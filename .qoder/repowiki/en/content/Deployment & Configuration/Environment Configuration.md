# Environment Configuration

<cite>
**Referenced Files in This Document**
- [src/config.ts](file://src/config.ts)
- [docker-compose.yml](file://docker-compose.yml)
- [src/server.ts](file://src/server.ts)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts)
- [src/infra/postgresLedger.ts](file://src/infra/postgresLedger.ts)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts)
- [src/middleware/rateLimit.ts](file://src/middleware/rateLimit.ts)
- [src/middleware/auth.ts](file://src/middleware/auth.ts)
- [src/infra/health.ts](file://src/infra/health.ts)
- [Dockerfile](file://Dockerfile)
- [package.json](file://package.json)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Configuration Architecture](#configuration-architecture)
3. [Core Configuration Variables](#core-configuration-variables)
4. [Environment Variable Loading and Validation](#environment-variable-loading-and-validation)
5. [Store Backend Configuration](#store-backend-configuration)
6. [Rate Limiting Configuration](#rate-limiting-configuration)
7. [On-Chain Ledger Configuration](#on-chain-ledger-configuration)
8. [Environment Setup Examples](#environment-setup-examples)
9. [Secure Secret Management](#secure-secret-management)
10. [Configuration Validation and Fallback Mechanisms](#configuration-validation-and-fallback-mechanisms)
11. [Common Misconfiguration Issues](#common-misconfiguration-issues)
12. [Debugging Strategies](#debugging-strategies)
13. [Best Practices](#best-practices)

## Introduction

The EscrowGrid platform uses a comprehensive environment-based configuration system that allows for flexible deployment across development, staging, and production environments. The configuration is managed through TypeScript interfaces and validated at runtime, ensuring type safety and robust error handling.

The platform supports multiple store backends (memory and PostgreSQL), optional on-chain ledger integration, configurable rate limiting, and secure API key management. All configuration values are loaded from environment variables and validated during application startup.

## Configuration Architecture

The configuration system follows a layered architecture with clear separation of concerns:

```mermaid
graph TB
subgraph "Environment Variables"
ENV1[STORE_BACKEND]
ENV2[DATABASE_URL]
ENV3[ROOT_API_KEY]
ENV4[RATE_LIMIT_ENABLED]
ENV5[ONCHAIN_*]
end
subgraph "Configuration Module"
CONFIG[src/config.ts]
TYPE[AppConfig Interface]
VALIDATION[Validation Functions]
end
subgraph "Runtime Components"
SERVER[src/server.ts]
STORE[Store Implementation]
LEDGER[Ledger Clients]
MIDDLEWARE[Middlewares]
end
ENV1 --> CONFIG
ENV2 --> CONFIG
ENV3 --> CONFIG
ENV4 --> CONFIG
ENV5 --> CONFIG
CONFIG --> TYPE
CONFIG --> VALIDATION
TYPE --> SERVER
VALIDATION --> STORE
VALIDATION --> LEDGER
VALIDATION --> MIDDLEWARE
```

**Diagram sources**
- [src/config.ts](file://src/config.ts#L1-L47)
- [src/server.ts](file://src/server.ts#L12)

**Section sources**
- [src/config.ts](file://src/config.ts#L1-L47)
- [src/server.ts](file://src/server.ts#L12)

## Core Configuration Variables

The platform defines several critical configuration variables that control system behavior:

### Essential Configuration Parameters

| Variable | Type | Description | Default Value | Required |
|----------|------|-------------|---------------|----------|
| `PORT` | number | Server port | 4000 | No |
| `STORE_BACKEND` | StoreBackend | Data persistence backend | 'memory' | No |
| `DATABASE_URL` | string | PostgreSQL connection string | - | When STORE_BACKEND=postgres |
| `ROOT_API_KEY` | string | Master API key for administrative access | - | No |

### Rate Limiting Configuration

| Variable | Type | Description | Default Value | Purpose |
|----------|------|-------------|---------------|---------|
| `RATE_LIMIT_ENABLED` | boolean | Enable request rate limiting | false | Security |
| `RATE_LIMIT_WINDOW_MS` | number | Time window for rate limiting (milliseconds) | 60000 | Configurable sliding window |
| `RATE_LIMIT_MAX_REQUESTS` | number | Maximum requests per window | 1000 | Rate limit threshold |

### On-Chain Ledger Configuration

| Variable | Type | Description | Required | Purpose |
|----------|------|-------------|----------|---------|
| `ONCHAIN_LEDGER_ENABLED` | boolean | Enable blockchain ledger integration | No | Optional feature |
| `ONCHAIN_RPC_URL` | string | Blockchain RPC endpoint URL | When enabled | Chain connectivity |
| `ONCHAIN_PRIVATE_KEY` | string | Wallet private key for transactions | When enabled | Transaction signing |
| `ONCHAIN_CONTRACT_ADDRESS` | string | Smart contract address | When enabled | Contract interaction |
| `ONCHAIN_CHAIN_ID` | number | Blockchain network identifier | No | Network validation |

**Section sources**
- [src/config.ts](file://src/config.ts#L3-L16)
- [src/config.ts](file://src/config.ts#L23-L38)

## Environment Variable Loading and Validation

The configuration loading process follows a structured approach with type conversion and validation:

```mermaid
flowchart TD
START([Application Start]) --> LOAD_ENV["Load Environment Variables"]
LOAD_ENV --> PARSE_PORT["Parse PORT to Number"]
PARSE_PORT --> VALIDATE_PORT{"Port Valid?"}
VALIDATE_PORT --> |Invalid| DEFAULT_PORT["Use Default: 4000"]
VALIDATE_PORT --> |Valid| CONTINUE1["Continue"]
DEFAULT_PORT --> CONTINUE1
CONTINUE1 --> PARSE_RATE_LIMIT["Parse Rate Limit Values"]
PARSE_RATE_LIMIT --> VALIDATE_RATE_LIMIT{"Rate Limits Valid?"}
VALIDATE_RATE_LIMIT --> |Invalid| DEFAULT_RATE_LIMIT["Use Defaults:<br/>60000ms, 1000 req"]
VALIDATE_RATE_LIMIT --> |Valid| CONTINUE2["Continue"]
DEFAULT_RATE_LIMIT --> CONTINUE2
CONTINUE2 --> VALIDATE_STORE{"STORE_BACKEND<br/>Valid?"}
VALIDATE_STORE --> |Invalid| DEFAULT_STORE["Use Default: 'memory'"]
VALIDATE_STORE --> |Valid| CONTINUE3["Continue"]
DEFAULT_STORE --> CONTINUE3
CONTINUE3 --> VALIDATE_POSTGRES{"DATABASE_URL<br/>Required?"}
VALIDATE_POSTGRES --> |Yes| CHECK_POSTGRES["Check DATABASE_URL"]
VALIDATE_POSTGRES --> |No| CONTINUE4["Continue"]
CHECK_POSTGRES --> POSTGRES_VALID{"URL Valid?"}
POSTGRES_VALID --> |No| ERROR["Throw Configuration Error"]
POSTGRES_VALID --> |Yes| CONTINUE4
CONTINUE4 --> VALIDATE_ONCHAIN{"ONCHAIN_LEDGER_ENABLED?"}
VALIDATE_ONCHAIN --> |Yes| VALIDATE_ONCHAIN_PARAMS["Validate On-Chain Parameters"]
VALIDATE_ONCHAIN --> |No| COMPLETE["Configuration Complete"]
VALIDATE_ONCHAIN_PARAMS --> ONCHAIN_VALID{"Params Valid?"}
ONCHAIN_VALID --> |No| LOG_ERROR["Log Validation Error"]
ONCHAIN_VALID --> |Yes| COMPLETE
LOG_ERROR --> COMPLETE
COMPLETE --> READY([System Ready])
ERROR --> EXIT([Exit with Error])
```

**Diagram sources**
- [src/config.ts](file://src/config.ts#L18-L38)

### Type Conversion and Validation Logic

The configuration module implements robust type conversion with fallback mechanisms:

1. **Port Configuration**: Converts `PORT` environment variable to number with 4000 as default
2. **Boolean Parsing**: Uses strict equality comparison (`=== 'true'`) for boolean flags
3. **Numeric Validation**: Validates rate limit parameters and converts to integers
4. **Optional Parameters**: Provides sensible defaults for optional configuration
5. **Required Parameter Validation**: Throws errors for missing required parameters

**Section sources**
- [src/config.ts](file://src/config.ts#L18-L38)

## Store Backend Configuration

The platform supports two distinct store backends with automatic selection based on configuration:

### Memory Store Backend

The memory store provides ephemeral data storage suitable for development and testing:

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
+createAsset(input) Asset
+createPosition(input) Position
+getPosition(id) Position
+updatePosition(position, event) Position
}
class Store {
<<interface>>
+createInstitution(input) Institution
+listInstitutions() Institution[]
+getInstitution(id) Institution
+createAssetTemplate(input) AssetTemplate
+createAsset(input) Asset
+createPosition(input) Position
+getPosition(id) Position
+updatePosition(position, event) Position
}
MemoryStore ..|> Store
```

**Diagram sources**
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts#L13-L217)

### PostgreSQL Store Backend

The PostgreSQL store provides persistent data storage with ACID compliance:

```mermaid
classDiagram
class PostgresStore {
-pool : Pool
+constructor(connectionString)
+createInstitution(input) Institution
+listInstitutions() Institution[]
+getInstitution(id) Institution
+createAssetTemplate(input) AssetTemplate
+createAsset(input) Asset
+createPosition(input) Position
+getPosition(id) Position
+updatePosition(position, event) Position
+listPositions(params) Position[]
+listAssets(params) Asset[]
+listAssetTemplates(params) AssetTemplate[]
}
class Store {
<<interface>>
+createInstitution(input) Institution
+listInstitutions() Institution[]
+getInstitution(id) Institution
+createAssetTemplate(input) AssetTemplate
+createAsset(input) Asset
+createPosition(input) Position
+getPosition(id) Position
+updatePosition(position, event) Position
}
PostgresStore ..|> Store
```

**Diagram sources**
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L89-L416)

### Store Selection Logic

The store backend is selected at application startup based on the `STORE_BACKEND` environment variable:

```mermaid
flowchart TD
START([Application Startup]) --> CHECK_BACKEND{"STORE_BACKEND == 'postgres'?"}
CHECK_BACKEND --> |Yes| VALIDATE_POSTGRES["Validate DATABASE_URL"]
CHECK_BACKEND --> |No| MEMORY_STORE["Use Memory Store"]
VALIDATE_POSTGRES --> POSTGRES_VALID{"Valid URL?"}
POSTGRES_VALID --> |Yes| CREATE_POSTGRES["Create PostgreSQL Store"]
POSTGRES_VALID --> |No| ERROR["Throw Error:<br/>DATABASE_URL required"]
CREATE_POSTGRES --> SUCCESS([Store Initialized])
MEMORY_STORE --> SUCCESS
ERROR --> EXIT([Exit with Error])
```

**Diagram sources**
- [src/store/index.ts](file://src/store/index.ts#L1-L14)

**Section sources**
- [src/store/index.ts](file://src/store/index.ts#L1-L14)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts#L89-L95)
- [src/store/memoryStore.ts](file://src/store/memoryStore.ts#L13-L217)

## Rate Limiting Configuration

The rate limiting system provides configurable protection against abuse while maintaining performance:

### Rate Limiting Architecture

```mermaid
sequenceDiagram
participant Client
participant Middleware as "Rate Limit Middleware"
participant Bucket as "Rate Limit Bucket"
participant Handler as "API Handler"
Client->>Middleware : API Request
Middleware->>Middleware : Check Rate Limit Enabled
alt Rate Limiting Disabled
Middleware->>Handler : Pass Through
else Rate Limiting Enabled
Middleware->>Bucket : Get Current Window
Bucket-->>Middleware : Window Status
alt Within Limit
Middleware->>Bucket : Increment Counter
Middleware->>Handler : Allow Request
else Over Limit
Middleware->>Client : 429 Too Many Requests
end
end
```

**Diagram sources**
- [src/middleware/rateLimit.ts](file://src/middleware/rateLimit.ts#L1-L65)

### Configuration Parameters

The rate limiting system uses sliding window algorithm with configurable parameters:

| Parameter | Environment Variable | Default | Description |
|-----------|---------------------|---------|-------------|
| Window Size | `RATE_LIMIT_WINDOW_MS` | 60000 | Time window in milliseconds |
| Request Limit | `RATE_LIMIT_MAX_REQUESTS` | 1000 | Maximum requests per window |
| Enabled | `RATE_LIMIT_ENABLED` | false | Global rate limiting switch |

### Rate Limiting Behavior

1. **Sliding Window Algorithm**: Tracks requests within the specified time window
2. **Per-Client Rate Limiting**: Uses API key or institution ID as rate limiting key
3. **Root API Key Exemption**: Root API key bypasses rate limits
4. **Health Check Bypass**: `/health` and `/ready` endpoints are exempt
5. **Dynamic Window Reset**: Windows reset when out of the current window period

**Section sources**
- [src/middleware/rateLimit.ts](file://src/middleware/rateLimit.ts#L1-L65)
- [src/config.ts](file://src/config.ts#L35-L37)

## On-Chain Ledger Configuration

The on-chain ledger integration provides blockchain-based immutability for financial transactions:

### On-Chain Ledger Architecture

```mermaid
graph TB
subgraph "On-Chain Ledger System"
ENABLED[ONCHAIN_LEDGER_ENABLED]
RPC[ONCHAIN_RPC_URL]
PRIVATE_KEY[ONCHAIN_PRIVATE_KEY]
CONTRACT[ONCHAIN_CONTRACT_ADDRESS]
CHAIN_ID[ONCHAIN_CHAIN_ID]
end
subgraph "Smart Contract Interface"
ABI[ABI: recordPositionEvent]
METHOD[recordPositionEvent<br/>positionId, kind, payload]
end
subgraph "Template Configuration"
TEMPLATE[Asset Template Config]
ONCHAIN_CONFIG[config.onchain Block]
TEMPLATE_ENABLED[enabled: boolean]
TEMPLATE_CHAIN_ID[chainId: number]
end
ENABLED --> VALIDATION{Enabled?}
VALIDATION --> |No| DISABLED[Skip On-Chain Writes]
VALIDATION --> |Yes| PARAM_CHECK{All Params Present?}
PARAM_CHECK --> |No| ERROR[Log Validation Error]
PARAM_CHECK --> |Yes| CONTRACT_CALL[Call Smart Contract]
TEMPLATE --> TEMPLATE_CHECK{Template Enabled?}
TEMPLATE_CHECK --> |No| SKIP[Skip Position]
TEMPLATE_CHECK --> |Yes| CHAIN_CHECK{Chain ID Match?}
CHAIN_CHECK --> |No| SKIP
CHAIN_CHECK --> |Yes| WRITE[Write to Chain]
CONTRACT_CALL --> METHOD
METHOD --> ABI
```

**Diagram sources**
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L1-L82)

### Configuration Requirements

For on-chain ledger functionality to work, the following environment variables must be configured:

1. **Basic Configuration**:
   - `ONCHAIN_LEDGER_ENABLED`: Set to `true` to enable
   - `ONCHAIN_RPC_URL`: Blockchain RPC endpoint (e.g., Infura, Alchemy)
   - `ONCHAIN_PRIVATE_KEY`: Wallet private key for transaction signing

2. **Contract Configuration**:
   - `ONCHAIN_CONTRACT_ADDRESS`: Deployed smart contract address
   - `ONCHAIN_CHAIN_ID`: Optional network identifier for validation

### Template-Level Configuration

On-chain writing is controlled at the asset template level through the template configuration:

```typescript
// Example template configuration with on-chain enabled
{
  "code": "CONSTR_ESCROW_ONCHAIN",
  "name": "On-chain Construction Escrow",
  "config": {
    "currency": "USD",
    "onchain": {
      "enabled": true,
      "chainId": 11155111  // Sepolia Testnet
    }
  }
}
```

### On-Chain Event Processing

The on-chain ledger system processes position lifecycle events:

1. **POSITION_CREATED Events**: Triggered when new positions are created
2. **POSITION_STATE_CHANGED Events**: Triggered for state transitions
3. **Template Validation**: Checks template-level on-chain configuration
4. **Chain ID Validation**: Ensures events are written to correct network
5. **Error Handling**: Graceful degradation with logging on failures

**Section sources**
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L1-L82)
- [README.md](file://README.md#L239-L274)

## Environment Setup Examples

### Development Environment

Development configuration prioritizes ease of setup and local testing:

```yaml
# docker-compose.dev.yml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: taas_dev
      POSTGRES_USER: taas_user
      POSTGRES_PASSWORD: taas_pass
    ports:
      - "5432:5432"
    volumes:
      - ./db/schema.sql:/docker-entrypoint-initdb.d/10-schema.sql:ro

  api:
    build: .
    environment:
      NODE_ENV: development
      PORT: 4000
      STORE_BACKEND: postgres
      DATABASE_URL: postgres://taas_user:taas_pass@db:5432/taas_dev
      ROOT_API_KEY: dev-root-key-${RANDOM_STRING}
      RATE_LIMIT_ENABLED: "false"
      ONCHAIN_LEDGER_ENABLED: "false"
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "4000:4000"
    command: npm run dev

  admin:
    build: ./admin-console
    ports:
      - "8080:80"
```

### Staging Environment

Staging environment mirrors production with enhanced monitoring:

```yaml
# docker-compose.staging.yml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: taas_staging
      POSTGRES_USER: taas_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - staging-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "taas_user"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: .
    environment:
      NODE_ENV: staging
      PORT: 4000
      STORE_BACKEND: postgres
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@db:5432/taas_staging
      ROOT_API_KEY: ${ROOT_API_KEY}
      RATE_LIMIT_ENABLED: "true"
      RATE_LIMIT_WINDOW_MS: "60000"
      RATE_LIMIT_MAX_REQUESTS: "1000"
      ONCHAIN_LEDGER_ENABLED: "false"
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "4000:4000"
    restart: unless-stopped

volumes:
  staging-db-data:
```

### Production Environment

Production configuration emphasizes security, reliability, and performance:

```yaml
# docker-compose.prod.yml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: taas_prod
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - prod-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "taas_user"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  api:
    build: .
    environment:
      NODE_ENV: production
      PORT: 4000
      STORE_BACKEND: postgres
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@db:5432/taas_prod
      ROOT_API_KEY: ${ROOT_API_KEY}
      RATE_LIMIT_ENABLED: "true"
      RATE_LIMIT_WINDOW_MS: "60000"
      RATE_LIMIT_MAX_REQUESTS: "1000"
      ONCHAIN_LEDGER_ENABLED: "true"
      ONCHAIN_RPC_URL: ${ONCHAIN_RPC_URL}
      ONCHAIN_PRIVATE_KEY: ${ONCHAIN_PRIVATE_KEY}
      ONCHAIN_CONTRACT_ADDRESS: ${ONCHAIN_CONTRACT_ADDRESS}
      ONCHAIN_CHAIN_ID: "1"  # Ethereum Mainnet
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "4000:4000"
    restart: unless-stopped
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 30s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

  admin:
    build: ./admin-console
    environment:
      API_BASE_URL: "https://api.yourdomain.com"
    ports:
      - "80:80"
      - "443:443"
    restart: unless-stopped

volumes:
  prod-db-data:
```

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)

## Secure Secret Management

### Secret Storage Best Practices

1. **Environment-Specific Secrets**:
   - Use separate secret stores for each environment
   - Never commit secrets to version control
   - Implement secret rotation policies

2. **Secret Configuration**:
   ```bash
   # Development (local)
   export ROOT_API_KEY="dev-root-key-$(openssl rand -hex 16)"
   export DATABASE_URL="postgresql://user:pass@localhost:5432/taas_dev"
   
   # Production (CI/CD)
   export ROOT_API_KEY=$(vault kv get -field=root_api_key secret/escrowgrid/prod)
   export DATABASE_URL=$(vault kv get -field=db_url secret/escrowgrid/prod)
   ```

3. **Secret Validation**:
   ```typescript
   // Configuration validation for secrets
   if (!config.rootApiKey || config.rootApiKey.length < 32) {
     throw new Error('ROOT_API_KEY must be at least 32 characters');
   }
   
   if (config.onchainLedgerEnabled && !config.onchainPrivateKey?.startsWith('0x')) {
     throw new Error('ONCHAIN_PRIVATE_KEY must be a valid hex string');
   }
   ```

### Docker Compose Secret Management

```yaml
# docker-compose.yml with secrets
version: '3.9'

services:
  api:
    build: .
    environment:
      - NODE_ENV=production
      - STORE_BACKEND=postgres
      - DATABASE_URL_FILE=/run/secrets/db_url
      - ROOT_API_KEY_FILE=/run/secrets/root_key
    secrets:
      - db_url
      - root_key
      - onchain_private_key

secrets:
  db_url:
    file: ./secrets/db_url.txt
  root_key:
    file: ./secrets/root_key.txt
  onchain_private_key:
    file: ./secrets/onchain_private_key.txt
```

**Section sources**
- [src/config.ts](file://src/config.ts#L40-L47)

## Configuration Validation and Fallback Mechanisms

### Runtime Configuration Validation

The platform implements comprehensive validation with graceful fallbacks:

```mermaid
flowchart TD
START([Configuration Load]) --> VALIDATE_REQUIRED{Required<br/>Parameters?}
VALIDATE_REQUIRED --> |Missing| REQUIRED_ERROR[Throw Required Error]
VALIDATE_REQUIRED --> |Present| VALIDATE_TYPES{Type<br/>Validation?}
VALIDATE_TYPES --> |Invalid| TYPE_ERROR[Convert to Default]
VALIDATE_TYPES --> |Valid| VALIDATE_LOGIC{Business<br/>Logic?}
TYPE_ERROR --> CONTINUE[Continue Validation]
VALIDATE_LOGIC --> |Invalid| LOG_WARNING[Log Warning]
VALIDATE_LOGIC --> |Valid| CONTINUE
LOG_WARNING --> CONTINUE
CONTINUE --> VALIDATE_DEPENDENCIES{Dependencies<br/>Met?}
VALIDATE_DEPENDENCIES --> |No| DEPENDENCY_ERROR[Graceful Degradation]
VALIDATE_DEPENDENCIES --> |Yes| SUCCESS[Configuration Valid]
REQUIRED_ERROR --> EXIT([Exit Application])
TYPE_ERROR --> EXIT
LOG_WARNING --> EXIT
DEPENDENCY_ERROR --> EXIT
SUCCESS --> READY([Application Ready])
```

**Diagram sources**
- [src/config.ts](file://src/config.ts#L40-L47)

### Validation Functions

The configuration module includes specialized validation functions:

1. **PostgreSQL URL Validation**:
   ```typescript
   export function requirePostgresUrl(): string {
     if (!config.postgresUrl) {
       throw new Error('DATABASE_URL is required when STORE_BACKEND=postgres');
     }
     return config.postgresUrl;
   }
   ```

2. **On-Chain Parameter Validation**:
   ```typescript
   constructor() {
     if (!config.onchainRpcUrl || !config.onchainPrivateKey || !config.onchainContractAddress) {
       throw new Error('On-chain ledger requires ONCHAIN_RPC_URL, ONCHAIN_PRIVATE_KEY, and ONCHAIN_CONTRACT_ADDRESS');
     }
   }
   ```

### Fallback Mechanisms

1. **Default Port**: Falls back to 4000 if PORT is invalid or missing
2. **Default Store Backend**: Uses memory store when STORE_BACKEND is invalid
3. **Default Rate Limits**: Uses 60-second window with 1000 requests when invalid
4. **Graceful On-Chain Degradation**: Disables on-chain functionality with logging on parameter errors

**Section sources**
- [src/config.ts](file://src/config.ts#L40-L47)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L20-L25)

## Common Misconfiguration Issues

### Database Configuration Problems

1. **Missing DATABASE_URL**:
   ```bash
   # Error: DATABASE_URL is required when STORE_BACKEND=postgres
   # Solution: Set DATABASE_URL or change STORE_BACKEND to 'memory'
   export STORE_BACKEND=memory
   ```

2. **Invalid PostgreSQL URL**:
   ```bash
   # Error: Connection refused or invalid URL format
   # Solution: Verify URL format and database accessibility
   export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
   ```

### Rate Limiting Issues

1. **Invalid Rate Limit Parameters**:
   ```bash
   # Error: Non-numeric values for rate limit parameters
   # Solution: Ensure numeric values for RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX_REQUESTS
   export RATE_LIMIT_WINDOW_MS=60000
   export RATE_LIMIT_MAX_REQUESTS=1000
   ```

### On-Chain Ledger Problems

1. **Incomplete On-Chain Configuration**:
   ```bash
   # Error: Missing required on-chain parameters
   # Solution: Provide all required on-chain environment variables
   export ONCHAIN_LEDGER_ENABLED=true
   export ONCHAIN_RPC_URL="https://rpc.url"
   export ONCHAIN_PRIVATE_KEY="0x..."
   export ONCHAIN_CONTRACT_ADDRESS="0x..."
   ```

2. **Chain ID Mismatch**:
   ```bash
   # Error: Template chain ID doesn't match configured chain ID
   # Solution: Ensure template configuration matches on-chain configuration
   # Template config: "onchain": {"enabled": true, "chainId": 1}
   # Environment: ONCHAIN_CHAIN_ID=1
   ```

### API Key Configuration

1. **Missing Root API Key**:
   ```bash
   # Error: Authentication failures without ROOT_API_KEY
   # Solution: Set ROOT_API_KEY for administrative access
   export ROOT_API_KEY="your-secret-key-here"
   ```

**Section sources**
- [src/config.ts](file://src/config.ts#L40-L47)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L20-L25)

## Debugging Strategies

### Configuration Debugging

1. **Enable Debug Logging**:
   ```bash
   export NODE_ENV=development
   export DEBUG=taas:config
   ```

2. **Configuration Validation Script**:
   ```javascript
   // config-debug.js
   const { config } = require('./dist/config');
   
   console.log('Current Configuration:', {
     port: config.port,
     storeBackend: config.storeBackend,
     postgresUrl: config.postgresUrl ? '***' : 'MISSING',
     rootApiKey: config.rootApiKey ? '***' : 'MISSING',
     rateLimitEnabled: config.rateLimitEnabled,
     onchainLedgerEnabled: config.onchainLedgerEnabled
   });
   ```

3. **Environment Variable Inspection**:
   ```bash
   # Check all environment variables
   env | grep -E "(STORE_|DATABASE_|ROOT_API_|RATE_|ONCHAIN_)"
   
   # Verify PostgreSQL connectivity
   psql "$DATABASE_URL" -c "SELECT 1;"
   ```

### Health Check Diagnostics

1. **Application Health Check**:
   ```bash
   curl http://localhost:4000/health
   # Expected: {"status":"ok","service":"taas-platform","storeBackend":"memory"}
   ```

2. **Readiness Check**:
   ```bash
   curl http://localhost:4000/ready
   # Expected: {"ok":true,"storeBackend":"memory"}
   ```

3. **Configuration Endpoint**:
   ```bash
   # Add a configuration debug endpoint in server.ts
   app.get('/config-debug', (req, res) => {
     res.json({
       config: {
         ...config,
         postgresUrl: config.postgresUrl ? '***' : 'undefined',
         rootApiKey: config.rootApiKey ? '***' : 'undefined'
       }
     });
   });
   ```

### Log Analysis

1. **On-Chain Ledger Logs**:
   ```bash
   # Look for on-chain ledger initialization logs
   docker logs taas-api | grep -i "onchain_ledger"
   
   # Expected: Successful initialization or error messages
   ```

2. **Rate Limiting Logs**:
   ```bash
   # Monitor rate limiting behavior
   docker logs taas-api | grep -i "rate_limit"
   ```

**Section sources**
- [src/server.ts](file://src/server.ts#L26-L38)
- [src/infra/health.ts](file://src/infra/health.ts#L1-L45)

## Best Practices

### Configuration Management

1. **Environment Separation**:
   - Use distinct environment files for each deployment stage
   - Implement CI/CD pipeline for configuration deployment
   - Version control configuration templates

2. **Security Hardening**:
   - Rotate API keys regularly
   - Use encrypted secrets in production
   - Implement principle of least privilege

3. **Monitoring and Alerting**:
   - Monitor configuration validation errors
   - Track rate limiting violations
   - Alert on on-chain ledger failures

### Deployment Strategies

1. **Blue-Green Deployment**:
   - Test configuration changes in staging
   - Validate with health checks before promotion
   - Rollback quickly on configuration issues

2. **Gradual Rollout**:
   - Deploy configuration changes incrementally
   - Monitor system behavior closely
   - Use feature flags for optional configurations

3. **Infrastructure as Code**:
   - Define configuration in Terraform/CloudFormation
   - Automate configuration deployment
   - Maintain configuration drift detection

### Performance Optimization

1. **Connection Pooling**:
   - Configure appropriate PostgreSQL connection pools
   - Monitor connection usage patterns
   - Optimize for expected load

2. **Rate Limiting Tuning**:
   - Adjust rate limits based on traffic patterns
   - Implement tiered rate limiting for different API tiers
   - Monitor rate limiting effectiveness

3. **On-Chain Optimization**:
   - Batch on-chain operations when possible
   - Implement circuit breakers for blockchain failures
   - Monitor gas costs and transaction success rates

**Section sources**
- [src/config.ts](file://src/config.ts#L1-L47)
- [src/middleware/rateLimit.ts](file://src/middleware/rateLimit.ts#L1-L65)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L1-L82)