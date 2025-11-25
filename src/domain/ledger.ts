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

export interface LedgerClient {
  recordPositionCreated(position: Position): Promise<void>;
  recordPositionStateChanged(
    position: Position,
    lifecycleEvent: PositionLifecycleEvent,
  ): Promise<void>;
  listEvents(params?: { positionId?: string }): Promise<LedgerEvent[]>;
}

