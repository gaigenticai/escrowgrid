import { Router, Response } from 'express';
import { store, ConcurrencyConflictError } from '../store';
import { ApiErrorPayload } from '../domain/types';
import { applyTransition } from '../domain/lifecycle';
import { ledgerClient } from '../infra/ledgerClient';
import { auditLogger } from '../infra/auditLogger';
import { policyStore } from '../infra/policyStore';
import type { AuthedRequest } from '../middleware/auth';
import { requireWriteAccess } from '../middleware/auth';
import {
  CreatePositionSchema,
  TransitionPositionSchema,
  PaginationSchema,
  formatZodError,
  type CreatePositionInput,
  type TransitionPositionInput,
} from '../validation/schemas';

const router = Router();

router.post('/', async (req: AuthedRequest<unknown, unknown, CreatePositionInput>, res: Response) => {
  const auth = req.auth;

  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  try {
    requireWriteAccess(auth);
  } catch (err) {
    const status = (err as any).statusCode ?? 403;
    return res.status(status).json({ error: (err as Error).message });
  }

  // Validate request body with Zod
  const parseResult = CreatePositionSchema.safeParse(req.body);
  if (!parseResult.success) {
    const payload: ApiErrorPayload = {
      error: 'Validation failed',
      details: formatZodError(parseResult.error),
    };
    return res.status(400).json(payload);
  }

  const { institutionId, assetId, holderReference, currency, amount, externalReference } = parseResult.data;

  try {
    const effectiveInstitutionId =
      auth.role === 'root'
        ? institutionId
        : auth.institutionId;

    if (!effectiveInstitutionId) {
      const payload: ApiErrorPayload = {
        error: 'Invalid institution context',
        details: 'Institution must be specified or derived from API key',
      };
      return res.status(400).json(payload);
    }

    if (auth.role !== 'root' && institutionId && institutionId !== auth.institutionId) {
      const payload: ApiErrorPayload = {
        error: 'Forbidden',
        details: 'Cannot create positions for a different institution',
      };
      return res.status(403).json(payload);
    }

    // Enforce institution- and region-specific policy (if any)
    const asset = await store.getAsset(assetId);
    if (!asset || asset.institutionId !== effectiveInstitutionId) {
      const payload: ApiErrorPayload = {
        error: 'Asset not found for institution',
      };
      return res.status(400).json(payload);
    }
    const template = await store.getAssetTemplate(asset.templateId);
    if (!template) {
      const payload: ApiErrorPayload = {
        error: 'Asset template not found for asset',
      };
      return res.status(400).json(payload);
    }

    const policy = await policyStore.getPolicy(effectiveInstitutionId, template.region);
    if (policy) {
      const positionPolicy = policy.config.position;
      if (positionPolicy.minAmount !== undefined && amount < positionPolicy.minAmount) {
        const payload: ApiErrorPayload = {
          error: 'Amount below minimum for policy',
          details: `minAmount=${positionPolicy.minAmount}`,
        };
        return res.status(400).json(payload);
      }
      if (positionPolicy.maxAmount !== undefined && amount > positionPolicy.maxAmount) {
        const payload: ApiErrorPayload = {
          error: 'Amount above maximum for policy',
          details: `maxAmount=${positionPolicy.maxAmount}`,
        };
        return res.status(400).json(payload);
      }
      if (
        positionPolicy.allowedCurrencies &&
        !positionPolicy.allowedCurrencies.includes(currency)
      ) {
        const payload: ApiErrorPayload = {
          error: 'Currency not allowed by policy',
          details: { allowedCurrencies: positionPolicy.allowedCurrencies, currency },
        };
        return res.status(400).json(payload);
      }
    }

    const position = await store.createPosition({
      institutionId: effectiveInstitutionId,
      assetId,
      holderReference,
      currency,
      amount,
      externalReference,
    });
    await ledgerClient.recordPositionCreated(position, { requestId: req.requestId });
    await auditLogger.record({
      action: 'POSITION_CREATED',
      outcome: 'success',
      method: req.method,
      path: req.path,
      requestId: req.requestId,
      resourceType: 'position',
      resourceId: position.id,
      payload: {
        institutionId: effectiveInstitutionId,
        assetId,
        holderReference,
        currency,
        amount,
      },
      auth,
    });
    return res.status(201).json(position);
  } catch (err) {
    const payload: ApiErrorPayload = {
      error: 'Failed to create position',
      details: err instanceof Error ? err.message : String(err),
    };
    return res.status(400).json(payload);
  }
});

router.get(
  '/',
  async (
    req: AuthedRequest<
      unknown,
      unknown,
      unknown,
      { institutionId?: string; assetId?: string; holderReference?: string; limit?: string; offset?: string }
    >,
    res: Response,
  ) => {
    const { institutionId, assetId, holderReference, limit, offset } = req.query;
    const auth = req.auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    // Validate pagination parameters
    const paginationResult = PaginationSchema.safeParse({ limit, offset });
    if (!paginationResult.success) {
      return res.status(400).json({
        error: 'Invalid pagination parameters',
        details: formatZodError(paginationResult.error),
      });
    }
    const { limit: pageLimit, offset: pageOffset } = paginationResult.data;

    let effectiveInstitutionId: string | undefined;
    if (auth.role === 'root') {
      effectiveInstitutionId = institutionId;
    } else {
      effectiveInstitutionId = auth.institutionId;
      if (!effectiveInstitutionId) {
        return res.status(403).json({ error: 'No institution associated with API key' });
      }
    }

    const allPositions = await store.listPositions(
      effectiveInstitutionId === undefined && assetId === undefined && holderReference === undefined
        ? undefined
        : {
            institutionId: effectiveInstitutionId as string,
            assetId: assetId as string,
            holderReference: holderReference as string,
          },
    );

    // Apply pagination
    const paginatedPositions = allPositions.slice(pageOffset, pageOffset + pageLimit);

    // Return with pagination metadata
    return res.json({
      data: paginatedPositions,
      pagination: {
        total: allPositions.length,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: pageOffset + pageLimit < allPositions.length,
      },
    });
  },
);

router.get('/:id', async (req: AuthedRequest<{ id: string }>, res: Response) => {
  const auth = req.auth;
  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  const position = await store.getPosition(req.params.id);
  if (!position) {
    const payload: ApiErrorPayload = {
      error: 'Position not found',
    };
    return res.status(404).json(payload);
  }

  if (auth.role !== 'root' && auth.institutionId !== position.institutionId) {
    return res.status(403).json({ error: 'Forbidden to access this position' });
  }

  return res.json(position);
});

router.post(
  '/:id/transition',
  async (req: AuthedRequest<{ id: string }, unknown, TransitionPositionInput>, res: Response) => {
  const { id } = req.params;
  const auth = req.auth;

  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  try {
    requireWriteAccess(auth);
  } catch (err) {
    const status = (err as any).statusCode ?? 403;
    return res.status(status).json({ error: (err as Error).message });
  }

  // Validate request body with Zod
  const parseResult = TransitionPositionSchema.safeParse(req.body);
  if (!parseResult.success) {
    const payload: ApiErrorPayload = {
      error: 'Validation failed',
      details: formatZodError(parseResult.error),
    };
    return res.status(400).json(payload);
  }

  const { toState, reason, metadata } = parseResult.data;

  const existing = await store.getPosition(id);
  if (!existing) {
    const payload: ApiErrorPayload = {
      error: 'Position not found',
    };
    return res.status(404).json(payload);
  }

  if (auth.role !== 'root' && auth.institutionId !== existing.institutionId) {
    return res.status(403).json({ error: 'Forbidden to transition this position' });
  }

  try {
    const now = new Date().toISOString();
    const updated = applyTransition({
      position: existing,
      toState,
      reason,
      metadata,
      now,
    });
    const lifecycleEvent = updated.events[updated.events.length - 1];

    // Pass the expected (from) state to enable optimistic concurrency control.
    // This ensures that if another request modified the position concurrently,
    // we'll detect it and fail safely rather than corrupting state.
    await store.updatePosition(updated, lifecycleEvent, existing.state);

    if (lifecycleEvent) {
      await ledgerClient.recordPositionStateChanged(updated, lifecycleEvent, {
        requestId: req.requestId,
      });
    }
    await auditLogger.record({
      action: 'POSITION_TRANSITIONED',
      outcome: 'success',
      method: req.method,
      path: req.path,
      requestId: req.requestId,
      resourceType: 'position',
      resourceId: updated.id,
      payload: {
        fromState: lifecycleEvent?.fromState,
        toState: lifecycleEvent?.toState,
        reason,
      },
      auth,
    });
    return res.json(updated);
  } catch (err) {
    // Handle concurrency conflicts with a specific 409 status
    if (err instanceof ConcurrencyConflictError) {
      // Audit concurrency conflict - important for detecting race conditions
      await auditLogger.record({
        action: 'CONCURRENCY_CONFLICT',
        outcome: 'failure',
        method: req.method,
        path: req.path,
        requestId: req.requestId,
        auth,
        resourceType: 'position',
        resourceId: id,
        statusCode: 409,
        error: {
          code: 'CONCURRENCY_CONFLICT',
          message: `Expected state ${err.expectedState} but found ${err.actualState}`,
          details: { expectedState: err.expectedState, actualState: err.actualState },
        },
      });

      const payload: ApiErrorPayload = {
        error: 'Concurrent modification detected',
        details: `Position was modified by another request. Expected state: ${err.expectedState}, actual: ${err.actualState}. Please retry.`,
      };
      return res.status(409).json(payload);
    }

    const payload: ApiErrorPayload = {
      error: 'Failed to transition position',
      details: err instanceof Error ? err.message : String(err),
    };
    return res.status(400).json(payload);
  }
},
);

export const positionsRouter = router;

