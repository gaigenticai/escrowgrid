import express, { Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import type { Server } from 'http';
import swaggerUi from 'swagger-ui-express';
import { institutionsRouter } from './api/institutions';
import { assetTemplatesRouter } from './api/assetTemplates';
import { assetsRouter } from './api/assets';
import { positionsRouter } from './api/positions';
import { ledgerRouter } from './api/ledger';
import { apiKeysRouter } from './api/apiKeys';
import { policiesRouter } from './api/policies';
import { metricsRouter } from './api/metrics';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { checkReadiness } from './infra/health';
import { openApiSpec } from './openapi';
import { applySecurityHeaders } from './middleware/securityHeaders';
import { shutdownAllPools } from './infra/db';

const app = express();

// CORS configuration:
// - In production, configure CORS_ALLOWED_ORIGINS as a comma-separated list of origins.
// - If unset, CORS is disabled (no CORS headers), which is safest when an API gateway terminates requests.
// - In local development (NODE_ENV !== 'production'), fall back to allowing localhost origins for convenience.
let corsOptions: CorsOptions | undefined;
if (config.corsAllowedOrigins && config.corsAllowedOrigins.trim().length > 0) {
  const origins = config.corsAllowedOrigins
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  corsOptions = {
    origin: origins,
  };
} else if (process.env.NODE_ENV !== 'production') {
  corsOptions = {
    origin: [
      'http://localhost:3000',
      'http://localhost:4000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8080',
    ],
  };
}

if (corsOptions) {
  app.use(cors(corsOptions));
}
app.use(requestIdMiddleware);
app.use(applySecurityHeaders);
app.use(express.json());
app.use(authMiddleware);
app.use(requestLogger);
app.use(rateLimitMiddleware);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'taas-platform', storeBackend: config.storeBackend });
});

// Readiness check
app.get('/ready', async (_req: Request, res: Response) => {
  const status = await checkReadiness();
  if (!status.ok) {
    return res.status(503).json(status);
  }
  return res.json(status);
});

// OpenAPI specification and interactive API docs
app.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'EscrowGrid API Explorer',
    swaggerOptions: {
      docExpansion: 'none'
    }
  }),
);

app.get('/docs/redoc', (_req: Request, res: Response) => {
  res.type('html').send(`<!doctype html>
<html>
  <head>
    <title>EscrowGrid API Reference</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { margin: 0; padding: 0; }
      body, html { height: 100%; }
      #redoc-container { height: 100vh; }
    </style>
  </head>
  <body>
    <div id="redoc-container"></div>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script>
      Redoc.init('/openapi.json', { scrollYOffset: 60 }, document.getElementById('redoc-container'));
    </script>
  </body>
</html>`);
});

// Core TAAS resources
app.use('/institutions', institutionsRouter);
app.use('/asset-templates', assetTemplatesRouter);
app.use('/assets', assetsRouter);
app.use('/positions', positionsRouter);
app.use('/ledger-events', ledgerRouter);
app.use('/metrics', metricsRouter);
app.use('/', apiKeysRouter);
app.use('/', policiesRouter);

const PORT = config.port;
let server: Server | undefined;

if (process.env.NODE_ENV !== 'test') {
  const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  let shuttingDown = false;

  server = app.listen(PORT, () => {
    console.log(
      JSON.stringify({
        type: 'startup',
        message: `TAAS platform API listening on port ${PORT} using ${config.storeBackend} store`,
        port: PORT,
        storeBackend: config.storeBackend,
      }),
    );
  });

  const handleShutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(
      JSON.stringify({
        type: 'shutdown_start',
        signal,
      }),
    );
    if (!server) {
      shutdownAllPools()
        .then(() => {
          console.log(JSON.stringify({ type: 'shutdown_complete' }));
          process.exit(0);
        })
        .catch((err) => {
          console.error(
            JSON.stringify({
              type: 'shutdown_error',
              error: err instanceof Error ? err.message : String(err),
            }),
          );
          process.exit(1);
        });
      return;
    }
    server.close(() => {
      shutdownAllPools()
        .then(() => {
          console.log(JSON.stringify({ type: 'shutdown_complete' }));
          process.exit(0);
        })
        .catch((err) => {
          console.error(
            JSON.stringify({
              type: 'shutdown_error',
              error: err instanceof Error ? err.message : String(err),
            }),
          );
          process.exit(1);
        });
    });
  };

  shutdownSignals.forEach((sig) => {
    process.on(sig, handleShutdown);
  });
}

export { app, server };
