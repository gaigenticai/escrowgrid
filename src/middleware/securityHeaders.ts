import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth';
import { config } from '../config';

type HelmetMiddleware = (req: AuthedRequest, res: Response, next: NextFunction) => void;

let helmetMiddleware: HelmetMiddleware | undefined;

if (config.helmetEnabled) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const helmet = require('helmet') as (options?: Record<string, unknown>) => HelmetMiddleware;
    // Disable CSP/COEP by default so that docs and proxies can manage them.
    helmetMiddleware = helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    });
  } catch (err) {
    // If helmet is not installed, fall back to the built-in headers and log once.
    console.error(
      JSON.stringify({
        type: 'helmet_init_error',
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    helmetMiddleware = undefined;
  }
}

export function applySecurityHeaders(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (helmetMiddleware) {
    return helmetMiddleware(req, res, next);
  }

  // Basic hardening headers; HSTS and CSP are typically managed at the edge (reverse proxy / CDN).
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  next();
}


