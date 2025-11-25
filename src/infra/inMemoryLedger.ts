import { LedgerClient, LedgerEvent, LedgerEventKind } from '../domain/ledger';
import { Position, PositionLifecycleEvent } from '../domain/types';

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}

class InMemoryLedger implements LedgerClient {
  private events: LedgerEvent[] = [];

  async recordPositionCreated(position: Position): Promise<void> {
    const event: LedgerEvent = {
      id: generateId('led'),
      kind: 'POSITION_CREATED',
      positionId: position.id,
      at: now(),
      newState: position.state,
      payload: {
        institutionId: position.institutionId,
        assetId: position.assetId,
        currency: position.currency,
        amount: position.amount,
        externalReference: position.externalReference,
      },
    };
    this.events.push(event);
  }

  async recordPositionStateChanged(
    position: Position,
    lifecycleEvent: PositionLifecycleEvent,
  ): Promise<void> {
    const event: LedgerEvent = {
      id: generateId('led'),
      kind: 'POSITION_STATE_CHANGED',
      positionId: position.id,
      at: now(),
      previousState: lifecycleEvent.fromState,
      newState: lifecycleEvent.toState,
      payload: {
        reason: lifecycleEvent.reason,
        metadata: lifecycleEvent.metadata,
      },
    };
    this.events.push(event);
  }

  async listEvents(params?: { positionId?: string }): Promise<LedgerEvent[]> {
    if (!params || params.positionId === undefined) {
      return [...this.events];
    }
    return this.events.filter((e) => e.positionId === params.positionId);
  }
}

export const inMemoryLedger: LedgerClient = new InMemoryLedger();

