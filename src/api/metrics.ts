import { Router, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { getRequestMetricsSnapshot } from '../infra/metrics';

const router = Router();

router.get('/', (req: AuthedRequest, res: Response) => {
  const auth = req.auth;
  if (!auth || auth.role !== 'root') {
    return res.status(403).json({ error: 'Forbidden: metrics are root-only' });
  }
  const snapshot = getRequestMetricsSnapshot();
  return res.json(snapshot);
});

export const metricsRouter = router;

