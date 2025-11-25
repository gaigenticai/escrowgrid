import { Pool } from 'pg';
import {
  Asset,
  AssetTemplate,
  Institution,
  Position,
  PositionLifecycleEvent,
  PositionState,
  Region,
  Vertical,
} from '../domain/types';
import { validateTemplateConfig } from '../domain/verticals';
import type { Store } from './store';
import { requirePostgresUrl } from '../config';

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}

function mapInstitutionRow(row: any): Institution {
  return {
    id: row.id,
    name: row.name,
    regions: row.regions as Region[],
    verticals: row.verticals as Vertical[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssetTemplateRow(row: any): AssetTemplate {
  return {
    id: row.id,
    institutionId: row.institution_id,
    code: row.code,
    name: row.name,
    vertical: row.vertical as Vertical,
    region: row.region as Region,
    config: row.config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssetRow(row: any): Asset {
  return {
    id: row.id,
    institutionId: row.institution_id,
    templateId: row.template_id,
    label: row.label,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPositionEventRow(row: any): PositionLifecycleEvent {
  return {
    id: row.id,
    positionId: row.position_id,
    fromState: (row.from_state as PositionState | null) ?? null,
    toState: row.to_state as PositionState,
    reason: row.reason ?? undefined,
    at: row.at,
    metadata: row.metadata ?? undefined,
  };
}

function mapPositionRow(row: any, events: PositionLifecycleEvent[]): Position {
  return {
    id: row.id,
    institutionId: row.institution_id,
    assetId: row.asset_id,
    holderReference: row.holder_reference,
    currency: row.currency,
    amount: Number(row.amount),
    state: row.state as PositionState,
    externalReference: row.external_reference ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events,
  };
}

export class PostgresStore implements Store {
  private pool: Pool;

  constructor() {
    const connectionString = requirePostgresUrl();
    this.pool = new Pool({ connectionString });
  }

  async createInstitution(input: {
    name: string;
    regions: Region[];
    verticals?: Vertical[] | undefined;
  }): Promise<Institution> {
    const id = generateId('inst');
    const timestamp = now();
    const verticals = input.verticals ?? ['CONSTRUCTION', 'TRADE_FINANCE'];
    const result = await this.pool.query(
      `INSERT INTO institutions (id, name, regions, verticals, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, input.name, input.regions, verticals, timestamp, timestamp],
    );
    return mapInstitutionRow(result.rows[0]);
  }

  async listInstitutions(): Promise<Institution[]> {
    const result = await this.pool.query('SELECT * FROM institutions ORDER BY created_at ASC');
    return result.rows.map(mapInstitutionRow);
  }

  async getInstitution(id: string): Promise<Institution | undefined> {
    const result = await this.pool.query('SELECT * FROM institutions WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return undefined;
    }
    return mapInstitutionRow(result.rows[0]);
  }

  async createAssetTemplate(input: {
    institutionId: string;
    code: string;
    name: string;
    vertical: Vertical;
    region: Region;
    config: Record<string, unknown>;
  }): Promise<AssetTemplate> {
    const institution = await this.getInstitution(input.institutionId);
    if (!institution) {
      throw new Error('Institution not found');
    }

    validateTemplateConfig({
      vertical: input.vertical,
      code: input.code,
      region: input.region,
      config: input.config,
    });

    const id = generateId('tmpl');
    const timestamp = now();
    const result = await this.pool.query(
      `INSERT INTO asset_templates
       (id, institution_id, code, name, vertical, region, config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        input.institutionId,
        input.code,
        input.name,
        input.vertical,
        input.region,
        input.config,
        timestamp,
        timestamp,
      ],
    );
    return mapAssetTemplateRow(result.rows[0]);
  }

  async listAssetTemplates(params?: { institutionId?: string }): Promise<AssetTemplate[]> {
    if (!params || params.institutionId === undefined) {
      const result = await this.pool.query(
        'SELECT * FROM asset_templates ORDER BY created_at ASC',
      );
      return result.rows.map(mapAssetTemplateRow);
    }
    const result = await this.pool.query(
      'SELECT * FROM asset_templates WHERE institution_id = $1 ORDER BY created_at ASC',
      [params.institutionId],
    );
    return result.rows.map(mapAssetTemplateRow);
  }

  async getAssetTemplate(id: string): Promise<AssetTemplate | undefined> {
    const result = await this.pool.query('SELECT * FROM asset_templates WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return undefined;
    }
    return mapAssetTemplateRow(result.rows[0]);
  }

  async createAsset(input: {
    institutionId: string;
    templateId: string;
    label: string;
    metadata?: Record<string, unknown>;
  }): Promise<Asset> {
    const institution = await this.getInstitution(input.institutionId);
    if (!institution) {
      throw new Error('Institution not found');
    }
    const template = await this.getAssetTemplate(input.templateId);
    if (!template || template.institutionId !== input.institutionId) {
      throw new Error('Asset template not found for institution');
    }

    const id = generateId('ast');
    const timestamp = now();
    const result = await this.pool.query(
      `INSERT INTO assets
       (id, institution_id, template_id, label, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        input.institutionId,
        input.templateId,
        input.label,
        input.metadata ?? {},
        timestamp,
        timestamp,
      ],
    );
    return mapAssetRow(result.rows[0]);
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    const result = await this.pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return undefined;
    }
    return mapAssetRow(result.rows[0]);
  }

  async listAssets(params?: { institutionId?: string; templateId?: string }): Promise<Asset[]> {
    if (!params) {
      const result = await this.pool.query('SELECT * FROM assets ORDER BY created_at ASC');
      return result.rows.map(mapAssetRow);
    }

    const conditions: string[] = [];
    const values: any[] = [];

    if (params.institutionId !== undefined) {
      values.push(params.institutionId);
      conditions.push(`institution_id = $${values.length}`);
    }
    if (params.templateId !== undefined) {
      values.push(params.templateId);
      conditions.push(`template_id = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM assets ${whereClause} ORDER BY created_at ASC`,
      values,
    );
    return result.rows.map(mapAssetRow);
  }

  async createPosition(input: {
    institutionId: string;
    assetId: string;
    holderReference: string;
    currency: string;
    amount: number;
    externalReference?: string | undefined;
  }): Promise<Position> {
    const institution = await this.getInstitution(input.institutionId);
    if (!institution) {
      throw new Error('Institution not found');
    }
    const asset = await this.getAsset(input.assetId);
    if (!asset || asset.institutionId !== input.institutionId) {
      throw new Error('Asset not found for institution');
    }

    const id = generateId('pos');
    const timestamp = now();
    const state: PositionState = 'CREATED';
    const result = await this.pool.query(
      `INSERT INTO positions
       (id, institution_id, asset_id, holder_reference, currency, amount, state, external_reference, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        input.institutionId,
        input.assetId,
        input.holderReference,
        input.currency,
        input.amount,
        state,
        input.externalReference ?? null,
        timestamp,
        timestamp,
      ],
    );
    const row = result.rows[0];
    return mapPositionRow(row, []);
  }

  private async getPositionEvents(positionId: string): Promise<PositionLifecycleEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM position_events
       WHERE position_id = $1
       ORDER BY at ASC, created_at ASC`,
      [positionId],
    );
    return result.rows.map(mapPositionEventRow);
  }

  async getPosition(id: string): Promise<Position | undefined> {
    const result = await this.pool.query('SELECT * FROM positions WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return undefined;
    }
    const events = await this.getPositionEvents(id);
    return mapPositionRow(result.rows[0], events);
  }

  async listPositions(params?: {
    institutionId?: string;
    assetId?: string;
    holderReference?: string;
  }): Promise<Position[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.institutionId !== undefined) {
      values.push(params.institutionId);
      conditions.push(`institution_id = $${values.length}`);
    }
    if (params?.assetId !== undefined) {
      values.push(params.assetId);
      conditions.push(`asset_id = $${values.length}`);
    }
    if (params?.holderReference !== undefined) {
      values.push(params.holderReference);
      conditions.push(`holder_reference = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM positions ${whereClause} ORDER BY created_at ASC`,
      values,
    );

    const positions: Position[] = [];
    for (const row of result.rows) {
      const events = await this.getPositionEvents(row.id);
      positions.push(mapPositionRow(row, events));
    }
    return positions;
  }

  async updatePosition(position: Position, latestEvent?: PositionLifecycleEvent): Promise<Position> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE positions
         SET institution_id = $1,
             asset_id = $2,
             holder_reference = $3,
             currency = $4,
             amount = $5,
             state = $6,
             external_reference = $7,
             updated_at = $8
         WHERE id = $9`,
        [
          position.institutionId,
          position.assetId,
          position.holderReference,
          position.currency,
          position.amount,
          position.state,
          position.externalReference ?? null,
          position.updatedAt,
          position.id,
        ],
      );

      if (latestEvent) {
        await client.query(
          `INSERT INTO position_events
           (id, position_id, from_state, to_state, reason, at, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            latestEvent.id,
            latestEvent.positionId,
            latestEvent.fromState,
            latestEvent.toState,
            latestEvent.reason ?? null,
            latestEvent.at,
            latestEvent.metadata ?? null,
            now(),
          ],
        );
      }

      await client.query('COMMIT');
      return position;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export function createPostgresStore(): Store {
  return new PostgresStore();
}

