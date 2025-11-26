import { Router, Response } from 'express';
import { store } from '../store';
import { apiKeyStore } from '../infra/apiKeyStore';
import { auditLogger } from '../infra/auditLogger';
import type { AuthedRequest } from '../middleware/auth';
import {
  CreateApiKeySchema,
  formatZodError,
  type CreateApiKeyInput,
} from '../validation/schemas';

const router = Router();

interface RevokeApiKeyParams {
  id: string;
  keyId: string;
}

router.post(
  '/institutions/:id/api-keys',
  async (req: AuthedRequest<{ id: string }, unknown, CreateApiKeyInput>, res: Response) => {
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

    // Validate request body with Zod
    const parseResult = CreateApiKeySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatZodError(parseResult.error),
      });
    }

    const { label, role } = parseResult.data;

    const created = await apiKeyStore.createKey({
      institutionId: id,
      label,
      role,
    });

    await auditLogger.record({
      action: 'API_KEY_CREATED',
      outcome: 'success',
      method: req.method,
      path: req.path,
      requestId: req.requestId,
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

router.post(
  '/institutions/:id/api-keys/:keyId/revoke',
  async (req: AuthedRequest<RevokeApiKeyParams>, res: Response) => {
    const { id, keyId } = req.params;
    const auth = req.auth;

    if (!auth) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const isRoot = auth.role === 'root';
    const isSameInstitution = auth.institutionId === id;
    const isAdmin = auth.role === 'admin';

    if (!isRoot && !(isSameInstitution && isAdmin)) {
      return res.status(403).json({ error: 'Forbidden to revoke API keys for this institution' });
    }

    const institution = await store.getInstitution(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    const revoked = await apiKeyStore.revokeKey({ id: keyId, institutionId: id });
    if (!revoked) {
      return res.status(404).json({ error: 'API key not found or already revoked' });
    }

    await auditLogger.record({
      action: 'API_KEY_REVOKED',
      outcome: 'success',
      method: req.method,
      path: req.path,
      requestId: req.requestId,
      resourceType: 'api_key',
      resourceId: revoked.id,
      payload: {
        institutionId: revoked.institutionId,
        label: revoked.label,
        role: revoked.role,
      },
      auth,
    });

    return res.status(200).json({
      id: revoked.id,
      institutionId: revoked.institutionId,
      label: revoked.label,
      role: revoked.role,
      createdAt: revoked.createdAt,
      revokedAt: revoked.revokedAt,
    });
  },
);

export const apiKeysRouter = router;

