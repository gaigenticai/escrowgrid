import crypto from 'crypto';

/**
 * Generates a cryptographically secure unique identifier.
 *
 * Uses crypto.randomUUID() which provides 122 bits of randomness,
 * making IDs unpredictable and suitable for security-sensitive contexts
 * like financial transactions and API keys.
 *
 * Format: `{prefix}_{uuid}` e.g., `pos_550e8400-e29b-41d4-a716-446655440000`
 *
 * @param prefix - Short identifier prefix (e.g., 'pos', 'inst', 'ak')
 * @returns Prefixed UUID string
 */
export function generateSecureId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * Generates a current ISO timestamp string.
 * Centralized to ensure consistent timestamp formatting across the codebase.
 *
 * @returns ISO 8601 formatted timestamp string
 */
export function now(): string {
  return new Date().toISOString();
}
