import { Position, PositionLifecycleEvent, PositionState } from './types';

const allowedTransitions: Record<PositionState, PositionState[]> = {
  CREATED: ['FUNDED', 'CANCELLED', 'EXPIRED'],
  FUNDED: ['PARTIALLY_RELEASED', 'RELEASED', 'CANCELLED', 'EXPIRED'],
  PARTIALLY_RELEASED: ['PARTIALLY_RELEASED', 'RELEASED', 'CANCELLED', 'EXPIRED'],
  RELEASED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(from: PositionState, to: PositionState): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function applyTransition(params: {
  position: Position;
  toState: PositionState;
  reason?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  now: string;
}): Position {
  const { position, toState, reason, metadata, now } = params;

  if (position.state === toState) {
    return position;
  }

  if (!canTransition(position.state, toState)) {
    throw new Error(`Invalid transition from ${position.state} to ${toState}`);
  }

  const event: PositionLifecycleEvent = {
    id: `ple_${Math.random().toString(36).slice(2)}`,
    positionId: position.id,
    fromState: position.state,
    toState,
    reason,
    at: now,
    metadata,
  };

  return {
    ...position,
    state: toState,
    updatedAt: now,
    events: [...position.events, event],
  };
}

