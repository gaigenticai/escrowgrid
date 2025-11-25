import { Router, Response } from 'express';
import { store } from '../store';
import { policyStore } from '../infra/policyStore';
import type { AuthedRequest } from '../middleware/auth';
import type { Region } from '../domain/types';

const router = Router();

const REGIONS: Region[] = ['US', 'EU_UK', 'SG', 'UAE'];

function isRegion(value: string): value is Region {
  return REGIONS.includes(value as Region);
}

interface UpsertPolicyBody {
  position?: {
    minAmount?: number;
    maxAmount?: number;
    allowedCurrencies?: string[];
  };
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
  async (req: AuthedRequest<{ id: string; region: string }, unknown, UpsertPolicyBody>, res: Response) => {
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

    const body = req.body;
    const positionConfig = body.position ?? {};

    if (
      positionConfig.minAmount !== undefined &&
      typeof positionConfig.minAmount !== 'number'
    ) {
      return res.status(400).json({ error: 'position.minAmount must be a number when provided' });
    }
    if (
      positionConfig.maxAmount !== undefined &&
      typeof positionConfig.maxAmount !== 'number'
    ) {
      return res.status(400).json({ error: 'position.maxAmount must be a number when provided' });
    }
    if (
      positionConfig.allowedCurrencies !== undefined &&
      !Array.isArray(positionConfig.allowedCurrencies)
    ) {
      return res
        .status(400)
        .json({ error: 'position.allowedCurrencies must be an array of strings when provided' });
    }

    const config = {
      region,
      position: {
        minAmount: positionConfig.minAmount,
        maxAmount: positionConfig.maxAmount,
        allowedCurrencies: positionConfig.allowedCurrencies,
      },
    };

    const policy = await policyStore.upsertPolicy({
      institutionId: id,
      region,
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

