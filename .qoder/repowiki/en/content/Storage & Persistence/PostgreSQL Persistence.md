# PostgreSQL Persistence

<cite>
**Referenced Files in This Document**
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
- [src/store/store.ts](file://src/store/store.ts)
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts)
- [src/store/index.ts](file://src/store/index.ts)
- [src/config.ts](file://src/config.ts)
- [db/schema.sql](file://db/schema.sql)
- [db/backup.sh](file://db/backup.sh)
- [db/restore.sh](file://db/restore.sh)
- [src/api/institutions.ts](file://src/api/institutions.ts)
- [src/api/assets.ts](file://src/api/assets.ts)
- [src/api/positions.ts](file://src/api/positions.ts)
- [src/infra/health.ts](file://src/infra/health.ts)
- [src/infra/postgresLedger.ts](file://src/infra/postgresLedger.ts)
- [src/infra/policyStore.ts](file://src/infra/policyStore.ts)
- [docker-compose.yml](file://docker-compose.yml)
- [vitest.postgres.config.ts](file://vitest.postgres.config.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Data Model Design](#data-model-design)
4. [PostgreSQL Store Implementation](#postgresql-store-implementation)
5. [Connection Management](#connection-management)
6. [Transaction Handling](#transaction-handling)
7. [Configuration Options](#configuration-options)
8. [CRUD Operations](#crud-operations)
9. [Performance Considerations](#performance-considerations)
10. [Migration Strategies](#migration-strategies)
11. [Backup and Restore](#backup-and-restore)
12. [Testing and Validation](#testing-and-validation)
13. [Troubleshooting](#troubleshooting)

## Introduction

The escrowgrid platform implements a robust PostgreSQL persistence layer that provides durable, relational data storage for institutional financial operations. The PostgreSQL store serves as the primary backend for the Store interface, offering ACID compliance, advanced querying capabilities, and enterprise-grade reliability compared to the in-memory alternative.

This persistence layer manages four core entity types: institutions, asset templates, assets, and positions, along with supporting infrastructure for lifecycle events, auditing, and policy enforcement. The implementation leverages PostgreSQL's native JSONB support for flexible configuration storage while maintaining strong typing through TypeScript interfaces.

## Architecture Overview

The PostgreSQL persistence architecture follows a layered approach with clear separation of concerns:

```mermaid
graph TB
subgraph "Application Layer"
API[REST APIs]
Domain[Domain Logic]
end
subgraph "Persistence Layer"
Store[Store Interface]
PostgresStore[PostgreSQL Store]
MemoryStore[Memory Store]
end
subgraph "Database Layer"
Schema[PostgreSQL Schema]
Pool[Connection Pool]
Transactions[Transaction Management]
end
subgraph "Infrastructure"
Config[Configuration]
Health[Health Checks]
Backup[Backup Scripts]
end
API --> Store
Store --> PostgresStore
Store --> MemoryStore
PostgresStore --> Schema
PostgresStore --> Pool
PostgresStore --> Transactions
Config --> PostgresStore
Health --> PostgresStore
Backup --> Schema
```

**Diagram sources**
- [src/store/store.ts](file://src/store/store.ts#L1-L59)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L89-L417)
- [src/store/index.ts](file://src/store/index.ts#L1-L16)

The architecture supports dual-backend operation, allowing seamless switching between PostgreSQL and in-memory stores based on configuration. This design enables development, testing, and production environments to use appropriate storage backends.

**Section sources**
- [src/store/store.ts](file://src/store/store.ts#L1-L59)
- [src/store/index.ts](file://src/store/index.ts#L1-L16)

## Data Model Design

The PostgreSQL schema defines a normalized relational model optimized for financial operations with strong referential integrity and efficient querying patterns.

### Core Entity Relationships

```mermaid
erDiagram
INSTITUTION {
text id PK
text name
text_array regions
text_array verticals
timestamptz created_at
timestamptz updated_at
}
ASSET_TEMPLATE {
text id PK
text institution_id FK
text code
text name
text vertical
text region
jsonb config
timestamptz created_at
timestamptz updated_at
}
ASSET {
text id PK
text institution_id FK
text template_id FK
text label
jsonb metadata
timestamptz created_at
timestamptz updated_at
}
POSITION {
text id PK
text institution_id FK
text asset_id FK
text holder_reference
text currency
numeric amount
text state
text external_reference
timestamptz created_at
timestamptz updated_at
}
POSITION_EVENT {
text id PK
text position_id FK
text from_state
text to_state
text reason
timestamptz at
jsonb metadata
timestamptz created_at
}
LEDGER_EVENT {
text id PK
text kind
text position_id FK
timestamptz at
text previous_state
text new_state
jsonb payload
timestamptz created_at
}
INSTITUTION_POLICY {
text id PK
text institution_id FK
text region
jsonb config
timestamptz created_at
timestamptz updated_at
}
API_KEY {
text id PK
text institution_id FK
text key_hash
text label
text role
timestamptz created_at
timestamptz revoked_at
}
AUDIT_EVENT {
text id PK
timestamptz occurred_at
timestamptz created_at
text api_key_id
text institution_id
text method
text path
text action
text resource_type
text resource_id
jsonb payload
}
INSTITUTION ||--o{ ASSET_TEMPLATE : "owns"
INSTITUTION ||--o{ ASSET : "manages"
INSTITUTION ||--o{ POSITION : "operates"
INSTITUTION ||--o{ API_KEY : "authenticates"
INSTITUTION ||--o{ INSTITUTION_POLICY : "defines"
ASSET_TEMPLATE ||--o{ ASSET : "templates"
ASSET ||--o{ POSITION : "instantiates"
POSITION ||--o{ POSITION_EVENT : "tracks"
POSITION ||--o{ LEDGER_EVENT : "records"
API_KEY ||--o{ AUDIT_EVENT : "generates"
INSTITUTION ||--o{ AUDIT_EVENT : "triggers"
```

**Diagram sources**
- [db/schema.sql](file://db/schema.sql#L1-L138)

### Table Mappings

The schema defines six primary tables with specific purposes:

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `institutions` | Organization management | Stores institution metadata, regions, and verticals |
| `asset_templates` | Asset definition framework | Template-based asset creation with JSONB configuration |
| `assets` | Asset instances | Individual asset records linked to templates |
| `positions` | Financial positions | Core financial instrument tracking with state management |
| `position_events` | Lifecycle tracking | Event-driven state transitions with metadata |
| `ledger_events` | Audit trail | Comprehensive event logging for compliance |

**Section sources**
- [db/schema.sql](file://db/schema.sql#L1-L138)

## PostgreSQL Store Implementation

The `PostgresStore` class implements the Store interface using PostgreSQL as the underlying data store. It provides type-safe CRUD operations with automatic mapping between database rows and TypeScript domain objects.

### Class Structure and Initialization

```mermaid
classDiagram
class PostgresStore {
-Pool pool
+constructor()
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
-mapInstitutionRow(row) Institution
-mapAssetTemplateRow(row) AssetTemplate
-mapAssetRow(row) Asset
-mapPositionRow(row, events) Position
-mapPositionEventRow(row) PositionLifecycleEvent
}
class Store {
<<interface>>
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
PostgresStore ..|> Store : implements
```

**Diagram sources**
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L89-L417)
- [src/store/store.ts](file://src/store/store.ts#L4-L58)

### Core Implementation Patterns

The PostgreSQL store employs several key patterns for reliable data access:

#### Connection Management
- Uses the `pg` library's connection pooling for efficient resource utilization
- Establishes connections during store initialization
- Implements proper connection lifecycle management

#### Query Abstraction
- Leverages prepared statements with parameterized queries for security
- Uses RETURNING clauses to retrieve generated values efficiently
- Implements consistent timestamp management across operations

#### Data Mapping
- Automatic row-to-object mapping with type safety
- Handles nullable fields and optional properties appropriately
- Maintains data integrity through strict type checking

**Section sources**
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L89-L417)

## Connection Management

The PostgreSQL connection management system ensures reliable database access with proper resource allocation and cleanup.

### Connection Pool Configuration

The connection pool is configured through the `pg` library's `Pool` class, which provides:

- Automatic connection pooling with configurable limits
- Connection validation and health checking
- Graceful handling of connection failures
- Efficient resource utilization

### Connection String Management

```mermaid
sequenceDiagram
participant App as Application
participant Config as Configuration
participant Store as PostgresStore
participant Pool as Connection Pool
App->>Config : requirePostgresUrl()
Config->>Config : validate DATABASE_URL
Config-->>App : connection string
App->>Store : new PostgresStore()
Store->>Pool : new Pool(connectionString)
Pool-->>Store : pool instance
Store-->>App : store instance
Note over App,Pool : Connection established and ready
```

**Diagram sources**
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L92-L95)
- [src/config.ts](file://src/config.ts#L40-L46)

### Health Monitoring

The system includes comprehensive health monitoring capabilities:

- Connection readiness checks using `pg_isready`
- Periodic health validation
- Graceful degradation on connection failures
- Detailed error reporting for troubleshooting

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)
- [docker-compose.yml](file://docker-compose.yml#L17-L21)

## Transaction Handling

The PostgreSQL store implements robust transaction handling for complex operations involving multiple database modifications.

### Two-Phase Commit Pattern

```mermaid
sequenceDiagram
participant Client as Client Code
participant Store as PostgresStore
participant Pool as Connection Pool
participant DB as PostgreSQL
Client->>Store : updatePosition(position, event)
Store->>Pool : await pool.connect()
Pool-->>Store : client connection
Store->>DB : BEGIN
DB-->>Store : transaction started
Store->>DB : UPDATE positions
DB-->>Store : update successful
alt event exists
Store->>DB : INSERT position_events
DB-->>Store : insert successful
end
Store->>DB : COMMIT
DB-->>Store : transaction committed
Store->>Pool : client.release()
Store-->>Client : position updated
Note over Client,DB : Successful completion
alt transaction fails
Store->>DB : ROLLBACK
DB-->>Store : transaction rolled back
Store->>Pool : client.release()
Store-->>Client : error propagated
end
```

**Diagram sources**
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L356-L415)

### Transaction Isolation Levels

The implementation uses PostgreSQL's default isolation level (READ COMMITTED) with explicit transaction boundaries for:

- Atomic updates to position state and associated events
- Consistent data modifications across related tables
- Rollback capability on failure scenarios
- Resource cleanup guarantees

### Error Recovery Mechanisms

The transaction system implements comprehensive error recovery:

- Automatic rollback on exceptions
- Connection release in finally blocks
- Proper error propagation to caller
- Resource leak prevention

**Section sources**
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L356-L415)

## Configuration Options

The PostgreSQL persistence layer supports extensive configuration through environment variables and programmatic settings.

### Environment-Based Configuration

| Configuration Variable | Purpose | Default Value | Example |
|------------------------|---------|---------------|---------|
| `STORE_BACKEND` | Backend selection | `'memory'` | `'postgres'` |
| `DATABASE_URL` | Connection string | `undefined` | `'postgres://user:pass@host:5432/db'` |
| `PGDATABASE` | Database name | `undefined` | `'taas_platform'` |
| `PGUSER` | Database user | `undefined` | `'taas_user'` |
| `PGPASSWORD` | Database password | `undefined` | `'taas_pass'` |
| `PGHOST` | Database host | `'localhost'` | `'db.example.com'` |
| `PGPORT` | Database port | `5432` | `5432` |

### Configuration Validation

```mermaid
flowchart TD
Start([Configuration Load]) --> CheckBackend{STORE_BACKEND == 'postgres'?}
CheckBackend --> |Yes| ValidateURL{DATABASE_URL set?}
CheckBackend --> |No| UseMemory[Use Memory Store]
ValidateURL --> |Yes| ParseURL[Parse Connection String]
ValidateURL --> |No| ThrowError[Throw Configuration Error]
ParseURL --> TestConnection[Test Database Connection]
TestConnection --> |Success| InitializeStore[Initialize PostgreSQL Store]
TestConnection --> |Failure| LogError[Log Connection Error]
LogError --> ThrowError
UseMemory --> End([Store Ready])
InitializeStore --> End
ThrowError --> End
```

**Diagram sources**
- [src/config.ts](file://src/config.ts#L23-L46)
- [src/store/index.ts](file://src/store/index.ts#L8-L12)

### Runtime Configuration Changes

The system supports runtime configuration changes through the configuration module, enabling:

- Dynamic backend switching
- Connection string updates
- Environment-specific tuning
- Graceful configuration reloads

**Section sources**
- [src/config.ts](file://src/config.ts#L1-L47)
- [src/store/index.ts](file://src/store/index.ts#L1-L16)

## CRUD Operations

The PostgreSQL store provides comprehensive CRUD operations with advanced querying capabilities and data validation.

### Institution Management

Institution operations demonstrate the complete CRUD lifecycle:

```mermaid
sequenceDiagram
participant API as REST API
participant Store as PostgresStore
participant DB as PostgreSQL
API->>Store : createInstitution(input)
Store->>Store : generateId('inst')
Store->>Store : now()
Store->>DB : INSERT INTO institutions
DB-->>Store : institution created
Store->>Store : mapInstitutionRow()
Store-->>API : Institution object
API->>Store : listInstitutions()
Store->>DB : SELECT * FROM institutions ORDER BY created_at ASC
DB-->>Store : institution rows
Store->>Store : mapInstitutionRow[]()
Store-->>API : Institution[] array
API->>Store : getInstitution(id)
Store->>DB : SELECT * FROM institutions WHERE id = $1
DB-->>Store : institution row
Store->>Store : mapInstitutionRow()
Store-->>API : Institution | undefined
```

**Diagram sources**
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L97-L125)
- [src/api/institutions.ts](file://src/api/institutions.ts#L9-L67)

### Advanced Querying Patterns

The store implements sophisticated querying patterns for complex data retrieval:

#### Parameterized Filtering
- Supports dynamic filtering by multiple criteria
- Builds SQL queries based on provided parameters
- Maintains SQL injection protection through parameterization

#### Relationship Navigation
- Efficiently retrieves related entities (assets, positions)
- Implements lazy loading patterns where appropriate
- Provides comprehensive filtering capabilities

#### State Management Queries
- Tracks position lifecycle events
- Maintains historical state information
- Supports temporal queries and analytics

**Section sources**
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L127-L258)
- [src/api/assets.ts](file://src/api/assets.ts#L91-L122)
- [src/api/positions.ts](file://src/api/positions.ts#L154-L191)

## Performance Considerations

The PostgreSQL persistence layer incorporates numerous performance optimization strategies and monitoring capabilities.

### Indexing Strategy

The schema implements comprehensive indexing for optimal query performance:

| Index Type | Purpose | Columns | Benefits |
|------------|---------|---------|----------|
| Primary Keys | Unique identification | `id` | Fast lookups and joins |
| Foreign Keys | Referential integrity | `institution_id`, `asset_id` | Efficient relationship queries |
| Composite Indexes | Multi-column filtering | `(institution_id, created_at)` | Optimized bulk operations |
| JSONB Path Indexes | JSON field access | `config`, `metadata` | Fast JSON queries |
| Timestamp Indexes | Temporal queries | `created_at`, `at` | Efficient time-based filtering |

### Query Optimization Patterns

```mermaid
flowchart TD
Query[Incoming Query] --> Analyze[Query Analysis]
Analyze --> Indexed{Indexed Columns?}
Indexed --> |Yes| FastPath[Fast Path Execution]
Indexed --> |No| FullScan[Full Table Scan]
FastPath --> Results[Results Returned]
FullScan --> Optimize[Optimization Suggestion]
Optimize --> AddIndex[Add Index]
AddIndex --> Reanalyze[Re-analyze Query]
Reanalyze --> FastPath
```

### Concurrency Patterns

The system handles concurrent access through:

- PostgreSQL's MVCC (Multi-Version Concurrency Control)
- Proper transaction isolation levels
- Connection pooling for resource management
- Deadlock detection and resolution

### Performance Monitoring

Key performance indicators include:

- Query execution time monitoring
- Connection pool utilization tracking
- Transaction throughput measurement
- Error rate analysis

**Section sources**
- [db/schema.sql](file://db/schema.sql#L24-L138)

## Migration Strategies

The platform supports smooth migration from in-memory to PostgreSQL persistence with minimal application changes.

### Migration Planning

```mermaid
graph LR
subgraph "Pre-Migration Phase"
A[Assess Current State]
B[Plan Schema Changes]
C[Prepare Backup Strategy]
end
subgraph "Migration Execution"
D[Deploy PostgreSQL]
E[Run Schema Migration]
F[Data Transfer Process]
end
subgraph "Validation Phase"
G[Test Functionality]
H[Verify Data Integrity]
I[Performance Testing]
end
A --> B --> C --> D --> E --> F --> G --> H --> I
```

### Data Migration Process

The migration process involves several critical steps:

#### Schema Preparation
- Deploy the PostgreSQL schema using the provided SQL script
- Configure connection parameters for the new backend
- Verify schema integrity and indexing

#### Data Transfer
- Export data from in-memory store (if applicable)
- Transform data to match PostgreSQL schema requirements
- Import data with proper validation and error handling

#### Validation and Testing
- Comprehensive functional testing
- Data integrity verification
- Performance benchmarking
- Production readiness assessment

### Seamless Switching

The dual-backend architecture enables:

- Zero-downtime migration planning
- Gradual rollout strategies
- Rollback capabilities
- Feature flag integration

**Section sources**
- [src/store/index.ts](file://src/store/index.ts#L8-L12)

## Backup and Restore

The PostgreSQL persistence layer includes comprehensive backup and restore capabilities designed for operational reliability.

### Backup Strategy

The backup system provides:

#### Automated Backup Scripts
- `backup.sh`: Creates SQL dumps of the entire database
- Supports both connection string and environment variable configurations
- Produces clean, readable SQL output suitable for version control

#### Backup Features
- No-owner and no-privileges options for portable backups
- Plain-text format for easy inspection and modification
- Timestamp-based naming for organized retention
- Cross-platform compatibility

### Restore Procedures

```mermaid
sequenceDiagram
participant Ops as Operations Team
participant Script as Restore Script
participant DB as PostgreSQL
Ops->>Script : ./restore.sh backup.sql
Script->>Script : validate backup file
Script->>DB : DROP SCHEMA public CASCADE
DB-->>Script : schema dropped
Script->>DB : CREATE SCHEMA public
DB-->>Script : schema recreated
Script->>DB : restore from backup file
DB-->>Script : restore complete
Script-->>Ops : restore successful
Note over Ops,DB : WARNING : This is destructive!
```

**Diagram sources**
- [db/restore.sh](file://db/restore.sh#L36-L45)

### Operational Procedures

#### Backup Best Practices
- Regular automated backups scheduled via cron or similar
- Retention policies for backup file management
- Encryption for sensitive data protection
- Verification procedures for backup integrity

#### Restore Procedures
- Dedicated restore environments for testing
- Data validation post-restore
- Rollback procedures for failed restores
- Documentation of restore procedures

### Disaster Recovery

The backup system supports comprehensive disaster recovery scenarios:

- Complete database restoration
- Point-in-time recovery capabilities
- Cross-region backup replication
- Automated failover procedures

**Section sources**
- [db/backup.sh](file://db/backup.sh#L1-L27)
- [db/restore.sh](file://db/restore.sh#L1-L46)

## Testing and Validation

The PostgreSQL persistence layer includes comprehensive testing capabilities for ensuring reliability and correctness.

### Test Infrastructure

```mermaid
graph TB
subgraph "Test Environment"
TestDB[(Test PostgreSQL)]
TestConfig[Test Configuration]
TestScripts[Test Scripts]
end
subgraph "Test Types"
Unit[Unit Tests]
Integration[Integration Tests]
Performance[Performance Tests]
Smoke[Smoke Tests]
end
subgraph "Validation"
DataIntegrity[Data Integrity]
QueryPerformance[Query Performance]
TransactionTests[Transaction Tests]
ErrorHandling[Error Handling]
end
TestDB --> Unit
TestDB --> Integration
TestDB --> Performance
TestDB --> Smoke
Unit --> DataIntegrity
Integration --> QueryPerformance
Performance --> TransactionTests
Smoke --> ErrorHandling
```

### Test Configuration

The testing system supports PostgreSQL-specific testing through:

- Separate test configuration for database connections
- Isolated test databases for parallel execution
- Cleanup procedures for test data management
- Mock and stub implementations for external dependencies

### Validation Procedures

Key validation areas include:

- Data consistency across all entity types
- Transaction boundary enforcement
- Error handling and recovery
- Performance benchmarks
- Security validation

**Section sources**
- [vitest.postgres.config.ts](file://vitest.postgres.config.ts#L1-L10)

## Troubleshooting

Common PostgreSQL persistence issues and their solutions:

### Connection Issues

**Problem**: Connection timeouts or refused connections
**Solution**: 
- Verify database availability and network connectivity
- Check connection string format and credentials
- Review connection pool configuration
- Monitor database server logs

### Performance Problems

**Problem**: Slow query execution
**Solution**:
- Analyze query execution plans
- Review index usage and effectiveness
- Optimize query patterns
- Consider connection pool tuning

### Data Integrity Issues

**Problem**: Unexpected data corruption or loss
**Solution**:
- Run database integrity checks
- Review backup procedures
- Validate transaction handling
- Check for concurrent access conflicts

### Configuration Errors

**Problem**: Store initialization failures
**Solution**:
- Verify environment variable configuration
- Check database permissions and access
- Validate schema deployment
- Review connection string format

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)