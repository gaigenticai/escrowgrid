import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { Pool } from 'pg';

let app: import('express').Express;
let rootKey = 'test-root-key-pg';
let instApiKey: string;
let institutionId: string;
let templateId: string;
let assetId: string;
let positionId: string;

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

beforeAll(async () => {
  if (!TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must be set to run Postgres integration tests');
  }

  process.env.NODE_ENV = 'test';
  process.env.STORE_BACKEND = 'postgres';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.ROOT_API_KEY = rootKey;
  process.env.ONCHAIN_LEDGER_ENABLED = 'false';

  // Clean database tables before tests
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  await pool.query(
    `
    TRUNCATE TABLE
      audit_events,
      ledger_events,
      position_events,
      positions,
      assets,
      asset_templates,
      institution_policies,
      api_keys,
      institutions
    RESTART IDENTITY CASCADE;
  `,
  );
  await pool.end();

  const mod = await import('../server');
  app = mod.app;
});

describe('TAAS API integration (Postgres backend)', () => {
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
        name: 'PG Test Bank',
        regions: ['EU_UK'],
        verticals: ['CONSTRUCTION', 'TRADE_FINANCE'],
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    institutionId = res.body.id;
  });

  it('creates an institution API key', async () => {
    const res = await request(app)
      .post(`/institutions/${institutionId}/api-keys`)
      .set('X-API-KEY', rootKey)
      .send({
        label: 'pg-inst-admin',
        role: 'admin',
      });
    expect(res.status).toBe(201);
    expect(res.body.apiKey).toBeDefined();
    instApiKey = res.body.apiKey;
  });

  it('revokes an institution API key (postgres)', async () => {
    const createRes = await request(app)
      .post(`/institutions/${institutionId}/api-keys`)
      .set('X-API-KEY', rootKey)
      .send({
        label: 'revocation-test-pg',
        role: 'admin',
      });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get(`/institutions/${institutionId}/api-keys`)
      .set('X-API-KEY', rootKey);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    const revocationKey = (listRes.body as any[]).find((k) => k.label === 'revocation-test-pg');
    expect(revocationKey).toBeDefined();
    const keyId = revocationKey.id as string;

    const revokeRes = await request(app)
      .post(`/institutions/${institutionId}/api-keys/${keyId}/revoke`)
      .set('X-API-KEY', rootKey);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.revokedAt).toBeDefined();

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
        name: 'PG Construction Escrow',
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
        label: 'PG Project Alpha Escrow',
        metadata: { projectCode: 'PG-ALPHA-001' },
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
        holderReference: 'PG_SUBCONTRACTOR_123',
        currency: 'USD',
        amount: 50000,
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
        reason: 'PG funds received into escrow',
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

