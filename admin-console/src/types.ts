export type Institution = {
  id: string;
  name: string;
  regions: Region[];
  verticals: Vertical[];
  createdAt: string;
  updatedAt: string;
};

export type ApiKey = {
  id: string;
  institutionId: string;
  label: string;
  role: ApiKeyRole;
  createdAt: string;
  revokedAt?: string;
};

export type ApiKeyRole = 'admin' | 'read_only';

export type AssetTemplate = {
  id: string;
  institutionId: string;
  code: TemplateCode;
  name: string;
  vertical: Vertical;
  region: Region;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Asset = {
  id: string;
  institutionId: string;
  templateId: string;
  label: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Position = {
  id: string;
  institutionId: string;
  assetId: string;
  holderReference: string;
  currency: string;
  amount: number;
  state: PositionState;
  externalReference?: string;
  createdAt: string;
  updatedAt: string;
  events: PositionEvent[];
};

export type PositionEvent = {
  id: string;
  positionId: string;
  fromState: PositionState | null;
  toState: PositionState;
  reason?: string;
  at: string;
  metadata?: Record<string, unknown>;
};

export type PositionState =
  | 'CREATED'
  | 'FUNDED'
  | 'PARTIALLY_RELEASED'
  | 'RELEASED'
  | 'CANCELLED'
  | 'EXPIRED';

export type Region = 'US' | 'EU_UK' | 'SG' | 'UAE';
export type Vertical = 'CONSTRUCTION' | 'TRADE_FINANCE';
export type TemplateCode = 'CONSTR_ESCROW' | 'CONSTR_RETAINAGE' | 'TF_INVOICE' | 'TF_LC';

export type PolicyConfig = {
  position: {
    minAmount?: number;
    maxAmount?: number;
    allowedCurrencies?: string[];
  };
};

export type Policy = {
  id: string;
  institutionId: string;
  region: Region;
  config: PolicyConfig;
  createdAt: string;
  updatedAt: string;
};

export type LedgerEvent = {
  id: string;
  kind: 'POSITION_CREATED' | 'POSITION_STATE_CHANGED';
  positionId: string;
  at: string;
  previousState?: PositionState | null;
  newState?: PositionState | null;
  txHash?: string;
};

// UI State types
export type ActiveTab = 'institutions' | 'assets' | 'positions';

// Allowed position transitions
export const POSITION_TRANSITIONS: Record<PositionState, PositionState[]> = {
  CREATED: ['FUNDED', 'CANCELLED', 'EXPIRED'],
  FUNDED: ['PARTIALLY_RELEASED', 'RELEASED', 'CANCELLED', 'EXPIRED'],
  PARTIALLY_RELEASED: ['PARTIALLY_RELEASED', 'RELEASED', 'CANCELLED', 'EXPIRED'],
  RELEASED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export const REGIONS: Region[] = ['US', 'EU_UK', 'SG', 'UAE'];
export const VERTICALS: Vertical[] = ['CONSTRUCTION', 'TRADE_FINANCE'];
export const TEMPLATE_CODES: TemplateCode[] = ['CONSTR_ESCROW', 'CONSTR_RETAINAGE', 'TF_INVOICE', 'TF_LC'];
export const API_KEY_ROLES: ApiKeyRole[] = ['admin', 'read_only'];

// Valid ISO 4217 currency codes
export const VALID_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  'CNY', 'HKD', 'SGD', 'INR', 'MXN', 'BRL', 'ZAR', 'AED',
  'SAR', 'KRW', 'TWD', 'THB', 'MYR', 'IDR', 'PHP', 'VND',
  'PLN', 'SEK', 'NOK', 'DKK', 'CZK', 'HUF', 'ILS', 'TRY',
] as const;

export type CurrencyCode = (typeof VALID_CURRENCIES)[number];
