# Health Checks

<cite>
**Referenced Files in This Document**
- [src/infra/health.ts](file://src/infra/health.ts)
- [src/server.ts](file://src/server.ts)
- [src/config.ts](file://src/config.ts)
- [src/store/index.ts](file://src/store/index.ts)
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
- [docker-compose.yml](file://docker-compose.yml)
- [README.md](file://README.md)
- [src/__tests__/api.test.ts](file://src/__tests__/api.test.ts)
- [src/__tests__/api.postgres.test.ts](file://src/__tests__/api.postgres.test.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Health Check Endpoints](#health-check-endpoints)
4. [Readiness Status Interface](#readiness-status-interface)
5. [Storage Backend Differences](#storage-backend-differences)
6. [Implementation Details](#implementation-details)
7. [Integration with Express Server](#integration-with-express-server)
8. [Monitoring and Observability](#monitoring-and-observability)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Best Practices](#best-practices)
11. [Deployment Configuration](#deployment-configuration)

## Introduction

The escrowgrid health check system provides essential monitoring capabilities for container orchestration environments, particularly Kubernetes deployments. The system implements two primary health check endpoints that assess different aspects of system health: liveness and readiness probes. These checks are crucial for automated deployment pipelines, service discovery, and maintaining high availability in production environments.

The health check system evaluates system readiness based on storage backend connectivity and database accessibility, providing structured responses that integrate seamlessly with modern monitoring stacks and container orchestration platforms.

## System Architecture

The health check system is built around a modular architecture that adapts to different storage backends while maintaining consistent monitoring interfaces.

```mermaid
graph TB
subgraph "Container Orchestration"
K8s[Kubernetes]
Probe[Liveness/Readiness Probes]
end
subgraph "Application Layer"
Server[Express Server]
Health[Health Module]
Config[Configuration]
end
subgraph "Storage Layer"
MemStore[Memory Store]
PGStore[PostgreSQL Store]
DB[(PostgreSQL Database)]
end
subgraph "Monitoring"
Metrics[Metrics Endpoint]
Logs[Request Logging]
end
K8s --> Probe
Probe --> Server
Server --> Health
Health --> Config
Health --> MemStore
Health --> PGStore
PGStore --> DB
Server --> Metrics
Server --> Logs
```

**Diagram sources**
- [src/server.ts](file://src/server.ts#L1-L100)
- [src/infra/health.ts](file://src/infra/health.ts#L1-L47)
- [src/config.ts](file://src/config.ts#L1-L47)

**Section sources**
- [src/server.ts](file://src/server.ts#L1-L100)
- [src/infra/health.ts](file://src/infra/health.ts#L1-L47)
- [src/config.ts](file://src/config.ts#L1-L47)

## Health Check Endpoints

The system exposes three primary health check endpoints that serve different purposes in monitoring and deployment scenarios:

### Liveness Probe (`/health`)
A lightweight endpoint that confirms the application process is running and responsive. This endpoint does not perform any resource-intensive checks and provides a quick indication of process health.

### Readiness Probe (`/ready`)
A comprehensive endpoint that evaluates system readiness by checking storage backend connectivity and database accessibility when applicable. This endpoint is critical for determining whether the service should accept traffic.

### Metrics Endpoint (`/metrics`)
Provides detailed performance metrics and operational data for monitoring and alerting systems.

| Endpoint | Purpose | Resource Intensive | Authentication |
|----------|---------|-------------------|----------------|
| `/health` | Liveness check | Low | No |
| `/ready` | Readiness check | Medium (PostgreSQL only) | No |
| `/metrics` | Performance metrics | Low | Yes (root API key required) |

**Section sources**
- [src/server.ts](file://src/server.ts#L26-L38)
- [README.md](file://README.md#L359-L361)

## Readiness Status Interface

The `ReadinessStatus` interface defines the standardized response structure for readiness checks, enabling consistent interpretation across monitoring systems and orchestration platforms.

```mermaid
classDiagram
class ReadinessStatus {
+boolean ok
+string storeBackend
+DatabaseStatus db?
}
class DatabaseStatus {
+boolean ok
+string error?
}
ReadinessStatus --> DatabaseStatus : "contains"
```

**Diagram sources**
- [src/infra/health.ts](file://src/infra/health.ts#L4-L11)

### Interface Properties

| Property | Type | Description | Presence Condition |
|----------|------|-------------|-------------------|
| `ok` | `boolean` | Overall system readiness status | Always present |
| `storeBackend` | `string` | Active storage backend identifier | Always present |
| `db` | `object?` | Database connectivity status | PostgreSQL backend only |

### Response Examples

#### Memory Backend (Always Ready)
```json
{
  "ok": true,
  "storeBackend": "memory"
}
```

#### PostgreSQL Backend (Healthy)
```json
{
  "ok": true,
  "storeBackend": "postgres",
  "db": {
    "ok": true
  }
}
```

#### PostgreSQL Backend (Unhealthy)
```json
{
  "ok": false,
  "storeBackend": "postgres",
  "db": {
    "ok": false,
    "error": "Connection refused"
  }
}
```

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L4-L11)

## Storage Backend Differences

The health check system adapts its behavior based on the configured storage backend, providing appropriate checks for each storage type.

### Memory Backend Behavior

When using the in-memory storage backend, the health check system performs minimal validation since there are no external dependencies to verify.

```mermaid
flowchart TD
Start([Health Check Request]) --> CheckBackend{"Store Backend?"}
CheckBackend --> |memory| AlwaysReady["Return: {ok: true}"]
CheckBackend --> |postgres| CheckDB["Check PostgreSQL"]
CheckDB --> AlwaysReady
AlwaysReady --> End([Response])
```

**Diagram sources**
- [src/infra/health.ts](file://src/infra/health.ts#L13-L20)

### PostgreSQL Backend Behavior

For PostgreSQL storage, the health check performs comprehensive connectivity testing including connection establishment, credential validation, and basic query execution.

```mermaid
flowchart TD
Start([Health Check Request]) --> CheckBackend{"Store Backend?"}
CheckBackend --> |memory| AlwaysReady["Return: {ok: true}"]
CheckBackend --> |postgres| GetConnStr["Get Connection String"]
GetConnStr --> CreatePool["Create Connection Pool"]
CreatePool --> TestQuery["Execute SELECT 1"]
TestQuery --> Success{"Query Successful?"}
Success --> |Yes| SuccessResp["Return: {ok: true, db: {ok: true}}"]
Success --> |No| ErrorResp["Return: {ok: false, db: {ok: false, error: message}}"]
SuccessResp --> Cleanup["Close Connection Pool"]
ErrorResp --> Cleanup
Cleanup --> End([Response])
```

**Diagram sources**
- [src/infra/health.ts](file://src/infra/health.ts#L21-L44)

### Backend-Specific Configuration

| Backend | Health Check Complexity | Dependencies | Timeout Handling |
|---------|------------------------|--------------|------------------|
| Memory | Minimal | None | N/A |
| PostgreSQL | Moderate | Database connection | Connection pool cleanup |

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L13-L44)
- [src/store/index.ts](file://src/store/index.ts#L1-L16)

## Implementation Details

The `checkReadiness` function serves as the core implementation of the readiness check system, providing robust error handling and resource cleanup.

### Function Signature and Behavior

The function implements asynchronous readiness validation with comprehensive error handling:

```typescript
export async function checkReadiness(): Promise<ReadinessStatus>
```

### Key Implementation Features

#### Conditional Logic Based on Backend
The function evaluates the storage backend configuration and applies appropriate validation logic:

- **Memory Backend**: Immediate success response
- **PostgreSQL Backend**: Connection and query validation

#### Connection Pool Management
Proper resource lifecycle management ensures connection pools are properly cleaned up:

- Connection pool creation during validation
- Automatic cleanup in finally block
- Graceful error handling for cleanup failures

#### Error Handling Strategy
Comprehensive error capture and reporting:

- Type-safe error message extraction
- Fallback string conversion for non-error objects
- Consistent error response formatting

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L13-L44)

## Integration with Express Server

The health check system integrates seamlessly with the Express server through dedicated route handlers that provide standardized responses.

### Route Handler Implementation

```mermaid
sequenceDiagram
participant Client as "Health Check Client"
participant Server as "Express Server"
participant Health as "Health Module"
participant Store as "Storage Backend"
Client->>Server : GET /ready
Server->>Health : checkReadiness()
Health->>Store : Validate connection
Store-->>Health : Connection status
Health-->>Server : ReadinessStatus
Server-->>Client : HTTP Response
Note over Client,Store : Response includes status code and JSON body
```

**Diagram sources**
- [src/server.ts](file://src/server.ts#L31-L38)

### Express Server Integration Points

#### Health Endpoint
Provides basic liveness verification without resource checks.

#### Readiness Endpoint
Implements comprehensive system validation with conditional database checks.

#### Response Handling
The readiness endpoint implements proper HTTP status code responses:

- **200 OK**: System is ready and operational
- **503 Service Unavailable**: System dependencies are unavailable

**Section sources**
- [src/server.ts](file://src/server.ts#L26-L38)

## Monitoring and Observability

The health check system integrates with comprehensive monitoring and observability infrastructure to support operational excellence.

### Monitoring Endpoints

#### Health Endpoint
- **Purpose**: Lightweight liveness monitoring
- **Response**: Basic service status
- **Use Case**: Container restart decisions

#### Readiness Endpoint  
- **Purpose**: Comprehensive system validation
- **Response**: Detailed readiness status
- **Use Case**: Traffic routing decisions

#### Metrics Endpoint
- **Purpose**: Performance and operational metrics
- **Response**: Request statistics and timing data
- **Use Case**: Capacity planning and alerting

### Suggested Monitoring Configuration

```yaml
# Prometheus-style scrape configuration
scrape_configs:
  - job_name: 'escrowgrid-backend'
    metrics_path: /metrics
    static_configs:
      - targets: ['escrowgrid:4000']
```

### Service Level Objectives (SLOs)

| Metric | Target | Measurement Window |
|--------|--------|-------------------|
| Availability | 99.9% | 30-day rolling |
| Latency (95th percentile) | < 300ms | Normal load |
| Latency (99th percentile) | < 1s | Normal load |

**Section sources**
- [README.md](file://README.md#L355-L378)

## Troubleshooting Guide

Common issues and resolution strategies for health check problems.

### Connectivity Issues

#### Problem: PostgreSQL Connection Failures
**Symptoms**: Readiness endpoint returns 503 with database error
**Causes**: 
- Network connectivity issues
- Authentication failures
- Database unavailability
- Connection pool exhaustion

**Resolution Steps**:
1. Verify database connectivity manually
2. Check connection string configuration
3. Validate database credentials
4. Monitor connection pool metrics
5. Review database logs for errors

#### Problem: Memory Backend Issues
**Symptoms**: Unexpected readiness failures
**Causes**:
- Insufficient memory allocation
- Garbage collection issues
- Application crashes

**Resolution Steps**:
1. Monitor memory usage patterns
2. Check application logs for errors
3. Verify system resource availability
4. Review garbage collection metrics

### Configuration Problems

#### Problem: Incorrect Store Backend Configuration
**Symptoms**: Health checks behave unexpectedly
**Causes**:
- Environment variable misconfiguration
- Missing required database URL
- Invalid backend selection

**Resolution Steps**:
1. Verify `STORE_BACKEND` environment variable
2. Check `DATABASE_URL` for PostgreSQL backend
3. Validate configuration loading
4. Restart service with correct configuration

### Performance Issues

#### Problem: Slow Health Check Responses
**Symptoms**: Health checks timeout or take excessive time
**Causes**:
- Database query timeouts
- Connection pool contention
- Resource exhaustion

**Resolution Steps**:
1. Monitor health check response times
2. Adjust connection pool settings
3. Optimize database queries
4. Scale system resources

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L31-L44)
- [src/config.ts](file://src/config.ts#L40-L46)

## Best Practices

### Deployment Configuration

#### Kubernetes Health Probes
Configure appropriate health probes for different environments:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 4000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 4000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

#### Monitoring Integration
Implement comprehensive monitoring with appropriate alerting:

- **Alert on readiness failures**: Immediate notification of system issues
- **Monitor response times**: Track health check performance
- **Log health check results**: Maintain audit trail of system status

### Development and Testing

#### Local Development Setup
Configure health checks appropriately for development environments:

- Use memory backend for local development
- Mock database connections when appropriate
- Implement graceful degradation for offline scenarios

#### Testing Strategies
Ensure comprehensive health check validation:

- Unit tests for individual health check components
- Integration tests with different storage backends
- Load testing to validate performance under stress

### Production Considerations

#### Resource Management
Implement proper resource cleanup and monitoring:

- Connection pool sizing based on expected load
- Health check frequency optimization
- Graceful shutdown procedures

#### Security Considerations
Secure health check endpoints appropriately:

- Restrict access to internal networks only
- Implement authentication for sensitive environments
- Monitor for unauthorized access attempts

## Deployment Configuration

### Environment Variables

Configure health check behavior through environment variables:

| Variable | Purpose | Default | Example |
|----------|---------|---------|---------|
| `STORE_BACKEND` | Storage backend selection | `memory` | `postgres` |
| `DATABASE_URL` | PostgreSQL connection string | - | `postgresql://user:pass@host:5432/db` |
| `NODE_ENV` | Environment mode | `development` | `production` |

### Docker Compose Configuration

Sample Docker Compose setup with health checks:

```yaml
services:
  api:
    build: .
    environment:
      STORE_BACKEND: postgres
      DATABASE_URL: postgresql://user:pass@db:5432/escrowgrid
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Kubernetes Deployment

Kubernetes deployment with health probes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: escrowgrid
spec:
  template:
    spec:
      containers:
      - name: app
        image: escrowgrid:latest
        ports:
        - containerPort: 4000
        env:
        - name: STORE_BACKEND
          value: "postgres"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 10
```

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L23-L46)
- [src/config.ts](file://src/config.ts#L23-L46)