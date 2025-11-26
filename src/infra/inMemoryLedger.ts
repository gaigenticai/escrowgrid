import { LedgerClient, LedgerContext, LedgerEvent } from '../domain/ledger';
import { Position, PositionLifecycleEvent } from '../domain/types';
import { generateSecureId, now } from '../utils/id';

class InMemoryLedger implements LedgerClient {
  private events: LedgerEvent[] = [];

  async recordPositionCreated(position: Position, context?: LedgerContext): Promise<void> {
    const event: LedgerEvent = {
      id: generateSecureId('led'),
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
        requestId: context?.requestId,
      },
    };
    this.events.push(event);
  }

  async recordPositionStateChanged(
    position: Position,
    lifecycleEvent: PositionLifecycleEvent,
  ): Promise<void> {
    const event: LedgerEvent = {
      id: generateSecureId('led'),
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

