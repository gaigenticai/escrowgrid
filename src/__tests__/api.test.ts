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

  const mod = await import('../server');
  app = mod.app;
});

describe('TAAS API integration (in-memory backend)', () => {
  it('responds to health without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
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
});

