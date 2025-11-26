export type Region = 'US' | 'EU_UK' | 'SG' | 'UAE';

/**
 * All valid regions as an array, useful for validation.
 */
export const REGIONS: readonly Region[] = ['US', 'EU_UK', 'SG', 'UAE'] as const;

/**
 * Type guard to check if a value is a valid Region.
 */
export function isValidRegion(value: unknown): value is Region {
  return typeof value === 'string' && REGIONS.includes(value as Region);
}

export type Vertical = 'CONSTRUCTION' | 'TRADE_FINANCE';

/**
 * All valid verticals as an array, useful for validation.
 */
export const VERTICALS: readonly Vertical[] = ['CONSTRUCTION', 'TRADE_FINANCE'] as const;

/**
 * Type guard to check if a value is a valid Vertical.
 */
export function isValidVertical(value: unknown): value is Vertical {
  return typeof value === 'string' && VERTICALS.includes(value as Vertical);
}

export type ApiKeyRole = 'admin' | 'read_only';

export interface Institution {
  id: string;
  name: string;
  regions: Region[];
  verticals: Vertical[];
  createdAt: string;
  updatedAt: string;
}

export interface AssetTemplate {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  vertical: Vertical;
  region: Region;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  institutionId: string;
  templateId: string;
  label: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type PositionState =
  | 'CREATED'
  | 'FUNDED'
  | 'PARTIALLY_RELEASED'
  | 'RELEASED'
  | 'CANCELLED'
  | 'EXPIRED';

/**
 * All valid position states as an array, useful for validation.
 */
export const POSITION_STATES: readonly PositionState[] = [
  'CREATED',
  'FUNDED',
  'PARTIALLY_RELEASED',
  'RELEASED',
  'CANCELLED',
  'EXPIRED',
] as const;

/**
 * Type guard to check if a value is a valid PositionState.
 */
export function isValidPositionState(value: unknown): value is PositionState {
  return typeof value === 'string' && POSITION_STATES.includes(value as PositionState);
}

export interface PositionLifecycleEvent {
  id: string;
  positionId: string;
  fromState: PositionState | null;
  toState: PositionState;
  reason?: string | undefined;
  at: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface Position {
  id: string;
  institutionId: string;
  assetId: string;
  holderReference: string;
  currency: string;
  amount: number;
  state: PositionState;
  externalReference?: string | undefined;
  createdAt: string;
  updatedAt: string;
  events: PositionLifecycleEvent[];
}

export interface ApiKey {
  id: string;
  institutionId: string;
  keyHash: string;
  label: string;
  role: ApiKeyRole;
  createdAt: string;
  revokedAt?: string | undefined;
}

export interface ApiErrorPayload {
  error: string;
  details?: unknown;
}

