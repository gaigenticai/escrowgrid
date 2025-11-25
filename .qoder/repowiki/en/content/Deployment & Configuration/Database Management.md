# Database Management

<cite>
**Referenced Files in This Document**
- [db/schema.sql](file://db/schema.sql) - *Initial schema definition*
- [db/migrations/0001_initial.sql](file://db/migrations/0001_initial.sql) - *Added in recent commit as migration framework*
- [db/backup.sh](file://db/backup.sh)
- [db/restore.sh](file://db/restore.sh)
- [db/migrate.sh](file://db/migrate.sh) - *Added in recent commit as migration framework*
- [docker-compose.yml](file://docker-compose.yml)
- [src/config.ts](file://src/config.ts)
- [src/infra/postgresLedger.ts](file://src/infra/postgresLedger.ts)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
- [src/infra/health.ts](file://src/infra/health.ts)
- [src/__tests__/api.postgres.test.ts](file://src/__tests__/api.postgres.test.ts)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Database Schema and Initialization](#database-schema-and-initialization)
3. [Database Migration Framework](#database-migration-framework)
4. [Backup Operations](#backup-operations)
5. [Restore Operations](#restore-operations)
6. [Environment Configuration](#environment-configuration)
7. [Docker Integration](#docker-integration)
8. [Monitoring and Health Checks](#monitoring-and-health-checks)
9. [Best Practices and Safety Guidelines](#best-practices-and-safety-guidelines)
10. [Troubleshooting Common Issues](#troubleshooting-common-issues)
11. [Disaster Recovery Procedures](#disaster-recovery-procedures)

## Introduction

The escrowgrid platform utilizes PostgreSQL as its primary database system, managing critical financial data for tokenization-as-a-service operations. This comprehensive guide covers database setup, backup, restore operations, and maintenance procedures essential for production deployments.

The platform supports both in-memory and persistent storage backends, with PostgreSQL serving as the production-grade solution for maintaining transactional integrity and data durability across institutional asset management operations.

## Database Schema and Initialization

### Schema Definition Structure

The database schema follows a normalized relational design optimized for financial transactions and compliance requirements. The schema includes comprehensive tables for institutions, asset management, positions, and audit trails.

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
API_KEYS {
string id PK
string institution_id FK
string key_hash UK
string label
string role
timestamptz created_at
timestamptz revoked_at
}
AUDIT_EVENTS {
string id PK
timestamptz occurred_at
timestamptz created_at
string api_key_id
string institution_id
string method
string path
string action
string resource_type
string resource_id
jsonb payload
}
INSTITUTION_POLICIES {
string id PK
string institution_id FK
string region
jsonb config
timestamptz created_at
timestamptz updated_at
}
INSTITUTIONS ||--o{ ASSET_TEMPLATES : "owns"
INSTITUTIONS ||--o{ ASSETS : "manages"
INSTITUTIONS ||--o{ API_KEYS : "has"
INSTITUTIONS ||--o{ INSTITUTION_POLICIES : "defines"
ASSET_TEMPLATES ||--o{ ASSETS : "defines"
ASSETS ||--o{ POSITIONS : "contains"
POSITIONS ||--o{ POSITION_EVENTS : "tracks"
POSITIONS ||--o{ LEDGER_EVENTS : "records"
API_KEYS ||--o{ AUDIT_EVENTS : "generates"
INSTITUTIONS ||--o{ AUDIT_EVENTS : "produces"
```

**Diagram sources**
- [db/schema.sql](file://db/schema.sql#L3-L138)

### Schema Initialization Process

The database initialization occurs through multiple mechanisms depending on the deployment environment:

#### Manual Schema Application

For development and standalone PostgreSQL instances, the schema can be applied manually:

```bash
# Create database
createdb taas_platform

# Apply schema
psql taas_platform < db/schema.sql
```

#### Docker Container Initialization

When using Docker Compose, the schema is automatically applied during container startup through the `docker-entrypoint-initdb.d` mechanism:

```yaml
volumes:
  - ./db/schema.sql:/docker-entrypoint-initdb.d/10-schema.sql:ro
```

This ensures that the PostgreSQL container automatically executes the schema file upon first startup, creating the necessary tables and indexes.

**Section sources**
- [db/schema.sql](file://db/schema.sql#L1-L138)
- [docker-compose.yml](file://docker-compose.yml#L15-L16)

## Database Migration Framework

### Migration System Architecture

The platform now includes a database migration framework to manage schema evolution over time. This system uses incremental SQL migration files stored in the `db/migrations` directory and tracks applied versions in a dedicated `schema_migrations` table.

```mermaid
flowchart TD
Start([Migration Script Start]) --> CheckPsql["Check psql Availability"]
CheckPsql --> PsqlExists{"psql Available?"}
PsqlExists --> |No| ErrorExit["Exit with Error"]
PsqlExists --> |Yes| EnsureMigrationsTable["Ensure schema_migrations Table Exists"]
EnsureMigrationsTable --> ListMigrations["List Migration Files"]
ListMigrations --> FilesExist{"Migration Files Found?"}
FilesExist --> |No| NoMigrations["Exit: No Migrations to Apply"]
FilesExist --> |Yes| ProcessMigrations["Process Each Migration"]
ProcessMigrations --> GetVersion["Extract Version from Filename"]
GetVersion --> CheckApplied["Check if Migration Already Applied"]
CheckApplied --> AlreadyApplied{"Already Applied?"}
AlreadyApplied --> |Yes| SkipMigration["Skip Migration"]
AlreadyApplied --> |No| ApplyMigration["Apply Migration SQL"]
ApplyMigration --> RecordApplied["Record Migration in schema_migrations"]
RecordApplied --> NextMigration["Process Next Migration"]
NextMigration --> ProcessMigrations
SkipMigration --> NextMigration
ProcessMigrations --> AllProcessed["All Migrations Processed"]
AllProcessed --> Complete([Migrations Complete])
```

**Diagram sources**
- [db/migrate.sh](file://db/migrate.sh#L1-L71)
- [db/migrations/0001_initial.sql](file://db/migrations/0001_initial.sql#L1-L141)

### Migration Script Functionality

The `db/migrate.sh` script implements a simple but effective migration system:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Simple SQL migrations runner for the TAAS Platform.
# Applies migrations in db/migrations in lexicographic order, tracking state
# in a schema_migrations table inside the target database.
#
# Usage:
#   DATABASE_URL="postgres://user:pass@host:port/dbname" ./db/migrate.sh
# or
#   PGDATABASE=taas_platform PGUSER=... PGPASSWORD=... ./db/migrate.sh
```

#### Key Features

- **Lexicographic Ordering**: Migrations are applied in filename order (e.g., 0001_, 0002_)
- **Idempotent Execution**: Each migration is tracked in `schema_migrations` table to prevent re-application
- **Atomic Operations**: Each migration runs as a single transaction with `ON_ERROR_STOP=1`
- **Flexible Connection**: Supports both `DATABASE_URL` and standard libpq environment variables

#### Migration State Tracking

The system creates and maintains a `schema_migrations` table to track applied versions:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

This table ensures that:
- **Duplicate Application Prevention**: Each migration is applied only once
- **Audit Trail**: Timestamp of when each migration was applied
- **Consistency**: Migration state is stored within the target database

**Section sources**
- [db/migrate.sh](file://db/migrate.sh#L34-L40)
- [db/migrations/0001_initial.sql](file://db/migrations/0001_initial.sql#L1-L141)

### Migration File Structure

Migration files are stored in the `db/migrations/` directory with a consistent naming pattern:

```
db/migrations/
└── 0001_initial.sql
```

The initial migration file contains the complete schema definition:

```sql
-- 0001_initial.sql
-- Initial TAAS Platform PostgreSQL schema.

CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  regions TEXT[] NOT NULL,
  verticals TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
-- Additional table definitions...
```

**Section sources**
- [db/migrations/0001_initial.sql](file://db/migrations/0001_initial.sql#L1-L141)

### Command-Line Usage

The migration script supports the same connection methods as other database utilities:

#### Method 1: DATABASE_URL Approach
```bash
export DATABASE_URL="postgres://user:password@host:port/dbname"
./db/migrate.sh
```

#### Method 2: Libpq Environment Variables
```bash
export PGDATABASE=taas_platform
export PGUSER=your_username
export PGPASSWORD=your_password
export PGHOST=localhost
export PGPORT=5432
./db/migrate.sh
```

### Migration Process Flow

1. **Verify Dependencies**: Check that `psql` is available
2. **Ensure Tracking Table**: Create `schema_migrations` table if it doesn't exist
3. **Discover Migrations**: Find all `.sql` files in `db/migrations/` directory
4. **Process Sequentially**: For each migration file (in lexicographic order):
   - Check if already applied by querying `schema_migrations`
   - If not applied, execute the SQL file using `psql`
   - Record successful application in `schema_migrations` table
5. **Complete**: Exit with success status

The script outputs progress information to stderr:
```
Ensuring schema_migrations table exists...
Checking migration 0001_initial.sql...
Applying migration 0001_initial.sql...
  Applied.
Migrations complete.
```

**Section sources**
- [db/migrate.sh](file://db/migrate.sh#L1-L71)

## Backup Operations

### Backup Script Architecture

The backup system employs a lightweight shell script utilizing PostgreSQL's native `pg_dump` utility with specific optimization flags for cross-environment compatibility.

```mermaid
flowchart TD
Start([Backup Script Start]) --> CheckDump["Check pg_dump Availability"]
CheckDump --> DumpExists{"pg_dump Available?"}
DumpExists --> |No| ErrorExit["Exit with Error"]
DumpExists --> |Yes| CheckURL["Check DATABASE_URL Environment"]
CheckURL --> URLSet{"DATABASE_URL Set?"}
URLSet --> |Yes| UseURL["Use DATABASE_URL Parameter"]
URLSet --> |No| UseEnvVars["Use PG* Environment Variables"]
UseURL --> ExecuteDump["Execute pg_dump with Flags"]
UseEnvVars --> ExecuteDump
ExecuteDump --> NoOwner["--no-owner Flag"]
ExecuteDump --> NoPrivileges["--no-privileges Flag"]
ExecuteDump --> PlainFormat["--format=plain Flag"]
NoOwner --> Output["Write SQL to stdout"]
NoPrivileges --> Output
PlainFormat --> Output
Output --> End([Script Complete])
```

**Diagram sources**
- [db/backup.sh](file://db/backup.sh#L1-L27)

### Command-Line Usage Patterns

The backup script supports flexible environment variable configurations:

#### Method 1: DATABASE_URL Approach
```bash
export DATABASE_URL="postgres://user:password@host:port/dbname"
./db/backup.sh > taas-backup-$(date +%Y%m%d-%H%M%S).sql
```

#### Method 2: Libpq Environment Variables
```bash
export PGDATABASE=taas_platform
export PGUSER=your_username
export PGPASSWORD=your_password
export PGHOST=localhost
export PGPORT=5432
./db/backup.sh > taas-backup-$(date +%Y%m%d-%H%M%S).sql
```

### Critical Backup Flags Explained

#### `--no-owner` Flag Importance

The `--no-owner` flag prevents ownership information from being included in the backup:

- **Cross-Environment Compatibility**: Ensures the backup works regardless of the target database user
- **Security**: Prevents accidental privilege escalation during restoration
- **Portability**: Enables restoration to databases with different ownership structures

#### `--no-privileges` Flag Importance

The `--no-privileges` flag excludes privilege and ACL information:

- **Standardization**: Creates consistent backups across different PostgreSQL installations
- **Simplicity**: Reduces complexity in restoration scenarios
- **Compatibility**: Works with various PostgreSQL privilege models

#### `--format=plain` Format Choice

Using plain SQL format provides several advantages:

- **Human Readability**: Allows manual inspection and modification if needed
- **Version Control**: Enables diffing and version tracking
- **Debugging**: Facilitates troubleshooting and selective restoration

**Section sources**
- [db/backup.sh](file://db/backup.sh#L1-L27)

## Restore Operations

### Restore Script Architecture

The restore operation employs a destructive approach designed for controlled environments, particularly useful for staging and testing scenarios.

```mermaid
flowchart TD
Start([Restore Script Start]) --> CheckArgs["Check Arguments"]
CheckArgs --> ArgsValid{"Single Argument?"}
ArgsValid --> |No| ArgError["Print Usage & Exit"]
ArgsValid --> |Yes| CheckFile["Check Backup File Exists"]
CheckFile --> FileExists{"File Found?"}
FileExists --> |No| FileNotFoundError["Print Error & Exit"]
FileExists --> |Yes| CheckPsql["Check psql Availability"]
CheckPsql --> PsqlExists{"psql Available?"}
PsqlExists --> |No| PsqlError["Exit with Error"]
PsqlExists --> |Yes| CheckURL["Check DATABASE_URL Environment"]
CheckURL --> URLSet{"DATABASE_URL Set?"}
URLSet --> |Yes| UseURL["Use DATABASE_URL"]
URLSet --> |No| UseEnvVars["Use PG* Environment Variables"]
UseURL --> DropSchema["Drop Public Schema"]
UseEnvVars --> DropSchema
DropSchema --> RecreateSchema["Recreate Public Schema"]
RecreateSchema --> RestoreData["Restore from SQL File"]
RestoreData --> Complete([Restore Complete])
```

**Diagram sources**
- [db/restore.sh](file://db/restore.sh#L1-L46)

### Destructive Nature and Safety Precautions

#### Warning: Complete Schema Replacement

The restore process performs a complete schema replacement:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

This operation:
- **Destroys all existing data** in the target database
- **Removes all custom extensions** and configurations
- **Resets all sequences** and auto-increment counters
- **Eliminates custom permissions** and roles

#### Safety Guidelines

1. **Never use against Production Without Plan**
   - Always have a current backup before restoration
   - Verify the target environment is appropriate
   - Test restoration procedures in non-production environments

2. **Environment Isolation**
   - Use dedicated restore environments
   - Maintain separate database instances for different stages
   - Implement proper access controls

3. **Pre-Restoration Checklist**
   - Confirm backup file integrity
   - Verify sufficient disk space
   - Check network connectivity
   - Validate target database accessibility

### Command-Line Usage Patterns

#### Basic Restore Operation
```bash
export DATABASE_URL="postgres://user:password@host:port/dbname"
./db/restore.sh taas-backup-YYYYMMDD-HHMMSS.sql
```

#### Using Environment Variables
```bash
export PGDATABASE=taas_staging
export PGUSER=staging_user
export PGPASSWORD=secure_password
./db/restore.sh taas-backup-YYYYMMDD-HHMMSS.sql
```

**Section sources**
- [db/restore.sh](file://db/restore.sh#L1-L46)

## Environment Configuration

### Database Connection Management

The platform supports multiple database connection configuration methods through environment variables and connection strings.

```mermaid
classDiagram
class DatabaseConfig {
+string storeBackend
+string postgresUrl
+requirePostgresUrl() string
+validateConnection() boolean
}
class ConnectionMethods {
+DATABASE_URL string
+PGDATABASE string
+PGUSER string
+PGPASSWORD string
+PGHOST string
+PGPORT number
}
class ConnectionValidation {
+checkReadiness() ReadinessStatus
+testConnection() boolean
+handleErrors(error) void
}
DatabaseConfig --> ConnectionMethods : "uses"
DatabaseConfig --> ConnectionValidation : "validates"
```

**Diagram sources**
- [src/config.ts](file://src/config.ts#L1-L47)
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)

### Configuration Options

#### Backend Selection
```typescript
// Store backend configuration
export type StoreBackend = 'memory' | 'postgres';

// Environment variable
STORE_BACKEND=postgres
```

#### Connection String Format
```bash
# Full connection string
DATABASE_URL="postgres://username:password@hostname:port/database"

# Simplified format
DATABASE_URL="postgres://hostname:port/database"
```

#### Environment Variable Fallback
```bash
# Individual parameters
PGDATABASE=taas_platform
PGUSER=taas_user
PGPASSWORD=taas_pass
PGHOST=localhost
PGPORT=5432
```

**Section sources**
- [src/config.ts](file://src/config.ts#L1-L47)
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)

## Docker Integration

### Container-Based Database Setup

The Docker Compose configuration provides automated database initialization and management through container orchestration.

```mermaid
graph TB
subgraph "Docker Compose Services"
DB[PostgreSQL Container]
API[API Server Container]
ADMIN[Admin Console Container]
end
subgraph "Database Initialization"
SchemaSQL[schema.sql]
InitScript[docker-entrypoint-initdb.d]
HealthCheck[Health Check]
end
subgraph "Application Layer"
Config[Configuration]
Connection[Database Connection]
Migration[Schema Migration]
end
SchemaSQL --> InitScript
InitScript --> DB
DB --> HealthCheck
HealthCheck --> API
Config --> Connection
Connection --> DB
Migration --> DB
```

**Diagram sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)

### Automated Schema Deployment

The PostgreSQL container automatically applies the schema during initialization:

#### Volume Mount Configuration
```yaml
volumes:
  - ./db/schema.sql:/docker-entrypoint-initdb.d/10-schema.sql:ro
```

This mount ensures:
- **Read-only access** prevents accidental modifications
- **Automatic execution** on container startup
- **Version control** integration through Git

#### Health Check Implementation
```yaml
healthcheck:
  test: ["CMD", "pg_isready", "-U", "taas_user"]
  interval: 5s
  timeout: 5s
  retries: 5
```

The health check validates:
- **Database availability** through `pg_isready`
- **User authentication** verification
- **Connection establishment** capability

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)

## Monitoring and Health Checks

### Database Health Monitoring

The platform implements comprehensive health checking to ensure database connectivity and operational status.

```mermaid
sequenceDiagram
participant Client as "Client Request"
participant Health as "Health Endpoint"
participant DB as "Database Pool"
participant PG as "PostgreSQL"
Client->>Health : GET /health
Health->>DB : Create Connection Pool
DB->>PG : Test Connection
PG-->>DB : Connection OK
DB-->>Health : Pool Ready
Health-->>Client : {status : "ok", db : {ok : true}}
Note over Client,PG : Successful health check
Client->>Health : GET /ready
Health->>DB : Execute SELECT 1
DB->>PG : Query Execution
PG-->>DB : Query Result
DB-->>Health : Query Success
Health-->>Client : {status : "ok", db : {ok : true}}
Note over Client,PG : Readiness check passed
```

**Diagram sources**
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)

### Health Check Endpoints

#### Liveness Check (`/health`)
- Validates basic service functionality
- Tests database connection when using PostgreSQL backend
- Provides immediate feedback on service status

#### Readiness Check (`/ready`)
- Comprehensive database connectivity test
- Executes actual SQL queries to verify data access
- Essential for Kubernetes deployments and load balancer health checks

### Connection Pool Management

The PostgreSQL client implements robust connection pooling with automatic cleanup:

```typescript
// Connection pool lifecycle
try {
  const connectionString = requirePostgresUrl();
  pool = new Pool({ connectionString });
  await pool.query('SELECT 1');
  // Success handling
} catch (err) {
  // Error handling
} finally {
  if (pool) {
    await pool.end().catch(() => {});
  }
}
```

**Section sources**
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)

## Best Practices and Safety Guidelines

### Backup Strategy Implementation

#### Retention Policies
- **Daily Backups**: Maintain 7-14 days of daily backups
- **Weekly Backups**: Keep weekly snapshots for longer-term recovery
- **Monthly Backups**: Archive monthly backups for historical recovery
- **Yearly Backups**: Retain yearly backups for compliance requirements

#### Storage Recommendations
- **Offsite Storage**: Store backups in geographically separated locations
- **Encryption**: Encrypt backups in transit and at rest
- **Integrity Verification**: Regularly verify backup file integrity
- **Access Controls**: Implement strict access controls for backup systems

### Restore Testing Procedures

#### Staging Environment Validation
1. **Environment Preparation**: Create isolated staging environment
2. **Backup Restoration**: Perform full restoration from production backup
3. **Functional Testing**: Validate all critical business operations
4. **Performance Testing**: Verify system performance under realistic loads
5. **Rollback Planning**: Establish rollback procedures for failed restores

#### Disaster Recovery Scenarios
- **Complete System Failure**: Restore from latest backup to new infrastructure
- **Partial Data Corruption**: Restore specific tables or schemas
- **Accidental Deletion**: Recover deleted data from recent backups
- **Security Breach**: Restore clean state from known good backup

### Security Considerations

#### Database Access Control
- **Principle of Least Privilege**: Grant minimal necessary permissions
- **Role-Based Access**: Implement role-based database access patterns
- **Audit Logging**: Enable comprehensive audit logging for all database operations
- **Network Security**: Restrict database access to authorized networks only

#### Backup Security
- **Encryption Keys**: Securely manage encryption keys for backup files
- **Access Logging**: Monitor access to backup storage systems
- **Integrity Checks**: Implement cryptographic checksums for backup verification
- **Retention Policies**: Define secure deletion procedures for expired backups

## Troubleshooting Common Issues

### Permission Errors

#### Problem: Insufficient Database Permissions
**Symptoms:**
- `permission denied for schema public` errors
- `permission denied for table X` messages
- Authentication failures during connection attempts

**Solutions:**
1. **Verify User Permissions**
   ```sql
   -- Check user privileges
   \du
   
   -- Grant necessary permissions
   GRANT ALL PRIVILEGES ON DATABASE taas_platform TO taas_user;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO taas_user;
   ```

2. **Connection String Verification**
   ```bash
   # Verify connection string format
   psql "postgres://user:password@host:port/dbname" -c "SELECT 1;"
   
   # Test with individual parameters
   export PGUSER=taas_user
   export PGPASSWORD=taas_pass
   export PGDATABASE=taas_platform
   psql -c "SELECT 1;"
   ```

#### Problem: Schema Owner Mismatch
**Symptoms:**
- `must be owner of schema public` errors
- `cannot drop schema public` messages

**Solutions:**
1. **Change Schema Ownership**
   ```sql
   ALTER SCHEMA public OWNER TO taas_user;
   ```

2. **Use --no-owner Flag in Backups**
   Ensure backup scripts include the `--no-owner` flag to prevent ownership issues.

### Connection Failures

#### Problem: Network Connectivity Issues
**Symptoms:**
- `connection refused` errors
- Timeout exceptions during connection attempts
- DNS resolution failures

**Solutions:**
1. **Network Connectivity Test**
   ```bash
   # Test database connectivity
   telnet localhost 5432
   
   # Test with ping
   ping db-hostname
   
   # Verify firewall rules
   iptables -L | grep 5432
   ```

2. **Connection String Validation**
   ```bash
   # Test connection with psql
   psql -h hostname -p port -U username -d dbname -c "SELECT 1;"
   
   # Verify environment variables
   env | grep PG
   ```

#### Problem: Authentication Failures
**Symptoms:**
- `password authentication failed` errors
- `role "username" does not exist` messages
- SSL connection failures

**Solutions:**
1. **Password Verification**
   ```bash
   # Test password authentication
   psql -h hostname -U username -W dbname
   
   # Check password in configuration
   echo $PGPASSWORD
   ```

2. **User Account Verification**
   ```sql
   -- Check user existence
   SELECT rolname FROM pg_roles WHERE rolname='taas_user';
   
   -- Verify user permissions
   \du taas_user
   ```

### Schema Migration Conflicts

#### Problem: Version Mismatch Between Environments
**Symptoms:**
- `column does not exist` errors
- `table does not exist` messages
- `data type mismatch` warnings

**Solutions:**
1. **Schema Comparison**
   ```bash
   # Compare schemas between environments
   pg_dump --schema-only --no-owner production_db > prod_schema.sql
   pg_dump --schema-only --no-owner staging_db > staging_schema.sql
   diff prod_schema.sql staging_schema.sql
   ```

2. **Migration Strategy**
   - Implement gradual schema migrations
   - Use database migration tools for version control
   - Maintain backward compatibility during transitions

#### Problem: Data Integrity Violations
**Symptoms:**
- `violates foreign key constraint` errors
- `unique constraint violation` messages
- `not-null constraint violation` errors

**Solutions:**
1. **Data Validation**
   ```sql
   -- Check referential integrity
   SELECT conname, conrelid::regclass, confrelid::regclass
   FROM pg_constraint
   WHERE contype = 'f';
   
   -- Validate data completeness
   SELECT COUNT(*) FROM table_name WHERE column_name IS NULL;
   ```

2. **Constraint Resolution**
   ```sql
   -- Drop problematic constraints temporarily
   ALTER TABLE table_name DROP CONSTRAINT constraint_name;
   
   -- Fix data issues
   UPDATE table_name SET column_name = default_value WHERE column_name IS NULL;
   
   -- Re-add constraints
   ALTER TABLE table_name ADD CONSTRAINT constraint_name CHECK (condition);
   ```

**Section sources**
- [src/__tests__/api.postgres.test.ts](file://src/__tests__/api.postgres.test.ts#L26-L43)

## Disaster Recovery Procedures

### Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)

#### RTO Targets
- **Critical Systems**: 1-4 hours for full system recovery
- **Non-Critical Systems**: 8-24 hours for partial recovery
- **Data Recovery**: 2-8 hours for critical data restoration

#### RPO Targets
- **Financial Transactions**: 15 minutes maximum data loss
- **Operational Data**: 1 hour maximum data loss
- **Configuration Data**: 24 hours maximum data loss

### Multi-Level Recovery Strategies

#### Level 1: Immediate Recovery (1-4 hours)
1. **Infrastructure Restoration**
   - Provision new compute resources
   - Deploy fresh database containers
   - Configure network connectivity

2. **Database Restoration**
   - Restore latest backup to new database
   - Verify data integrity
   - Update connection configurations

3. **Application Recovery**
   - Deploy application containers
   - Configure environment variables
   - Run health checks

#### Level 2: Full Operational Recovery (4-24 hours)
1. **Data Synchronization**
   - Apply transaction logs since last backup
   - Resolve any data inconsistencies
   - Validate business continuity

2. **Service Validation**
   - Execute comprehensive testing
   - Verify all integrations
   - Monitor system performance

3. **Documentation Updates**
   - Update runbooks with lessons learned
   - Document recovery procedures
   - Train operations team

### Automated Recovery Scripts

#### Emergency Backup Creation
```bash
#!/bin/bash
# emergency-backup.sh - Create immediate backup for disaster recovery

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="emergency-backup-${TIMESTAMP}.sql"

echo "Creating emergency backup: ${BACKUP_FILE}"

# Force backup with minimal options
pg_dump \
  --no-owner \
  --no-privileges \
  --format=plain \
  --file="${BACKUP_FILE}" \
  "${DATABASE_URL}"

echo "Emergency backup completed: ${BACKUP_FILE}"
```

#### Rapid Recovery Template
```bash
#!/bin/bash
# rapid-recovery.sh - Template for quick disaster recovery

RECOVERY_TARGET=$1
BACKUP_FILE=$2

echo "Starting rapid recovery for ${RECOVERY_TARGET}"
echo "Using backup file: ${BACKUP_FILE}"

# Step 1: Stop services
echo "Stopping services..."
docker-compose down

# Step 2: Restore database
echo "Restoring database..."
./db/restore.sh "${BACKUP_FILE}"

# Step 3: Restart services
echo "Restarting services..."
docker-compose up -d

# Step 4: Verify recovery
echo "Verifying recovery..."
sleep 30
curl -f http://localhost:4000/health || exit 1

echo "Rapid recovery completed successfully"
```

### Testing and Validation

#### Quarterly Disaster Recovery Testing
1. **Scenario Development**
   - Simulate various failure modes
   - Develop realistic recovery scenarios
   - Define success criteria

2. **Test Execution**
   - Conduct recovery drills in non-production environments
   - Measure actual recovery times
   - Document performance metrics

3. **Improvement Iteration**
   - Analyze recovery effectiveness
   - Identify bottlenecks and improvements
   - Update procedures and training materials

#### Continuous Monitoring Integration
- **Automated Alerts**: Configure alerts for database anomalies
- **Performance Baselines**: Establish baseline performance metrics
- **Capacity Planning**: Monitor growth trends for capacity decisions
- **Security Monitoring**: Track unauthorized access attempts

**Section sources**
- [README.md](file://README.md#L327-L353)