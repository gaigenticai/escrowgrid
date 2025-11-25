# Audit Logging

<cite>
**Referenced Files in This Document**
- [src/domain/audit.ts](file://src/domain/audit.ts)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts)
- [db/schema.sql](file://db/schema.sql)
- [src/middleware/auth.ts](file://src/middleware/auth.ts)
- [src/middleware/requestLogger.ts](file://src/middleware/requestLogger.ts)
- [src/api/assets.ts](file://src/api/assets.ts)
- [src/api/positions.ts](file://src/api/positions.ts)
- [src/api/institutions.ts](file://src/api/institutions.ts)
- [src/api/policies.ts](file://src/api/policies.ts)
- [src/config.ts](file://src/config.ts)
- [src/server.ts](file://src/server.ts)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Core Data Model](#core-data-model)
4. [Audit Logger Implementation](#audit-logger-implementation)
5. [API Integration](#api-integration)
6. [Database Schema](#database-schema)
7. [Configuration Management](#configuration-management)
8. [Security and Compliance](#security-and-compliance)
9. [Performance Considerations](#performance-considerations)
10. [Query Patterns and Reporting](#query-patterns-and-reporting)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Best Practices](#best-practices)

## Introduction

The EscrowGrid audit logging system provides comprehensive observability and compliance capabilities for the financial escrow platform. Built on a dual-mode architecture, it captures detailed audit trails of all API operations while maintaining flexibility for both development testing and production durability requirements.

The system implements structured JSON logging with standardized event formats, enabling real-time monitoring, compliance reporting, and forensic analysis. It supports configurable storage backends (memory for development, PostgreSQL for production) and integrates seamlessly with the authentication middleware to capture contextual information about who performed which actions.

## System Architecture

The audit logging system follows a layered architecture with clear separation of concerns:

```mermaid
graph TB
subgraph "Application Layer"
API[API Endpoints]
Middleware[Authentication Middleware]
Auth[Auth Context]
end
subgraph "Audit Infrastructure"
Logger[Audit Logger Interface]
InMemLogger[InMemoryAuditLogger]
PGLogger[PostgresAuditLogger]
Config[Configuration Manager]
end
subgraph "Storage Layer"
Memory[In-Memory Events]
PG[(PostgreSQL Database)]
Indexes[Database Indexes]
end
subgraph "External Systems"
Logs[Log Aggregation]
Monitoring[Monitoring Tools]
Compliance[Compliance Systems]
end
API --> Middleware
Middleware --> Auth
API --> Logger
Logger --> InMemLogger
Logger --> PGLogger
InMemLogger --> Memory
PGLogger --> PG
PG --> Indexes
PGLogger --> Logs
InMemLogger --> Logs
Logs --> Monitoring
Logs --> Compliance
```

**Diagram sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L13-L109)
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L8-L21)
- [src/server.ts](file://src/server.ts#L12-L24)

**Section sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L1-L109)
- [src/server.ts](file://src/server.ts#L12-L24)

## Core Data Model

The audit system defines a comprehensive data model for capturing all relevant information about API operations:

### Audit Event Types

The system supports six primary audit actions:

| Action Type | Description | Resource Affected |
|-------------|-------------|-------------------|
| `INSTITUTION_CREATED` | New institution registration | Institution entity |
| `API_KEY_CREATED` | API key generation | API key entity |
| `ASSET_TEMPLATE_CREATED` | Asset template creation | Asset template entity |
| `ASSET_CREATED` | Asset instantiation | Asset entity |
| `POSITION_CREATED` | Position establishment | Position entity |
| `POSITION_TRANSITIONED` | Position state change | Position entity |

### Audit Event Structure

```mermaid
classDiagram
class AuditEventInput {
+AuditAction action
+string method
+string path
+string resourceType?
+string resourceId?
+Record~string, unknown~ payload?
+AuthContext auth?
+string occurredAt?
}
class AuditEvent {
+string id
+string occurredAt
+string createdAt
+string apiKeyId?
+string institutionId?
+string method
+string path
+AuditAction action
+string resourceType?
+string resourceId?
+Record~string, unknown~ payload?
}
class AuthContext {
+AuthRole role
+string institutionId?
+string apiKeyId?
}
AuditEventInput --> AuthContext : "includes"
AuditEvent --> AuthContext : "derived from"
```

**Diagram sources**
- [src/domain/audit.ts](file://src/domain/audit.ts#L11-L35)
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L8-L12)

### Structured JSON Format

All audit events are emitted as structured JSON logs with the following format:

```json
{
  "type": "audit",
  "id": "aud_abc123def456",
  "occurredAt": "2024-01-15T10:30:00.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "apiKeyId": "key_abc123",
  "institutionId": "inst_xyz789",
  "method": "POST",
  "path": "/api/v1/positions",
  "action": "POSITION_CREATED",
  "resourceType": "position",
  "resourceId": "pos_def456",
  "payload": {
    "institutionId": "inst_xyz789",
    "assetId": "ast_ghi789",
    "holderReference": "REF-12345",
    "currency": "USD",
    "amount": 100000.00
  }
}
```

**Section sources**
- [src/domain/audit.ts](file://src/domain/audit.ts#L1-L36)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L38-L44)

## Audit Logger Implementation

The system provides two distinct implementations of the AuditLogger interface, each optimized for different environments:

### InMemoryAuditLogger

Designed for development and testing environments, this implementation stores audit events in memory with immediate console logging:

```mermaid
classDiagram
class InMemoryAuditLogger {
-events : AuditEvent[]
+record(event : AuditEventInput) : Promise~void~
}
class AuditLogger {
<<interface>>
+record(event : AuditEventInput) : Promise~void~
}
InMemoryAuditLogger ..|> AuditLogger : implements
```

**Diagram sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L17-L44)

Key characteristics:
- **Storage**: In-memory array with automatic JSON console emission
- **Persistence**: Transient storage (lost on restart)
- **Performance**: Zero-latency recording
- **Use Case**: Development, testing, local debugging

### PostgresAuditLogger

Production-ready implementation with durable storage and indexing:

```mermaid
classDiagram
class PostgresAuditLogger {
-pool : Pool
+constructor()
+record(event : AuditEventInput) : Promise~void~
}
class AuditLogger {
<<interface>>
+record(event : AuditEventInput) : Promise~void~
}
PostgresAuditLogger ..|> AuditLogger : implements
```

**Diagram sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L47-L96)

Production features:
- **Storage**: PostgreSQL database with JSONB payload support
- **Indexing**: Composite indexes on `(institution_id, occurred_at)` and `(api_key_id, occurred_at)`
- **Durability**: ACID-compliant transactions
- **Scalability**: Optimized for high-volume write operations

### Configuration-Driven Instantiation

The system automatically selects the appropriate logger based on configuration:

```mermaid
flowchart TD
Start([Application Startup]) --> CheckConfig["Check config.storeBackend"]
CheckConfig --> IsPostgres{"storeBackend === 'postgres'?"}
IsPostgres --> |Yes| CreatePG["new PostgresAuditLogger()"]
IsPostgres --> |No| CreateInMem["new InMemoryAuditLogger()"]
CreatePG --> Export["Export auditLogger"]
CreateInMem --> Export
Export --> Ready([Ready for Use])
```

**Diagram sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L101-L107)

**Section sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L13-L109)
- [src/config.ts](file://src/config.ts#L1-L47)

## API Integration

Audit events are captured at strategic points throughout the API lifecycle, ensuring comprehensive coverage of all user interactions:

### Authentication Context Capture

The system leverages the authentication middleware to capture contextual information:

```mermaid
sequenceDiagram
participant Client as "API Client"
participant Auth as "Auth Middleware"
participant API as "API Endpoint"
participant Logger as "Audit Logger"
participant Storage as "Storage Backend"
Client->>Auth : Request with API Key
Auth->>Auth : Validate Credentials
Auth->>API : Attach Auth Context
API->>API : Process Business Logic
API->>Logger : record(auditEvent)
Logger->>Storage : Store Audit Event
Logger->>Client : Console Log JSON
API->>Client : Response
```

**Diagram sources**
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L35-L81)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L20-L44)

### Example Audit Trail Generation

#### Position Creation Audit Trail

```typescript
// API Endpoint: POST /api/v1/positions
await auditLogger.record({
  action: 'POSITION_CREATED',
  method: req.method,
  path: req.path,
  resourceType: 'position',
  resourceId: position.id,
  payload: {
    institutionId: effectiveInstitutionId,
    assetId,
    holderReference,
    currency,
    amount,
  },
  auth,
});
```

#### Position State Transition Audit Trail

```typescript
// API Endpoint: POST /api/v1/positions/:id/transition
await auditLogger.record({
  action: 'POSITION_TRANSITIONED',
  method: req.method,
  path: req.path,
  resourceType: 'position',
  resourceId: updated.id,
  payload: {
    fromState: lifecycleEvent?.fromState,
    toState: lifecycleEvent?.toState,
    reason,
  },
  auth,
});
```

### Supported API Operations

The audit system captures events across all major API endpoints:

| Endpoint Pattern | Actions Captured | Resource Context |
|------------------|------------------|------------------|
| `POST /institutions` | `INSTITUTION_CREATED` | Institution entity |
| `POST /assets` | `ASSET_CREATED` | Asset entity |
| `POST /positions` | `POSITION_CREATED` | Position entity |
| `POST /positions/:id/transition` | `POSITION_TRANSITIONED` | Position entity |
| `PUT /institutions/:id/policies/:region` | Policy modifications | Institution policies |

**Section sources**
- [src/api/assets.ts](file://src/api/assets.ts#L68-L80)
- [src/api/positions.ts](file://src/api/positions.ts#L129-L143)
- [src/api/positions.ts](file://src/api/positions.ts#L272-L284)
- [src/api/institutions.ts](file://src/api/institutions.ts#L45-L57)

## Database Schema

The audit_events table provides the foundation for persistent audit storage with optimized query performance:

### Table Structure

```mermaid
erDiagram
AUDIT_EVENTS {
text id PK
timestamptz occurred_at
timestamptz created_at
text api_key_id FK
text institution_id FK
text method
text path
text action
text resource_type
text resource_id
jsonb payload
}
INSTITUTIONS {
text id PK
text name
text[] regions
text[] verticals
timestamptz created_at
timestamptz updated_at
}
API_KEYS {
text id PK
text institution_id FK
text key_hash
text label
text role
timestamptz created_at
timestamptz revoked_at
}
AUDIT_EVENTS ||--|| INSTITUTIONS : "institution_id"
AUDIT_EVENTS ||--|| API_KEYS : "api_key_id"
```

**Diagram sources**
- [db/schema.sql](file://db/schema.sql#L106-L118)

### Index Strategy

The database schema includes strategically placed indexes for optimal query performance:

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_audit_events_institution` | `(institution_id, occurred_at)` | Institution-based audit queries |
| `idx_audit_events_api_key` | `(api_key_id, occurred_at)` | API key activity tracking |
| Primary Key | `id` | Unique event identification |

### Query Optimization

The schema supports efficient compliance and audit queries:

```sql
-- Compliance report: Institution activity within date range
SELECT * FROM audit_events 
WHERE institution_id = 'inst_xyz789' 
AND occurred_at BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY occurred_at DESC;

-- API key usage analysis
SELECT action, COUNT(*) as count 
FROM audit_events 
WHERE api_key_id = 'key_abc123' 
GROUP BY action 
ORDER BY count DESC;
```

**Section sources**
- [db/schema.sql](file://db/schema.sql#L106-L125)

## Configuration Management

The audit logging system integrates with the application's configuration framework to provide flexible deployment options:

### Environment-Based Configuration

```mermaid
flowchart TD
EnvVars[Environment Variables] --> ConfigParser[Configuration Parser]
ConfigParser --> StoreBackend{STORE_BACKEND}
StoreBackend --> |postgres| PGMode[PostgreSQL Mode]
StoreBackend --> |memory| MemMode[Memory Mode]
PGMode --> PGConfig[PostgreSQL URL Required]
MemMode --> MemConfig[Development Settings]
PGConfig --> PGLogger[PostgresAuditLogger]
MemConfig --> InMemLogger[InMemoryAuditLogger]
PGLogger --> AuditSystem[Audit System Active]
InMemLogger --> AuditSystem
```

**Diagram sources**
- [src/config.ts](file://src/config.ts#L23-L26)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L101-L107)

### Configuration Parameters

| Parameter | Environment Variable | Default | Description |
|-----------|---------------------|---------|-------------|
| `storeBackend` | `STORE_BACKEND` | `'memory'` | Storage backend selection |
| `postgresUrl` | `DATABASE_URL` | `undefined` | PostgreSQL connection string |
| `rootApiKey` | `ROOT_API_KEY` | `undefined` | Root API key for unrestricted access |

### Production Deployment

For production environments, ensure proper configuration:

```bash
# PostgreSQL backend for durability
STORE_BACKEND=postgres
DATABASE_URL=postgresql://user:password@host:5432/database

# Root API key for administrative operations
ROOT_API_KEY=your_root_api_key_here
```

**Section sources**
- [src/config.ts](file://src/config.ts#L1-L47)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L101-L107)

## Security and Compliance

The audit logging system implements several security measures to ensure log integrity and compliance with regulatory requirements:

### Log Integrity

- **Immutable Events**: Once recorded, audit events cannot be modified or deleted
- **Timestamp Precision**: Millisecond-level timestamps for precise event ordering
- **Unique Identifiers**: UUID-like identifiers prevent event tampering
- **Structured Format**: Standardized JSON format ensures consistency

### Access Controls

The system respects the authentication hierarchy:

| Role Level | Access Scope | Audit Coverage |
|------------|--------------|----------------|
| Root | All institutions | Complete system visibility |
| Admin | Own institution | Institution-specific activities |
| Read Only | Own institution | Read operations only |

### Compliance Features

#### Retention Policies

Implement retention policies based on regulatory requirements:

```sql
-- Example retention policy (30 days)
DELETE FROM audit_events 
WHERE occurred_at < NOW() - INTERVAL '30 days';

-- Archive older events
CREATE TABLE audit_events_archive AS 
SELECT * FROM audit_events 
WHERE occurred_at < '2024-01-01';

-- Cleanup archive trigger
TRUNCATE TABLE audit_events_archive;
```

#### Privacy Protection

Sensitive data protection through selective logging:

```typescript
// Example: Mask sensitive payment information
await auditLogger.record({
  action: 'PAYMENT_PROCESSED',
  method: req.method,
  path: req.path,
  payload: {
    // Sensitive fields masked
    cardNumber: '**** **** **** 1234',
    amount: payment.amount,
    currency: payment.currency
  },
  auth,
});
```

### Regulatory Compliance

The system supports various compliance frameworks:

- **SOX**: Transactional audit trails with immutable records
- **PCI DSS**: Payment processing audit requirements
- **GDPR**: Data protection with selective information masking
- **KYC/AML**: Customer due diligence tracking

## Performance Considerations

The audit logging system is designed to handle high-volume environments with minimal impact on application performance:

### Write Performance

#### Memory vs. Database Comparison

| Aspect | InMemoryAuditLogger | PostgresAuditLogger |
|--------|-------------------|-------------------|
| Latency | ~0.1ms | 5-10ms (network + disk) |
| Throughput | Unlimited (memory) | 1000+ TPS |
| Durability | No persistence | ACID guarantees |
| Scalability | Single instance | Horizontal scaling |

#### Batch Processing Options

For high-volume scenarios, consider batch processing:

```typescript
// Batch audit events for improved throughput
const batchEvents = events.map(event => ({
  ...event,
  id: generateId('aud')
}));

await this.pool.query(
  'INSERT INTO audit_events SELECT * FROM unnest($1::audit_events[])',
  [batchEvents]
);
```

### Query Performance

#### Index Utilization

The database schema provides optimized indexes for common query patterns:

```sql
-- Fast institution-based queries
EXPLAIN ANALYZE 
SELECT * FROM audit_events 
WHERE institution_id = 'inst_xyz789' 
AND occurred_at > '2024-01-01'
ORDER BY occurred_at DESC 
LIMIT 100;

-- Efficient API key analysis
EXPLAIN ANALYZE 
SELECT action, COUNT(*) 
FROM audit_events 
WHERE api_key_id = 'key_abc123' 
GROUP BY action;
```

#### Query Optimization Strategies

1. **Partitioning**: Consider table partitioning for historical data
2. **Materialized Views**: Create pre-aggregated views for common reports
3. **Connection Pooling**: Optimize PostgreSQL connection management
4. **Async Logging**: Implement asynchronous logging for non-critical events

### Memory Management

#### In-Memory Logger Limits

For development environments, implement memory limits:

```typescript
class MemoryLimitedLogger implements AuditLogger {
  private events: AuditEvent[] = [];
  private readonly maxEvents = 10000;
  
  async record(event: AuditEventInput): Promise<void> {
    if (this.events.length >= this.maxEvents) {
      this.events.shift(); // Remove oldest
    }
    // Record event...
  }
}
```

#### Garbage Collection Impact

Monitor garbage collection impact in long-running applications:

```javascript
// Monitor memory usage
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log('Memory:', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
  });
}, 30000);
```

**Section sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L17-L44)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L89-L96)

## Query Patterns and Reporting

The audit system supports sophisticated query patterns for compliance reporting and operational insights:

### Compliance Reporting Queries

#### Daily Activity Report

```sql
SELECT 
  DATE_TRUNC('day', occurred_at) as date,
  action,
  COUNT(*) as event_count,
  COUNT(DISTINCT api_key_id) as unique_keys
FROM audit_events
WHERE occurred_at BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY date, action
ORDER BY date, event_count DESC;
```

#### Institution Activity Dashboard

```sql
WITH daily_stats AS (
  SELECT 
    institution_id,
    DATE(occurred_at) as activity_date,
    COUNT(*) as total_events,
    COUNT(CASE WHEN action = 'POSITION_CREATED' THEN 1 END) as position_creations,
    COUNT(CASE WHEN action = 'POSITION_TRANSITIONED' THEN 1 END) as transitions
  FROM audit_events
  WHERE occurred_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY institution_id, activity_date
)
SELECT 
  institution_id,
  AVG(total_events) as avg_daily_events,
  MAX(total_events) as peak_daily_events,
  SUM(position_creations) as total_positions_created,
  SUM(transitions) as total_transitions
FROM daily_stats
GROUP BY institution_id
ORDER BY avg_daily_events DESC;
```

#### API Key Usage Analysis

```sql
SELECT 
  ak.key_hash,
  i.name as institution_name,
  COUNT(ae.id) as total_actions,
  STRING_AGG(DISTINCT ae.action, ', ') as action_types,
  MAX(ae.occurred_at) as last_activity
FROM audit_events ae
JOIN api_keys ak ON ae.api_key_id = ak.id
JOIN institutions i ON ak.institution_id = i.id
WHERE ae.occurred_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY ak.key_hash, i.name
ORDER BY total_actions DESC;
```

### Real-Time Monitoring Queries

#### Active Session Tracking

```sql
SELECT 
  api_key_id,
  institution_id,
  COUNT(*) as concurrent_sessions,
  MAX(occurred_at) as last_activity
FROM audit_events
WHERE action IN ('POSITION_CREATED', 'POSITION_TRANSITIONED')
AND occurred_at > NOW() - INTERVAL '5 minutes'
GROUP BY api_key_id, institution_id
HAVING COUNT(*) > 10;
```

#### Anomaly Detection

```sql
WITH hourly_rates AS (
  SELECT 
    api_key_id,
    DATE_TRUNC('hour', occurred_at) as hour,
    COUNT(*) as events_per_hour
  FROM audit_events
  WHERE occurred_at > CURRENT_DATE - INTERVAL '7 days'
  GROUP BY api_key_id, hour
)
SELECT 
  api_key_id,
  AVG(events_per_hour) as avg_rate,
  STDDEV(events_per_hour) as stddev_rate,
  MAX(events_per_hour) as peak_rate
FROM hourly_rates
GROUP BY api_key_id
HAVING MAX(events_per_hour) > AVG(events_per_hour) * 3;
```

### Advanced Analytics

#### Behavioral Pattern Analysis

```sql
WITH user_patterns AS (
  SELECT 
    api_key_id,
    STRING_AGG(action, '->' ORDER BY occurred_at) as action_sequence,
    COUNT(*) as sequence_count
  FROM audit_events
  WHERE occurred_at > CURRENT_DATE - INTERVAL '30 days'
  GROUP BY api_key_id, action_sequence
  HAVING COUNT(*) > 5
)
SELECT 
  action_sequence,
  COUNT(*) as occurrence_count,
  AVG(sequence_count) as avg_occurrences_per_user
FROM user_patterns
GROUP BY action_sequence
ORDER BY occurrence_count DESC;
```

#### Temporal Analysis

```sql
SELECT 
  EXTRACT(HOUR FROM occurred_at) as hour_of_day,
  COUNT(*) as total_events,
  COUNT(CASE WHEN action = 'POSITION_CREATED' THEN 1 END) as position_creations,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM occurred_at)) as median_time
FROM audit_events
WHERE occurred_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY hour_of_day
ORDER BY hour_of_day;
```

**Section sources**
- [db/schema.sql](file://db/schema.sql#L106-L125)

## Troubleshooting Guide

Common issues and their solutions when working with the audit logging system:

### Development Issues

#### Memory Logger Not Recording Events

**Problem**: Audit events aren't appearing in development mode.

**Solution**:
1. Verify `STORE_BACKEND` is set to `memory`
2. Check console output for JSON log entries
3. Ensure proper import of `auditLogger`

```typescript
// Debug memory logger
console.log('Audit Logger:', auditLogger);
console.log('Events:', (auditLogger as any).events);
```

#### Inconsistent Timestamps

**Problem**: Audit events show incorrect or inconsistent timestamps.

**Solution**:
1. Verify system clock synchronization
2. Check timezone configuration
3. Use UTC consistently across the application

```typescript
// Force UTC timestamps
const utcNow = new Date().toISOString();
```

### Production Issues

#### PostgreSQL Connection Failures

**Problem**: Audit events fail to persist in PostgreSQL.

**Diagnostic Steps**:
1. Verify `DATABASE_URL` environment variable
2. Test database connectivity
3. Check PostgreSQL server status

```bash
# Test database connection
psql "$DATABASE_URL" -c "SELECT 1;"
```

**Solution**:
1. Validate connection string format
2. Check network connectivity
3. Verify PostgreSQL credentials
4. Monitor connection pool usage

#### Performance Degradation

**Problem**: Audit logging impacts application performance.

**Investigation**:
1. Monitor database query performance
2. Check connection pool exhaustion
3. Analyze write queue depth

```sql
-- Monitor slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

**Optimization Strategies**:
1. Implement asynchronous logging
2. Add database connection pooling
3. Consider write batching
4. Monitor and tune PostgreSQL configuration

### Configuration Issues

#### Mixed Storage Backends

**Problem**: Different instances use different storage backends.

**Solution**:
1. Standardize configuration across deployments
2. Use environment-specific configuration files
3. Implement configuration validation

```typescript
// Configuration validation
if (config.storeBackend === 'postgres' && !config.postgresUrl) {
  throw new Error('DATABASE_URL required for PostgreSQL backend');
}
```

#### Missing Authentication Context

**Problem**: Audit events lack authentication information.

**Diagnosis**:
1. Verify authentication middleware is applied
2. Check API key validation
3. Review request headers

**Solution**:
Ensure proper middleware ordering in `server.ts`:

```typescript
app.use(authMiddleware);  // Must come before audit logger
app.use(requestLogger);   // After authentication
```

### Monitoring and Alerting

#### Log Delivery Issues

**Problem**: Audit logs not reaching external systems.

**Monitoring Checks**:
1. Verify console log output
2. Check log shipping configuration
3. Monitor external system connectivity

```typescript
// Health check for audit system
const auditHealth = async () => {
  try {
    await auditLogger.record({
      action: 'SYSTEM_HEALTH_CHECK',
      method: 'GET',
      path: '/health/audit',
      occurredAt: new Date().toISOString()
    });
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
};
```

**Section sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L17-L44)
- [src/config.ts](file://src/config.ts#L40-L46)

## Best Practices

### Implementation Guidelines

#### Proper Audit Event Creation

Always include comprehensive context information:

```typescript
// Good practice: Include all relevant context
await auditLogger.record({
  action: 'POSITION_TRANSITIONED',
  method: req.method,
  path: req.path,
  resourceType: 'position',
  resourceId: position.id,
  payload: {
    fromState: currentState,
    toState: newState,
    reason: transitionReason,
    amount: position.amount,
    currency: position.currency
  },
  auth: req.auth,
  occurredAt: new Date().toISOString()
});
```

#### Error Handling in Audit Logging

Implement robust error handling for audit operations:

```typescript
// Graceful degradation for audit failures
try {
  await auditLogger.record(auditEvent);
} catch (error) {
  console.warn('Failed to record audit event:', error);
  // Continue operation - audit failure shouldn't break business logic
}
```

#### Selective Logging for Sensitive Data

Mask sensitive information in audit payloads:

```typescript
// Mask sensitive payment information
const sensitivePayload = {
  cardNumber: creditCard.last4, // Only store last 4 digits
  amount: transaction.amount,
  currency: transaction.currency
};

await auditLogger.record({
  action: 'PAYMENT_PROCESSED',
  payload: sensitivePayload,
  auth: req.auth
});
```

### Operational Excellence

#### Log Rotation and Archiving

Implement automated log rotation for production environments:

```bash
#!/bin/bash
# Daily audit log rotation script

# Move today's logs to archive
mv /var/log/audit/*.log /var/log/audit/archive/

# Compress old archives
find /var/log/audit/archive/ -name "*.gz" -mtime +30 -delete

# Restart log shipping service
systemctl restart log-shipping-service
```

#### Monitoring and Alerting

Set up comprehensive monitoring:

```yaml
# Prometheus alerting rules
groups:
- name: audit_logging
  rules:
  - alert: AuditLoggingDegradation
    expr: rate(audit_events_total[5m]) < 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Audit logging performance degradation"
      
  - alert: AuditStorageFull
    expr: audit_storage_usage_percent > 80
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Audit storage capacity exceeded"
```

#### Compliance Validation

Regular compliance checks:

```typescript
// Monthly compliance report generator
const generateComplianceReport = async () => {
  const reportPeriod = {
    startDate: moment().subtract(1, 'month').startOf('month'),
    endDate: moment().subtract(1, 'month').endOf('month')
  };
  
  const complianceChecks = [
    {
      name: 'Audit Event Coverage',
      check: async () => {
        const totalEndpoints = 100;
        const coveredEndpoints = await countCoveredEndpoints();
        return coveredEndpoints / totalEndpoints >= 0.95;
      }
    },
    {
      name: 'Log Integrity',
      check: async () => {
        const corruptedEvents = await countCorruptedEvents();
        return corruptedEvents === 0;
      }
    }
  ];
  
  return await Promise.all(complianceChecks.map(async check => ({
    name: check.name,
    passed: await check.check()
  })));
};
```

### Security Hardening

#### Access Control Implementation

Implement least-privilege access for audit data:

```typescript
// Role-based audit data access
const canViewAuditData = (auth: AuthContext, targetInstitution: string) => {
  if (auth.role === 'root') return true;
  if (auth.role === 'admin' && auth.institutionId === targetInstitution) return true;
  return false;
};

// Audit access control enforcement
const getAuditEvents = async (auth: AuthContext, filters: AuditFilters) => {
  if (!canViewAuditData(auth, filters.institutionId)) {
    throw new Error('Insufficient permissions for audit data access');
  }
  
  return await queryAuditEvents(filters);
};
```

#### Data Retention Automation

Automate data retention policies:

```typescript
// Automated data retention cleanup
const cleanupOldAuditEvents = async () => {
  const retentionDays = 90; // GDPR compliance
  
  await db.query(`
    DELETE FROM audit_events 
    WHERE occurred_at < NOW() - INTERVAL '${retentionDays} days'
  `);
  
  console.log(`Cleaned up audit events older than ${retentionDays} days`);
};
```

**Section sources**
- [src/api/positions.ts](file://src/api/positions.ts#L272-L284)
- [src/api/assets.ts](file://src/api/assets.ts#L68-L80)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L20-L44)