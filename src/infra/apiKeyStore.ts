import { Pool } from 'pg';
import crypto from 'crypto';
import { ApiKey, ApiKeyRole } from '../domain/types';
import { config, requirePostgresUrl } from '../config';
import { createAppPool } from './db';

export interface ApiKeyRecord extends ApiKey {}

export interface CreatedApiKey {
  token: string;
  record: ApiKeyRecord;
}

export interface ApiKeyStore {
  createKey(params: {
    institutionId: string;
    label: string;
    role: ApiKeyRole;
  }): Promise<CreatedApiKey>;

  findByToken(token: string): Promise<ApiKeyRecord | undefined>;

  listByInstitution(institutionId: string): Promise<ApiKeyRecord[]>;

  revokeKey(params: { id: string; institutionId: string }): Promise<ApiKeyRecord | undefined>;
}

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}

function generateToken(): string {
  return `ak_${crypto.randomBytes(24).toString('hex')}`;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class InMemoryApiKeyStore implements ApiKeyStore {
  private records = new Map<string, ApiKeyRecord>();
  private byHash = new Map<string, string>();

  async createKey(params: {
    institutionId: string;
    label: string;
    role: ApiKeyRole;
  }): Promise<CreatedApiKey> {
    const id = generateId('ak');
    const token = generateToken();
    const keyHash = hashToken(token);
    const createdAt = now();
    const record: ApiKeyRecord = {
      id,
      institutionId: params.institutionId,
      keyHash,
      label: params.label,
      role: params.role,
      createdAt,
      revokedAt: undefined,
    };
    this.records.set(id, record);
    this.byHash.set(keyHash, id);
    return { token, record };
  }

  async findByToken(token: string): Promise<ApiKeyRecord | undefined> {
    const keyHash = hashToken(token);
    const id = this.byHash.get(keyHash);
    if (!id) {
      return undefined;
    }
    const record = this.records.get(id);
    if (!record || record.revokedAt) {
      return undefined;
    }
    return record;
  }

  async listByInstitution(institutionId: string): Promise<ApiKeyRecord[]> {
    return Array.from(this.records.values()).filter(
      (k) => k.institutionId === institutionId && !k.revokedAt,
    );
  }

  async revokeKey(params: { id: string; institutionId: string }): Promise<ApiKeyRecord | undefined> {
    const existing = this.records.get(params.id);
    if (!existing || existing.institutionId !== params.institutionId || existing.revokedAt) {
      return undefined;
    }
    const updated: ApiKeyRecord = {
      ...existing,
      revokedAt: now(),
    };
    this.records.set(params.id, updated);
    // Keep byHash entry so that if the same token is presented again it will be rejected by revokedAt check.
    return updated;
  }
}

class PostgresApiKeyStore implements ApiKeyStore {
  private pool: Pool;

  constructor() {
    const connectionString = requirePostgresUrl();
    this.pool = createAppPool(connectionString);
  }

  async createKey(params: {
    institutionId: string;
    label: string;
    role: ApiKeyRole;
  }): Promise<CreatedApiKey> {
    const id = generateId('ak');
    const token = generateToken();
    const keyHash = hashToken(token);
    const createdAt = now();

    await this.pool.query(
      `INSERT INTO api_keys (id, institution_id, key_hash, label, role, created_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
      [id, params.institutionId, keyHash, params.label, params.role, createdAt],
    );

    const record: ApiKeyRecord = {
      id,
      institutionId: params.institutionId,
      keyHash,
      label: params.label,
      role: params.role,
      createdAt,
      revokedAt: undefined,
    };

    return { token, record };
  }

  async findByToken(token: string): Promise<ApiKeyRecord | undefined> {
    const keyHash = hashToken(token);
    const result = await this.pool.query(
      `SELECT id, institution_id, key_hash, label, role, created_at, revoked_at
       FROM api_keys
       WHERE key_hash = $1`,
      [keyHash],
    );
    if (result.rowCount === 0) {
      return undefined;
    }
    const row = result.rows[0];
    if (row.revoked_at) {
      return undefined;
    }
    const record: ApiKeyRecord = {
      id: row.id,
      institutionId: row.institution_id,
      keyHash: row.key_hash,
      label: row.label,
      role: row.role,
      createdAt: row.created_at,
      revokedAt: row.revoked_at ?? undefined,
    };
    return record;
  }

  async listByInstitution(institutionId: string): Promise<ApiKeyRecord[]> {
    const result = await this.pool.query(
      `SELECT id, institution_id, key_hash, label, role, created_at, revoked_at
       FROM api_keys
       WHERE institution_id = $1
       ORDER BY created_at ASC`,
      [institutionId],
    );
    return result.rows
      .filter((row) => !row.revoked_at)
      .map((row) => ({
        id: row.id,
        institutionId: row.institution_id,
        keyHash: row.key_hash,
        label: row.label,
        role: row.role,
        createdAt: row.created_at,
        revokedAt: row.revoked_at ?? undefined,
      }));
  }

  async revokeKey(params: { id: string; institutionId: string }): Promise<ApiKeyRecord | undefined> {
    const result = await this.pool.query(
      `UPDATE api_keys
       SET revoked_at = CASE
         WHEN revoked_at IS NULL THEN $3
         ELSE revoked_at
       END
       WHERE id = $1 AND institution_id = $2
       RETURNING id, institution_id, key_hash, label, role, created_at, revoked_at`,
      [params.id, params.institutionId, now()],
    );
    if (result.rowCount === 0) {
      return undefined;
    }
    const row = result.rows[0];
    const record: ApiKeyRecord = {
      id: row.id,
      institutionId: row.institution_id,
      keyHash: row.key_hash,
      label: row.label,
      role: row.role,
      createdAt: row.created_at,
      revokedAt: row.revoked_at ?? undefined,
    };
    return record;
  }
}

let apiKeyStoreInstance: ApiKeyStore;

if (config.storeBackend === 'postgres') {
  apiKeyStoreInstance = new PostgresApiKeyStore();
} else {
  apiKeyStoreInstance = new InMemoryApiKeyStore();
}

export const apiKeyStore: ApiKeyStore = apiKeyStoreInstance;

