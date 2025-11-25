import type { Region } from './types';

export interface PositionPolicyConfig {
  minAmount?: number | undefined;
  maxAmount?: number | undefined;
  allowedCurrencies?: string[] | undefined;
}

export interface InstitutionPolicyConfig {
  region: Region;
  position: PositionPolicyConfig;
}

export interface InstitutionPolicy {
  id: string;
  institutionId: string;
  region: Region;
  config: InstitutionPolicyConfig;
  createdAt: string;
  updatedAt: string;
}

