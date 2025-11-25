import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth';
import { recordRequestMetric } from '../infra/metrics';

export function requestLogger(req: AuthedRequest, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  const { method, path } = req;

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = durationNs / 1e6;
    const auth = req.auth;
    const logPayload = {
      type: 'request',
      method,
      path,
      status: res.statusCode,
      durationMs,
      apiKeyId: auth?.apiKeyId ?? null,
      institutionId: auth?.institutionId ?? null,
    };
    console.log(JSON.stringify(logPayload));
    recordRequestMetric(method, res.statusCode, durationMs);
  });

  next();
}

