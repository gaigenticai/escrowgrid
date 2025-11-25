import { Router, Response } from 'express';
import { store } from '../store';
import { ApiErrorPayload, Region, Vertical } from '../domain/types';
import { auditLogger } from '../infra/auditLogger';
import type { AuthedRequest } from '../middleware/auth';

const router = Router();

router.post(
  '/',
  async (
    req: AuthedRequest<
      unknown,
      unknown,
      { name?: string; regions?: Region[]; verticals?: Vertical[] | undefined }
    >,
    res: Response,
  ) => {
    const { name, regions, verticals } = req.body;
    const auth = req.auth;

    if (!auth || auth.role !== 'root') {
      const payload: ApiErrorPayload = {
        error: 'Forbidden',
        details: 'Only root can create institutions',
      };
      return res.status(403).json(payload);
    }

    if (!name || !regions || !Array.isArray(regions) || regions.length === 0) {
      const payload: ApiErrorPayload = {
        error: 'Invalid request body',
        details: 'name and regions are required',
      };
      return res.status(400).json(payload);
    }

    try {
      const institution = await store.createInstitution({
        name,
        regions,
        verticals: verticals ?? undefined,
      });

      await auditLogger.record({
        action: 'INSTITUTION_CREATED',
        method: req.method,
        path: req.path,
        resourceType: 'institution',
        resourceId: institution.id,
        payload: {
          name,
          regions,
          verticals: verticals ?? undefined,
        },
        auth,
      });

      return res.status(201).json(institution);
    } catch (err) {
      const payload: ApiErrorPayload = {
        error: 'Failed to create institution',
        details: err instanceof Error ? err.message : String(err),
      };
      return res.status(500).json(payload);
    }
  },
);

router.get('/', async (req: AuthedRequest, res: Response) => {
  const auth = req.auth;
  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  if (auth.role === 'root') {
    const institutions = await store.listInstitutions();
    return res.json(institutions);
  }

  if (!auth.institutionId) {
    return res.status(403).json({ error: 'No institution associated with API key' });
  }

  const inst = await store.getInstitution(auth.institutionId);
  if (!inst) {
    return res.status(404).json({ error: 'Institution not found' });
  }
  return res.json([inst]);
});

router.get('/:id', async (req: AuthedRequest<{ id: string }>, res: Response) => {
  const auth = req.auth;
  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  const { id } = req.params;

  if (auth.role !== 'root' && auth.institutionId !== id) {
    return res.status(403).json({ error: 'Forbidden to access this institution' });
  }

  const institution = await store.getInstitution(id);
  if (!institution) {
    const payload: ApiErrorPayload = {
      error: 'Institution not found',
    };
    return res.status(404).json(payload);
  }
  return res.json(institution);
});

export const institutionsRouter = router;

