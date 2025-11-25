# Storage Initialization and Configuration

<cite>
**Referenced Files in This Document**
- [src/store/index.ts](file://src/store/index.ts)
- [src/config.ts](file://src/config.ts)
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
- [src/store/store.ts](file://src/store/store.ts)
- [src/server.ts](file://src/server.ts)
- [src/infra/health.ts](file://src/infra/health.ts)
- [src/infra/ledgerClient.ts](file://src/infra/ledgerClient.ts)
- [src/infra/policyStore.ts](file://src/infra/policyStore.ts)
- [docker-compose.yml](file://docker-compose.yml)
- [Dockerfile](file://Dockerfile)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Configuration Architecture](#configuration-architecture)
3. [Storage Backend Selection Logic](#storage-backend-selection-logic)
4. [Environment Variables](#environment-variables)
5. [Storage Implementation Details](#storage-implementation-details)
6. [Factory Pattern Implementation](#factory-pattern-implementation)
7. [Configuration Scenarios](#configuration-scenarios)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Extension Points](#extension-points)
10. [Health Monitoring](#health-monitoring)

## Introduction

The EscrowGrid platform implements a flexible storage initialization and configuration system that enables seamless switching between different storage backends based on runtime configuration. The system employs a factory pattern combined with conditional exports to instantiate either an in-memory store for development environments or a PostgreSQL-based store for production deployments.

This architecture provides several key benefits:
- **Environment-specific optimization**: Different storage backends for development vs. production
- **Configuration-driven behavior**: Runtime selection based on environment variables
- **Type-safe abstraction**: Unified Store interface across all implementations
- **Scalable architecture**: Easy extension for additional storage backends

## Configuration Architecture

The configuration system is built around a centralized configuration module that reads environment variables and provides typed configuration objects to the rest of the application.

```mermaid
graph TB
subgraph "Configuration Layer"
ConfigModule["config.ts<br/>Configuration Module"]
EnvVars["Environment Variables<br/>Environment Variables"]
AppConfig["AppConfig Interface<br/>Typed Configuration"]
end
subgraph "Storage Layer"
StoreIndex["index.ts<br/>Storage Factory"]
MemoryStore["memoryStore.ts<br/>In-Memory Implementation"]
PostgresStore["postgresStore.ts<br/>PostgreSQL Implementation"]
end
subgraph "Application Layer"
Server["server.ts<br/>Main Application"]
Health["health.ts<br/>Health Checks"]
InfraModules["Infrastructure Modules<br/>ledgerClient, policyStore"]
end
EnvVars --> ConfigModule
ConfigModule --> AppConfig
AppConfig --> StoreIndex
StoreIndex --> MemoryStore
StoreIndex --> PostgresStore
StoreIndex --> Server
StoreIndex --> Health
StoreIndex --> InfraModules
```

**Diagram sources**
- [src/config.ts](file://src/config.ts#L1-L47)
- [src/store/index.ts](file://src/store/index.ts#L1-L16)

**Section sources**
- [src/config.ts](file://src/config.ts#L1-L47)
- [src/store/index.ts](file://src/store/index.ts#L1-L16)

## Storage Backend Selection Logic

The storage backend selection follows a straightforward conditional logic pattern that evaluates the `STORE_BACKEND` environment variable to determine the appropriate storage implementation.

```mermaid
flowchart TD
Start([Application Startup]) --> LoadConfig["Load Configuration<br/>from config.ts"]
LoadConfig --> CheckBackend{"STORE_BACKEND<br/>Environment Variable"}
CheckBackend --> |postgres| CreatePostgres["createPostgresStore()<br/>Instantiate PostgreSQL Store"]
CheckBackend --> |memory| UseMemory["memoryStore<br/>Use In-Memory Store"]
CreatePostgres --> ExportStore["Export Store Instance"]
UseMemory --> ExportStore
ExportStore --> Ready([Storage Ready])
CreatePostgres --> ValidateDB{"Database<br/>Connection?"}
ValidateDB --> |Success| ExportStore
ValidateDB --> |Failure| Error([Initialization Error])
```

**Diagram sources**
- [src/store/index.ts](file://src/store/index.ts#L8-L12)
- [src/config.ts](file://src/config.ts#L24-L25)

The selection logic is implemented in [`src/store/index.ts`](file://src/store/index.ts#L8-L12) and demonstrates a clean factory pattern approach:

- **Development Environment**: Defaults to `'memory'` backend for fast startup and easy testing
- **Production Environment**: Uses `'postgres'` backend for persistence and scalability
- **Validation**: The system validates database connection requirements when PostgreSQL is selected

**Section sources**
- [src/store/index.ts](file://src/store/index.ts#L8-L12)
- [src/config.ts](file://src/config.ts#L24-L25)

## Environment Variables

The storage system relies on several key environment variables that control behavior and connectivity:

| Variable | Purpose | Default Value | Required |
|----------|---------|---------------|----------|
| `STORE_BACKEND` | Determines storage implementation | `'memory'` | No |
| `DATABASE_URL` | PostgreSQL connection string | None | Yes (when STORE_BACKEND=postgres) |
| `PORT` | Server port | `4000` | No |
| `NODE_ENV` | Environment mode | `'development'` | No |

### Primary Storage Control Variables

**STORE_BACKEND**: Controls the primary storage backend selection
- **Values**: `'memory'` or `'postgres'`
- **Default**: `'memory'` (development-friendly)
- **Impact**: Determines whether in-memory or persistent storage is used

**DATABASE_URL**: PostgreSQL connection string for persistent storage
- **Format**: `postgresql://username:password@host:port/database`
- **Required**: Only when `STORE_BACKEND=postgres`
- **Example**: `postgresql://user:pass@localhost:5432/escrowgrid`

### Additional Configuration Variables

**PORT**: Server binding port
- **Default**: `4000`
- **Purpose**: HTTP server port configuration

**NODE_ENV**: Environment identification
- **Values**: `'development'`, `'test'`, `'production'`
- **Impact**: Affects logging, error handling, and performance characteristics

**Section sources**
- [src/config.ts](file://src/config.ts#L18-L46)
- [docker-compose.yml](file://docker-compose.yml#L26-L29)

## Storage Implementation Details

### Memory Store Implementation

The in-memory store provides a lightweight, volatile storage solution ideal for development and testing scenarios.

```mermaid
classDiagram
class MemoryStore {
-institutions : Map~string, Institution~
-assetTemplates : Map~string, AssetTemplate~
-assets : Map~string, Asset~
-positions : Map~string, Position~
+createInstitution(input) Institution
+listInstitutions() Institution[]
+getInstitution(id) Institution
+createAssetTemplate(input) AssetTemplate
+listAssetTemplates(params) AssetTemplate[]
+getAssetTemplate(id) AssetTemplate
+createAsset(input) Asset
+getAsset(id) Asset
+listAssets(params) Asset[]
+createPosition(input) Position
+getPosition(id) Position
+listPositions(params) Position[]
+updatePosition(position, event) Position
}
class Store {
<<interface>>
+createInstitution(input) Promise~Institution~
+listInstitutions() Promise~Institution[]~
+getInstitution(id) Promise~Institution~
+createAssetTemplate(input) Promise~AssetTemplate~
+listAssetTemplates(params) Promise~AssetTemplate[]~
+getAssetTemplate(id) Promise~AssetTemplate~
+createAsset(input) Promise~Asset~
+getAsset(id) Promise~Asset~
+listAssets(params) Promise~Asset[]~
+createPosition(input) Promise~Position~
+getPosition(id) Promise~Position~
+listPositions(params) Promise~Position[]~
+updatePosition(position, event) Promise~Position~
}
MemoryStore ..|> Store : implements
```

**Diagram sources**
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts#L13-L214)
- [src/store/store.ts](file://src/store/store.ts#L4-L58)

Key characteristics of the memory store:
- **Volatility**: Data persists only during runtime
- **Performance**: Fastest possible access for development
- **Simplicity**: No external dependencies or setup required
- **Concurrency**: Thread-safe through JavaScript's Map implementation

### PostgreSQL Store Implementation

The PostgreSQL store provides persistent, scalable storage suitable for production environments.

```mermaid
classDiagram
class PostgresStore {
-pool : Pool
+constructor()
+createInstitution(input) Promise~Institution~
+listInstitutions() Promise~Institution[]~
+getInstitution(id) Promise~Institution~
+createAssetTemplate(input) Promise~AssetTemplate~
+listAssetTemplates(params) Promise~AssetTemplate[]~
+getAssetTemplate(id) Promise~AssetTemplate~
+createAsset(input) Promise~Asset~
+getAsset(id) Promise~Asset~
+listAssets(params) Promise~Asset[]~
+createPosition(input) Promise~Position~
+getPosition(id) Promise~Position~
+listPositions(params) Promise~Position[]~
+updatePosition(position, event) Promise~Position~
-getPositionEvents(positionId) Promise~PositionLifecycleEvent[]~
}
class Store {
<<interface>>
+createInstitution(input) Promise~Institution~
+listInstitutions() Promise~Institution[]~
+getInstitution(id) Promise~Institution~
+createAssetTemplate(input) Promise~AssetTemplate~
+listAssetTemplates(params) Promise~AssetTemplate[]~
+getAssetTemplate(id) Promise~AssetTemplate~
+createAsset(input) Promise~Asset~
+getAsset(id) Promise~Asset~
+listAssets(params) Promise~Asset[]~
+createPosition(input) Promise~Position~
+getPosition(id) Promise~Position~
+listPositions(params) Promise~Position[]~
+updatePosition(position, event) Promise~Position~
}
PostgresStore ..|> Store : implements
```

**Diagram sources**
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L89-L411)
- [src/store/store.ts](file://src/store/store.ts#L4-L58)

Key characteristics of the PostgreSQL store:
- **Persistence**: Data survives application restarts
- **Scalability**: Handles large datasets and concurrent access
- **ACID Compliance**: Ensures data integrity and consistency
- **Transaction Support**: Full transaction support for complex operations

**Section sources**
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts#L1-L218)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L1-L417)

## Factory Pattern Implementation

The storage system implements a clean factory pattern through the [`createPostgresStore`](file://src/store/postgresStore.ts#L413-L416) function and conditional instantiation logic.

```mermaid
sequenceDiagram
participant App as Application
participant Index as store/index.ts
participant Config as config.ts
participant Factory as postgresStore.ts
participant PG as PostgreSQL
App->>Index : Import store
Index->>Config : Load configuration
Config-->>Index : AppConfig
Index->>Index : Evaluate STORE_BACKEND
alt STORE_BACKEND === 'postgres'
Index->>Factory : createPostgresStore()
Factory->>PG : new Pool(connectionString)
PG-->>Factory : Pool instance
Factory-->>Index : PostgresStore instance
else STORE_BACKEND === 'memory'
Index->>Index : memoryStore
Index-->>App : MemoryStore instance
end
Index-->>App : Store instance
```

**Diagram sources**
- [src/store/index.ts](file://src/store/index.ts#L8-L12)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L413-L416)

### Factory Function Benefits

The factory pattern provides several advantages:

1. **Encapsulation**: Database connection logic is isolated in the factory
2. **Testability**: Easy mocking and testing of different store implementations
3. **Flexibility**: Future extensions can be added without changing the interface
4. **Error Handling**: Centralized error handling for database connection issues

**Section sources**
- [src/store/index.ts](file://src/store/index.ts#L1-L16)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L413-L416)

## Configuration Scenarios

### Development Environment Setup

For local development, the system defaults to in-memory storage for rapid iteration and testing.

**Environment Configuration:**
```bash
# .env file for development
NODE_ENV=development
STORE_BACKEND=memory
PORT=4000
RATE_LIMIT_ENABLED=false
```

**Benefits:**
- Instant startup without database setup
- Data loss between sessions (expected for development)
- No external dependencies required
- Faster testing cycles

### Production Environment Setup

For production deployments, the system uses PostgreSQL for persistence and reliability.

**Environment Configuration:**
```bash
# .env file for production
NODE_ENV=production
STORE_BACKEND=postgres
DATABASE_URL=postgresql://user:pass@db-host:5432/escrowgrid
PORT=4000
ROOT_API_KEY=your-secret-key
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
```

**Benefits:**
- Data persistence across restarts
- Scalable for production workloads
- ACID compliance ensures data integrity
- Connection pooling for performance

### Docker Compose Production Scenario

The [`docker-compose.yml`](file://docker-compose.yml#L26-L29) demonstrates a production-ready configuration:

```yaml
environment:
  NODE_ENV: production
  STORE_BACKEND: postgres
  DATABASE_URL: postgres://taas_user:taas_pass@db:5432/taas_platform
  ROOT_API_KEY: replace-me-root-key
```

**Production Features:**
- PostgreSQL database with health checks
- Environment-specific configuration
- Secure credential management
- Scalable architecture

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L26-L29)
- [Dockerfile](file://Dockerfile#L15)

## Troubleshooting Guide

### Common Initialization Failures

#### 1. Missing Database Connection

**Symptoms:**
- Application fails to start with database errors
- Connection refused or timeout messages
- Health check failures

**Diagnosis:**
```bash
# Check database connectivity
psql "$DATABASE_URL" -c "SELECT 1"

# Verify environment variables
echo $DATABASE_URL
echo $STORE_BACKEND
```

**Solutions:**
- Verify PostgreSQL server is running and accessible
- Check network connectivity and firewall rules
- Validate connection string format and credentials
- Ensure database schema is properly initialized

#### 2. Invalid Configuration Values

**Symptoms:**
- Type errors in configuration parsing
- Unexpected default values
- Runtime configuration validation failures

**Diagnosis:**
```typescript
// Check configuration validation in config.ts
console.log(config); // Log parsed configuration
```

**Solutions:**
- Validate environment variable types and formats
- Ensure required variables are set
- Check for typos in variable names
- Verify numeric values are within acceptable ranges

#### 3. Missing DATABASE_URL for PostgreSQL Backend

**Error Message:** `DATABASE_URL is required when STORE_BACKEND=postgres`

**Solution:**
```bash
# Set the required environment variable
export DATABASE_URL=postgresql://user:pass@host:port/database

# Or configure in docker-compose.yml
environment:
  DATABASE_URL: postgresql://user:pass@db:5432/escrowgrid
```

### Health Check Issues

The system includes comprehensive health monitoring through [`health.ts`](file://src/infra/health.ts#L1-L45):

```mermaid
flowchart TD
HealthCheck[Health Check Request] --> CheckBackend{Store Backend?}
CheckBackend --> |postgres| TestDB[Test Database Connection]
CheckBackend --> |memory| Pass[Pass Health Check]
TestDB --> DBSuccess{Connection<br/>Successful?}
DBSuccess --> |Yes| Pass
DBSuccess --> |No| Fail[Fail Health Check]
Pass --> HealthyResponse[200 OK Response]
Fail --> ErrorResponse[503 Service Unavailable]
```

**Diagram sources**
- [src/infra/health.ts](file://src/infra/health.ts#L14-L45)

**Common Health Check Issues:**
- Database unavailability
- Network connectivity problems
- Authentication failures
- Schema migration issues

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)
- [src/config.ts](file://src/config.ts#L40-L46)

## Extension Points

### Adding New Storage Backends

The architecture supports easy addition of new storage backends through the unified Store interface.

#### Step 1: Define the Store Interface

All storage implementations must conform to the [`Store`](file://src/store/store.ts#L4-L58) interface:

```typescript
export interface Store {
  createInstitution(input: { ... }): Promise<Institution>;
  listInstitutions(): Promise<Institution[]>;
  getInstitution(id: string): Promise<Institution | undefined>;
  // ... other methods
}
```

#### Step 2: Implement the New Store

Create a new file following the existing pattern:

```typescript
// src/store/newStore.ts
import type { Store } from './store';

export class NewStore implements Store {
  // Implementation...
}

export function createNewStore(): Store {
  return new NewStore();
}
```

#### Step 3: Update Configuration Types

Extend the [`StoreBackend`](file://src/config.ts#L1) type:

```typescript
export type StoreBackend = 'memory' | 'postgres' | 'newstore';
```

#### Step 4: Modify the Factory Logic

Update [`src/store/index.ts`](file://src/store/index.ts#L8-L12):

```typescript
if (config.storeBackend === 'postgres') {
  storeInstance = createPostgresStore();
} else if (config.storeBackend === 'newstore') {
  storeInstance = createNewStore();
} else {
  storeInstance = memoryStore;
}
```

### Infrastructure Module Extensions

The storage system is used by multiple infrastructure modules, each with their own storage requirements:

```mermaid
graph TB
subgraph "Storage System"
StoreInterface["Store Interface"]
MemoryStore["Memory Store"]
PostgresStore["PostgreSQL Store"]
end
subgraph "Infrastructure Modules"
LedgerClient["Ledger Client"]
PolicyStore["Policy Store"]
AuditLogger["Audit Logger"]
end
StoreInterface --> MemoryStore
StoreInterface --> PostgresStore
LedgerClient --> StoreInterface
PolicyStore --> StoreInterface
AuditLogger --> StoreInterface
```

**Diagram sources**
- [src/infra/ledgerClient.ts](file://src/infra/ledgerClient.ts#L41-L45)
- [src/infra/policyStore.ts](file://src/infra/policyStore.ts#L125-L129)

Each module can independently choose its storage backend while maintaining consistency through the configuration system.

**Section sources**
- [src/store/store.ts](file://src/store/store.ts#L4-L58)
- [src/infra/ledgerClient.ts](file://src/infra/ledgerClient.ts#L41-L45)
- [src/infra/policyStore.ts](file://src/infra/policyStore.ts#L125-L129)

## Health Monitoring

The system includes comprehensive health monitoring capabilities to ensure storage availability and performance.

### Health Check Endpoints

The application exposes two key endpoints for monitoring:

**Health Endpoint** (`GET /health`):
- Reports basic service status
- Indicates current storage backend
- Provides minimal response for load balancer health checks

**Readiness Endpoint** (`GET /ready`):
- Performs comprehensive health validation
- Tests database connectivity (when applicable)
- Returns detailed status information

### Database Health Validation

The [`checkReadiness`](file://src/infra/health.ts#L14-L45) function provides sophisticated database health validation:

```mermaid
sequenceDiagram
participant Client as Health Check Client
participant Health as Health Module
participant Config as Configuration
participant PG as PostgreSQL
Client->>Health : GET /ready
Health->>Config : Check storeBackend
Config-->>Health : Backend type
alt storeBackend !== 'postgres'
Health-->>Client : 200 OK (Healthy)
else storeBackend === 'postgres'
Health->>Config : requirePostgresUrl()
Config-->>Health : Connection string
Health->>PG : new Pool(connection)
Health->>PG : pool.query('SELECT 1')
PG-->>Health : Query result
alt Query successful
Health-->>Client : 200 OK (Healthy)
else Query failed
Health-->>Client : 503 Service Unavailable
end
end
```

**Diagram sources**
- [src/infra/health.ts](file://src/infra/health.ts#L14-L45)

### Monitoring Best Practices

1. **Regular Health Checks**: Implement periodic health checks in production
2. **Database Monitoring**: Monitor PostgreSQL connection pools and query performance
3. **Capacity Planning**: Track storage growth and optimize accordingly
4. **Error Logging**: Log storage-related errors for troubleshooting

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)
- [src/server.ts](file://src/server.ts#L26-L38)