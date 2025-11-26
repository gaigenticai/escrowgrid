import type { AuthContext } from '../middleware/auth';

/**
 * Audit actions for successful operations
 */
export type AuditSuccessAction =
  | 'INSTITUTION_CREATED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'ASSET_TEMPLATE_CREATED'
  | 'ASSET_CREATED'
  | 'POSITION_CREATED'
  | 'POSITION_TRANSITIONED'
  | 'POLICY_UPDATED';

/**
 * Audit actions for failed operations - critical for security monitoring
 */
export type AuditFailureAction =
  | 'AUTH_FAILED'
  | 'AUTH_FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'RESOURCE_NOT_FOUND'
  | 'CONCURRENCY_CONFLICT'
  | 'ONCHAIN_LEDGER_FAILED'
  | 'ONCHAIN_LEDGER_RETRY_EXHAUSTED';

export type AuditAction = AuditSuccessAction | AuditFailureAction;

/**
 * Outcome of the audited operation
 */
export type AuditOutcome = 'success' | 'failure';

export interface AuditEventInput {
  action: AuditAction;
  outcome: AuditOutcome;
  method: string;
  path: string;
  requestId?: string;
  resourceType?: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  auth?: AuthContext;
  occurredAt?: string;
  /**
   * Error details for failed operations
   */
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
  /**
   * HTTP status code returned
   */
  statusCode?: number;
  /**
   * Client IP address for security tracking
   */
  clientIp?: string;
}

export interface AuditEvent {
  id: string;
  occurredAt: string;
  createdAt: string;
  requestId?: string | undefined;
  apiKeyId?: string | undefined;
  institutionId?: string | undefined;
  method: string;
  path: string;
  action: AuditAction;
  outcome: AuditOutcome;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  payload?: Record<string, unknown> | undefined;
  error?: { code?: string; message: string; details?: unknown } | undefined;
  statusCode?: number | undefined;
  clientIp?: string | undefined;
}

