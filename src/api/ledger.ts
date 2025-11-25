import { Router, Response } from 'express';
import { ledgerClient } from '../infra/ledgerClient';
import { store } from '../store';
import type { AuthedRequest } from '../middleware/auth';

const router = Router();

router.get(
  '/',
  async (req: AuthedRequest<unknown, unknown, unknown, { positionId?: string }>, res: Response) => {
    const { positionId } = req.query;
    const auth = req.auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    if (!positionId) {
      if (auth.role !== 'root') {
        return res
          .status(400)
          .json({ error: 'positionId is required for non-root ledger queries' });
      }
      const events = await ledgerClient.listEvents(undefined);
      return res.json(events);
    }

    const position = await store.getPosition(positionId);
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    if (auth.role !== 'root' && auth.institutionId !== position.institutionId) {
      return res.status(403).json({ error: 'Forbidden to access ledger events for this position' });
    }

    const events = await ledgerClient.listEvents({ positionId });
    return res.json(events);
  },
);

export const ledgerRouter = router;

