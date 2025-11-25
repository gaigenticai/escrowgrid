import { Router, Response } from 'express';
import { store } from '../store';
import { ApiErrorPayload, PositionState } from '../domain/types';
import { applyTransition } from '../domain/lifecycle';
import { ledgerClient } from '../infra/ledgerClient';
import { auditLogger } from '../infra/auditLogger';
import { policyStore } from '../infra/policyStore';
import type { AuthedRequest } from '../middleware/auth';
import { requireWriteAccess } from '../middleware/auth';

const router = Router();

interface CreatePositionBody {
  institutionId?: string;
  assetId?: string;
  holderReference?: string;
  currency?: string;
  amount?: number;
  externalReference?: string;
}

router.post('/', async (req: AuthedRequest<unknown, unknown, CreatePositionBody>, res: Response) => {
  const { institutionId, assetId, holderReference, currency, amount, externalReference } = req.body;
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

  if (!assetId || !holderReference || !currency || typeof amount !== 'number') {
    const payload: ApiErrorPayload = {
      error: 'Invalid request body',
      details: 'assetId, holderReference, currency, and numeric amount are required',
    };
    return res.status(400).json(payload);
  }

  if (amount <= 0) {
    const payload: ApiErrorPayload = {
      error: 'Invalid amount',
      details: 'amount must be greater than zero',
    };
    return res.status(400).json(payload);
  }

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
      { institutionId?: string; assetId?: string; holderReference?: string }
    >,
    res: Response,
  ) => {
    const { institutionId, assetId, holderReference } = req.query;
    const auth = req.auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    let effectiveInstitutionId: string | undefined;
    if (auth.role === 'root') {
      effectiveInstitutionId = institutionId;
    } else {
      effectiveInstitutionId = auth.institutionId;
      if (!effectiveInstitutionId) {
        return res.status(403).json({ error: 'No institution associated with API key' });
      }
    }

    const positions = await store.listPositions(
      effectiveInstitutionId === undefined && assetId === undefined && holderReference === undefined
        ? undefined
        : {
            institutionId: effectiveInstitutionId as string,
            assetId: assetId as string,
            holderReference: holderReference as string,
          },
    );
    return res.json(positions);
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

interface TransitionBody {
  toState?: PositionState;
  reason?: string;
  metadata?: Record<string, unknown>;
}

router.post(
  '/:id/transition',
  async (req: AuthedRequest<{ id: string }, unknown, TransitionBody>, res: Response) => {
  const { id } = req.params;
  const { toState, reason, metadata } = req.body;
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

  if (!toState) {
    const payload: ApiErrorPayload = {
      error: 'Invalid request body',
      details: 'toState is required',
    };
    return res.status(400).json(payload);
  }

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
    await store.updatePosition(updated, lifecycleEvent);
    if (lifecycleEvent) {
      await ledgerClient.recordPositionStateChanged(updated, lifecycleEvent, {
        requestId: req.requestId,
      });
    }
    await auditLogger.record({
      action: 'POSITION_TRANSITIONED',
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
    const payload: ApiErrorPayload = {
      error: 'Failed to transition position',
      details: err instanceof Error ? err.message : String(err),
    };
    return res.status(400).json(payload);
  }
},
);

export const positionsRouter = router;

