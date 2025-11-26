/**
 * Client-side form validation utilities for the Admin Console.
 * Mirrors the backend Zod schemas for consistent validation.
 */

import { REGIONS, VERTICALS, VALID_CURRENCIES } from './types';

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Field validation results
export interface FieldErrors {
  [fieldName: string]: string | undefined;
}

// Amount limits (mirror backend)
export const AMOUNT_LIMITS = {
  MIN: 0.00000001,
  MAX: 1_000_000_000_000_000,
  MAX_DECIMAL_PLACES: 8,
} as const;

// String length limits (mirror backend)
export const STRING_LIMITS = {
  NAME: { min: 1, max: 255 },
  LABEL: { min: 1, max: 255 },
  REFERENCE: { min: 1, max: 255 },
} as const;

// ============================================================================
// Individual Field Validators
// ============================================================================

export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { isValid: false, error: `${fieldName} is required` };
  }
  return { isValid: true };
}

export function validateStringLength(
  value: string | undefined,
  fieldName: string,
  limits: { min: number; max: number },
): ValidationResult {
  if (!value) {
    if (limits.min > 0) {
      return { isValid: false, error: `${fieldName} is required` };
    }
    return { isValid: true };
  }

  if (value.length < limits.min) {
    return { isValid: false, error: `${fieldName} must be at least ${limits.min} character(s)` };
  }
  if (value.length > limits.max) {
    return { isValid: false, error: `${fieldName} must not exceed ${limits.max} characters` };
  }
  return { isValid: true };
}

export function validateAmount(value: number | string | undefined): ValidationResult {
  if (value === undefined || value === '') {
    return { isValid: false, error: 'Amount is required' };
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return { isValid: false, error: 'Amount must be a valid number' };
  }

  if (numValue <= 0) {
    return { isValid: false, error: 'Amount must be positive' };
  }

  if (numValue < AMOUNT_LIMITS.MIN) {
    return { isValid: false, error: `Amount must be at least ${AMOUNT_LIMITS.MIN}` };
  }

  if (numValue > AMOUNT_LIMITS.MAX) {
    return { isValid: false, error: `Amount must not exceed ${AMOUNT_LIMITS.MAX.toExponential()}` };
  }

  // Check decimal places
  const decimalStr = numValue.toString();
  const decimalPart = decimalStr.includes('.') ? decimalStr.split('.')[1] : '';
  if (decimalPart.length > AMOUNT_LIMITS.MAX_DECIMAL_PLACES) {
    return {
      isValid: false,
      error: `Amount must have at most ${AMOUNT_LIMITS.MAX_DECIMAL_PLACES} decimal places`,
    };
  }

  return { isValid: true };
}

export function validateCurrency(value: string | undefined): ValidationResult {
  if (!value) {
    return { isValid: false, error: 'Currency is required' };
  }

  const upperValue = value.toUpperCase();
  if (!VALID_CURRENCIES.includes(upperValue as any)) {
    return {
      isValid: false,
      error: `Invalid currency code. Valid codes include: ${VALID_CURRENCIES.slice(0, 10).join(', ')}...`,
    };
  }

  return { isValid: true };
}

export function validateRegion(value: string | undefined): ValidationResult {
  if (!value) {
    return { isValid: false, error: 'Region is required' };
  }

  if (!REGIONS.includes(value as any)) {
    return { isValid: false, error: `Invalid region. Valid regions: ${REGIONS.join(', ')}` };
  }

  return { isValid: true };
}

export function validateVertical(value: string | undefined): ValidationResult {
  if (!value) {
    return { isValid: false, error: 'Vertical is required' };
  }

  if (!VERTICALS.includes(value as any)) {
    return { isValid: false, error: `Invalid vertical. Valid verticals: ${VERTICALS.join(', ')}` };
  }

  return { isValid: true };
}

export function validateRegions(values: string[] | undefined): ValidationResult {
  if (!values || values.length === 0) {
    return { isValid: false, error: 'At least one region is required' };
  }

  const invalidRegions = values.filter((r) => !REGIONS.includes(r as any));
  if (invalidRegions.length > 0) {
    return { isValid: false, error: `Invalid regions: ${invalidRegions.join(', ')}` };
  }

  return { isValid: true };
}

export function validateEmail(value: string | undefined): ValidationResult {
  if (!value) {
    return { isValid: true }; // Email might be optional
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
}

// ============================================================================
// Form Validators
// ============================================================================

export interface InstitutionFormData {
  name: string;
  regions: string[];
  verticals?: string[];
}

export function validateInstitutionForm(data: InstitutionFormData): FieldErrors {
  const errors: FieldErrors = {};

  const nameResult = validateStringLength(data.name, 'Name', STRING_LIMITS.NAME);
  if (!nameResult.isValid) errors.name = nameResult.error;

  const regionsResult = validateRegions(data.regions);
  if (!regionsResult.isValid) errors.regions = regionsResult.error;

  return errors;
}

export interface AssetTemplateFormData {
  code: string;
  name: string;
  vertical: string;
  region: string;
}

export function validateAssetTemplateForm(data: AssetTemplateFormData): FieldErrors {
  const errors: FieldErrors = {};

  const codeResult = validateRequired(data.code, 'Code');
  if (!codeResult.isValid) errors.code = codeResult.error;

  const nameResult = validateStringLength(data.name, 'Name', STRING_LIMITS.NAME);
  if (!nameResult.isValid) errors.name = nameResult.error;

  const verticalResult = validateVertical(data.vertical);
  if (!verticalResult.isValid) errors.vertical = verticalResult.error;

  const regionResult = validateRegion(data.region);
  if (!regionResult.isValid) errors.region = regionResult.error;

  return errors;
}

export interface AssetFormData {
  templateId: string;
  label: string;
}

export function validateAssetForm(data: AssetFormData): FieldErrors {
  const errors: FieldErrors = {};

  const templateResult = validateRequired(data.templateId, 'Template');
  if (!templateResult.isValid) errors.templateId = templateResult.error;

  const labelResult = validateStringLength(data.label, 'Label', STRING_LIMITS.LABEL);
  if (!labelResult.isValid) errors.label = labelResult.error;

  return errors;
}

export interface PositionFormData {
  assetId: string;
  holderReference: string;
  currency: string;
  amount: number | string;
}

export function validatePositionForm(data: PositionFormData): FieldErrors {
  const errors: FieldErrors = {};

  const assetResult = validateRequired(data.assetId, 'Asset');
  if (!assetResult.isValid) errors.assetId = assetResult.error;

  const holderResult = validateStringLength(data.holderReference, 'Holder Reference', STRING_LIMITS.REFERENCE);
  if (!holderResult.isValid) errors.holderReference = holderResult.error;

  const currencyResult = validateCurrency(data.currency);
  if (!currencyResult.isValid) errors.currency = currencyResult.error;

  const amountResult = validateAmount(data.amount);
  if (!amountResult.isValid) errors.amount = amountResult.error;

  return errors;
}

export interface PolicyFormData {
  minAmount?: number | string;
  maxAmount?: number | string;
  allowedCurrencies?: string[];
}

export function validatePolicyForm(data: PolicyFormData): FieldErrors {
  const errors: FieldErrors = {};

  if (data.minAmount !== undefined && data.minAmount !== '') {
    const minResult = validateAmount(data.minAmount);
    if (!minResult.isValid) errors.minAmount = minResult.error;
  }

  if (data.maxAmount !== undefined && data.maxAmount !== '') {
    const maxResult = validateAmount(data.maxAmount);
    if (!maxResult.isValid) errors.maxAmount = maxResult.error;
  }

  // Check min <= max
  if (data.minAmount && data.maxAmount) {
    const min = typeof data.minAmount === 'string' ? parseFloat(data.minAmount) : data.minAmount;
    const max = typeof data.maxAmount === 'string' ? parseFloat(data.maxAmount) : data.maxAmount;
    if (!isNaN(min) && !isNaN(max) && min > max) {
      errors.minAmount = 'Minimum amount must be less than or equal to maximum';
    }
  }

  // Validate currencies if provided
  if (data.allowedCurrencies && data.allowedCurrencies.length > 0) {
    const invalidCurrencies = data.allowedCurrencies.filter(
      (c) => !VALID_CURRENCIES.includes(c.toUpperCase() as any),
    );
    if (invalidCurrencies.length > 0) {
      errors.allowedCurrencies = `Invalid currencies: ${invalidCurrencies.join(', ')}`;
    }
  }

  return errors;
}

export interface ApiKeyFormData {
  label: string;
  role: string;
}

export function validateApiKeyForm(data: ApiKeyFormData): FieldErrors {
  const errors: FieldErrors = {};

  const labelResult = validateStringLength(data.label, 'Label', STRING_LIMITS.LABEL);
  if (!labelResult.isValid) errors.label = labelResult.error;

  const roleResult = validateRequired(data.role, 'Role');
  if (!roleResult.isValid) errors.role = roleResult.error;
  else if (data.role !== 'admin' && data.role !== 'read_only') {
    errors.role = 'Role must be either "admin" or "read_only"';
  }

  return errors;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some((e) => e !== undefined);
}

export function getFirstError(errors: FieldErrors): string | undefined {
  return Object.values(errors).find((e) => e !== undefined);
}
