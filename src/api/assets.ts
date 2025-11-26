import { Router, Response } from 'express';
import { store } from '../store';
import { ApiErrorPayload } from '../domain/types';
import { auditLogger } from '../infra/auditLogger';
import type { AuthedRequest } from '../middleware/auth';
import { requireWriteAccess } from '../middleware/auth';
import {
  CreateAssetSchema,
  PaginationSchema,
  formatZodError,
  type CreateAssetInput,
} from '../validation/schemas';

const router = Router();

router.post('/', async (req: AuthedRequest<unknown, unknown, CreateAssetInput>, res: Response) => {
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
  const parseResult = CreateAssetSchema.safeParse(req.body);
  if (!parseResult.success) {
    const payload: ApiErrorPayload = {
      error: 'Validation failed',
      details: formatZodError(parseResult.error),
    };
    return res.status(400).json(payload);
  }

  const { institutionId, templateId, label, metadata } = parseResult.data;

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
        details: 'Cannot create assets for a different institution',
      };
      return res.status(403).json(payload);
    }

    const asset = await store.createAsset({
      institutionId: effectiveInstitutionId,
      templateId,
      label,
      metadata: metadata ?? {},
    });
    await auditLogger.record({
      action: 'ASSET_CREATED',
      outcome: 'success',
      method: req.method,
      path: req.path,
      requestId: req.requestId,
      resourceType: 'asset',
      resourceId: asset.id,
      payload: {
        institutionId: effectiveInstitutionId,
        templateId,
        label,
      },
      auth,
    });
    return res.status(201).json(asset);
  } catch (err) {
    const payload: ApiErrorPayload = {
      error: 'Failed to create asset',
      details: err instanceof Error ? err.message : String(err),
    };
    return res.status(400).json(payload);
  }
});

router.get(
  '/',
  async (
    req: AuthedRequest<unknown, unknown, unknown, { institutionId?: string; templateId?: string; limit?: string; offset?: string }>,
    res: Response,
  ) => {
    const { institutionId, templateId, limit, offset } = req.query;
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

    const allAssets = await store.listAssets(
      effectiveInstitutionId === undefined && templateId === undefined
        ? undefined
        : {
            institutionId: effectiveInstitutionId as string,
            templateId: templateId as string,
          },
    );

    // Apply pagination
    const paginatedAssets = allAssets.slice(pageOffset, pageOffset + pageLimit);

    return res.json({
      data: paginatedAssets,
      pagination: {
        total: allAssets.length,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: pageOffset + pageLimit < allAssets.length,
      },
    });
  },
);

router.get('/:id', async (req: AuthedRequest<{ id: string }>, res: Response) => {
  const auth = req.auth;
  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  const asset = await store.getAsset(req.params.id);
  if (!asset) {
    const payload: ApiErrorPayload = {
      error: 'Asset not found',
    };
    return res.status(404).json(payload);
  }

  if (auth.role !== 'root' && auth.institutionId !== asset.institutionId) {
    return res.status(403).json({ error: 'Forbidden to access this asset' });
  }

  return res.json(asset);
});

export const assetsRouter = router;

