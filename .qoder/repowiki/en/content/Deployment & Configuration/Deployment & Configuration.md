# Deployment & Configuration

<cite>
**Referenced Files in This Document**   
- [docker-compose.yml](file://docker-compose.yml)
- [Dockerfile](file://Dockerfile)
- [admin-console/Dockerfile](file://admin-console/Dockerfile)
- [src/config.ts](file://src/config.ts)
- [db/schema.sql](file://db/schema.sql)
- [db/backup.sh](file://db/backup.sh)
- [db/restore.sh](file://db/restore.sh)
- [src/server.ts](file://src/server.ts)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
- [src/infra/postgresLedger.ts](file://src/infra/postgresLedger.ts)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Docker & Docker Compose Deployment](#docker--docker-compose-deployment)
4. [Container Networking & Volume Management](#container-networking--volume-management)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup & Management](#database-setup--management)
7. [Backup & Restore Procedures](#backup--restore-procedures)
8. [Production Deployment Best Practices](#production-deployment-best-practices)
9. [Scaling Considerations](#scaling-considerations)
10. [Environment-Specific Configurations](#environment-specific-configurations)
11. [Step-by-Step Deployment Guides](#step-by-step-deployment-guides)

## Introduction
This document provides comprehensive guidance for deploying and configuring the escrowgrid platform. It covers Docker and docker-compose deployment workflows, environment variable configuration, database setup, backup and restore procedures, production deployment best practices, scaling considerations, and environment-specific configurations. The documentation includes step-by-step deployment guides for different environments including development, staging, and production.

**Section sources**
- [README.md](file://README.md#L1-L378)

## Project Structure
The escrowgrid platform consists of multiple components organized in a modular structure. The main components include:
- **admin-console/**: Admin interface built with React
- **db/**: Database schema and management scripts
- **load/**: Load testing scripts
- **src/**: Core backend application in TypeScript
- **website/**: Public website
- Root-level configuration files including Docker, package, and deployment configurations

The architecture follows a microservices-inspired pattern with separate containers for the API, database, and admin console, connected through docker-compose for local and staging deployments.

```mermaid
graph TD
subgraph "Frontend"
AdminConsole[Admin Console]
Website[Public Website]
end
subgraph "Backend"
API[API Service]
DB[(PostgreSQL)]
end
AdminConsole --> API
Website --> API
API --> DB
```

**Diagram sources**
- [docker-compose.yml](file://docker-compose.yml#L3-L55)
- [Dockerfile](file://Dockerfile#L1-L27)
- [admin-console/Dockerfile](file://admin-console/Dockerfile#L1-L20)

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)
- [README.md](file://README.md#L1-L378)

## Docker & Docker Compose Deployment
The escrowgrid platform uses Docker and docker-compose for containerized deployment. The docker-compose.yml file defines three services: db, api, and admin.

The **db service** uses the postgres:16-alpine image with:
- Database name: taas_platform
- User: taas_user
- Password: taas_pass
- Host port mapping: 15432:5432 (to avoid conflicts with local PostgreSQL installations)
- Volume mount for schema initialization
- Health check using pg_isready

The **api service** is built from the root Dockerfile with:
- Multi-stage build process for optimized image size
- Node.js 20-alpine base image
- Environment variables for configuration
- Dependency on the db service with health check condition
- Port mapping: 4000 (container) to dynamic host port

The **admin service** is built from the admin-console/Dockerfile with:
- Multi-stage build with nginx as the runtime
- Dependency on the api service
- Port mapping: 8080:80 (host:container)

To deploy the platform using docker-compose:
```bash
docker compose up --build
```

This command builds the images (if not already built) and starts all services. The API service listens on container port 4000, but Docker assigns a dynamic host port to avoid conflicts. Use `docker compose ps` to discover the assigned host port.

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L3-L55)
- [Dockerfile](file://Dockerfile#L1-L27)
- [admin-console/Dockerfile](file://admin-console/Dockerfile#L1-L20)

## Container Networking & Volume Management
The escrowgrid platform uses Docker's default bridge network for container communication. The services are configured to communicate through Docker's internal DNS resolution, where services can reference each other by their service names (e.g., "db" and "api").

### Container Networking
The services are interconnected as follows:
- The api service connects to the db service using the hostname "db" and port 5432
- The admin service connects to the api service (dependency only, actual communication depends on frontend configuration)
- All services are on the same Docker network created by docker-compose

Network configuration includes:
- Service dependencies with health checks to ensure proper startup order
- Internal port exposure for inter-service communication
- Selective port exposure to the host for external access

### Volume Management
The platform uses Docker volumes for persistent data storage and configuration:

**Database Volume**
The database service mounts the schema.sql file to initialize the database:
```yaml
volumes:
  - ./db/schema.sql:/docker-entrypoint-initdb.d/10-schema.sql:ro
```

This volume mount ensures that the database schema is automatically applied when the container starts for the first time. The file is mounted as read-only (ro) to prevent accidental modifications.

For production deployments, consider using a named volume or bind mount to a persistent storage location to ensure data persistence across container restarts:
```yaml
volumes:
  - db_data:/var/lib/postgresql/data
  - ./db/schema.sql:/docker-entrypoint-initdb.d/10-schema.sql:ro

volumes:
  db_data:
```

This configuration separates the database data from the container filesystem, ensuring that data persists even if the container is recreated.

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L15-L16)
- [docker-compose.yml](file://docker-compose.yml#L39-L41)

## Environment Configuration
The escrowgrid platform uses environment variables for configuration, with values defined in both docker-compose.yml and the config.ts file.

### Environment Variables in docker-compose.yml
The docker-compose.yml file defines several environment variables for the api service:

**Core Configuration**
- `NODE_ENV`: Sets the Node.js environment (production)
- `STORE_BACKEND`: Specifies the storage backend (postgres)
- `DATABASE_URL`: Connection string for PostgreSQL database
- `ROOT_API_KEY`: Master API key for administrative operations
- `RATE_LIMIT_ENABLED`: Enables/disables rate limiting
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS`: Maximum number of requests per window

**On-Chain Ledger Configuration (commented out)**
- `ONCHAIN_LEDGER_ENABLED`: Enables on-chain ledger functionality
- `ONCHAIN_RPC_URL`: RPC endpoint for blockchain network
- `ONCHAIN_PRIVATE_KEY`: Private key for blockchain transactions
- `ONCHAIN_CONTRACT_ADDRESS`: Smart contract address
- `ONCHAIN_CHAIN_ID`: Blockchain network ID

### Configuration in config.ts
The src/config.ts file defines the application configuration interface and processes environment variables:

```typescript
export interface AppConfig {
  port: number;
  storeBackend: StoreBackend;
  postgresUrl?: string | undefined;
  rootApiKey?: string | undefined;
  onchainLedgerEnabled: boolean;
  onchainRpcUrl?: string | undefined;
  onchainPrivateKey?: string | undefined;
  onchainContractAddress?: string | undefined;
  onchainChainId?: number | undefined;
  rateLimitEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}
```

The configuration system includes:
- Type safety through TypeScript interfaces
- Default values for optional parameters
- Type conversion (e.g., string to number)
- Validation functions like requirePostgresUrl()

### .env File Usage
While the current configuration uses direct environment variables in docker-compose.yml, the platform can be adapted to use .env files for better environment management:

Create a .env file:
```env
NODE_ENV=production
STORE_BACKEND=postgres
DATABASE_URL=postgres://taas_user:taas_pass@db:5432/taas_platform
ROOT_API_KEY=your-root-api-key
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
```

Then reference it in docker-compose.yml:
```yaml
api:
  build: .
  env_file:
    - .env
  depends_on:
    db:
      condition: service_healthy
  ports:
    - "4000"
```

This approach separates configuration from the deployment manifest, making it easier to manage different environments.

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L26-L38)
- [src/config.ts](file://src/config.ts#L3-L38)

## Database Setup & Management
The escrowgrid platform uses PostgreSQL as its primary data store, with a comprehensive schema defined in db/schema.sql.

### Database Schema
The database schema includes the following tables:

**Core Entities**
- `institutions`: Organizations using the platform
- `asset_templates`: Templates for tokenizable assets
- `assets`: Specific instances of assets
- `positions`: Holder-specific claims on assets
- `position_events`: Lifecycle events for positions
- `ledger_events`: Immutable ledger entries

**Supporting Tables**
- `api_keys`: Authentication keys for API access
- `audit_events`: Audit trail of API operations
- `institution_policies`: Policy configurations per institution

The schema includes appropriate indexes for query performance, foreign key constraints for data integrity, and unique constraints where required.

### Database Initialization
The database is initialized through Docker volume mounting:
```yaml
volumes:
  - ./db/schema.sql:/docker-entrypoint-initdb.d/10-schema.sql:ro
```

When the PostgreSQL container starts for the first time, it automatically executes any SQL files in the /docker-entrypoint-initdb.d/ directory, ensuring the schema is created.

### Connection Configuration
The API service connects to the database using the DATABASE_URL environment variable:
```
postgres://taas_user:taas_pass@db:5432/taas_platform
```

The connection is managed through the pg package in Node.js, with connection pooling for performance.

### Store Backend Configuration
The platform supports multiple storage backends through the STORE_BACKEND environment variable:
- `memory`: In-memory storage (default for development)
- `postgres`: PostgreSQL persistent storage

When using PostgreSQL, the application validates that DATABASE_URL is provided and creates a connection pool for database operations.

```mermaid
erDiagram
INSTITUTIONS {
string id PK
string name
string[] regions
string[] verticals
timestamptz created_at
timestamptz updated_at
}
ASSET_TEMPLATES {
string id PK
string institution_id FK
string code
string name
string vertical
string region
jsonb config
timestamptz created_at
timestamptz updated_at
}
ASSETS {
string id PK
string institution_id FK
string template_id FK
string label
jsonb metadata
timestamptz created_at
timestamptz updated_at
}
POSITIONS {
string id PK
string institution_id FK
string asset_id FK
string holder_reference
string currency
numeric amount
string state
string external_reference
timestamptz created_at
timestamptz updated_at
}
POSITION_EVENTS {
string id PK
string position_id FK
string from_state
string to_state
string reason
timestamptz at
jsonb metadata
timestamptz created_at
}
LEDGER_EVENTS {
string id PK
string kind
string position_id FK
timestamptz at
string previous_state
string new_state
jsonb payload
timestamptz created_at
}
API_KEYS {
string id PK
string institution_id FK
string key_hash UK
string label
string role
timestamptz created_at
timestamptz revoked_at
}
INSTITUTIONS ||--o{ ASSET_TEMPLATES : "has"
INSTITUTIONS ||--o{ ASSETS : "has"
INSTITUTIONS ||--o{ POSITIONS : "has"
INSTITUTIONS ||--o{ API_KEYS : "has"
ASSET_TEMPLATES ||--o{ ASSETS : "instantiates"
ASSETS ||--o{ POSITIONS : "contains"
POSITIONS ||--o{ POSITION_EVENTS : "has"
POSITIONS ||--o{ LEDGER_EVENTS : "generates"
```

**Diagram sources**
- [db/schema.sql](file://db/schema.sql#L3-L138)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L1-L417)

**Section sources**
- [db/schema.sql](file://db/schema.sql#L1-L138)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L1-L417)
- [docker-compose.yml](file://docker-compose.yml#L4-L22)

## Backup & Restore Procedures
The escrowgrid platform includes scripts for database backup and restore operations in the db/ directory.

### Backup Procedure
The db/backup.sh script creates a SQL dump of the database:

**Usage Methods**
1. Using DATABASE_URL environment variable:
```bash
DATABASE_URL="postgres://user:pass@host:port/dbname" ./db/backup.sh > taas-backup.sql
```

2. Using libpq environment variables:
```bash
PGDATABASE=taas_platform PGUSER=... PGPASSWORD=... ./db/backup.sh > taas-backup.sql
```

**Script Features**
- Validates that pg_dump is installed
- Uses --no-owner and --no-privileges options to make the dump more portable
- Outputs plain SQL format to stdout for redirection
- Falls back to libpq environment variables if DATABASE_URL is not set

**Production Backup Example**
```bash
# Create timestamped backup
export DATABASE_URL="postgres://taas_user:taas_pass@localhost:15432/taas_platform"
./db/backup.sh > taas-backup-$(date +%Y%m%d-%H%M%S).sql

# Compress the backup
gzip taas-backup-$(date +%Y%m%d-%H%M%S).sql

# Upload to cloud storage (example with AWS CLI)
aws s3 cp taas-backup-$(date +%Y%m%d-%H%M%S).sql.gz s3://your-backup-bucket/
```

### Restore Procedure
The db/restore.sh script restores a database from a SQL dump:

**Usage Methods**
1. Using DATABASE_URL environment variable:
```bash
DATABASE_URL="postgres://user:pass@host:port/dbname" ./db/restore.sh taas-backup.sql
```

2. Using libpq environment variables:
```bash
PGDATABASE=taas_platform PGUSER=... PGPASSWORD=... ./db/restore.sh taas-backup.sql
```

**Critical Warning**
The restore script is destructive - it drops and recreates the public schema:
```bash
psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
```

This means all existing data in the target database will be lost. Only use this script on databases intended to be overwritten (e.g., staging, test, or new environments).

**Restore Process**
1. Validate input parameters and backup file existence
2. Check that psql is installed
3. Drop all objects in the public schema and recreate it
4. Execute the SQL dump file

**Safety Recommendations**
- Always backup the current database before restoring
- Verify the target database is correct
- Test restores on non-production environments first
- Consider using pg_restore for more granular control in production

**Section sources**
- [db/backup.sh](file://db/backup.sh#L1-L27)
- [db/restore.sh](file://db/restore.sh#L1-L46)

## Production Deployment Best Practices
Deploying the escrowgrid platform to production requires careful consideration of security, reliability, and maintainability.

### Security Configuration
**API Key Management**
- Set a strong, randomly generated ROOT_API_KEY
- Rotate API keys periodically
- Use different keys for different environments
- Store keys in secure secrets management (not in version control)

**Database Security**
- Use strong passwords for database users
- Restrict database access to trusted networks
- Enable SSL/TLS for database connections in production
- Regularly update PostgreSQL to security patches

**Container Security**
- Keep base images updated (node:20-alpine, postgres:16-alpine)
- Minimize attack surface by using minimal base images
- Run containers as non-root users when possible
- Regularly scan images for vulnerabilities

### Reliability & Monitoring
**Health Checks**
The platform provides built-in health checks:
- `/health`: Basic liveness check
- `/ready`: Readiness check (includes database connectivity)

Configure your orchestration platform (Docker, Kubernetes, etc.) to use these endpoints for health monitoring.

**Metrics Collection**
The `/metrics` endpoint provides JSON metrics (root-only access). Integrate with monitoring systems like:
- Prometheus for time-series data collection
- Grafana for visualization
- Alertmanager for notifications

**Logging**
- Enable structured logging in production
- Centralize logs using tools like ELK stack or cloud logging services
- Retain logs for compliance and debugging

### Configuration Management
**Environment Separation**
Maintain separate configurations for:
- Development
- Staging
- Production

Use different database instances and API keys for each environment.

**Configuration as Code**
Store environment configurations in version control (without secrets):
- Use .env files for local development
- Use Kubernetes ConfigMaps/Secrets or cloud provider equivalents for production
- Automate configuration deployment through CI/CD pipelines

### Deployment Strategies
**Blue-Green Deployment**
- Maintain two identical production environments
- Deploy new version to inactive environment
- Test thoroughly
- Switch traffic to new environment
- Roll back by switching back if issues arise

**Canary Deployment**
- Deploy new version to a small subset of users
- Monitor performance and error rates
- Gradually increase traffic if no issues
- Roll back if problems are detected

**Section sources**
- [README.md](file://README.md#L355-L378)
- [src/server.ts](file://src/server.ts#L26-L38)
- [docker-compose.yml](file://docker-compose.yml#L17-L21)

## Scaling Considerations
The escrowgrid platform can be scaled to handle increased load through various strategies.

### Horizontal Scaling
The stateless API service can be horizontally scaled by running multiple instances behind a load balancer.

**Scaling Requirements**
- Externalized session storage (already met with PostgreSQL backend)
- Shared database connection pool
- Load balancer for traffic distribution

**Implementation Example**
```yaml
api:
  build: .
  replicas: 3
  environment:
    STORE_BACKEND: postgres
    DATABASE_URL: ${DATABASE_URL}
    ROOT_API_KEY: ${ROOT_API_KEY}
  depends_on:
    db:
      condition: service_healthy
  ports:
    - "4000"
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
```

### Database Scaling
**Connection Pooling**
The application uses connection pooling through the pg package. Configure appropriate pool sizes based on expected load:
- Default pool size: 10 connections
- Adjust based on concurrent request volume
- Monitor for connection timeouts or exhaustion

**Read Replicas**
For read-heavy workloads, consider adding PostgreSQL read replicas:
- Route read queries to replicas
- Write queries to primary
- Use connection routing logic in the application

### Performance Optimization
**Caching**
Implement caching for frequently accessed data:
- Redis or Memcached for in-memory caching
- Cache database query results
- Cache API responses where appropriate

**Rate Limiting**
The platform includes built-in rate limiting:
- Configurable window and request limits
- Protects against abuse and DDoS attacks
- Tune values based on expected usage patterns

```mermaid
graph TD
Client --> LoadBalancer
LoadBalancer --> API1[API Instance 1]
LoadBalancer --> API2[API Instance 2]
LoadBalancer --> API3[API Instance 3]
API1 --> DB[(PostgreSQL)]
API2 --> DB
API3 --> DB
DB --> Replica1[(Read Replica)]
DB --> Replica2[(Read Replica)]
style API1 fill:#f9f,stroke:#333
style API2 fill:#f9f,stroke:#333
style API3 fill:#f9f,stroke:#333
style DB fill:#3498db,stroke:#333,color:#fff
style Replica1 fill:#3498db,stroke:#333,color:#fff
style Replica2 fill:#3498db,stroke:#333,color:#fff
```

**Diagram sources**
- [docker-compose.yml](file://docker-compose.yml#L23-L47)
- [src/config.ts](file://src/config.ts#L13-L15)

**Section sources**
- [src/config.ts](file://src/config.ts#L13-L15)
- [docker-compose.yml](file://docker-compose.yml#L23-L47)

## Environment-Specific Configurations
The escrowgrid platform supports different configurations for various environments through environment variables and conditional logic.

### Development Environment
**Configuration**
```env
NODE_ENV=development
STORE_BACKEND=memory
ROOT_API_KEY=dev-root-key
RATE_LIMIT_ENABLED=false
```

**Features**
- In-memory storage for fast development
- Disabled rate limiting
- Detailed error messages
- Hot reloading (when using npm run dev)

**Docker Compose Override**
Create docker-compose.dev.yml:
```yaml
version: '3.9'
services:
  api:
    environment:
      - STORE_BACKEND=memory
      - RATE_LIMIT_ENABLED=false
    volumes:
      - ./src:/app/src
    command: npm run dev
```

### Staging Environment
**Configuration**
```env
NODE_ENV=staging
STORE_BACKEND=postgres
DATABASE_URL=postgres://user:pass@staging-db:5432/taas_platform
ROOT_API_KEY=staging-root-key
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=500
ONCHAIN_LEDGER_ENABLED=false
```

**Features**
- Persistent PostgreSQL storage
- Rate limiting enabled
- Realistic data volumes
- Monitoring and logging enabled
- On-chain functionality disabled

### Production Environment
**Configuration**
```env
NODE_ENV=production
STORE_BACKEND=postgres
DATABASE_URL=postgres://user:pass@prod-db:5432/taas_platform
ROOT_API_KEY=${ROOT_API_KEY_SECRET}
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
ONCHAIN_LEDGER_ENABLED=true
ONCHAIN_RPC_URL=${ONCHAIN_RPC_URL_SECRET}
ONCHAIN_PRIVATE_KEY=${ONCHAIN_PRIVATE_KEY_SECRET}
ONCHAIN_CONTRACT_ADDRESS=0x...
ONCHAIN_CHAIN_ID=1
```

**Features**
- Full production configuration
- On-chain ledger enabled
- Strict rate limiting
- Comprehensive monitoring
- Regular backups
- Disaster recovery procedures

**Security Considerations**
- Secrets stored in secure vault (not in environment files)
- Regular security audits
- Penetration testing
- Incident response plan

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L26-L38)
- [src/config.ts](file://src/config.ts#L23-L38)

## Step-by-Step Deployment Guides

### Development Environment Deployment
Follow these steps to deploy the escrowgrid platform in a development environment:

1. **Install Prerequisites**
   - Docker and Docker Compose
   - Node.js 20.x
   - npm

2. **Clone the Repository**
   ```bash
   git clone https://github.com/escrowgrid/escrowgrid.git
   cd escrowgrid
   ```

3. **Start the Platform**
   ```bash
   docker compose up --build
   ```

4. **Verify Deployment**
   ```bash
   # Find the API port
   docker compose ps
   
   # Test health endpoint (replace PORT with actual port)
   curl http://localhost:PORT/health
   ```

5. **Access Services**
   - API: http://localhost:PORT (PORT from docker compose ps)
   - Admin Console: http://localhost:8080

6. **Development Workflow**
   For active development, use the dev server:
   ```bash
   npm install
   npm run dev
   ```

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)
- [README.md](file://README.md#L10-L23)

### Staging Environment Deployment
Follow these steps to deploy the escrowgrid platform in a staging environment:

1. **Provision Infrastructure**
   - Virtual machine or container orchestration platform
   - Dedicated PostgreSQL instance
   - Domain name (optional)

2. **Configure Environment Variables**
   Create a .env.staging file:
   ```env
   NODE_ENV=staging
   STORE_BACKEND=postgres
   DATABASE_URL=postgres://taas_user:strong_password@db-host:5432/taas_platform
   ROOT_API_KEY=generate_a_strong_random_key
   RATE_LIMIT_ENABLED=true
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX_REQUESTS=500
   ```

3. **Deploy with Docker Compose**
   ```bash
   # Copy configuration
   cp .env.staging .env
   
   # Start services
   docker compose up -d --build
   
   # Monitor logs
   docker compose logs -f
   ```

4. **Verify Deployment**
   ```bash
   # Check service status
   docker compose ps
   
   # Test endpoints
   API_PORT=$(docker compose port api 4000 | cut -d: -f2)
   curl http://localhost:${API_PORT}/health
   curl http://localhost:${API_PORT}/ready
   ```

5. **Configure Monitoring**
   - Set up health check monitoring
   - Configure log aggregation
   - Establish alerting rules

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)
- [src/config.ts](file://src/config.ts#L23-L38)

### Production Environment Deployment
Follow these steps to deploy the escrowgrid platform in a production environment:

1. **Infrastructure Preparation**
   - High-availability PostgreSQL cluster
   - Load balancer
   - SSL/TLS certificates
   - Monitoring and alerting system
   - Backup storage (S3, etc.)

2. **Security Configuration**
   - Generate strong secrets for all environment variables
   - Store secrets in a secure vault (Hashicorp Vault, AWS Secrets Manager, etc.)
   - Configure firewall rules
   - Set up intrusion detection

3. **Database Setup**
   ```bash
   # Create production database
   createdb taas_platform_prod
   
   # Apply schema
   psql taas_platform_prod < db/schema.sql
   
   # Configure backups
   # Set up automated backup script with rotation
   ```

4. **Deployment Configuration**
   Create production-specific docker-compose.prod.yml:
   ```yaml
   version: '3.9'
   services:
     api:
       image: escrowgrid/api:production-latest
       environment:
         - NODE_ENV=production
         - STORE_BACKEND=postgres
         - DATABASE_URL=${DATABASE_URL}
         - ROOT_API_KEY=${ROOT_API_KEY}
         - RATE_LIMIT_ENABLED=true
         - RATE_LIMIT_WINDOW_MS=60000
         - RATE_LIMIT_MAX_REQUESTS=1000
         - ONCHAIN_LEDGER_ENABLED=true
         - ONCHAIN_RPC_URL=${ONCHAIN_RPC_URL}
         - ONCHAIN_PRIVATE_KEY=${ONCHAIN_PRIVATE_KEY}
         - ONCHAIN_CONTRACT_ADDRESS=0x...
       depends_on:
         db:
           condition: service_healthy
       deploy:
         replicas: 3
         update_config:
           parallelism: 1
           delay: 30s
   ```

5. **Rolling Deployment**
   ```bash
   # Deploy with zero downtime
   docker stack deploy -c docker-compose.prod.yml escrowgrid
   
   # Monitor deployment
   docker service ls
   docker service logs escrowgrid_api
   ```

6. **Post-Deployment Verification**
   ```bash
   # Verify health and readiness
   for i in {1..10}; do
     curl -f http://load-balancer-ip/health && break
     sleep 5
   done
   
   # Test API functionality
   curl -H "X-API-KEY: ${ROOT_API_KEY}" http://load-balancer-ip/institutions
   ```

7. **Ongoing Operations**
   - Regular backups with offsite storage
   - Security patching schedule
   - Performance monitoring
   - Capacity planning
   - Disaster recovery testing

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)
- [src/config.ts](file://src/config.ts#L23-L38)
- [db/backup.sh](file://db/backup.sh#L1-L27)
- [db/restore.sh](file://db/restore.sh#L1-L46)