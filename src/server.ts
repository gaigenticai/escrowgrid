import express, { Request, Response } from 'express';
import cors from 'cors';
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
import { requestLogger } from './middleware/requestLogger';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { checkReadiness } from './infra/health';
import { openApiSpec } from './openapi';

const app = express();
app.use(cors());
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(
      `TAAS platform API listening on port ${PORT} using ${config.storeBackend} store`,
    );
  });
}

export { app };
