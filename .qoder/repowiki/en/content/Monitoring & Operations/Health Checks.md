# Health Checks

<cite>
**Referenced Files in This Document**
- [src/infra/health.ts](file://src/infra/health.ts)
- [src/server.ts](file://src/server.ts)
- [src/config.ts](file://src/config.ts)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts)
- [src/store/index.ts](file://src/store/index.ts)
- [docker-compose.yml](file://docker-compose.yml)
- [Dockerfile](file://Dockerfile)
- [db/schema.sql](file://db/schema.sql)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Health Check Architecture](#health-check-architecture)
3. [Implementation Details](#implementation-details)
4. [Storage Backend Integration](#storage-backend-integration)
5. [Express Server Integration](#express-server-integration)
6. [HTTP Responses](#http-responses)
7. [Kubernetes Integration](#kubernetes-integration)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Best Practices](#best-practices)
10. [Monitoring and Observability](#monitoring-and-observability)

## Introduction

The escrowgrid platform implements a comprehensive health check system designed to monitor service availability and backend dependencies. The system provides two distinct health endpoints that serve different purposes in Kubernetes deployments and monitoring infrastructure:

- **Liveness Probe** (`/health`): Lightweight check that verifies the service is running without hitting any backend dependencies
- **Readiness Probe** (`/ready`): Comprehensive check that validates all backend connections, particularly PostgreSQL database connectivity when configured

This dual-probe approach ensures optimal container orchestration behavior while maintaining robust monitoring capabilities for production environments.

## Health Check Architecture

The health check system follows a layered architecture that adapts to different storage backends and provides appropriate validation for each configuration.

```mermaid
graph TB
subgraph "Client Layer"
LB[Load Balancer/Kubernetes]
Monitor[Monitoring Systems]
end
subgraph "Application Layer"
Server[Express Server]
Health[Health Module]
end
subgraph "Storage Layer"
MemStore[In-Memory Store]
PGStore[PostgreSQL Store]
DB[(PostgreSQL Database)]
end
subgraph "Configuration Layer"
Config[Environment Config]
EnvVars[Environment Variables]
end
LB --> Server
Monitor --> Server
Server --> Health
Health --> MemStore
Health --> PGStore
PGStore --> DB
Config --> Health
EnvVars --> Config
```

**Diagram sources**
- [src/server.ts](file://src/server.ts#L26-L38)
- [src/infra/health.ts](file://src/infra/health.ts#L13-L45)
- [src/config.ts](file://src/config.ts#L1-L47)

## Implementation Details

### checkReadiness Function

The core health check functionality is implemented in the `checkReadiness` function, which provides comprehensive validation of service dependencies.

```mermaid
flowchart TD
Start([checkReadiness Called]) --> CheckBackend{"Store Backend<br/>=== 'postgres'?"}
CheckBackend --> |No| ReturnHealthy["Return Healthy Status<br/>ok: true<br/>storeBackend: 'memory'"]
CheckBackend --> |Yes| GetConnectionString["Get PostgreSQL URL<br/>requirePostgresUrl()"]
GetConnectionString --> CreatePool["Create Connection Pool"]
CreatePool --> TestConnection["Execute SELECT 1"]
TestConnection --> ConnectionSuccess{"Query Successful?"}
ConnectionSuccess --> |Yes| ReturnDBHealthy["Return DB Healthy Status<br/>ok: true<br/>db.ok: true"]
ConnectionSuccess --> |No| CatchError["Catch Connection Error"]
CatchError --> ReturnDBUnhealthy["Return DB Unhealthy Status<br/>ok: false<br/>db.ok: false<br/>db.error: error message"]
ReturnHealthy --> End([End])
ReturnDBHealthy --> End
ReturnDBUnhealthy --> End
CreatePool --> Cleanup["Cleanup Connection Pool"]
TestConnection --> Cleanup
Cleanup --> End
```

**Diagram sources**
- [src/infra/health.ts](file://src/infra/health.ts#L13-L45)

The function implements several key characteristics:

- **Conditional Validation**: Only performs database connectivity checks when PostgreSQL is configured as the storage backend
- **Resource Management**: Properly manages database connection pools with cleanup in finally blocks
- **Error Handling**: Captures and reports detailed error information for troubleshooting
- **Type Safety**: Uses TypeScript interfaces to ensure consistent response structure

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L13-L45)

### Health Status Interface

The health system defines a structured interface for reporting status information:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `ok` | `boolean` | Overall health status | `true` or `false` |
| `storeBackend` | `string` | Active storage backend | `'postgres'` or `'memory'` |
| `db` | `object` | Database connectivity status (PostgreSQL only) | `{ ok: boolean, error?: string }` |

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L4-L11)

## Storage Backend Integration

The health check system adapts its behavior based on the configured storage backend, providing different validation approaches for each scenario.

### In-Memory Backend Health

When using the in-memory storage backend, the health check provides immediate feedback without external dependencies:

```mermaid
sequenceDiagram
participant Client
participant Server
participant Health
participant MemoryStore
Client->>Server : GET /ready
Server->>Health : checkReadiness()
Health->>Health : Check config.storeBackend
Health->>Health : config.storeBackend === 'postgres'? No
Health->>MemoryStore : No database connection needed
Health-->>Server : { ok : true, storeBackend : 'memory' }
Server-->>Client : 200 OK
```

**Diagram sources**
- [src/infra/health.ts](file://src/infra/health.ts#L14-L19)
- [src/store/index.ts](file://src/store/index.ts#L8-L12)

### PostgreSQL Backend Health

For PostgreSQL storage, the health check performs comprehensive database connectivity validation:

```mermaid
sequenceDiagram
participant Client
participant Server
participant Health
participant PGPool
participant Database
Client->>Server : GET /ready
Server->>Health : checkReadiness()
Health->>Health : Check config.storeBackend
Health->>Health : config.storeBackend === 'postgres'? Yes
Health->>Health : requirePostgresUrl()
Health->>PGPool : new Pool({ connectionString })
PGPool->>Database : Establish connection
Database-->>PGPool : Connection established
Health->>Database : SELECT 1
Database-->>Health : Query result
Health->>PGPool : pool.end()
PGPool->>Database : Close connection
Health-->>Server : { ok : true, storeBackend : 'postgres', db : { ok : true } }
Server-->>Client : 200 OK
```

**Diagram sources**
- [src/infra/health.ts](file://src/infra/health.ts#L21-L45)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L92-L95)

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L13-L45)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L92-L95)

## Express Server Integration

The health check endpoints are integrated directly into the Express server, providing seamless access to health monitoring functionality.

### Endpoint Registration

The server registers two distinct health endpoints with different behaviors:

| Endpoint | Method | Purpose | Response Status |
|----------|--------|---------|-----------------|
| `/health` | GET | Liveness probe | 200 OK |
| `/ready` | GET | Readiness probe | 200 OK or 503 Service Unavailable |

### Middleware Integration

Both health endpoints bypass authentication middleware, ensuring they remain accessible regardless of service state:

```mermaid
flowchart LR
Request[Incoming Request] --> AuthCheck{"Path === '/health'<br/>|| '/ready'?"}
AuthCheck --> |Yes| SkipAuth[Bypass Authentication]
AuthCheck --> |No| RequireAuth[Require API Key]
SkipAuth --> HealthHandler[Health Handler]
RequireAuth --> AuthHandler[Authenticated Handler]
HealthHandler --> Response[Response]
AuthHandler --> Response
```

**Diagram sources**
- [src/server.ts](file://src/server.ts#L26-L38)
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L35-L42)

**Section sources**
- [src/server.ts](file://src/server.ts#L26-L38)

## HTTP Responses

### Healthy State Responses

#### Liveness Probe (/health)
```json
{
  "status": "ok",
  "service": "taas-platform",
  "storeBackend": "memory"
}
```

#### Readiness Probe (/ready) - In-Memory Backend
```json
{
  "ok": true,
  "storeBackend": "memory"
}
```

#### Readiness Probe (/ready) - PostgreSQL Backend (Healthy)
```json
{
  "ok": true,
  "storeBackend": "postgres",
  "db": {
    "ok": true
  }
}
```

### Unhealthy State Responses

#### Readiness Probe (/ready) - PostgreSQL Backend (Unhealthy)
```json
{
  "ok": false,
  "storeBackend": "postgres",
  "db": {
    "ok": false,
    "error": "Connection failed: getaddrinfo ENOTFOUND postgres.example.com"
  }
}
```

#### Readiness Probe (/ready) - PostgreSQL Backend (Configuration Error)
```json
{
  "ok": false,
  "storeBackend": "postgres",
  "db": {
    "ok": false,
    "error": "DATABASE_URL is required when STORE_BACKEND=postgres"
  }
}
```

**Section sources**
- [src/server.ts](file://src/server.ts#L27-L38)
- [src/infra/health.ts](file://src/infra/health.ts#L26-L45)

## Kubernetes Integration

The health check system is specifically designed to integrate seamlessly with Kubernetes orchestration, providing the necessary probes for optimal container management.

### Kubernetes Deployment Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taas-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: taas-platform
  template:
    metadata:
      labels:
        app: taas-platform
    spec:
      containers:
      - name: taas-platform
        image: escrowgrid/taas-platform:latest
        ports:
        - containerPort: 4000
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 4000
          initialDelaySeconds: 15
          periodSeconds: 10
          failureThreshold: 3
```

### Probe Behavior in Kubernetes

| Scenario | Liveness Probe | Readiness Probe | Container Action |
|----------|----------------|-----------------|------------------|
| Service Healthy | 200 OK | 200 OK | Continue running |
| Database Down | 200 OK | 503 Service Unavailable | Mark pod as not ready |
| Service Crashed | 5xx/Timeout | 5xx/Timeout | Restart container |

### Docker Compose Integration

The system includes Docker Compose configuration with health checks for local development and testing:

```yaml
services:
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "taas_user"]
      interval: 5s
      timeout: 5s
      retries: 5
  
  api:
    depends_on:
      db:
        condition: service_healthy
```

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L17-L21)
- [docker-compose.yml](file://docker-compose.yml#L39-L41)

## Troubleshooting Guide

### Common Database Connection Issues

#### Issue: "DATABASE_URL is required when STORE_BACKEND=postgres"

**Cause**: PostgreSQL backend selected but no database connection string provided.

**Solution**:
```bash
# Set the required environment variable
export DATABASE_URL="postgres://username:password@hostname:port/database"

# Verify the connection string format
echo $DATABASE_URL
```

#### Issue: Connection Timeout or Network Error

**Symptoms**: Health check returns 503 with error containing "timeout" or "network unreachable".

**Diagnosis Steps**:
1. Verify network connectivity
2. Check firewall rules
3. Validate database server accessibility
4. Confirm connection string format

**Resolution**:
```bash
# Test database connectivity
psql "$DATABASE_URL" -c "SELECT 1"

# Check network connectivity
telnet hostname 5432
```

#### Issue: Authentication Failure

**Symptoms**: Health check returns 503 with authentication-related error messages.

**Common Causes**:
- Incorrect username/password
- Database user lacks permissions
- SSL/TLS configuration mismatch

**Resolution**:
```bash
# Verify credentials
psql "$DATABASE_URL" -c "SELECT current_user"

# Check user permissions
psql "$DATABASE_URL" -c "SELECT rolname FROM pg_roles WHERE rolname='your_user'"
```

### Configuration Validation

#### Environment Variable Verification

```bash
# Check required variables
echo "STORE_BACKEND: $STORE_BACKEND"
echo "DATABASE_URL: ${DATABASE_URL:0:20}..."  # Mask sensitive data
echo "ROOT_API_KEY: ${ROOT_API_KEY:+SET}"      # Check if set
```

#### Schema Validation

Ensure the PostgreSQL database has the required schema:

```sql
-- Verify required tables exist
\dt
\dx  -- List extensions

-- Check table structure
\d institutions
\d asset_templates
\d assets
\d positions
\d position_events
\d ledger_events
```

### Debugging Tools

#### Local Health Check Testing

```bash
# Test liveness probe
curl -f http://localhost:4000/health || echo "Liveness check failed"

# Test readiness probe
curl -f http://localhost:4000/ready || echo "Readiness check failed"

# Verbose testing with timing
time curl -f http://localhost:4000/ready
```

#### Log Analysis

Monitor application logs for health check failures:

```bash
# Filter health-related logs
journalctl -u taas-platform --since "1 hour ago" | grep -i "health\|ready\|db\|postgres"

# Check for connection errors
journalctl -u taas-platform --since "1 hour ago" | grep -i "error\|fail\|unreachable"
```

**Section sources**
- [src/config.ts](file://src/config.ts#L40-L45)
- [src/infra/health.ts](file://src/infra/health.ts#L31-L45)

## Best Practices

### Production Configuration

#### Environment-Specific Settings

```bash
# Production environment
export NODE_ENV=production
export STORE_BACKEND=postgres
export DATABASE_URL="postgresql://user:pass@prod-db:5432/taas_prod"
export ROOT_API_KEY="secure-production-key"
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_WINDOW_MS=60000
export RATE_LIMIT_MAX_REQUESTS=1000
```

#### Security Considerations

1. **API Key Management**: Use strong, randomly generated API keys
2. **Network Security**: Restrict database access to application servers only
3. **SSL/TLS**: Enable SSL for database connections in production
4. **Monitoring**: Implement comprehensive logging and alerting

#### Resource Management

```bash
# Connection pool sizing
export PG_CONNECTION_POOL_SIZE=10
export PG_CONNECTION_TIMEOUT=30000

# Health check tuning
export HEALTH_CHECK_INTERVAL=30000
export HEALTH_CHECK_TIMEOUT=5000
```

### Monitoring Integration

#### Prometheus Metrics

```yaml
scrape_configs:
  - job_name: 'taas-platform'
    metrics_path: /metrics
    static_configs:
      - targets: ['taas-platform:4000']
    scrape_interval: 15s
```

#### Alerting Rules

```yaml
groups:
  - name: taas-health
    rules:
      - alert: TaasServiceDown
        expr: up{job="taas-platform"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "TAAS service is down"
          
      - alert: TaasDatabaseUnreachable
        expr: taas_db_connected == 0
        for: 30s
        labels:
          severity: warning
        annotations:
          summary: "TAAS database connection lost"
```

### Performance Optimization

#### Connection Pool Tuning

```javascript
// Optimal pool configuration for production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                    // Maximum connections
  min: 2,                     // Minimum connections
  idleTimeoutMillis: 30000,   // Idle timeout
  connectionTimeoutMillis: 5000, // Connection timeout
})
```

#### Health Check Frequency

- **Liveness Probe**: Every 10 seconds (short interval for quick restart)
- **Readiness Probe**: Every 30 seconds (balanced frequency)
- **Failure Threshold**: 3 consecutive failures before marking unready

**Section sources**
- [README.md](file://README.md#L355-L378)
- [docker-compose.yml](file://docker-compose.yml#L26-L38)

## Monitoring and Observability

### Built-in Metrics

The platform provides comprehensive metrics for monitoring service health and performance:

#### Request Metrics
- Total requests by status code
- Requests by HTTP method
- Average response duration
- Error rates

#### Database Metrics
- Connection pool utilization
- Query execution times
- Connection failure rates

### External Monitoring Integration

#### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "TAAS Platform Health",
    "panels": [
      {
        "title": "Service Availability",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"taas-platform\"}"
          }
        ]
      },
      {
        "title": "Database Connectivity",
        "type": "stat",
        "targets": [
          {
            "expr": "taas_db_connected"
          }
        ]
      }
    ]
  }
}
```

#### Slack/Teams Alerts

```json
{
  "alerts": [
    {
      "condition": "taas_db_connected == 0",
      "message": "🚨 TAAS Database connection lost",
      "severity": "high"
    },
    {
      "condition": "taas_request_errors > 100",
      "message": "⚠️ High error rate detected",
      "severity": "medium"
    }
  ]
}
```

### Logging Strategy

#### Structured Logging

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "taas-platform",
  "endpoint": "/ready",
  "status": "success",
  "response_time_ms": 15,
  "store_backend": "postgres",
  "db_connection": true
}
```

#### Log Aggregation

Configure centralized logging for production environments:

```bash
# Fluentd configuration
<source>
  @type tail
  path /var/log/taas-platform/*.log
  tag taas.platform.*
  format json
</source>

<match taas.platform.**>
  @type elasticsearch
  host elasticsearch.example.com
  port 9200
  index_name taas-platform-logs
</match>
```

**Section sources**
- [src/infra/metrics.ts](file://src/infra/metrics.ts#L1-L37)
- [README.md](file://README.md#L355-L378)