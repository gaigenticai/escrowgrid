export type Region = 'US' | 'EU_UK' | 'SG' | 'UAE';

export type Vertical = 'CONSTRUCTION' | 'TRADE_FINANCE';

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

