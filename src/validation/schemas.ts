import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/**
 * ISO 4217 currency codes commonly used in financial applications.
 * This list can be extended as needed.
 */
export const VALID_CURRENCY_CODES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  'CNY', 'HKD', 'SGD', 'INR', 'MXN', 'BRL', 'ZAR', 'AED',
  'SAR', 'KRW', 'TWD', 'THB', 'MYR', 'IDR', 'PHP', 'VND',
  'PLN', 'SEK', 'NOK', 'DKK', 'CZK', 'HUF', 'ILS', 'TRY',
] as const;

export type CurrencyCode = (typeof VALID_CURRENCY_CODES)[number];

/**
 * String length limits to prevent abuse and ensure data consistency.
 */
export const STRING_LIMITS = {
  NAME: { min: 1, max: 255 },
  LABEL: { min: 1, max: 255 },
  CODE: { min: 1, max: 50 },
  REFERENCE: { min: 1, max: 255 },
  REASON: { min: 0, max: 1000 },
} as const;

/**
 * Amount limits for financial safety.
 * Min: 0.00000001 (8 decimal places for crypto compatibility)
 * Max: 10^15 (quadrillion - well within safe JS integer range)
 */
export const AMOUNT_LIMITS = {
  MIN: 0.00000001,
  MAX: 1_000_000_000_000_000, // 10^15
  MAX_DECIMAL_PLACES: 8,
} as const;

/**
 * Metadata limits to prevent abuse.
 */
export const METADATA_LIMITS = {
  MAX_SIZE_BYTES: 65536, // 64KB
  MAX_DEPTH: 10,
} as const;

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Region enum schema
 */
export const RegionSchema = z.enum(['US', 'EU_UK', 'SG', 'UAE']);
export type Region = z.infer<typeof RegionSchema>;

/**
 * Vertical enum schema
 */
export const VerticalSchema = z.enum(['CONSTRUCTION', 'TRADE_FINANCE']);
export type Vertical = z.infer<typeof VerticalSchema>;

/**
 * Position state enum schema
 */
export const PositionStateSchema = z.enum([
  'CREATED',
  'FUNDED',
  'PARTIALLY_RELEASED',
  'RELEASED',
  'CANCELLED',
  'EXPIRED',
]);
export type PositionState = z.infer<typeof PositionStateSchema>;

/**
 * API key role enum schema
 */
export const ApiKeyRoleSchema = z.enum(['admin', 'read_only']);
export type ApiKeyRole = z.infer<typeof ApiKeyRoleSchema>;

/**
 * Asset template code enum schema
 */
export const TemplateCodeSchema = z.enum([
  'CONSTR_ESCROW',
  'CONSTR_RETAINAGE',
  'TF_INVOICE',
  'TF_LC',
]);
export type TemplateCode = z.infer<typeof TemplateCodeSchema>;

/**
 * Currency code schema with ISO 4217 validation
 */
export const CurrencyCodeSchema = z
  .string()
  .min(3, 'Currency code must be 3 characters')
  .max(3, 'Currency code must be 3 characters')
  .toUpperCase()
  .refine(
    (code) => VALID_CURRENCY_CODES.includes(code as CurrencyCode),
    (code) => ({ message: `Invalid currency code: ${code}. Must be a valid ISO 4217 code.` }),
  );

/**
 * Monetary amount schema with precision and range validation
 */
export const AmountSchema = z
  .number()
  .positive('Amount must be positive')
  .min(AMOUNT_LIMITS.MIN, `Amount must be at least ${AMOUNT_LIMITS.MIN}`)
  .max(AMOUNT_LIMITS.MAX, `Amount must not exceed ${AMOUNT_LIMITS.MAX}`)
  .refine(
    (amount) => {
      const decimalStr = amount.toString();
      const decimalPart = decimalStr.includes('.') ? decimalStr.split('.')[1] : '';
      return decimalPart.length <= AMOUNT_LIMITS.MAX_DECIMAL_PLACES;
    },
    `Amount must have at most ${AMOUNT_LIMITS.MAX_DECIMAL_PLACES} decimal places`,
  );

/**
 * Helper to check JSON depth
 */
function getJsonDepth(obj: unknown, currentDepth = 0): number {
  if (currentDepth > METADATA_LIMITS.MAX_DEPTH) return currentDepth;
  if (typeof obj !== 'object' || obj === null) return currentDepth;

  if (Array.isArray(obj)) {
    return Math.max(currentDepth, ...obj.map((item) => getJsonDepth(item, currentDepth + 1)));
  }

  return Math.max(
    currentDepth,
    ...Object.values(obj).map((value) => getJsonDepth(value, currentDepth + 1)),
  );
}

/**
 * Metadata schema with size and depth limits
 */
export const MetadataSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .refine(
    (metadata) => {
      if (!metadata) return true;
      const jsonStr = JSON.stringify(metadata);
      return Buffer.byteLength(jsonStr, 'utf8') <= METADATA_LIMITS.MAX_SIZE_BYTES;
    },
    `Metadata must not exceed ${METADATA_LIMITS.MAX_SIZE_BYTES / 1024}KB`,
  )
  .refine(
    (metadata) => {
      if (!metadata) return true;
      return getJsonDepth(metadata) <= METADATA_LIMITS.MAX_DEPTH;
    },
    `Metadata nesting depth must not exceed ${METADATA_LIMITS.MAX_DEPTH} levels`,
  );

// ============================================================================
// Institution Schemas
// ============================================================================

export const CreateInstitutionSchema = z.object({
  name: z
    .string()
    .min(STRING_LIMITS.NAME.min, 'Name is required')
    .max(STRING_LIMITS.NAME.max, `Name must not exceed ${STRING_LIMITS.NAME.max} characters`),
  regions: z
    .array(RegionSchema)
    .min(1, 'At least one region is required')
    .max(10, 'Too many regions'),
  verticals: z.array(VerticalSchema).optional(),
});

export type CreateInstitutionInput = z.infer<typeof CreateInstitutionSchema>;

// ============================================================================
// API Key Schemas
// ============================================================================

export const CreateApiKeySchema = z.object({
  label: z
    .string()
    .min(STRING_LIMITS.LABEL.min, 'Label is required')
    .max(STRING_LIMITS.LABEL.max, `Label must not exceed ${STRING_LIMITS.LABEL.max} characters`),
  role: ApiKeyRoleSchema,
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;

// ============================================================================
// Asset Template Schemas
// ============================================================================

export const CreateAssetTemplateSchema = z.object({
  institutionId: z.string().optional(), // Only for root key
  code: TemplateCodeSchema,
  name: z
    .string()
    .min(STRING_LIMITS.NAME.min, 'Name is required')
    .max(STRING_LIMITS.NAME.max, `Name must not exceed ${STRING_LIMITS.NAME.max} characters`),
  vertical: VerticalSchema,
  region: RegionSchema,
  config: z.record(z.string(), z.unknown()).optional(),
});

export type CreateAssetTemplateInput = z.infer<typeof CreateAssetTemplateSchema>;

// ============================================================================
// Asset Schemas
// ============================================================================

export const CreateAssetSchema = z.object({
  institutionId: z.string().optional(), // Only for root key
  templateId: z.string().min(1, 'Template ID is required'),
  label: z
    .string()
    .min(STRING_LIMITS.LABEL.min, 'Label is required')
    .max(STRING_LIMITS.LABEL.max, `Label must not exceed ${STRING_LIMITS.LABEL.max} characters`),
  metadata: MetadataSchema,
});

export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;

// ============================================================================
// Position Schemas
// ============================================================================

export const CreatePositionSchema = z.object({
  institutionId: z.string().optional(), // Only for root key
  assetId: z.string().min(1, 'Asset ID is required'),
  holderReference: z
    .string()
    .min(STRING_LIMITS.REFERENCE.min, 'Holder reference is required')
    .max(
      STRING_LIMITS.REFERENCE.max,
      `Holder reference must not exceed ${STRING_LIMITS.REFERENCE.max} characters`,
    ),
  currency: CurrencyCodeSchema,
  amount: AmountSchema,
  externalReference: z
    .string()
    .max(
      STRING_LIMITS.REFERENCE.max,
      `External reference must not exceed ${STRING_LIMITS.REFERENCE.max} characters`,
    )
    .optional(),
});

export type CreatePositionInput = z.infer<typeof CreatePositionSchema>;

export const TransitionPositionSchema = z.object({
  toState: PositionStateSchema,
  reason: z
    .string()
    .max(
      STRING_LIMITS.REASON.max,
      `Reason must not exceed ${STRING_LIMITS.REASON.max} characters`,
    )
    .optional(),
  metadata: MetadataSchema,
});

export type TransitionPositionInput = z.infer<typeof TransitionPositionSchema>;

// ============================================================================
// Policy Schemas
// ============================================================================

export const PositionPolicyConfigSchema = z
  .object({
    minAmount: AmountSchema.optional(),
    maxAmount: AmountSchema.optional(),
    allowedCurrencies: z.array(CurrencyCodeSchema).optional(),
  })
  .refine(
    (config) => {
      if (config.minAmount !== undefined && config.maxAmount !== undefined) {
        return config.minAmount <= config.maxAmount;
      }
      return true;
    },
    { message: 'minAmount must be less than or equal to maxAmount' },
  );

export const UpsertPolicySchema = z.object({
  position: PositionPolicyConfigSchema,
});

export type UpsertPolicyInput = z.infer<typeof UpsertPolicySchema>;

// ============================================================================
// Pagination Schema
// ============================================================================

export const PaginationSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(1000, 'Limit must not exceed 1000')
    .optional()
    .default(100),
  offset: z.coerce
    .number()
    .int()
    .min(0, 'Offset must be non-negative')
    .optional()
    .default(0),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ============================================================================
// Validation Middleware Helper
// ============================================================================

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';

/**
 * Format Zod validation errors into a user-friendly format
 */
export function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Creates an Express middleware that validates request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatZodError(result.error),
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Creates an Express middleware that validates request query against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: formatZodError(result.error),
      });
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}
