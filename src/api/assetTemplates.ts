import { Router, Response } from 'express';
import { store } from '../store';
import { ApiErrorPayload, Region, Vertical } from '../domain/types';
import { auditLogger } from '../infra/auditLogger';
import type { AuthedRequest } from '../middleware/auth';
import { requireWriteAccess } from '../middleware/auth';

const router = Router();

interface CreateAssetTemplateBody {
  institutionId?: string;
  code?: string;
  name?: string;
  vertical?: Vertical;
  region?: Region;
  config?: Record<string, unknown>;
}

router.post('/', async (req: AuthedRequest<unknown, unknown, CreateAssetTemplateBody>, res: Response) => {
  const { institutionId, code, name, vertical, region, config } = req.body;
  const authReq = req as AuthedRequest;
  const auth = authReq.auth;

  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  try {
    requireWriteAccess(auth);
  } catch (err) {
    const status = (err as any).statusCode ?? 403;
    return res.status(status).json({ error: (err as Error).message });
  }

  if (!code || !name || !vertical || !region) {
    const payload: ApiErrorPayload = {
      error: 'Invalid request body',
      details: 'code, name, vertical, and region are required',
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
        details: 'Cannot create templates for a different institution',
      };
      return res.status(403).json(payload);
    }

    const template = await store.createAssetTemplate({
      institutionId: effectiveInstitutionId,
      code,
      name,
      vertical,
      region,
      config: config ?? {},
    });

    await auditLogger.record({
      action: 'ASSET_TEMPLATE_CREATED',
      method: req.method,
      path: req.path,
      resourceType: 'asset_template',
      resourceId: template.id,
      payload: {
        institutionId: effectiveInstitutionId,
        code,
        name,
        vertical,
        region,
      },
      auth,
    });
    return res.status(201).json(template);
  } catch (err) {
    const payload: ApiErrorPayload = {
      error: 'Failed to create asset template',
      details: err instanceof Error ? err.message : String(err),
    };
    return res.status(400).json(payload);
  }
});

router.get(
  '/',
  async (req: AuthedRequest<unknown, unknown, unknown, { institutionId?: string }>, res: Response) => {
    const { institutionId } = req.query;
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

    const templates = await store.listAssetTemplates(
      effectiveInstitutionId ? { institutionId: effectiveInstitutionId } : undefined,
    );
    return res.json(templates);
  },
);

router.get('/:id', async (req: AuthedRequest<{ id: string }>, res: Response) => {
  const auth = req.auth;
  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  const template = await store.getAssetTemplate(req.params.id);
  if (!template) {
    const payload: ApiErrorPayload = {
      error: 'Asset template not found',
    };
    return res.status(404).json(payload);
  }

  if (auth.role !== 'root' && auth.institutionId !== template.institutionId) {
    return res.status(403).json({ error: 'Forbidden to access this asset template' });
  }

  return res.json(template);
});

export const assetTemplatesRouter = router;

