import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth';

function generateRequestId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${crypto.randomBytes(16).toString('hex')}`;
}

export function requestIdMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header =
    req.header('x-request-id') ??
    req.header('x-correlation-id') ??
    undefined;
  const requestId = header && header.trim().length > 0 ? header.trim() : generateRequestId();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}


