import { Position, PositionLifecycleEvent } from './types';

export type LedgerEventKind = 'POSITION_CREATED' | 'POSITION_STATE_CHANGED';

export interface LedgerEvent {
  id: string;
  kind: LedgerEventKind;
  positionId: string;
  at: string;
  previousState?: string | null;
  newState?: string;
  payload?: Record<string, unknown>;
}

export interface LedgerContext {
  requestId?: string;
}

export interface LedgerClient {
  recordPositionCreated(position: Position, context?: LedgerContext): Promise<void>;
  recordPositionStateChanged(
    position: Position,
    lifecycleEvent: PositionLifecycleEvent,
    context?: LedgerContext,
  ): Promise<void>;
  listEvents(params?: { positionId?: string }): Promise<LedgerEvent[]>;
}

