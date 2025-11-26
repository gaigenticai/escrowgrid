import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { apiKeyStore } from '../infra/apiKeyStore';
import { auditLogger } from '../infra/auditLogger';
import type { ApiKeyRole } from '../domain/types';

export type AuthRole = 'root' | ApiKeyRole;

export interface AuthContext {
  role: AuthRole;
  institutionId?: string;
  apiKeyId?: string;
}

export interface AuthedRequest<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any,
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  auth?: AuthContext;
  requestId?: string;
}

function extractToken(req: Request): string | undefined {
  const header = req.header('x-api-key');
  if (header) {
    return header.trim();
  }
  const authHeader = req.header('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

/**
 * Get client IP from request, handling proxies
 */
function getClientIp(req: Request): string {
  const forwarded = req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export async function authMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (
    req.path === '/health' ||
    req.path === '/ready' ||
    // Documentation endpoints may be configured as public via PUBLIC_DOCS_ENABLED.
    // If not enabled, they require authentication like any other endpoint.
    (config.publicDocsEnabled &&
      (req.path === '/openapi.json' ||
        req.path === '/docs' ||
        req.path === '/docs/' ||
        req.path === '/docs/redoc' ||
        req.path.startsWith('/docs/')))
  ) {
    return next();
  }

  const clientIp = getClientIp(req);
  const token = extractToken(req);

  if (!token) {
    // Audit failed auth attempt - missing credentials
    await auditLogger.record({
      action: 'AUTH_FAILED',
      outcome: 'failure',
      method: req.method,
      path: req.path,
      requestId: req.requestId,
      statusCode: 401,
      clientIp,
      error: {
        code: 'MISSING_API_KEY',
        message: 'No API key provided in request',
      },
    });
    res.status(401).json({ error: 'Missing API key' });
    return;
  }

  if (config.rootApiKey && token === config.rootApiKey) {
    // Check IP allowlist for root API key if configured
    if (config.rootApiKeyAllowedIps && config.rootApiKeyAllowedIps.length > 0) {
      const isAllowedIp = config.rootApiKeyAllowedIps.some((allowedIp) => {
        // Handle IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
        if (clientIp.startsWith('::ffff:')) {
          const ipv4Part = clientIp.slice(7);
          return allowedIp === ipv4Part || allowedIp === clientIp;
        }
        return allowedIp === clientIp;
      });

      if (!isAllowedIp) {
        // Log security alert for root key usage from unauthorized IP
        console.error(
          JSON.stringify({
            type: 'security_alert',
            severity: 'critical',
            event: 'ROOT_KEY_UNAUTHORIZED_IP',
            clientIp,
            allowedIps: config.rootApiKeyAllowedIps,
            path: req.path,
            method: req.method,
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
          }),
        );

        await auditLogger.record({
          action: 'AUTH_FORBIDDEN',
          outcome: 'failure',
          method: req.method,
          path: req.path,
          requestId: req.requestId,
          statusCode: 403,
          clientIp,
          error: {
            code: 'ROOT_KEY_IP_NOT_ALLOWED',
            message: 'Root API key used from unauthorized IP address',
            details: { clientIp },
          },
        });

        res.status(403).json({
          error: 'Forbidden',
          details: 'Root API key cannot be used from this IP address',
        });
        return;
      }
    }

    req.auth = { role: 'root' };
    return next();
  }

  try {
    const record = await apiKeyStore.findByToken(token);
    if (!record) {
      // Audit failed auth attempt - invalid key (potential attack)
      await auditLogger.record({
        action: 'AUTH_FAILED',
        outcome: 'failure',
        method: req.method,
        path: req.path,
        requestId: req.requestId,
        statusCode: 401,
        clientIp,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API key not found or revoked',
        },
      });
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.auth = {
      role: record.role,
      institutionId: record.institutionId,
      apiKeyId: record.id,
    };
    return next();
  } catch (err) {
    // Audit auth system error
    await auditLogger.record({
      action: 'AUTH_FAILED',
      outcome: 'failure',
      method: req.method,
      path: req.path,
      requestId: req.requestId,
      statusCode: 500,
      clientIp,
      error: {
        code: 'AUTH_ERROR',
        message: err instanceof Error ? err.message : String(err),
      },
    });
    res.status(500).json({
      error: 'Authentication failed',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

export function requireWriteAccess(auth?: AuthContext): void {
  if (!auth) {
    throw new Error('Missing auth context');
  }
  if (auth.role === 'read_only') {
    const err = new Error('Write access forbidden for read_only API key');
    (err as any).statusCode = 403;
    throw err;
  }
}

