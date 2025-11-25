import type { AuthContext } from '../middleware/auth';

export type AuditAction =
  | 'INSTITUTION_CREATED'
  | 'API_KEY_CREATED'
  | 'ASSET_TEMPLATE_CREATED'
  | 'ASSET_CREATED'
  | 'POSITION_CREATED'
  | 'POSITION_TRANSITIONED';

export interface AuditEventInput {
  action: AuditAction;
  method: string;
  path: string;
  requestId?: string;
  resourceType?: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  auth?: AuthContext;
  occurredAt?: string;
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
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  payload?: Record<string, unknown> | undefined;
}

