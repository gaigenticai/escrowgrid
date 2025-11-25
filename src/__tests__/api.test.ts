import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';

let app: import('express').Express;
let rootKey = 'test-root-key';
let instApiKey: string;
let institutionId: string;
let templateId: string;
let assetId: string;
let positionId: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.STORE_BACKEND = 'memory';
  process.env.ROOT_API_KEY = rootKey;
   process.env.RATE_LIMIT_ENABLED = 'true';
   process.env.RATE_LIMIT_WINDOW_MS = '60000';
   process.env.RATE_LIMIT_MAX_REQUESTS = '20';

  const mod = await import('../server');
  app = mod.app;
});

describe('TAAS API integration (in-memory backend)', () => {
  it('responds to health without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('creates an institution with root key', async () => {
    const res = await request(app)
      .post('/institutions')
      .set('X-API-KEY', rootKey)
      .send({
        name: 'Test Bank',
        regions: ['EU_UK'],
        verticals: ['CONSTRUCTION', 'TRADE_FINANCE'],
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test Bank');
    institutionId = res.body.id;
  });

  it('rejects unauthenticated and invalid API key requests', async () => {
    const unauthRes = await request(app).get('/institutions');
    expect(unauthRes.status).toBe(401);

    const invalidKeyRes = await request(app)
      .get('/institutions')
      .set('X-API-KEY', 'invalid-key');
    expect(invalidKeyRes.status).toBe(401);
  });

  it('creates an institution API key', async () => {
    const res = await request(app)
      .post(`/institutions/${institutionId}/api-keys`)
      .set('X-API-KEY', rootKey)
      .send({
        label: 'inst-admin',
        role: 'admin',
      });
    expect(res.status).toBe(201);
    expect(res.body.apiKey).toBeDefined();
    instApiKey = res.body.apiKey;
  });

  it('revokes an institution API key', async () => {
    // Create a dedicated key to revoke so other tests can continue using the original key.
    const createRes = await request(app)
      .post(`/institutions/${institutionId}/api-keys`)
      .set('X-API-KEY', rootKey)
      .send({
        label: 'revocation-test',
        role: 'admin',
      });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get(`/institutions/${institutionId}/api-keys`)
      .set('X-API-KEY', rootKey);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    const revocationKey = (listRes.body as any[]).find((k) => k.label === 'revocation-test');
    expect(revocationKey).toBeDefined();
    const keyId = revocationKey.id as string;

    const revokeRes = await request(app)
      .post(`/institutions/${institutionId}/api-keys/${keyId}/revoke`)
      .set('X-API-KEY', rootKey);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.revokedAt).toBeDefined();

    // After revocation, the key should no longer be returned from the list
    const listAfter = await request(app)
      .get(`/institutions/${institutionId}/api-keys`)
      .set('X-API-KEY', rootKey);
    expect(listAfter.status).toBe(200);
    const idsAfter = (listAfter.body as any[]).map((k) => k.id);
    expect(idsAfter).not.toContain(keyId);
  });

  it('creates an asset template with institution key', async () => {
    const res = await request(app)
      .post('/asset-templates')
      .set('X-API-KEY', instApiKey)
      .send({
        institutionId,
        code: 'CONSTR_ESCROW',
        name: 'Construction Escrow',
        vertical: 'CONSTRUCTION',
        region: 'EU_UK',
        config: { currency: 'USD', region: 'EU_UK' },
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    templateId = res.body.id;
  });

  it('creates an asset', async () => {
    const res = await request(app)
      .post('/assets')
      .set('X-API-KEY', instApiKey)
      .send({
        institutionId,
        templateId,
        label: 'Project Alpha Escrow',
        metadata: { projectCode: 'ALPHA-001' },
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    assetId = res.body.id;
  });

  it('creates a position under policy-free conditions', async () => {
    const res = await request(app)
      .post('/positions')
      .set('X-API-KEY', instApiKey)
      .send({
        institutionId,
        assetId,
        holderReference: 'SUBCONTRACTOR_123',
        currency: 'USD',
        amount: 100000,
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.state).toBe('CREATED');
    positionId = res.body.id;
  });

  it('enforces policy constraints on position creation', async () => {
    // Configure a policy that only allows EUR and a higher minimum amount
    const policyRes = await request(app)
      .put(`/institutions/${institutionId}/policies/EU_UK`)
      .set('X-API-KEY', instApiKey)
      .send({
        position: {
          minAmount: 200000,
          allowedCurrencies: ['EUR'],
        },
      });
    expect(policyRes.status).toBe(200);

    // Amount below min should be rejected
    const belowMinRes = await request(app)
      .post('/positions')
      .set('X-API-KEY', instApiKey)
      .send({
        institutionId,
        assetId,
        holderReference: 'SUBCONTRACTOR_456',
        currency: 'EUR',
        amount: 100000,
      });
    expect(belowMinRes.status).toBe(400);
    expect(belowMinRes.body.error).toBe('Amount below minimum for policy');

    // Disallowed currency should be rejected
    const badCurrencyRes = await request(app)
      .post('/positions')
      .set('X-API-KEY', instApiKey)
      .send({
        institutionId,
        assetId,
        holderReference: 'SUBCONTRACTOR_789',
        currency: 'USD',
        amount: 250000,
      });
    expect(badCurrencyRes.status).toBe(400);
    expect(badCurrencyRes.body.error).toBe('Currency not allowed by policy');
  });

  it('transitions a position to FUNDED', async () => {
    const res = await request(app)
      .post(`/positions/${positionId}/transition`)
      .set('X-API-KEY', instApiKey)
      .send({
        toState: 'FUNDED',
        reason: 'Funds received into escrow',
      });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('FUNDED');
  });

  it('returns ledger events for the position', async () => {
    const res = await request(app)
      .get(`/ledger-events?positionId=${positionId}`)
      .set('X-API-KEY', instApiKey);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('enforces per-key rate limiting', async () => {
    // Create a dedicated key for rate limit testing so we know its request count.
    const createRes = await request(app)
      .post(`/institutions/${institutionId}/api-keys`)
      .set('X-API-KEY', rootKey)
      .send({
        label: 'rate-limit-test',
        role: 'admin',
      });
    expect(createRes.status).toBe(201);
    const rateLimitKey = createRes.body.apiKey as string;

    // RATE_LIMIT_MAX_REQUESTS is set to 20 in beforeAll; exceed that with this key.
    for (let i = 0; i < 22; i += 1) {
      await request(app)
        .get('/assets')
        .set('X-API-KEY', rateLimitKey);
    }

    const res = await request(app)
      .get('/assets')
      .set('X-API-KEY', rateLimitKey);
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Rate limit exceeded');
  });

  it('exposes Prometheus metrics for root only', async () => {
    // Non-root should be forbidden
    const forbiddenRes = await request(app)
      .get('/metrics/prometheus')
      .set('X-API-KEY', instApiKey);
    expect(forbiddenRes.status).toBe(403);

    // Root can access
    const res = await request(app)
      .get('/metrics/prometheus')
      .set('X-API-KEY', rootKey);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('taas_requests_total');
  });
});

