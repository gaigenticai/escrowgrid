import { Pool } from 'pg';
import { LedgerClient, LedgerEvent } from '../domain/ledger';
import { Position, PositionLifecycleEvent } from '../domain/types';
import { requirePostgresUrl } from '../config';

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}

export class PostgresLedger implements LedgerClient {
  private pool: Pool;

  constructor() {
    const connectionString = requirePostgresUrl();
    this.pool = new Pool({ connectionString });
  }

  async recordPositionCreated(position: Position): Promise<void> {
    const id = generateId('led');
    const timestamp = now();
    await this.pool.query(
      `INSERT INTO ledger_events
       (id, kind, position_id, at, previous_state, new_state, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        'POSITION_CREATED',
        position.id,
        timestamp,
        null,
        position.state,
        {
          institutionId: position.institutionId,
          assetId: position.assetId,
          currency: position.currency,
          amount: position.amount,
          externalReference: position.externalReference,
        },
        timestamp,
      ],
    );
  }

  async recordPositionStateChanged(
    position: Position,
    lifecycleEvent: PositionLifecycleEvent,
  ): Promise<void> {
    const id = generateId('led');
    const timestamp = now();
    await this.pool.query(
      `INSERT INTO ledger_events
       (id, kind, position_id, at, previous_state, new_state, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        'POSITION_STATE_CHANGED',
        position.id,
        timestamp,
        lifecycleEvent.fromState,
        lifecycleEvent.toState,
        {
          reason: lifecycleEvent.reason,
          metadata: lifecycleEvent.metadata,
        },
        timestamp,
      ],
    );
  }

  async listEvents(params?: { positionId?: string }): Promise<LedgerEvent[]> {
    if (!params || params.positionId === undefined) {
      const result = await this.pool.query('SELECT * FROM ledger_events ORDER BY at ASC');
      return result.rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        positionId: row.position_id,
        at: row.at,
        previousState: row.previous_state ?? undefined,
        newState: row.new_state ?? undefined,
        payload: row.payload ?? undefined,
      }));
    }

    const result = await this.pool.query(
      'SELECT * FROM ledger_events WHERE position_id = $1 ORDER BY at ASC',
      [params.positionId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      positionId: row.position_id,
      at: row.at,
      previousState: row.previous_state ?? undefined,
      newState: row.new_state ?? undefined,
      payload: row.payload ?? undefined,
    }));
  }
}

export function createPostgresLedger(): LedgerClient {
  return new PostgresLedger();
}

