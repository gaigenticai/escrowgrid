import { config } from '../config';
import { inMemoryLedger } from './inMemoryLedger';
import { createPostgresLedger } from './postgresLedger';
import { OnchainLedger } from './onchainLedger';
import type { LedgerClient } from '../domain/ledger';
import type { Position, PositionLifecycleEvent } from '../domain/types';

class CompositeLedger implements LedgerClient {
  private base: LedgerClient;
  private onchain?: OnchainLedger | undefined;

  constructor(base: LedgerClient, onchain?: OnchainLedger | undefined) {
    this.base = base;
    this.onchain = onchain;
  }

  async recordPositionCreated(position: Position): Promise<void> {
    await this.base.recordPositionCreated(position);
    if (this.onchain) {
      await this.onchain.recordPositionCreated(position);
    }
  }

  async recordPositionStateChanged(
    position: Position,
    lifecycleEvent: PositionLifecycleEvent,
  ): Promise<void> {
    await this.base.recordPositionStateChanged(position, lifecycleEvent);
    if (this.onchain) {
      await this.onchain.recordPositionStateChanged(position, lifecycleEvent);
    }
  }

  async listEvents(params?: { positionId?: string }): Promise<import('../domain/ledger').LedgerEvent[]> {
    return this.base.listEvents(params);
  }
}

let baseLedger: LedgerClient;

if (config.storeBackend === 'postgres') {
  baseLedger = createPostgresLedger();
} else {
  baseLedger = inMemoryLedger;
}

let onchainLedger: OnchainLedger | undefined;
if (config.onchainLedgerEnabled) {
  try {
    onchainLedger = new OnchainLedger();
  } catch (err) {
    console.error(
      JSON.stringify({
        type: 'onchain_ledger_init_error',
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    onchainLedger = undefined;
  }
}

export const ledgerClient: LedgerClient = new CompositeLedger(baseLedger, onchainLedger);

