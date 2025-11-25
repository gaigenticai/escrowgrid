# Storage Configuration & Backend Selection

<cite>
**Referenced Files in This Document**
- [src/store/index.ts](file://src/store/index.ts)
- [src/config.ts](file://src/config.ts)
- [src/store/store.ts](file://src/store/store.ts)
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
- [src/infra/ledgerClient.ts](file://src/infra/ledgerClient.ts)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts)
- [src/infra/postgresLedger.ts](file://src/infra/postgresLedger.ts)
- [src/infra/inMemoryLedger.ts](file://src/infra/inMemoryLedger.ts)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts)
- [src/domain/audit.ts](file://src/domain/audit.ts)
- [src/api/ledger.ts](file://src/api/ledger.ts)
- [db/schema.sql](file://db/schema.sql)
- [docker-compose.yml](file://docker-compose.yml)
- [README.md](file://README.md)
- [package.json](file://package.json)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Storage Architecture Overview](#storage-architecture-overview)
3. [Environment Variables Configuration](#environment-variables-configuration)
4. [Factory Pattern Implementation](#factory-pattern-implementation)
5. [Storage Backend Comparison](#storage-backend-comparison)
6. [Integration with Ledger System](#integration-with-ledger-system)
7. [Environment-Specific Recommendations](#environment-specific-recommendations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Best Practices](#best-practices)
10. [Conclusion](#conclusion)

## Introduction

Escrowgrid implements a sophisticated pluggable storage architecture that enables seamless switching between different storage backends based on runtime configuration. This design provides flexibility for different deployment scenarios while maintaining consistent data access patterns through a unified Store interface.

The storage system supports two primary backends: in-memory storage for development and testing, and PostgreSQL for production environments requiring data persistence and durability. Additionally, the architecture integrates with ledger systems for audit logging and blockchain integration capabilities.

## Storage Architecture Overview

The storage architecture follows a factory pattern design that initializes the appropriate storage implementation based on configuration. The system consists of several key components working together to provide a flexible and scalable data persistence layer.

```mermaid
graph TB
subgraph "Configuration Layer"
Config[config.ts]
EnvVars[Environment Variables]
end
subgraph "Factory Layer"
StoreIndex[index.ts]
StoreFactory[Store Factory]
end
subgraph "Storage Backends"
MemoryStore[Memory Store]
PostgresStore[PostgreSQL Store]
end
subgraph "Integration Layer"
LedgerClient[Ledger Client]
AuditLogger[Audit Logger]
ApiLayer[API Layer]
end
subgraph "External Systems"
PostgresDB[(PostgreSQL Database)]
Blockchain[Blockchain Network]
end
EnvVars --> Config
Config --> StoreIndex
StoreIndex --> StoreFactory
StoreFactory --> MemoryStore
StoreFactory --> PostgresStore
MemoryStore --> ApiLayer
PostgresStore --> PostgresDB
PostgresStore --> LedgerClient
PostgresStore --> AuditLogger
LedgerClient --> Blockchain
```

**Diagram sources**
- [src/store/index.ts](file://src/store/index.ts#L1-L16)
- [src/config.ts](file://src/config.ts#L1-L47)
- [src/infra/ledgerClient.ts](file://src/infra/ledgerClient.ts#L1-L64)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L1-L109)

**Section sources**
- [src/store/index.ts](file://src/store/index.ts#L1-L16)
- [src/config.ts](file://src/config.ts#L1-L47)

## Environment Variables Configuration

The storage backend selection is controlled through environment variables defined in the configuration system. The primary configuration variable is `STORE_BACKEND`, which determines the active storage implementation.

### Core Storage Configuration Variables

| Variable | Type | Default | Description | Required |
|----------|------|---------|-------------|----------|
| `STORE_BACKEND` | `'memory' \| 'postgres'` | `'memory'` | Selects storage backend implementation | No |
| `DATABASE_URL` | `string` | - | PostgreSQL connection string | Yes (when STORE_BACKEND=postgres) |
| `ONCHAIN_LEDGER_ENABLED` | `boolean` | `false` | Enables blockchain ledger integration | No |

### Configuration Loading Process

The configuration system loads environment variables during application startup and validates required settings. The factory pattern ensures that the appropriate storage implementation is instantiated based on the selected backend.

```mermaid
flowchart TD
Start([Application Startup]) --> LoadEnv["Load Environment Variables"]
LoadEnv --> ValidateConfig["Validate Configuration"]
ValidateConfig --> CheckBackend{"STORE_BACKEND?"}
CheckBackend --> |postgres| ValidatePostgres["Validate DATABASE_URL"]
CheckBackend --> |memory| InitMemory["Initialize Memory Store"]
ValidatePostgres --> CheckRequired{"DATABASE_URL Present?"}
CheckRequired --> |No| ThrowError["Throw Configuration Error"]
CheckRequired --> |Yes| InitPostgres["Initialize PostgreSQL Store"]
InitMemory --> ExportStore["Export Store Instance"]
InitPostgres --> ExportStore
ThrowError --> Exit([Exit Application])
ExportStore --> Ready([System Ready])
```

**Diagram sources**
- [src/config.ts](file://src/config.ts#L18-L47)
- [src/store/index.ts](file://src/store/index.ts#L8-L12)

**Section sources**
- [src/config.ts](file://src/config.ts#L18-L47)
- [src/store/index.ts](file://src/store/index.ts#L1-L16)

## Factory Pattern Implementation

The storage system implements a clean factory pattern that encapsulates the instantiation logic and provides a unified interface regardless of the underlying storage implementation.

### Store Interface Definition

The Store interface defines the contract that all storage implementations must fulfill, ensuring consistent behavior across different backends.

```mermaid
classDiagram
class Store {
<<interface>>
+createInstitution(input) Promise~Institution~
+listInstitutions() Promise~Institution[]~
+getInstitution(id) Promise~Institution~
+createAssetTemplate(input) Promise~AssetTemplate~
+listAssetTemplates(params?) Promise~AssetTemplate[]~
+getAssetTemplate(id) Promise~AssetTemplate~
+createAsset(input) Promise~Asset~
+getAsset(id) Promise~Asset~
+listAssets(params?) Promise~Asset[]~
+createPosition(input) Promise~Position~
+getPosition(id) Promise~Position~
+listPositions(params?) Promise~Position[]~
+updatePosition(position, event?) Promise~Position~
}
class MemoryStore {
-institutions Map~string, Institution~
-assetTemplates Map~string, AssetTemplate~
-assets Map~string, Asset~
-positions Map~string, Position~
+createInstitution(input) Promise~Institution~
+listInstitutions() Promise~Institution[]~
+getInstitution(id) Promise~Institution~
+createAssetTemplate(input) Promise~AssetTemplate~
+listAssetTemplates(params?) Promise~AssetTemplate[]~
+getAssetTemplate(id) Promise~AssetTemplate~
+createAsset(input) Promise~Asset~
+getAsset(id) Promise~Asset~
+listAssets(params?) Promise~Asset[]~
+createPosition(input) Promise~Position~
+getPosition(id) Promise~Position~
+listPositions(params?) Promise~Position[]~
+updatePosition(position, event?) Promise~Position~
}
class PostgresStore {
-pool Pool
+constructor()
+createInstitution(input) Promise~Institution~
+listInstitutions() Promise~Institution[]~
+getInstitution(id) Promise~Institution~
+createAssetTemplate(input) Promise~AssetTemplate~
+listAssetTemplates(params?) Promise~AssetTemplate[]~
+getAssetTemplate(id) Promise~AssetTemplate~
+createAsset(input) Promise~Asset~
+getAsset(id) Promise~Asset~
+listAssets(params?) Promise~Asset[]~
+createPosition(input) Promise~Position~
+getPosition(id) Promise~Position~
+listPositions(params?) Promise~Position[]~
+updatePosition(position, event?) Promise~Position~
}
Store <|.. MemoryStore
Store <|.. PostgresStore
```

**Diagram sources**
- [src/store/store.ts](file://src/store/store.ts#L4-L59)
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts#L13-L218)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L89-L417)

### Factory Instantiation Logic

The factory pattern centralizes the logic for selecting and initializing the appropriate storage implementation based on runtime configuration.

**Section sources**
- [src/store/store.ts](file://src/store/store.ts#L1-L59)
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts#L1-L218)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L1-L417)

## Storage Backend Comparison

Each storage backend offers distinct characteristics suitable for different deployment scenarios. Understanding these differences is crucial for making informed decisions about backend selection.

### In-Memory Storage

The in-memory storage implementation provides fast access and minimal overhead, ideal for development, testing, and scenarios where data persistence is not required.

#### Characteristics:
- **Performance**: Exceptionally fast due to direct memory access
- **Persistence**: Data is lost on application restart
- **Concurrency**: Thread-safe for single-process applications
- **Resource Usage**: Minimal memory footprint
- **Setup Complexity**: Zero configuration required

#### Use Cases:
- Local development and testing
- Temporary data processing
- Prototype development
- Scenarios where data loss is acceptable

### PostgreSQL Storage

The PostgreSQL implementation provides robust data persistence, ACID compliance, and advanced querying capabilities suitable for production environments.

#### Characteristics:
- **Performance**: Good performance with proper indexing
- **Persistence**: Data survives application restarts
- **Concurrency**: Full ACID compliance with transaction support
- **Resource Usage**: Depends on database size and configuration
- **Setup Complexity**: Requires database provisioning and maintenance

#### Advanced Features:
- **Transaction Support**: Atomic operations across multiple entities
- **Indexing**: Optimized queries with proper database indexes
- **Backup/Restore**: Comprehensive data protection mechanisms
- **Scalability**: Horizontal scaling through replication
- **Monitoring**: Built-in performance metrics and monitoring

**Section sources**
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts#L1-L218)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L1-L417)
- [db/schema.sql](file://db/schema.sql#L1-L138)

## Integration with Ledger System

The storage system integrates closely with the ledger infrastructure to provide comprehensive audit logging and blockchain integration capabilities. Both storage backends participate in the ledger ecosystem, though with different characteristics.

### Ledger Client Architecture

The ledger system implements a composite pattern that combines base storage ledger with optional blockchain ledger functionality.

```mermaid
sequenceDiagram
participant API as API Layer
participant LedgerClient as Ledger Client
participant BaseLedger as Base Ledger
participant OnchainLedger as On-chain Ledger
participant Storage as Storage Backend
API->>LedgerClient : recordPositionCreated(position)
LedgerClient->>BaseLedger : recordPositionCreated(position)
BaseLedger->>Storage : Store ledger event
Storage-->>BaseLedger : Event stored
BaseLedger-->>LedgerClient : Success
alt On-chain Ledger Enabled
LedgerClient->>OnchainLedger : recordPositionCreated(position)
OnchainLedger->>OnchainLedger : Validate template configuration
OnchainLedger->>OnchainLedger : Call blockchain contract
OnchainLedger-->>LedgerClient : Transaction submitted
end
LedgerClient-->>API : Operation complete
```

**Diagram sources**
- [src/infra/ledgerClient.ts](file://src/infra/ledgerClient.ts#L8-L36)
- [src/infra/postgresLedger.ts](file://src/infra/postgresLedger.ts#L22-L46)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L25-L108)

### Audit Logging Integration

Audit logging is tightly coupled with the storage backend selection, ensuring consistent audit trails across different environments.

#### Audit Event Structure

| Field | Type | Description | Storage Backend |
|-------|------|-------------|-----------------|
| `id` | `string` | Unique event identifier | Both |
| `occurredAt` | `string` | Timestamp of event occurrence | Both |
| `createdAt` | `string` | Timestamp of audit record creation | Both |
| `apiKeyId` | `string \| null` | Associated API key | Both |
| `institutionId` | `string \| null` | Associated institution | Both |
| `method` | `string` | HTTP method of request | Both |
| `path` | `string` | Request path | Both |
| `action` | `string` | Audit action performed | Both |
| `resourceType` | `string \| null` | Resource type affected | Both |
| `resourceId` | `string \| null` | Resource identifier | Both |
| `payload` | `object \| null` | Request/response payload | Both |

### Data Durability Implications

Different storage backends provide varying levels of data durability and audit trail reliability.

#### In-Memory Backend Durability:
- **Immediate Availability**: Audit events are immediately available
- **No Persistence**: Events are lost on application restart
- **Performance**: Highest performance for audit operations
- **Reliability**: Suitable for development and testing only

#### PostgreSQL Backend Durability:
- **Persistent Storage**: Audit events survive application restarts
- **ACID Compliance**: Guaranteed consistency and reliability
- **Query Capabilities**: Rich querying and reporting capabilities
- **Backup Integration**: Seamless integration with database backup systems

**Section sources**
- [src/infra/ledgerClient.ts](file://src/infra/ledgerClient.ts#L1-L64)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L1-L109)
- [src/domain/audit.ts](file://src/domain/audit.ts#L1-L36)

## Environment-Specific Recommendations

Choosing the appropriate storage backend for each environment is crucial for optimal performance, cost-effectiveness, and operational reliability.

### Development Environment

**Recommended Backend**: In-Memory Storage

**Rationale**:
- **Fast Iteration**: Immediate feedback during development
- **Zero Setup**: No database configuration required
- **Clean State**: Fresh data on each restart eliminates cleanup issues
- **Cost-Effective**: No infrastructure costs

**Configuration Example**:
```bash
# .env.development
STORE_BACKEND=memory
NODE_ENV=development
```

### Testing Environment

**Recommended Backend**: PostgreSQL Storage

**Rationale**:
- **Consistency**: Matches production behavior
- **Data Integrity**: Validates transaction handling
- **Performance Testing**: Realistic performance metrics
- **Integration Testing**: Complete end-to-end testing capability

**Configuration Example**:
```bash
# .env.testing
STORE_BACKEND=postgres
DATABASE_URL=postgresql://test_user:test_password@localhost:5432/taas_test
NODE_ENV=test
```

### Staging Environment

**Recommended Backend**: PostgreSQL Storage

**Rationale**:
- **Production Parity**: Identical to production configuration
- **Load Testing**: Accurate performance measurement
- **Integration Validation**: Complete system integration testing
- **Data Migration Testing**: Validates backup and restore procedures

**Configuration Example**:
```bash
# .env.staging
STORE_BACKEND=postgres
DATABASE_URL=${STAGING_DATABASE_URL}
NODE_ENV=staging
ONCHAIN_LEDGER_ENABLED=true
RATE_LIMIT_ENABLED=true
```

### Production Environment

**Recommended Backend**: PostgreSQL Storage

**Rationale**:
- **Data Persistence**: Critical for business continuity
- **High Availability**: Database clustering and replication support
- **Security**: Advanced security features and access controls
- **Monitoring**: Comprehensive observability and alerting
- **Scalability**: Horizontal scaling capabilities

**Configuration Example**:
```bash
# .env.production
STORE_BACKEND=postgres
DATABASE_URL=${PRODUCTION_DATABASE_URL}
NODE_ENV=production
ONCHAIN_LEDGER_ENABLED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
```

### Containerized Deployment

For containerized deployments, the storage configuration integrates seamlessly with orchestration platforms.

**Docker Compose Configuration**:
```yaml
services:
  api:
    image: taas-platform:latest
    environment:
      - STORE_BACKEND=postgres
      - DATABASE_URL=postgresql://user:pass@db:5432/taas_platform
      - NODE_ENV=production
    depends_on:
      - db
    ports:
      - "4000"
  
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=taas_platform
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - ./db/schema.sql:/docker-entrypoint-initdb.d/10-schema.sql:ro
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "user"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)
- [README.md](file://README.md#L37-L58)

## Troubleshooting Guide

Common configuration errors and connectivity issues can be systematically diagnosed and resolved using the following approaches.

### Configuration Validation Issues

#### Problem: PostgreSQL Backend Without Connection String

**Symptoms**:
- Application fails to start
- Error message: "DATABASE_URL is required when STORE_BACKEND=postgres"
- Health check failures

**Solution**:
1. Verify environment variable is set:
   ```bash
   echo $DATABASE_URL
   ```
2. Check connection string format:
   ```bash
   postgresql://username:password@hostname:port/database
   ```
3. Test database connectivity:
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1;"
   ```

#### Problem: Invalid Store Backend Value

**Symptoms**:
- Unexpected behavior or crashes
- Configuration warnings in logs
- Inconsistent data access patterns

**Solution**:
1. Verify STORE_BACKEND value:
   ```bash
   echo $STORE_BACKEND
   ```
2. Check for typos or invalid values
3. Ensure value matches supported options: `'memory'` or `'postgres'`

### Connectivity Issues

#### Problem: PostgreSQL Connection Timeout

**Symptoms**:
- Database connection errors in logs
- Slow application startup
- Intermittent query failures

**Diagnostic Steps**:
1. Test network connectivity:
   ```bash
   telnet database-host 5432
   ```
2. Verify database service status
3. Check firewall rules and network policies
4. Validate SSL/TLS configuration if required

#### Problem: Authentication Failures

**Symptoms**:
- "password authentication failed" errors
- Permission denied messages
- Database access denied

**Solution**:
1. Verify credentials:
   ```bash
   psql "$DATABASE_URL" -c "\du"
   ```
2. Check user permissions
3. Validate password expiration
4. Review database role assignments

### Performance Issues

#### Problem: Slow Query Performance

**Symptoms**:
- Long response times
- Database timeouts
- High CPU utilization

**Optimization Strategies**:
1. Enable query logging and analysis
2. Review database indexes
3. Optimize connection pooling
4. Monitor database statistics

#### Problem: Memory Exhaustion

**Symptoms**:
- Out of memory errors
- Garbage collection spikes
- Application crashes

**Resolution Approaches**:
1. Monitor memory usage patterns
2. Adjust JVM heap settings if applicable
3. Implement pagination for large datasets
4. Optimize data structures

### Integration Problems

#### Problem: Ledger Events Not Persisting

**Symptoms**:
- Audit logs missing events
- Ledger queries returning empty results
- Blockchain integration failures

**Investigation Steps**:
1. Check ledger client initialization
2. Verify storage backend compatibility
3. Review event processing logic
4. Validate external service connectivity

#### Problem: On-Chain Ledger Failures

**Symptoms**:
- Blockchain transaction errors
- Contract call failures
- Chain ID mismatches

**Debugging Process**:
1. Verify on-chain configuration
2. Check contract deployment status
3. Validate chain ID settings
4. Review transaction gas limits

**Section sources**
- [src/config.ts](file://src/config.ts#L40-L47)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L16-L221)

## Best Practices

Following established best practices ensures reliable operation and maintainable code across different environments.

### Configuration Management

1. **Environment Separation**: Use distinct configuration files for each environment
2. **Secret Management**: Store sensitive information in secure secret management systems
3. **Validation**: Implement configuration validation during application startup
4. **Documentation**: Document all configuration options and their effects

### Security Considerations

1. **Connection Security**: Use encrypted connections for database access
2. **Access Controls**: Implement proper database user permissions
3. **Audit Trails**: Enable comprehensive audit logging
4. **Monitoring**: Set up alerts for configuration changes and failures

### Performance Optimization

1. **Connection Pooling**: Configure appropriate connection pool sizes
2. **Indexing**: Design database indexes for common query patterns
3. **Caching**: Implement caching strategies where appropriate
4. **Monitoring**: Establish performance baseline and monitoring

### Operational Excellence

1. **Backup Strategy**: Implement regular database backups
2. **Disaster Recovery**: Plan for data recovery scenarios
3. **Scaling**: Design for horizontal and vertical scaling
4. **Maintenance**: Schedule regular database maintenance tasks

## Conclusion

The escrowgrid storage configuration system demonstrates a well-designed pluggable architecture that balances flexibility, performance, and reliability. The factory pattern implementation provides clean separation between configuration and implementation, while the unified Store interface ensures consistent behavior across different backends.

Key benefits of this architecture include:

- **Flexibility**: Easy switching between storage backends based on requirements
- **Consistency**: Uniform API regardless of underlying implementation
- **Maintainability**: Clear separation of concerns and modular design
- **Scalability**: Support for both development and production workloads
- **Integration**: Seamless integration with ledger and audit systems

The comprehensive configuration system, combined with detailed troubleshooting guidance and environment-specific recommendations, provides a solid foundation for deploying escrowgrid in various scenarios. Whether developing prototypes, conducting tests, or operating production systems, the storage architecture adapts appropriately while maintaining data integrity and system reliability.

By following the documented best practices and leveraging the troubleshooting resources, teams can effectively deploy and operate escrowgrid with confidence in its storage capabilities and backend selection flexibility.