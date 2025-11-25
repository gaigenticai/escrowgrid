# Docker Deployment

<cite>
**Referenced Files in This Document**
- [Dockerfile](file://Dockerfile)
- [docker-compose.yml](file://docker-compose.yml)
- [admin-console/Dockerfile](file://admin-console/Dockerfile)
- [package.json](file://package.json)
- [admin-console/package.json](file://admin-console/package.json)
- [src/config.ts](file://src/config.ts)
- [src/server.ts](file://src/server.ts)
- [db/schema.sql](file://db/schema.sql)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture Overview](#system-architecture-overview)
3. [Multi-Stage Docker Build Process](#multi-stage-docker-build-process)
4. [Docker Compose Configuration](#docker-compose-configuration)
5. [Container Services](#container-services)
6. [Environment Variables and Configuration](#environment-variables-and-configuration)
7. [Deployment Instructions](#deployment-instructions)
8. [Production Best Practices](#production-best-practices)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Monitoring and Observability](#monitoring-and-observability)

## Introduction

The escrowgrid platform is a Tokenization-as-a-Service (TAAS) infrastructure backend designed for institutions focusing on escrowable assets in construction and trade finance. The platform provides a comprehensive solution for managing institutional assets, positions, and financial transactions through a RESTful API.

This Docker deployment guide covers the complete process of building, configuring, and orchestrating the escrowgrid platform using Docker and docker-compose. The deployment includes three main services: the API backend, PostgreSQL database, and admin console, all orchestrated through a multi-stage build process for optimal production performance.

## System Architecture Overview

The escrowgrid platform follows a microservices architecture with clear separation of concerns across multiple containerized services:

```mermaid
graph TB
subgraph "Docker Compose Stack"
subgraph "Application Layer"
API[TAAS API Backend<br/>Port 4000]
ADMIN[Admin Console<br/>Port 8080]
end
subgraph "Data Layer"
DB[(PostgreSQL Database<br/>Port 5432)]
end
subgraph "External Dependencies"
CLIENT[Client Applications]
MONITOR[Monitoring Systems]
end
end
CLIENT --> API
CLIENT --> ADMIN
API --> DB
MONITOR --> API
MONITOR --> ADMIN
```

**Diagram sources**
- [docker-compose.yml](file://docker-compose.yml#L3-L55)
- [Dockerfile](file://Dockerfile#L1-L27)
- [admin-console/Dockerfile](file://admin-console/Dockerfile#L1-L20)

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)
- [README.md](file://README.md#L1-L50)

## Multi-Stage Docker Build Process

The escrowgrid platform employs sophisticated multi-stage Docker builds to optimize production images while maintaining development flexibility. This approach ensures minimal image sizes, reduced attack surfaces, and efficient resource utilization.

### Backend API Multi-Stage Build

The main API service uses a two-stage build process that separates dependency installation, compilation, and runtime execution:

```mermaid
flowchart TD
START([Build Process Start]) --> STAGE1["Builder Stage<br/>• Base: node:20-alpine<br/>• Working Directory: /app"]
STAGE1 --> COPY_DEPS["Copy Dependencies<br/>• package.json<br/>• package-lock.json<br/>• tsconfig.json"]
COPY_DEPS --> COPY_SRC["Copy Source Code<br/>• src/ directory<br/>• db/ directory"]
COPY_SRC --> INSTALL_DEV["Install Development Dependencies<br/>npm ci"]
INSTALL_DEV --> BUILD["Compile TypeScript<br/>npm run build"]
BUILD --> STAGE2["Runner Stage<br/>• Base: node:20-alpine<br/>• Working Directory: /app"]
STAGE2 --> COPY_PROD_DEPS["Copy Production Dependencies<br/>npm ci --omit=dev"]
COPY_PROD_DEPS --> COPY_ARTIFACTS["Copy Built Artifacts<br/>• dist/ directory<br/>• db/ assets"]
COPY_ARTIFACTS --> EXPOSE["Expose Port 4000"]
EXPOSE --> CMD["Start Command<br/>node dist/server.js"]
CMD --> END([Production Image Ready])
```

**Diagram sources**
- [Dockerfile](file://Dockerfile#L3-L26)

#### Builder Stage Analysis

The builder stage focuses on dependency installation and code compilation:

- **Base Image**: Uses `node:20-alpine` for minimal footprint and security
- **Working Directory**: Sets `/app` as the application root
- **Dependency Management**: Copies only essential files to leverage Docker cache
- **Compilation**: Executes `npm run build` to transpile TypeScript to JavaScript

#### Runner Stage Analysis

The runner stage optimizes for production runtime:

- **Clean Dependencies**: Installs only production dependencies using `--omit=dev`
- **Artifact Copying**: Transfers compiled code and database assets
- **Security Hardening**: Minimal runtime environment reduces attack surface
- **Port Exposure**: Standardizes on port 4000 for internal communication

**Section sources**
- [Dockerfile](file://Dockerfile#L1-L27)

### Admin Console Multi-Stage Build

The admin console uses a specialized multi-stage build combining React/Vite frontend compilation with Nginx serving:

```mermaid
flowchart TD
START([Admin Console Build]) --> VITE_STAGE["Vite Builder Stage<br/>• Base: node:20-alpine"]
VITE_STAGE --> COPY_VITE_FILES["Copy Vite Configuration<br/>• package.json<br/>• vite.config.ts<br/>• index.html"]
COPY_VITE_FILES --> COPY_SRC["Copy Source Files<br/>• src/ directory<br/>• public/ directory"]
COPY_SRC --> INSTALL_VITE["Install Vite Dependencies<br/>npm ci"]
INSTALL_VITE --> BUILD_VITE["Build Frontend<br/>npm run build"]
BUILD_VITE --> NGINX_STAGE["Nginx Runner Stage<br/>• Base: nginx:alpine"]
NGINX_STAGE --> COPY_DIST["Copy Build Artifacts<br/>from Vite stage"]
COPY_DIST --> CONFIG_NGINX["Configure Nginx<br/>Standard configuration"]
CONFIG_NGINX --> EXPOSE_PORT["Expose Port 80"]
EXPOSE_PORT --> START_NGINX["Start Nginx<br/>daemon off mode"]
START_NGINX --> READY([Ready for Deployment])
```

**Diagram sources**
- [admin-console/Dockerfile](file://admin-console/Dockerfile#L3-L19)

**Section sources**
- [admin-console/Dockerfile](file://admin-console/Dockerfile#L1-L20)

## Docker Compose Configuration

The docker-compose.yml file orchestrates the complete platform stack with comprehensive service definitions, networking, and health monitoring capabilities.

### Service Definitions

The configuration defines three primary services with specific roles and dependencies:

#### Database Service (PostgreSQL)

```mermaid
classDiagram
class DatabaseService {
+image : postgres : 16-alpine
+container_name : taas-db
+environment : POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
+ports : 15432 : 5432
+volumes : schema.sql initialization
+healthcheck : pg_isready test
+depends_on : None
}
class HealthCheck {
+test : pg_isready -U taas_user
+interval : 5s
+timeout : 5s
+retries : 5
}
DatabaseService --> HealthCheck : "uses"
```

**Diagram sources**
- [docker-compose.yml](file://docker-compose.yml#L4-L21)

#### API Service

```mermaid
classDiagram
class APIService {
+build : .
+container_name : taas-api
+environment : NODE_ENV, STORE_BACKEND, DATABASE_URL
+ports : dynamic host port
+depends_on : db (service_healthy)
+healthchecks : /health endpoint
}
class EnvironmentVars {
+NODE_ENV : production
+STORE_BACKEND : postgres
+DATABASE_URL : postgres connection string
+ROOT_API_KEY : replace-me-root-key
+RATE_LIMIT_ENABLED : true
+RATE_LIMIT_WINDOW_MS : 60000
+RATE_LIMIT_MAX_REQUESTS : 1000
}
APIService --> EnvironmentVars : "configures"
```

**Diagram sources**
- [docker-compose.yml](file://docker-compose.yml#L23-L46)
- [src/config.ts](file://src/config.ts#L23-L37)

#### Admin Console Service

```mermaid
classDiagram
class AdminConsoleService {
+build : ./admin-console
+container_name : taas-admin
+ports : 8080 : 80
+depends_on : api
+healthchecks : HTTP 200 on /health
}
class NginxConfig {
+expose_port : 80
+serve_static_files : true
+index_html : true
}
AdminConsoleService --> NginxConfig : "uses"
```

**Diagram sources**
- [docker-compose.yml](file://docker-compose.yml#L48-L55)
- [admin-console/Dockerfile](file://admin-console/Dockerfile#L13-L19)

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)

## Container Services

### Database Service Configuration

The PostgreSQL service provides persistent data storage with robust initialization and monitoring:

#### Security Configuration
- **Authentication**: Username/password authentication with dedicated credentials
- **Network Isolation**: Internal container networking prevents external access
- **Schema Initialization**: Automatic schema loading from mounted SQL file

#### Health Monitoring
- **Probe Type**: Exec-based health check using `pg_isready`
- **Frequency**: 5-second intervals during startup
- **Timeout**: 5-second execution window
- **Retry Logic**: 5 attempts before marking service unhealthy

### API Service Architecture

The API service serves as the central hub for all platform operations:

#### Runtime Environment
- **Node.js Version**: Consistent with builder stage for reliability
- **Environment Mode**: Production with optimized settings
- **Storage Backend**: Configurable between memory and PostgreSQL

#### Network Configuration
- **Internal Port**: Standardized on 4000 for inter-service communication
- **Host Port**: Dynamically assigned to prevent conflicts
- **Dependency Management**: Waits for database health before starting

### Admin Console Service

The admin console provides web-based management capabilities:

#### Static File Serving
- **Web Server**: Optimized Nginx configuration
- **File Serving**: Efficient static file delivery
- **Port Mapping**: Fixed host port 8080 for predictable access

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L4-L55)
- [src/server.ts](file://src/server.ts#L26-L38)

## Environment Variables and Configuration

The platform uses a comprehensive environment variable system for flexible deployment across different environments.

### Core Configuration Variables

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `NODE_ENV` | Runtime environment | `development` | No |
| `STORE_BACKEND` | Storage engine | `memory` | No |
| `DATABASE_URL` | PostgreSQL connection | - | Yes (when postgres) |
| `ROOT_API_KEY` | Administrative key | `replace-me-root-key` | Yes |
| `PORT` | Service port | `4000` | No |

### Rate Limiting Configuration

| Variable | Purpose | Default | Range |
|----------|---------|---------|-------|
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `true` | `true`/`false` |
| `RATE_LIMIT_WINDOW_MS` | Time window | `60000` | Milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | Requests per window | `1000` | Positive integer |

### Advanced Configuration Options

| Variable | Purpose | Example | Notes |
|----------|---------|---------|-------|
| `ONCHAIN_LEDGER_ENABLED` | Enable blockchain integration | `true` | Requires additional configs |
| `ONCHAIN_RPC_URL` | Blockchain RPC endpoint | `https://...` | Ethereum-compatible networks |
| `ONCHAIN_PRIVATE_KEY` | Wallet private key | `0x...` | For transaction signing |
| `ONCHAIN_CONTRACT_ADDRESS` | Smart contract address | `0x...` | On-chain ledger contract |

**Section sources**
- [src/config.ts](file://src/config.ts#L1-L47)
- [docker-compose.yml](file://docker-compose.yml#L26-L38)

## Deployment Instructions

### Prerequisites

Before deploying the escrowgrid platform, ensure the following requirements are met:

- **Docker Engine**: Version 20.10 or later
- **Docker Compose**: Version 2.0 or later
- **System Resources**: Minimum 2GB RAM, 1GB disk space
- **Network Access**: Internet connectivity for dependency downloads

### Step-by-Step Deployment Process

#### 1. Initial Setup and Building

```bash
# Navigate to project directory
cd taas-platform

# Build and start all services with fresh images
docker compose up --build
```

This command performs several critical operations:
- **Image Building**: Triggers multi-stage builds for both API and admin console
- **Service Orchestration**: Starts containers in dependency order
- **Volume Creation**: Initializes persistent storage for database
- **Network Setup**: Creates isolated network for service communication

#### 2. Service Discovery and Verification

After deployment completion, verify service health:

```bash
# Check running services and port assignments
docker compose ps

# Expected output format:
# NAME                 COMMAND                  SERVICE             STATUS              PORTS
# taas-api             "node dist/server.js"    api                 running             0.0.0.0:56888->4000/tcp
# taas-db              "docker-entrypoint.s…"   db                  running             0.0.0.0:15432->5432/tcp
# taas-admin           "nginx -g daemon off;"   admin               running             0.0.0.0:8080->80/tcp

# Verify API health
curl "http://localhost:56888/health"

# Verify readiness
curl "http://localhost:56888/ready"
```

#### 3. Admin Console Access

Access the admin interface through the configured port:

```bash
# Open admin console in browser
open http://localhost:8080

# Verify admin service health
curl "http://localhost:8080/health"
```

#### 4. Database Schema Verification

Confirm database initialization:

```bash
# Connect to database (using exposed port)
psql "postgresql://taas_user:taas_pass@localhost:15432/taas_platform"

# Verify schema exists
\dt
```

### Deployment Verification Checklist

- [ ] All services report "running" status
- [ ] API responds to health checks with 200 OK
- [ ] Database connection established successfully
- [ ] Admin console accessible on port 8080
- [ ] Port assignments match expected configurations
- [ ] Environment variables loaded correctly

**Section sources**
- [README.md](file://README.md#L276-L322)
- [docker-compose.yml](file://docker-compose.yml#L1-L55)

## Production Best Practices

### Container Security Hardening

#### Image Security
- **Minimal Base Images**: Use Alpine Linux variants for reduced attack surface
- **Non-root Execution**: Containers run with minimal privileges
- **Regular Updates**: Keep base images updated with security patches
- **Dependency Scanning**: Regular vulnerability assessments of dependencies

#### Network Security
- **Isolated Networks**: Services communicate through internal Docker networks
- **Port Exposure**: Minimize externally exposed ports
- **Firewall Rules**: Implement appropriate host-level firewall restrictions
- **TLS Termination**: Consider SSL/TLS for external communications

### Resource Management and Limits

#### Memory Allocation
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

#### CPU Constraints
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '0.5'
        reservations:
          cpus: '0.25'
```

#### Storage Optimization
- **Volume Management**: Use named volumes for persistent data
- **Log Rotation**: Implement log rotation to prevent disk exhaustion
- **Cleanup Policies**: Regular cleanup of temporary files and caches

### Monitoring and Observability

#### Health Check Implementation
The platform includes comprehensive health monitoring:

```mermaid
sequenceDiagram
participant LB as Load Balancer
participant API as API Service
participant DB as Database
participant Monitor as Monitoring System
LB->>API : GET /health
API->>API : Check service status
API-->>LB : 200 OK (status : ok)
LB->>API : GET /ready
API->>DB : Check database connectivity
DB-->>API : Connection successful
API-->>LB : 200 OK (ready)
Monitor->>API : GET /metrics
API-->>Monitor : Request metrics
```

**Diagram sources**
- [src/server.ts](file://src/server.ts#L26-L38)
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)

#### Metrics Collection
- **Request Metrics**: Track request counts, durations, and error rates
- **Database Metrics**: Monitor connection pools and query performance
- **Resource Metrics**: CPU, memory, and disk utilization
- **Business Metrics**: Position creations, transitions, and asset operations

### Backup and Disaster Recovery

#### Database Backup Strategy
```bash
# Automated backup script usage
./db/backup.sh > taas-backup-$(date +%Y%m%d-%H%M%S).sql

# Scheduled backup automation
0 2 * * * /path/to/taas-platform/db/backup.sh > /backups/taas-$(date +%Y%m%d-%H%M%S).sql
```

#### Volume Management
```yaml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/docker/volumes/taas_postgres_data
```

**Section sources**
- [db/schema.sql](file://db/schema.sql#L1-L138)
- [README.md](file://README.md#L327-L351)

## Troubleshooting Guide

### Common Deployment Issues

#### Container Startup Failures

**Problem**: Containers fail to start or exit immediately
**Diagnosis**:
```bash
# Check container logs
docker compose logs api
docker compose logs db
docker compose logs admin

# Inspect container status
docker compose ps
```

**Common Causes and Solutions**:

1. **Port Conflicts**
   ```bash
   # Solution: Check for conflicting services
   netstat -tulpn | grep :4000
   netstat -tulpn | grep :8080
   netstat -tulpn | grep :15432
   ```

2. **Missing Dependencies**
   ```bash
   # Solution: Rebuild with fresh dependencies
   docker compose down
   docker compose up --build
   ```

3. **Environment Configuration**
   ```bash
   # Solution: Verify environment variables
   docker compose exec api printenv | grep -E "(DATABASE_URL|ROOT_API_KEY)"
   ```

#### Network Connectivity Problems

**Problem**: Services cannot communicate with each other
**Diagnosis**:
```bash
# Test internal network connectivity
docker compose exec api ping taas-db
docker compose exec db ping taas-api

# Check DNS resolution
docker compose exec api nslookup taas-db
```

**Solutions**:
- Verify service dependencies in docker-compose.yml
- Check container network isolation
- Confirm port mappings are correct

#### Volume Mounting Errors

**Problem**: Database data not persisting between deployments
**Diagnosis**:
```bash
# Check volume mounts
docker compose exec db df -h
docker volume ls | grep taas

# Verify file permissions
docker compose exec db ls -la /var/lib/postgresql/data
```

**Solutions**:
- Ensure proper volume permissions
- Check Docker volume driver configuration
- Verify mount paths are correct

### Database-Specific Issues

#### Schema Initialization Failures
**Problem**: Database schema not loading properly
**Solution**:
```bash
# Manual schema loading
docker compose exec db psql -U taas_user -d taas_platform -f /docker-entrypoint-initdb.d/10-schema.sql

# Verify schema exists
docker compose exec db psql -U taas_user -d taas_platform -c "\dt"
```

#### Connection Pool Exhaustion
**Problem**: Database connections timing out
**Solution**:
```bash
# Check connection status
docker compose exec db psql -U taas_user -d taas_platform -c "SELECT * FROM pg_stat_activity;"

# Increase connection limits in docker-compose.yml
environment:
  POSTGRES_MAX_CONNECTIONS: 100
```

### Performance Troubleshooting

#### High Memory Usage
**Diagnosis**:
```bash
# Monitor container resource usage
docker stats

# Check Node.js memory usage
docker compose exec api node --inspect-brk=0.0.0.0:9229 dist/server.js &
```

**Solutions**:
- Adjust JVM heap settings for Node.js applications
- Implement connection pooling
- Optimize database queries

#### Slow API Responses
**Diagnosis**:
```bash
# Enable request logging
export REQUEST_LOGGING=true

# Monitor API metrics
curl http://localhost:56888/metrics
```

**Solutions**:
- Implement caching strategies
- Optimize database indexes
- Add request/response compression

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L18-L21)
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)

## Monitoring and Observability

### Health Check Endpoints

The platform provides comprehensive health monitoring through standardized endpoints:

#### Liveness Probe
- **Endpoint**: `GET /health`
- **Purpose**: Basic service availability check
- **Response**: `{ "status": "ok", "service": "taas-platform", "storeBackend": "postgres" }`
- **Frequency**: Every 30 seconds in production

#### Readiness Probe
- **Endpoint**: `GET /ready`
- **Purpose**: Service readiness including database connectivity
- **Response**: Success/failure based on service dependencies
- **Critical Path**: Blocks traffic until service is ready

#### Metrics Endpoint
- **Endpoint**: `GET /metrics`
- **Purpose**: Business and operational metrics
- **Access Control**: Root API key required
- **Data**: Request counts, error rates, performance metrics

### Prometheus Integration

For production monitoring, integrate with Prometheus:

```yaml
# prometheus.yml configuration
scrape_configs:
  - job_name: 'taas-backend'
    metrics_path: /metrics
    static_configs:
      - targets: ['taas-api:4000']
    bearer_token: '<root-api-key>'
```

### Log Management

#### Structured Logging
The platform implements structured logging for operational insights:

```javascript
// Example log entry structure
{
  level: 'info',
  message: 'API request processed',
  timestamp: '2024-01-01T00:00:00.000Z',
  requestId: 'req-123',
  method: 'GET',
  path: '/health',
  durationMs: 2,
  statusCode: 200
}
```

#### Log Aggregation
- **Centralized Logging**: Use ELK stack or Fluentd for log aggregation
- **Structured Format**: JSON-formatted logs for easy parsing
- **Log Retention**: Implement appropriate retention policies
- **Alerting**: Set up alerts for error patterns and performance degradation

### Performance Monitoring

#### Key Performance Indicators

| Metric | Description | Threshold |
|--------|-------------|-----------|
| API Response Time | Average request duration | < 300ms (95th percentile) |
| Error Rate | Percentage of failed requests | < 1% |
| Database Connections | Active database connections | < 80% of max |
| Memory Usage | Container memory consumption | < 85% |

#### Alerting Rules
```yaml
groups:
  - name: taas-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          
      - alert: DatabaseConnectionIssues
        expr: postgresql_connections > 0.8 * postgresql_max_connections
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool exhausted"
```

**Section sources**
- [src/server.ts](file://src/server.ts#L26-L38)
- [src/infra/metrics.ts](file://src/infra/metrics.ts#L1-L37)
- [README.md](file://README.md#L355-L378)