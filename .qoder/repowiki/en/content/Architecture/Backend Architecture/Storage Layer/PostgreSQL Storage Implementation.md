# PostgreSQL Storage Implementation

<cite>
**Referenced Files in This Document**
- [postgresStore.ts](file://src/store/postgresStore.ts)
- [schema.sql](file://db/schema.sql)
- [config.ts](file://src/config.ts)
- [types.ts](file://src/domain/types.ts)
- [store.ts](file://src/store/store.ts)
- [index.ts](file://src/store/index.ts)
- [lifecycle.ts](file://src/domain/lifecycle.ts)
- [memoryStore.ts](file://src/store/memoryStore.ts)
- [api.postgres.test.ts](file://src/__tests__/api.postgres.test.ts)
- [server.ts](file://src/server.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema Design](#database-schema-design)
4. [Connection Management](#connection-management)
5. [Entity Mapping](#entity-mapping)
6. [Transaction Management](#transaction-management)
7. [Query Construction](#query-construction)
8. [Indexing Strategy](#indexing-strategy)
9. [Error Handling](#error-handling)
10. [Performance Optimization](#performance-optimization)
11. [Setup and Configuration](#setup-and-configuration)
12. [Testing and Validation](#testing-and-validation)
13. [Troubleshooting Guide](#troubleshooting-guide)

## Introduction

The PostgreSQL storage implementation serves as the persistent data layer for the EscrowGrid platform, providing ACID-compliant transactional operations for managing financial instruments and their lifecycle events. Built on top of the `pg` library's connection pooling mechanism, this implementation ensures reliable data persistence while maintaining high performance through optimized query patterns and strategic indexing.

The storage layer implements a comprehensive domain model mapping that transforms TypeScript domain entities into PostgreSQL database tables, handling complex relationships between institutions, asset templates, assets, positions, and their associated lifecycle events. This implementation prioritizes data integrity through strict type checking, constraint validation, and atomic transaction boundaries.

## Architecture Overview

The PostgreSQL storage implementation follows a layered architecture pattern that separates concerns between data access, business logic, and presentation layers.

```mermaid
graph TB
subgraph "Application Layer"
API[REST API Controllers]
Business[Business Logic]
end
subgraph "Storage Layer"
StoreInterface[Store Interface]
PostgresStore[PostgresStore Implementation]
MemoryStore[MemoryStore Implementation]
end
subgraph "Database Layer"
PGPool[pg Pool Connection]
Schema[PostgreSQL Schema]
Indexes[Database Indexes]
end
subgraph "Domain Layer"
Types[Domain Types]
Entities[Domain Entities]
end
API --> Business
Business --> StoreInterface
StoreInterface --> PostgresStore
StoreInterface --> MemoryStore
PostgresStore --> PGPool
PGPool --> Schema
Schema --> Indexes
Types --> Entities
Entities --> PostgresStore
```

**Diagram sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L89-L417)
- [store.ts](file://src/store/store.ts#L4-L57)
- [index.ts](file://src/store/index.ts#L1-L16)

The architecture implements a factory pattern for store instantiation, allowing runtime selection between PostgreSQL and in-memory storage backends based on configuration. This design enables seamless testing and development scenarios while maintaining production-grade reliability.

**Section sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L89-L417)
- [store.ts](file://src/store/store.ts#L1-L59)
- [index.ts](file://src/store/index.ts#L1-L16)

## Database Schema Design

The PostgreSQL schema implements a normalized relational model designed to support complex financial instrument management with strong referential integrity and efficient query patterns.

```mermaid
erDiagram
INSTITUTIONS {
string id PK
string name
text[] regions
text[] verticals
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
INSTITUTIONS ||--o{ ASSET_TEMPLATES : "owns"
INSTITUTIONS ||--o{ ASSETS : "owns"
INSTITUTIONS ||--o{ POSITIONS : "owns"
ASSET_TEMPLATES ||--o{ ASSETS : "generates"
ASSETS ||--o{ POSITIONS : "contains"
POSITIONS ||--o{ POSITION_EVENTS : "tracks"
POSITIONS ||--o{ LEDGER_EVENTS : "logs"
```

**Diagram sources**
- [schema.sql](file://db/schema.sql#L3-L138)

### Table Relationships and Constraints

The schema enforces referential integrity through foreign key constraints with cascading delete behavior, ensuring data consistency across the entire domain model. Each table maintains creation and update timestamps for audit purposes and supports JSONB fields for flexible configuration storage.

**Section sources**
- [schema.sql](file://db/schema.sql#L1-L138)

## Connection Management

The PostgreSQL storage implementation utilizes the `pg.Pool` connection pool to efficiently manage database connections with automatic connection lifecycle management and resource optimization.

```mermaid
sequenceDiagram
participant App as Application
participant Store as PostgresStore
participant Pool as pg.Pool
participant Conn as Database Connection
participant DB as PostgreSQL
App->>Store : Initialize Store
Store->>Pool : new Pool(connectionString)
Pool-->>Store : Connection Pool Instance
App->>Store : Execute Query
Store->>Pool : pool.query(sql, params)
Pool->>Conn : Borrow Connection
Conn->>DB : Execute SQL
DB-->>Conn : Query Results
Conn-->>Pool : Release Connection
Pool-->>Store : Return Results
Store-->>App : Domain Entity
Note over Pool,DB : Connection Pool manages<br/>connection lifecycle automatically
```

**Diagram sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L89-L95)
- [config.ts](file://src/config.ts#L40-L45)

### Connection Pool Configuration

The connection pool inherits default configuration from the `pg` library, providing optimal performance characteristics for typical web application workloads. The pool automatically handles connection creation, reuse, and cleanup, minimizing overhead while maximizing throughput.

**Section sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L89-L95)
- [config.ts](file://src/config.ts#L40-L45)

## Entity Mapping

The storage implementation performs bidirectional mapping between TypeScript domain entities and PostgreSQL database records, handling type transformations, field mapping, and data validation during the conversion process.

```mermaid
flowchart TD
DomainEntity["Domain Entity<br/>(TypeScript)"] --> Mapper["Field Mapping<br/>Function"]
Mapper --> TypeTransform["Type Transformation<br/>& Validation"]
TypeTransform --> DatabaseRecord["Database Record<br/>(PostgreSQL)"]
DatabaseRecord --> ReverseMapper["Reverse Field Mapping"]
ReverseMapper --> ReverseTransform["Reverse Type Transformation"]
ReverseTransform --> DomainEntity
subgraph "Mapping Functions"
MapInstitution["mapInstitutionRow()"]
MapAssetTemplate["mapAssetTemplateRow()"]
MapAsset["mapAssetRow()"]
MapPosition["mapPositionRow()"]
MapEvent["mapPositionEventRow()"]
end
Mapper --> MapInstitution
Mapper --> MapAssetTemplate
Mapper --> MapAsset
Mapper --> MapPosition
Mapper --> MapEvent
```

**Diagram sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L24-L87)

### Field Transformation Patterns

Each entity mapping function handles specific transformation requirements:

- **Array Fields**: Regions and verticals are stored as PostgreSQL arrays and mapped to TypeScript arrays
- **JSON Fields**: Configuration and metadata fields use JSONB storage with automatic serialization/deserialization
- **Numeric Values**: Amount fields use PostgreSQL's NUMERIC type with precise decimal arithmetic
- **Timestamp Fields**: Creation and update timestamps maintain timezone awareness through TIMESTAMPTZ

**Section sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L24-L87)
- [types.ts](file://src/domain/types.ts#L1-L85)

## Transaction Management

The PostgreSQL storage implementation implements ACID-compliant transactions, particularly evident in the `updatePosition` method where position updates and lifecycle events are committed atomically.

```mermaid
sequenceDiagram
participant Client as Client Application
participant Store as PostgresStore
participant Pool as Connection Pool
participant DB as PostgreSQL
Client->>Store : updatePosition(position, event)
Store->>Pool : pool.connect()
Pool-->>Store : Database Client
Store->>DB : BEGIN TRANSACTION
DB-->>Store : Transaction Started
Store->>DB : UPDATE positions
DB-->>Store : Position Updated
alt Event Provided
Store->>DB : INSERT position_events
DB-->>Store : Event Created
end
Store->>DB : COMMIT TRANSACTION
DB-->>Store : Transaction Committed
Store->>Pool : client.release()
Store-->>Client : Position Updated
Note over Store,DB : Atomic operation : <br/>Either all changes succeed<br/>or none are applied
```

**Diagram sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L356-L409)

### ACID Compliance Implementation

The transaction implementation ensures atomicity through explicit BEGIN/COMMIT/ROLLBACK operations, maintaining consistency even in concurrent access scenarios. The rollback mechanism guarantees that partial updates never leave the database in an inconsistent state.

**Section sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L356-L409)

## Query Construction

The storage implementation employs parameterized queries with prepared statement optimization to prevent SQL injection and improve query performance through execution plan caching.

```mermaid
flowchart TD
QueryParams["Query Parameters"] --> ParamValidation["Parameter Validation"]
ParamValidation --> SQLBuilder["SQL Builder"]
SQLBuilder --> PreparedStatement["Prepared Statement"]
PreparedStatement --> QueryExecution["Query Execution"]
QueryExecution --> ResultMapping["Result Mapping"]
ResultMapping --> DomainObject["Domain Object"]
subgraph "Query Patterns"
InsertQuery["INSERT with RETURNING"]
SelectQuery["SELECT with WHERE"]
UpdateQuery["UPDATE with WHERE"]
DeleteQuery["DELETE with CASCADE"]
end
SQLBuilder --> InsertQuery
SQLBuilder --> SelectQuery
SQLBuilder --> UpdateQuery
SQLBuilder --> DeleteQuery
```

**Diagram sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L105-L109)
- [postgresStore.ts](file://src/store/postgresStore.ts#L280-L296)

### Dynamic Query Building

The implementation includes sophisticated dynamic query building for flexible filtering capabilities, particularly evident in the `listAssets` and `listPositions` methods that construct WHERE clauses based on optional parameters.

**Section sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L234-L257)
- [postgresStore.ts](file://src/store/postgresStore.ts#L321-L353)

## Indexing Strategy

The PostgreSQL schema implements a comprehensive indexing strategy designed to optimize query performance across all major access patterns while maintaining write performance through careful index maintenance.

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| asset_templates | idx_asset_templates_institution | institution_id | Template lookup by institution |
| assets | idx_assets_institution | institution_id | Asset lookup by institution |
| assets | idx_assets_template | template_id | Asset lookup by template |
| positions | idx_positions_institution | institution_id | Position lookup by institution |
| positions | idx_positions_asset | asset_id | Position lookup by asset |
| positions | idx_positions_holder_reference | holder_reference | Position lookup by holder |
| position_events | idx_position_events_position | position_id | Event lookup by position |
| ledger_events | idx_ledger_events_position | position_id | Ledger lookup by position |
| api_keys | idx_api_keys_institution | institution_id | API key lookup by institution |
| audit_events | idx_audit_events_institution | institution_id, occurred_at | Audit log queries |
| audit_events | idx_audit_events_api_key | api_key_id, occurred_at | Audit log queries |

**Section sources**
- [schema.sql](file://db/schema.sql#L24-L137)

## Error Handling

The PostgreSQL storage implementation provides comprehensive error handling for various failure scenarios, including database connectivity issues, constraint violations, and serialization failures.

```mermaid
flowchart TD
DatabaseOperation["Database Operation"] --> TryCatch["Try-Catch Block"]
TryCatch --> ErrorType{"Error Type"}
ErrorType --> |Connection Error| ConnectionHandler["Connection Error Handler"]
ErrorType --> |Constraint Violation| ConstraintHandler["Constraint Violation Handler"]
ErrorType --> |Serialization Failure| SerializationHandler["Serialization Handler"]
ErrorType --> |Other Error| GenericHandler["Generic Error Handler"]
ConnectionHandler --> RetryLogic["Retry Logic"]
ConstraintHandler --> ValidationError["Validation Error"]
SerializationHandler --> TransactionRetry["Transaction Retry"]
GenericHandler --> LogError["Log Error"]
RetryLogic --> FallbackStrategy["Fallback Strategy"]
TransactionRetry --> OptimisticLocking["Optimistic Locking"]
ValidationError --> ClientResponse["Client Error Response"]
LogError --> MonitoringAlert["Monitoring Alert"]
FallbackStrategy --> ClientResponse
OptimisticLocking --> ClientResponse
ClientResponse --> End["End"]
MonitoringAlert --> End
```

**Diagram sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L404-L407)

### Error Classification and Response

The implementation handles several categories of errors:

- **Connection Errors**: Network issues, authentication failures, and database unavailability
- **Constraint Violations**: Unique constraint violations, foreign key violations, and check constraint violations
- **Serialization Failures**: Concurrent transaction conflicts requiring retry logic
- **Validation Errors**: Business logic violations detected before database operations

**Section sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L404-L407)

## Performance Optimization

The PostgreSQL storage implementation incorporates several performance optimization strategies to ensure scalable operation under varying load conditions.

### Index Usage Optimization

Strategic index placement targets the most frequent query patterns:

- **Composite Indexes**: Multi-column indexes for complex filtering scenarios
- **Covering Indexes**: Indexes that include all required columns for specific queries
- **Partial Indexes**: Conditional indexes for frequently queried subsets of data

### Query Planning Optimization

The implementation leverages PostgreSQL's query planner through:

- **Parameterized Queries**: Consistent query patterns enable effective execution plan caching
- **Batch Operations**: Grouping related operations reduces round-trip overhead
- **Connection Pooling**: Maintaining persistent connections minimizes connection establishment costs

### Connection Pool Sizing

Recommended connection pool configuration based on workload characteristics:

- **Minimum Connections**: 2-4 connections for basic operation
- **Maximum Connections**: 20-50 connections for moderate concurrency
- **Idle Timeout**: 30 seconds for resource cleanup
- **Connection Lifetime**: 30 minutes for connection health monitoring

## Setup and Configuration

The PostgreSQL storage implementation requires specific environment configuration and database initialization procedures for proper operation.

### Environment Configuration

Essential environment variables for PostgreSQL backend operation:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `STORE_BACKEND` | Storage backend selection | Yes | `memory` |
| `DATABASE_URL` | PostgreSQL connection string | Yes* | - |
| `ONCHAIN_LEDGER_ENABLED` | Blockchain ledger integration | No | `false` |

*Required when `STORE_BACKEND=postgres`

### Database Initialization

The database schema initialization process involves executing the schema.sql script to establish the complete database structure:

```bash
# Initialize database schema
psql $DATABASE_URL < db/schema.sql

# Verify schema installation
psql $DATABASE_URL -c "\dt"
```

### Connection String Format

Standard PostgreSQL connection string format with optional parameters:

```
postgresql://username:password@host:port/database?sslmode=require&pool_max=10
```

**Section sources**
- [config.ts](file://src/config.ts#L23-L47)
- [schema.sql](file://db/schema.sql#L1-L138)

## Testing and Validation

The PostgreSQL storage implementation includes comprehensive testing infrastructure to validate functionality, error handling, and performance characteristics.

### Integration Testing

The test suite validates complete end-to-end functionality using a dedicated test database:

```mermaid
sequenceDiagram
participant Test as Test Suite
participant Pool as Test Pool
participant DB as Test Database
participant Store as PostgresStore
Test->>Pool : Connect to Test DB
Pool->>DB : Establish Connection
Test->>DB : TRUNCATE Tables
DB-->>Test : Cleanup Complete
Test->>Store : Initialize Store
Store->>Pool : pool.query()
Pool->>DB : Execute Queries
DB-->>Pool : Return Results
Pool-->>Store : Store Ready
Test->>Store : CRUD Operations
Store->>DB : Execute Transactions
DB-->>Store : Confirm Changes
Store-->>Test : Validation Results
Test->>Pool : Close Connection
Pool->>DB : Cleanup Resources
```

**Diagram sources**
- [api.postgres.test.ts](file://src/__tests__/api.postgres.test.ts#L15-L43)

### Test Database Management

The testing framework implements automated database cleanup and setup procedures to ensure test isolation and repeatability across multiple test runs.

**Section sources**
- [api.postgres.test.ts](file://src/__tests__/api.postgres.test.ts#L1-L153)

## Troubleshooting Guide

Common issues and resolution strategies for PostgreSQL storage implementation problems.

### Connection Issues

**Problem**: Database connection failures during startup
**Symptoms**: Application fails to start with connection errors
**Resolution**: 
1. Verify DATABASE_URL environment variable
2. Check network connectivity to database server
3. Validate database credentials and permissions
4. Ensure database server is accepting connections

### Performance Issues

**Problem**: Slow query performance in production
**Symptoms**: High response times, timeout errors
**Resolution**:
1. Analyze query execution plans using EXPLAIN
2. Review index utilization and coverage
3. Monitor connection pool statistics
4. Optimize frequently executed queries

### Data Integrity Issues

**Problem**: Constraint violations or data inconsistencies
**Symptoms**: Unique constraint errors, orphaned records
**Resolution**:
1. Validate referential integrity constraints
2. Review transaction boundaries and isolation levels
3. Check for concurrent modification conflicts
4. Implement proper error handling and retry logic

### Transaction Deadlocks

**Problem**: Serialization failures in concurrent environments
**Symptoms**: Transaction rollbacks, deadlock errors
**Resolution**:
1. Implement consistent ordering for transaction operations
2. Minimize transaction duration
3. Use appropriate isolation levels
4. Implement exponential backoff retry logic

**Section sources**
- [postgresStore.ts](file://src/store/postgresStore.ts#L404-L407)
- [api.postgres.test.ts](file://src/__tests__/api.postgres.test.ts#L15-L43)