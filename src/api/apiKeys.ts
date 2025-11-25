import { Router, Response } from 'express';
import { store } from '../store';
import { apiKeyStore } from '../infra/apiKeyStore';
import { auditLogger } from '../infra/auditLogger';
import type { ApiKeyRole } from '../domain/types';
import type { AuthedRequest } from '../middleware/auth';

const router = Router();

interface CreateApiKeyBody {
  label?: string;
  role?: ApiKeyRole;
}

router.post(
  '/institutions/:id/api-keys',
  async (req: AuthedRequest<{ id: string }, unknown, CreateApiKeyBody>, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;

    if (!auth) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const isRoot = auth.role === 'root';
    const isSameInstitution = auth.institutionId === id;
    const isAdmin = auth.role === 'admin';

    if (!isRoot && !(isSameInstitution && isAdmin)) {
      return res.status(403).json({ error: 'Forbidden to create API keys for this institution' });
    }

    const institution = await store.getInstitution(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    const label = req.body.label ?? 'default';
    const role: ApiKeyRole = req.body.role ?? 'admin';

    const created = await apiKeyStore.createKey({
      institutionId: id,
      label,
      role,
    });

    await auditLogger.record({
      action: 'API_KEY_CREATED',
      method: req.method,
      path: req.path,
      resourceType: 'api_key',
      resourceId: created.record.id,
      payload: {
        institutionId: id,
        label,
        role,
      },
      auth,
    });

    return res.status(201).json({
      id: created.record.id,
      institutionId: created.record.institutionId,
      label: created.record.label,
      role: created.record.role,
      createdAt: created.record.createdAt,
      apiKey: created.token,
    });
  },
);

router.get(
  '/institutions/:id/api-keys',
  async (req: AuthedRequest<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;

    if (!auth) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const isRoot = auth.role === 'root';
    const isSameInstitution = auth.institutionId === id;
    const isAdmin = auth.role === 'admin';

    if (!isRoot && !(isSameInstitution && isAdmin)) {
      return res.status(403).json({ error: 'Forbidden to list API keys for this institution' });
    }

    const institution = await store.getInstitution(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    const keys = await apiKeyStore.listByInstitution(id);
    const sanitized = keys.map((k) => ({
      id: k.id,
      institutionId: k.institutionId,
      label: k.label,
      role: k.role,
      createdAt: k.createdAt,
      revokedAt: k.revokedAt ?? undefined,
    }));
    return res.json(sanitized);
  },
);

export const apiKeysRouter = router;

