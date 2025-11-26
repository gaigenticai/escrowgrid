import { Router, Response } from 'express';
import { store } from '../store';
import { policyStore } from '../infra/policyStore';
import type { AuthedRequest } from '../middleware/auth';
import {
  RegionSchema,
  UpsertPolicySchema,
  formatZodError,
  type Region,
  type UpsertPolicyInput,
} from '../validation/schemas';

const router = Router();

function isRegion(value: string): value is Region {
  return RegionSchema.safeParse(value).success;
}

router.get(
  '/institutions/:id/policies',
  async (req: AuthedRequest<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;

    if (!auth) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const isRoot = auth.role === 'root';
    const isSameInstitution = auth.institutionId === id;

    if (!isRoot && !isSameInstitution) {
      return res.status(403).json({ error: 'Forbidden to access policies for this institution' });
    }

    const institution = await store.getInstitution(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    const policies = await policyStore.listPolicies(id);
    return res.json(
      policies.map((p) => ({
        id: p.id,
        institutionId: p.institutionId,
        region: p.region,
        config: p.config,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    );
  },
);

router.get(
  '/institutions/:id/policies/:region',
  async (req: AuthedRequest<{ id: string; region: string }>, res: Response) => {
    const { id, region } = req.params;
    const auth = req.auth;

    if (!auth) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const isRoot = auth.role === 'root';
    const isSameInstitution = auth.institutionId === id;

    if (!isRoot && !isSameInstitution) {
      return res.status(403).json({ error: 'Forbidden to access policies for this institution' });
    }

    if (!isRegion(region)) {
      return res.status(400).json({ error: 'Invalid region' });
    }

    const institution = await store.getInstitution(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    const policy = await policyStore.getPolicy(id, region);
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    return res.json({
      id: policy.id,
      institutionId: policy.institutionId,
      region: policy.region,
      config: policy.config,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    });
  },
);

router.put(
  '/institutions/:id/policies/:region',
  async (req: AuthedRequest<{ id: string; region: string }, unknown, UpsertPolicyInput>, res: Response) => {
    const { id, region } = req.params;
    const auth = req.auth;

    if (!auth) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const isRoot = auth.role === 'root';
    const isSameInstitution = auth.institutionId === id;
    const isAdmin = auth.role === 'admin';

    if (!isRoot && !(isSameInstitution && isAdmin)) {
      return res.status(403).json({ error: 'Forbidden to modify policies for this institution' });
    }

    if (!isRegion(region)) {
      return res.status(400).json({ error: 'Invalid region' });
    }

    const institution = await store.getInstitution(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    // Validate request body with Zod (includes minAmount <= maxAmount check)
    const parseResult = UpsertPolicySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatZodError(parseResult.error),
      });
    }

    const config = {
      region,
      position: parseResult.data.position,
    };

    const policy = await policyStore.upsertPolicy({
      institutionId: id,
      region: region as Region,
      config,
    });

    return res.status(200).json({
      id: policy.id,
      institutionId: policy.institutionId,
      region: policy.region,
      config: policy.config,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    });
  },
);

export const policiesRouter = router;

