import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { apiKeyStore } from '../infra/apiKeyStore';
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

export async function authMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (
    req.path === '/health' ||
    req.path === '/ready' ||
    req.path === '/openapi.json' ||
    req.path === '/docs' ||
    req.path === '/docs/' ||
    req.path === '/docs/redoc' ||
    req.path.startsWith('/docs/')
  ) {
    return next();
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing API key' });
    return;
  }

  if (config.rootApiKey && token === config.rootApiKey) {
    req.auth = { role: 'root' };
    return next();
  }

  try {
    const record = await apiKeyStore.findByToken(token);
    if (!record) {
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

