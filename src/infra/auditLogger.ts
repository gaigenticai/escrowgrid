import { Pool } from 'pg';
import { config, requirePostgresUrl } from '../config';
import { createAppPool } from './db';
import type { AuditEvent, AuditEventInput } from '../domain/audit';

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}

export interface AuditLogger {
  record(event: AuditEventInput): Promise<void>;
}

class InMemoryAuditLogger implements AuditLogger {
  private events: AuditEvent[] = [];

  async record(event: AuditEventInput): Promise<void> {
    const occurredAt = event.occurredAt ?? now();
    const createdAt = now();
    const record: AuditEvent = {
      id: generateId('aud'),
      occurredAt,
      createdAt,
      requestId: event.requestId,
      apiKeyId: event.auth?.apiKeyId,
      institutionId: event.auth?.institutionId,
      method: event.method,
      path: event.path,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      payload: event.payload,
    };
    this.events.push(record);
    // Also emit structured console log
    console.log(
      JSON.stringify({
        type: 'audit',
        ...record,
      }),
    );
  }
}

class PostgresAuditLogger implements AuditLogger {
  private pool: Pool;

  constructor() {
    const connectionString = requirePostgresUrl();
    this.pool = createAppPool(connectionString);
  }

  async record(event: AuditEventInput): Promise<void> {
    const id = generateId('aud');
    const occurredAt = event.occurredAt ?? now();
    const createdAt = now();
    const apiKeyId = event.auth?.apiKeyId ?? null;
    const institutionId = event.auth?.institutionId ?? null;

    await this.pool.query(
      `INSERT INTO audit_events
       (id, occurred_at, created_at, api_key_id, institution_id, method, path, action, resource_type, resource_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        occurredAt,
        createdAt,
        apiKeyId,
        institutionId,
        event.method,
        event.path,
        event.action,
        event.resourceType ?? null,
        event.resourceId ?? null,
        event.payload ?? null,
      ],
    );

    console.log(
      JSON.stringify({
        type: 'audit',
        id,
        occurredAt,
        createdAt,
        requestId: event.requestId ?? null,
        apiKeyId,
        institutionId,
        method: event.method,
        path: event.path,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
      }),
    );
  }
}

let auditLoggerInstance: AuditLogger;

if (config.storeBackend === 'postgres') {
  auditLoggerInstance = new PostgresAuditLogger();
} else {
  auditLoggerInstance = new InMemoryAuditLogger();
}

export const auditLogger: AuditLogger = auditLoggerInstance;

