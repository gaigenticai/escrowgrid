import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth';
import { config } from '../config';

interface RateLimitEntry {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, RateLimitEntry>();

export function rateLimitMiddleware(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!config.rateLimitEnabled) {
    next();
    return;
  }

  // Do not rate-limit health/readiness
  if (req.path === '/health' || req.path === '/ready') {
    next();
    return;
  }

  const auth = req.auth;
  if (!auth) {
    // Should not happen for protected routes, but be safe and skip limiting
    next();
    return;
  }

  // Optionally exempt root from rate limiting
  if (auth.role === 'root') {
    next();
    return;
  }

  const key = auth.apiKeyId ?? `inst:${auth.institutionId ?? 'unknown'}`;
  const now = Date.now();
  const windowMs = config.rateLimitWindowMs;
  const maxRequests = config.rateLimitMaxRequests;

  const entry = buckets.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    next();
    return;
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Rate limit exceeded',
      details: {
        windowMs,
        maxRequests,
      },
    });
    return;
  }

  entry.count += 1;
  buckets.set(key, entry);
  next();
}

