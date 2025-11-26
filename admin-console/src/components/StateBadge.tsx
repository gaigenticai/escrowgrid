import type { PositionState } from '../types';

interface StateBadgeProps {
  state: PositionState;
}

const stateConfig: Record<PositionState, { label: string; className: string }> = {
  CREATED: { label: 'Created', className: 'badge-info' },
  FUNDED: { label: 'Funded', className: 'badge-success' },
  PARTIALLY_RELEASED: { label: 'Partial', className: 'badge-warning' },
  RELEASED: { label: 'Released', className: 'badge-neutral' },
  CANCELLED: { label: 'Cancelled', className: 'badge-danger' },
  EXPIRED: { label: 'Expired', className: 'badge-danger' },
};

export function StateBadge({ state }: StateBadgeProps) {
  const config = stateConfig[state];
  return <span className={config.className}>{config.label}</span>;
}
