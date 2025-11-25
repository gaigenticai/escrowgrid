import { Router, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { getRequestMetricsSnapshot } from '../infra/metrics';
import { config } from '../config';

const router = Router();

router.get('/', (req: AuthedRequest, res: Response) => {
  if (!config.metricsEnabled) {
    return res.status(404).json({ error: 'Metrics disabled by configuration' });
  }
  const auth = req.auth;
  if (!auth || auth.role !== 'root') {
    return res.status(403).json({ error: 'Forbidden: metrics are root-only' });
  }
  const snapshot = getRequestMetricsSnapshot();
  return res.json(snapshot);
});

router.get('/prometheus', (req: AuthedRequest, res: Response) => {
  if (!config.metricsEnabled) {
    return res.status(404).type('text/plain').send('# metrics disabled\n');
  }
  const auth = req.auth;
  if (!auth || auth.role !== 'root') {
    return res.status(403).json({ error: 'Forbidden: metrics are root-only' });
  }
  const snapshot = getRequestMetricsSnapshot();

  const lines: string[] = [];
  lines.push('# HELP taas_requests_total Total number of HTTP requests processed.');
  lines.push('# TYPE taas_requests_total counter');
  lines.push(`taas_requests_total ${snapshot.totalRequests}`);

  lines.push('# HELP taas_requests_errors_total Total number of 5xx HTTP responses.');
  lines.push('# TYPE taas_requests_errors_total counter');
  lines.push(`taas_requests_errors_total ${snapshot.totalErrors}`);

  lines.push('# HELP taas_requests_status_total Total number of HTTP responses by status code.');
  lines.push('# TYPE taas_requests_status_total counter');
  for (const [status, count] of Object.entries(snapshot.requestsByStatus)) {
    lines.push(`taas_requests_status_total{status="${status}"} ${count}`);
  }

  lines.push('# HELP taas_requests_method_total Total number of HTTP requests by method.');
  lines.push('# TYPE taas_requests_method_total counter');
  for (const [method, count] of Object.entries(snapshot.requestsByMethod)) {
    lines.push(`taas_requests_method_total{method="${method}"} ${count}`);
  }

  lines.push('# HELP taas_requests_duration_average_ms Rolling average request duration in milliseconds.');
  lines.push('# TYPE taas_requests_duration_average_ms gauge');
  lines.push(`taas_requests_duration_average_ms ${snapshot.averageDurationMs}`);

  res
    .type('text/plain; version=0.0.4; charset=utf-8')
    .send(lines.join('\n') + '\n');
});

export const metricsRouter = router;

