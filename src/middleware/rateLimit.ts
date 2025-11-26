import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth';
import { config } from '../config';
import { auditLogger } from '../infra/auditLogger';

interface RateLimitEntry {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, RateLimitEntry>();

/**
 * Stricter rate limits for sensitive operations.
 * These limits are independent of the general rate limit.
 */
const SENSITIVE_OPERATION_LIMITS = {
  // API key creation: max 5 per hour per institution
  apiKeyCreation: {
    windowMs: 3600000, // 1 hour
    maxRequests: 5,
  },
  // Institution creation: max 10 per hour (root only, but still limit)
  institutionCreation: {
    windowMs: 3600000, // 1 hour
    maxRequests: 10,
  },
} as const;

// Separate buckets for sensitive operations
const sensitiveOperationBuckets = {
  apiKeyCreation: new Map<string, RateLimitEntry>(),
  institutionCreation: new Map<string, RateLimitEntry>(),
};

/**
 * Check if a sensitive operation is rate limited.
 * Returns { limited: false } if allowed, or { limited: true, retryAfterSeconds } if blocked.
 */
function checkSensitiveLimit(
  bucketName: keyof typeof sensitiveOperationBuckets,
  key: string,
): { limited: false } | { limited: true; retryAfterSeconds: number } {
  const bucket = sensitiveOperationBuckets[bucketName];
  const limits = SENSITIVE_OPERATION_LIMITS[bucketName];
  const now = Date.now();

  const entry = bucket.get(key);
  if (!entry || now - entry.windowStart >= limits.windowMs) {
    bucket.set(key, { windowStart: now, count: 1 });
    return { limited: false };
  }

  if (entry.count >= limits.maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + limits.windowMs - now) / 1000);
    return { limited: true, retryAfterSeconds };
  }

  entry.count += 1;
  bucket.set(key, entry);
  return { limited: false };
}

/**
 * Middleware for rate limiting sensitive operations like API key creation.
 * This is applied in addition to the general rate limit for extra protection.
 */
export async function sensitiveOperationRateLimitMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.auth;
  if (!auth) {
    next();
    return;
  }

  // Check for API key creation endpoint
  if (req.method === 'POST' && req.path.match(/^\/institutions\/[^/]+\/api-keys$/)) {
    const institutionId = req.params.id || req.path.split('/')[2];
    const key = `inst:${institutionId}`;
    const limits = SENSITIVE_OPERATION_LIMITS.apiKeyCreation;

    const result = checkSensitiveLimit('apiKeyCreation', key);
    if (result.limited) {
      await auditLogger.record({
        action: 'RATE_LIMITED',
        outcome: 'failure',
        method: req.method,
        path: req.path,
        requestId: req.requestId,
        auth,
        statusCode: 429,
        error: {
          code: 'SENSITIVE_OPERATION_RATE_LIMITED',
          message: `API key creation rate limit of ${limits.maxRequests} per ${limits.windowMs / 60000} minutes exceeded`,
          details: {
            operation: 'apiKeyCreation',
            institutionId,
            windowMinutes: limits.windowMs / 60000,
            maxRequests: limits.maxRequests,
            retryAfterSeconds: result.retryAfterSeconds,
          },
        },
      });

      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      res.status(429).json({
        error: 'Rate limit exceeded for API key creation',
        details: {
          maxKeys: limits.maxRequests,
          windowMinutes: limits.windowMs / 60000,
          retryAfterSeconds: result.retryAfterSeconds,
        },
      });
      return;
    }
  }

  // Check for institution creation endpoint
  if (req.method === 'POST' && req.path === '/institutions') {
    const key = auth.role === 'root' ? 'root' : `apikey:${auth.apiKeyId ?? 'unknown'}`;
    const limits = SENSITIVE_OPERATION_LIMITS.institutionCreation;

    const result = checkSensitiveLimit('institutionCreation', key);
    if (result.limited) {
      await auditLogger.record({
        action: 'RATE_LIMITED',
        outcome: 'failure',
        method: req.method,
        path: req.path,
        requestId: req.requestId,
        auth,
        statusCode: 429,
        error: {
          code: 'SENSITIVE_OPERATION_RATE_LIMITED',
          message: `Institution creation rate limit of ${limits.maxRequests} per ${limits.windowMs / 60000} minutes exceeded`,
          details: {
            operation: 'institutionCreation',
            windowMinutes: limits.windowMs / 60000,
            maxRequests: limits.maxRequests,
            retryAfterSeconds: result.retryAfterSeconds,
          },
        },
      });

      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      res.status(429).json({
        error: 'Rate limit exceeded for institution creation',
        details: {
          maxInstitutions: limits.maxRequests,
          windowMinutes: limits.windowMs / 60000,
          retryAfterSeconds: result.retryAfterSeconds,
        },
      });
      return;
    }
  }

  next();
}

export async function rateLimitMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

    // Audit rate limit hit - important for detecting abuse
    await auditLogger.record({
      action: 'RATE_LIMITED',
      outcome: 'failure',
      method: req.method,
      path: req.path,
      requestId: req.requestId,
      auth,
      statusCode: 429,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit of ${maxRequests} requests per ${windowMs}ms exceeded`,
        details: { windowMs, maxRequests, retryAfterSeconds },
      },
    });

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

