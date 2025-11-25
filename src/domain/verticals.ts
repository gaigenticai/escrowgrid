import { Region, Vertical } from './types';

export type ConstructionTemplateCode = 'CONSTR_ESCROW' | 'CONSTR_RETAINAGE';
export type TradeFinanceTemplateCode = 'TF_INVOICE' | 'TF_LC';

export type KnownTemplateCode = ConstructionTemplateCode | TradeFinanceTemplateCode;

export interface ConstructionEscrowConfig {
  currency: string;
  region: Region;
  minAmount?: number;
  maxAmount?: number;
}

export interface ConstructionRetainageConfig {
  currency: string;
  retainagePercentage: number;
}

export interface TradeFinanceInvoiceConfig {
  currency: string;
  maxTenorDays: number;
  country: string;
}

export interface TradeFinanceLcConfig {
  currency: string;
  issuingBankCountry: string;
  maxTenorDays: number;
}

export function validateTemplateConfig(params: {
  vertical: Vertical;
  code: string;
  region: Region;
  config: Record<string, unknown>;
}): void {
  const { vertical, code, region, config } = params;

  if (vertical === 'CONSTRUCTION') {
    validateConstructionTemplate(code, region, config);
  } else if (vertical === 'TRADE_FINANCE') {
    validateTradeFinanceTemplate(code, region, config);
  }
}

function validateConstructionTemplate(
  code: string,
  region: Region,
  config: Record<string, unknown>,
): void {
  if (code === 'CONSTR_ESCROW') {
    const cfg = config as Partial<ConstructionEscrowConfig>;
    if (!cfg.currency || typeof cfg.currency !== 'string') {
      throw new Error('CONSTR_ESCROW config requires a string currency');
    }
    if (!cfg.region || typeof cfg.region !== 'string') {
      throw new Error('CONSTR_ESCROW config requires a region');
    }
    if (cfg.region !== region) {
      throw new Error('CONSTR_ESCROW config.region must match template region');
    }
    if (cfg.minAmount !== undefined && typeof cfg.minAmount !== 'number') {
      throw new Error('CONSTR_ESCROW config.minAmount must be a number when provided');
    }
    if (cfg.maxAmount !== undefined && typeof cfg.maxAmount !== 'number') {
      throw new Error('CONSTR_ESCROW config.maxAmount must be a number when provided');
    }
  } else if (code === 'CONSTR_RETAINAGE') {
    const cfg = config as Partial<ConstructionRetainageConfig>;
    if (!cfg.currency || typeof cfg.currency !== 'string') {
      throw new Error('CONSTR_RETAINAGE config requires a string currency');
    }
    if (
      cfg.retainagePercentage === undefined ||
      typeof cfg.retainagePercentage !== 'number' ||
      cfg.retainagePercentage < 0 ||
      cfg.retainagePercentage > 100
    ) {
      throw new Error(
        'CONSTR_RETAINAGE config.retainagePercentage must be a number between 0 and 100',
      );
    }
  }
}

function validateTradeFinanceTemplate(
  code: string,
  _region: Region,
  config: Record<string, unknown>,
): void {
  if (code === 'TF_INVOICE') {
    const cfg = config as Partial<TradeFinanceInvoiceConfig>;
    if (!cfg.currency || typeof cfg.currency !== 'string') {
      throw new Error('TF_INVOICE config requires a string currency');
    }
    if (
      cfg.maxTenorDays === undefined ||
      typeof cfg.maxTenorDays !== 'number' ||
      cfg.maxTenorDays <= 0
    ) {
      throw new Error('TF_INVOICE config.maxTenorDays must be a positive number');
    }
    if (!cfg.country || typeof cfg.country !== 'string') {
      throw new Error('TF_INVOICE config requires a country');
    }
  } else if (code === 'TF_LC') {
    const cfg = config as Partial<TradeFinanceLcConfig>;
    if (!cfg.currency || typeof cfg.currency !== 'string') {
      throw new Error('TF_LC config requires a string currency');
    }
    if (!cfg.issuingBankCountry || typeof cfg.issuingBankCountry !== 'string') {
      throw new Error('TF_LC config requires an issuingBankCountry');
    }
    if (
      cfg.maxTenorDays === undefined ||
      typeof cfg.maxTenorDays !== 'number' ||
      cfg.maxTenorDays <= 0
    ) {
      throw new Error('TF_LC config.maxTenorDays must be a positive number');
    }
  }
}

