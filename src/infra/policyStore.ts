import { Pool } from 'pg';
import { config, requirePostgresUrl } from '../config';
import { createAppPool } from './db';
import type { InstitutionPolicy, InstitutionPolicyConfig } from '../domain/policy';
import type { Region } from '../domain/types';

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}

export interface PolicyStore {
  upsertPolicy(params: {
    institutionId: string;
    region: Region;
    config: InstitutionPolicyConfig;
  }): Promise<InstitutionPolicy>;

  getPolicy(institutionId: string, region: Region): Promise<InstitutionPolicy | undefined>;

  listPolicies(institutionId: string): Promise<InstitutionPolicy[]>;
}

class InMemoryPolicyStore implements PolicyStore {
  private items = new Map<string, InstitutionPolicy>();

  private key(institutionId: string, region: Region): string {
    return `${institutionId}::${region}`;
  }

  async upsertPolicy(params: {
    institutionId: string;
    region: Region;
    config: InstitutionPolicyConfig;
  }): Promise<InstitutionPolicy> {
    const k = this.key(params.institutionId, params.region);
    const existing = this.items.get(k);
    const timestamp = now();
    const policy: InstitutionPolicy = {
      id: existing?.id ?? generateId('pol'),
      institutionId: params.institutionId,
      region: params.region,
      config: params.config,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.items.set(k, policy);
    return policy;
  }

  async getPolicy(institutionId: string, region: Region): Promise<InstitutionPolicy | undefined> {
    const k = this.key(institutionId, region);
    return this.items.get(k);
  }

  async listPolicies(institutionId: string): Promise<InstitutionPolicy[]> {
    return Array.from(this.items.values()).filter((p) => p.institutionId === institutionId);
  }
}

class PostgresPolicyStore implements PolicyStore {
  private pool: Pool;

  constructor() {
    const connectionString = requirePostgresUrl();
    this.pool = createAppPool(connectionString);
  }

  private mapRow(row: any): InstitutionPolicy {
    return {
      id: row.id,
      institutionId: row.institution_id,
      region: row.region,
      config: row.config as InstitutionPolicyConfig,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async upsertPolicy(params: {
    institutionId: string;
    region: Region;
    config: InstitutionPolicyConfig;
  }): Promise<InstitutionPolicy> {
    const timestamp = now();
    const id = generateId('pol');
    const result = await this.pool.query(
      `INSERT INTO institution_policies (id, institution_id, region, config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (institution_id, region)
       DO UPDATE SET config = EXCLUDED.config, updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [id, params.institutionId, params.region, params.config, timestamp, timestamp],
    );
    return this.mapRow(result.rows[0]);
  }

  async getPolicy(institutionId: string, region: Region): Promise<InstitutionPolicy | undefined> {
    const result = await this.pool.query(
      `SELECT * FROM institution_policies
       WHERE institution_id = $1 AND region = $2`,
      [institutionId, region],
    );
    if (result.rowCount === 0) {
      return undefined;
    }
    return this.mapRow(result.rows[0]);
  }

  async listPolicies(institutionId: string): Promise<InstitutionPolicy[]> {
    const result = await this.pool.query(
      `SELECT * FROM institution_policies
       WHERE institution_id = $1
       ORDER BY region ASC`,
      [institutionId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }
}

let policyStoreInstance: PolicyStore;

if (config.storeBackend === 'postgres') {
  policyStoreInstance = new PostgresPolicyStore();
} else {
  policyStoreInstance = new InMemoryPolicyStore();
}

export const policyStore: PolicyStore = policyStoreInstance;

