# API Reference

<cite>
**Referenced Files in This Document**
- [openapi.ts](file://src/openapi.ts)
- [server.ts](file://src/server.ts)
- [institutions.ts](file://src/api/institutions.ts)
- [assets.ts](file://src/api/assets.ts)
- [positions.ts](file://src/api/positions.ts)
- [ledger.ts](file://src/api/ledger.ts)
- [policies.ts](file://src/api/policies.ts)
- [metrics.ts](file://src/api/metrics.ts)
- [apiKeys.ts](file://src/api/apiKeys.ts)
- [types.ts](file://src/domain/types.ts)
- [auth.ts](file://src/middleware/auth.ts)
- [rateLimit.ts](file://src/middleware/rateLimit.ts)
- [config.ts](file://src/config.ts)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication & Security](#authentication--security)
3. [Rate Limiting](#rate-limiting)
4. [API Versioning](#api-versioning)
5. [Error Handling](#error-handling)
6. [Core API Groups](#core-api-groups)
7. [Health & Monitoring](#health--monitoring)
8. [Client Implementation Guidelines](#client-implementation-guidelines)
9. [Real-World Usage Scenarios](#real-world-usage-scenarios)
10. [Schema Definitions](#schema-definitions)

## Introduction

The EscrowGrid Tokenization-as-a-Service (TAAS) platform provides RESTful APIs for managing institutions, assets, positions, policies, and ledger events. The platform focuses on escrowable real-world assets in construction and trade finance verticals.

### Key Features
- **Multi-institution support**: Institutions can operate independently with isolated data
- **Role-based access control**: Root and institution-level permissions
- **Policy enforcement**: Regional and institutional policy validation
- **Immutable ledger**: Cryptographically verifiable transaction history
- **Flexible asset modeling**: Template-based asset creation with custom configurations
- **Lifecycle management**: Complete position state transitions

### Base URLs
- **Production**: `https://api.escrowgrid.io`
- **Development**: `http://localhost:4000`

## Authentication & Security

The platform uses API key authentication with hierarchical permission levels.

### Authentication Methods

#### API Key Header
```http
X-API-KEY: your-api-key-here
```

#### Bearer Token
```http
Authorization: Bearer your-api-key-here
```

### Permission Levels

| Role | Description | Access Level |
|------|-------------|--------------|
| `root` | Global administrator | Full access to all institutions and data |
| `admin` | Institution administrator | Full access within assigned institution |
| `read_only` | Read-only access | Read-only access within assigned institution |

### Security Considerations

1. **API Key Management**: Store API keys securely and rotate regularly
2. **HTTPS Only**: All API communications must use HTTPS in production
3. **Scope Limiting**: Use read-only keys for monitoring and admin consoles
4. **Audit Logging**: All actions are logged for compliance and security

**Section sources**
- [auth.ts](file://src/middleware/auth.ts#L23-L81)
- [config.ts](file://src/config.ts#L23-L37)

## Rate Limiting

The platform implements sliding window rate limiting to prevent abuse and ensure fair usage.

### Rate Limiting Configuration

| Parameter | Default Value | Environment Variable |
|-----------|---------------|---------------------|
| Window Size | 60 seconds | `RATE_LIMIT_WINDOW_MS` |
| Max Requests | 1000 | `RATE_LIMIT_MAX_REQUESTS` |
| Enabled | Yes | `RATE_LIMIT_ENABLED` |

### Rate Limit Headers

When rate limits are exceeded:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "details": {
    "windowMs": 60000,
    "maxRequests": 1000
  }
}
```

### Rate Limiting Behavior

- **Root keys**: Not subject to rate limiting
- **Sliding window**: Counts requests within the last X milliseconds
- **Per-key basis**: Each API key has its own rate limit bucket
- **Graceful degradation**: Non-protected routes (health, docs) are exempt

**Section sources**
- [rateLimit.ts](file://src/middleware/rateLimit.ts#L12-L66)

## API Versioning

The platform follows semantic versioning principles:

- **Current Version**: `1.0.0`
- **Stability**: OpenAPI specification version `3.0.3`
- **Backward Compatibility**: Breaking changes are avoided in major versions
- **Deprecation**: Deprecated endpoints are clearly marked in documentation

### Version Discovery

```http
GET /openapi.json
```

Response includes version information in the OpenAPI spec.

## Error Handling

The platform uses consistent error response patterns across all endpoints.

### Standard Error Response

```json
{
  "error": "Error description",
  "details": "Additional context (optional)"
}
```

### HTTP Status Codes

| Status Code | Description | Usage |
|-------------|-------------|-------|
| 200 | Success | Successful GET requests |
| 201 | Created | Successful POST requests |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing or invalid API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server-side errors |

### Common Error Patterns

#### Validation Errors
```json
{
  "error": "Invalid request body",
  "details": "assetId, holderReference, currency, and numeric amount are required"
}
```

#### Policy Violations
```json
{
  "error": "Amount below minimum for policy",
  "details": "minAmount=1000"
}
```

#### Resource Conflicts
```json
{
  "error": "Asset not found for institution"
}
```

**Section sources**
- [types.ts](file://src/domain/types.ts#L80-L85)

## Core API Groups

### Institutions API

Manage institutional accounts and their configurations.

#### List Institutions
```http
GET /institutions
```

**Authentication**: Required  
**Permissions**: Root or institution access

**Response**:
```json
[
  {
    "id": "inst_123",
    "name": "Example Bank",
    "regions": ["EU_UK"],
    "verticals": ["CONSTRUCTION", "TRADE_FINANCE"],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

#### Create Institution (Root Only)
```http
POST /institutions
Content-Type: application/json
X-API-KEY: root-key

{
  "name": "New Institution",
  "regions": ["US"],
  "verticals": ["CONSTRUCTION"]
}
```

**Response**:
```json
{
  "id": "inst_new",
  "name": "New Institution",
  "regions": ["US"],
  "verticals": ["CONSTRUCTION"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### Get Institution Details
```http
GET /institutions/{id}
```

**Authentication**: Required  
**Permissions**: Root or same institution access

**Section sources**
- [institutions.ts](file://src/api/institutions.ts#L70-L111)

### Asset Templates API

Define reusable asset configurations for different verticals and regions.

#### Create Asset Template
```http
POST /asset-templates
Content-Type: application/json
X-API-KEY: api-key

{
  "code": "CONSTR_ESCROW",
  "name": "Construction Escrow",
  "vertical": "CONSTRUCTION",
  "region": "EU_UK",
  "config": {
    "currency": "USD",
    "minAmount": 1000,
    "maxAmount": 1000000
  }
}
```

**Supported Verticals & Codes**:

| Vertical | Code | Configuration |
|----------|------|---------------|
| CONSTRUCTION | `CONSTR_ESCROW` | Currency, min/max amounts |
| CONSTRUCTION | `CONSTR_RETAINAGE` | Currency, retainage percentage |
| TRADE_FINANCE | `TF_INVOICE` | Currency, max tenor, country |
| TRADE_FINANCE | `TF_LC` | Currency, issuing bank country, max tenor |

#### List Asset Templates
```http
GET /asset-templates?institutionId={id}
```

**Authentication**: Required  
**Permissions**: Root or institution access

**Section sources**
- [assets.ts](file://src/api/assets.ts#L17-L88)

### Assets API

Create and manage specific instances of asset templates.

#### Create Asset
```http
POST /assets
Content-Type: application/json
X-API-KEY: api-key

{
  "templateId": "template_123",
  "label": "Project Alpha Escrow",
  "metadata": {
    "projectCode": "ALPHA-001",
    "contractValue": 500000
  }
}
```

**Response**:
```json
{
  "id": "asset_456",
  "institutionId": "inst_123",
  "templateId": "template_123",
  "label": "Project Alpha Escrow",
  "metadata": {
    "projectCode": "ALPHA-001",
    "contractValue": 500000
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### List Assets
```http
GET /assets?institutionId={id}&templateId={id}
```

**Authentication**: Required  
**Permissions**: Root or institution access

**Section sources**
- [assets.ts](file://src/api/assets.ts#L91-L143)

### Positions API

Manage escrow positions with complete lifecycle tracking.

#### Create Position
```http
POST /positions
Content-Type: application/json
X-API-KEY: api-key

{
  "assetId": "asset_456",
  "holderReference": "SUBCONTRACTOR_123",
  "currency": "USD",
  "amount": 100000,
  "externalReference": "ESCROW_REF_001"
}
```

**Position States**:
- `CREATED`: Initial state after creation
- `FUNDED`: Funds deposited into escrow
- `PARTIALLY_RELEASED`: Partial release approved
- `RELEASED`: Full release approved
- `CANCELLED`: Position cancelled
- `EXPIRED`: Position expired

#### List Positions
```http
GET /positions?institutionId={id}&assetId={id}&holderReference={ref}
```

**Authentication**: Required  
**Permissions**: Root or institution access

#### Position Lifecycle Transitions
```http
POST /positions/{id}/transition
Content-Type: application/json
X-API-KEY: api-key

{
  "toState": "FUNDED",
  "reason": "Funds received into escrow",
  "metadata": {
    "depositDate": "2024-01-01",
    "depositAmount": 100000
  }
}
```

**Section sources**
- [positions.ts](file://src/api/positions.ts#L22-L293)

### Policies API

Configure regional and institutional policy rules.

#### Set Institution Policy
```http
PUT /institutions/{id}/policies/{region}
Content-Type: application/json
X-API-KEY: admin-key

{
  "position": {
    "minAmount": 1000,
    "maxAmount": 1000000,
    "allowedCurrencies": ["USD", "EUR", "GBP"]
  }
}
```

#### Get Institution Policies
```http
GET /institutions/{id}/policies
```

#### Get Specific Policy
```http
GET /institutions/{id}/policies/{region}
```

**Section sources**
- [policies.ts](file://src/api/policies.ts#L24-L177)

### Ledger Events API

Access immutable transaction history for audit and compliance.

#### List Ledger Events
```http
GET /ledger-events?positionId={id}
```

**Authentication**: Required  
**Permissions**: Root or position institution access

**Response**:
```json
[
  {
    "id": "event_123",
    "kind": "POSITION_CREATED",
    "positionId": "position_456",
    "at": "2024-01-01T00:00:00Z",
    "payload": {
      "institutionId": "inst_123",
      "assetId": "asset_456",
      "holderReference": "SUBCONTRACTOR_123",
      "currency": "USD",
      "amount": 100000
    }
  }
]
```

**Section sources**
- [ledger.ts](file://src/api/ledger.ts#L8-L38)

### API Keys Management

Manage API keys for institutions.

#### Create API Key
```http
POST /institutions/{id}/api-keys
Content-Type: application/json
X-API-KEY: admin-key

{
  "label": "Monitoring Key",
  "role": "read_only"
}
```

**Response**:
```json
{
  "id": "key_789",
  "institutionId": "inst_123",
  "label": "Monitoring Key",
  "role": "read_only",
  "createdAt": "2024-01-01T00:00:00Z",
  "apiKey": "sk_abc123def456..."
}
```

#### List API Keys
```http
GET /institutions/{id}/api-keys
```

**Section sources**
- [apiKeys.ts](file://src/api/apiKeys.ts#L16-L106)

## Health & Monitoring

### Health Check
```http
GET /health
```

**Response**:
```json
{
  "status": "ok",
  "service": "taas-platform",
  "storeBackend": "postgres"
}
```

### Readiness Check
```http
GET /ready
```

**Response**:
```json
{
  "ok": true,
  "storeBackend": "postgres",
  "db": {
    "ok": true
  }
}
```

### Metrics Endpoint (Root Only)
```http
GET /metrics
X-API-KEY: root-key
```

**Response**:
```json
{
  "totalRequests": 1000,
  "totalErrors": 5,
  "requestsByStatus": {
    "200": 950,
    "400": 30,
    "401": 15,
    "403": 5
  },
  "requestsByMethod": {
    "GET": 600,
    "POST": 400
  },
  "averageDurationMs": 150.5
}
```

**Section sources**
- [server.ts](file://src/server.ts#L26-L38)
- [metrics.ts](file://src/api/metrics.ts#L7-L17)

## Client Implementation Guidelines

### Best Practices

#### 1. Error Handling
```typescript
async function createPosition(client: HttpClient, data: PositionData) {
  try {
    const response = await client.post('/positions', data);
    return response.data;
  } catch (error) {
    if (error.response?.status === 400) {
      console.error('Validation error:', error.response.data);
    } else if (error.response?.status === 403) {
      console.error('Permission denied');
    } else if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      await wait(retryAfter * 1000);
      return createPosition(client, data); // Retry
    }
    throw error;
  }
}
```

#### 2. Rate Limiting
```typescript
class RateLimitedClient {
  private rateLimitRemaining = Infinity;
  private rateLimitReset = 0;

  async request(method: string, url: string, data?: any) {
    if (this.rateLimitRemaining <= 0) {
      const now = Date.now();
      if (now < this.rateLimitReset) {
        await wait(this.rateLimitReset - now);
      }
    }

    const response = await axios.request({ method, url, data });
    
    this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining']);
    this.rateLimitReset = parseInt(response.headers['x-ratelimit-reset']) * 1000;

    return response;
  }
}
```

#### 3. API Key Rotation
```typescript
class ApiKeyManager {
  private currentKey: string;
  private rotationInterval: NodeJS.Timeout;

  constructor(initialKey: string) {
    this.currentKey = initialKey;
    this.startRotation();
  }

  getCurrentKey(): string {
    return this.currentKey;
  }

  private startRotation() {
    this.rotationInterval = setInterval(async () => {
      try {
        const newKey = await this.rotateKey();
        this.currentKey = newKey;
      } catch (error) {
        console.error('Failed to rotate API key:', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily rotation
  }
}
```

### SDK Recommendations

#### HTTP Client Setup
```typescript
const client = axios.create({
  baseURL: 'https://api.escrowgrid.io',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'MyApp/1.0'
  }
});

// Add interceptors for automatic retries and logging
client.interceptors.request.use(config => {
  config.headers['X-API-KEY'] = apiKeyManager.getCurrentKey();
  return config;
});
```

#### Response Validation
```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

function validateResponse<T>(response: ApiResponse<any>): T {
  if (response.status >= 400) {
    throw new Error(`API Error ${response.status}: ${response.data.error}`);
  }
  return response.data;
}
```

## Real-World Usage Scenarios

### Scenario 1: Construction Escrow Management

#### Step 1: Institution Setup
```bash
# Create institution
curl -X POST https://api.escrowgrid.io/institutions \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $ROOT_API_KEY" \
  -d '{
    "name": "Global Construction Bank",
    "regions": ["US"],
    "verticals": ["CONSTRUCTION"]
  }'

# Create API key
curl -X POST https://api.escrowgrid.io/institutions/{institution-id}/api-keys \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $ROOT_API_KEY" \
  -d '{
    "label": "Construction Operations",
    "role": "admin"
  }'
```

#### Step 2: Asset Template Creation
```bash
# Create construction escrow template
curl -X POST https://api.escrowgrid.io/asset-templates \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $INST_API_KEY" \
  -d '{
    "code": "CONSTR_ESCROW",
    "name": "Construction Project Escrow",
    "vertical": "CONSTRUCTION",
    "region": "US",
    "config": {
      "currency": "USD",
      "minAmount": 10000,
      "maxAmount": 1000000
    }
  }'
```

#### Step 3: Position Management Workflow
```bash
# Create escrow position
curl -X POST https://api.escrowgrid.io/positions \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $INST_API_KEY" \
  -d '{
    "assetId": "{asset-id}",
    "holderReference": "SUBCONTRACTOR_001",
    "currency": "USD",
    "amount": 500000,
    "externalReference": "PROJECT_ALPHA_001"
  }'

# Fund the position
curl -X POST https://api.escrowgrid.io/positions/{position-id}/transition \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $INST_API_KEY" \
  -d '{
    "toState": "FUNDED",
    "reason": "Initial deposit received"
  }'

# Release partial funds
curl -X POST https://api.escrowgrid.io/positions/{position-id}/transition \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $INST_API_KEY" \
  -d '{
    "toState": "PARTIALLY_RELEASED",
    "reason": "Phase 1 completion",
    "metadata": {
      "releaseAmount": 250000,
      "releaseDate": "2024-02-01"
    }
  }'

# Final release
curl -X POST https://api.escrowgrid.io/positions/{position-id}/transition \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $INST_API_KEY" \
  -d '{
    "toState": "RELEASED",
    "reason": "Project completion verified"
  }'
```

### Scenario 2: Trade Finance Invoice Management

#### Step 1: Trade Finance Setup
```bash
# Create trade finance template
curl -X POST https://api.escrowgrid.io/asset-templates \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $INST_API_KEY" \
  -d '{
    "code": "TF_INVOICE",
    "name": "Invoice Financing",
    "vertical": "TRADE_FINANCE",
    "region": "EU_UK",
    "config": {
      "currency": "EUR",
      "maxTenorDays": 180,
      "country": "DE"
    }
  }'
```

#### Step 2: Invoice Position Creation
```bash
# Create invoice position
curl -X POST https://api.escrowgrid.io/positions \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $INST_API_KEY" \
  -d '{
    "assetId": "{invoice-template-id}",
    "holderReference": "SELLER_123",
    "currency": "EUR",
    "amount": 150000,
    "externalReference": "INV_2024_001"
  }'
```

### Scenario 3: Compliance & Audit Trail

#### Monitor Position Lifecycle
```bash
# Track all position events
curl "https://api.escrowgrid.io/ledger-events?positionId={position-id}" \
  -H "X-API-KEY: $INST_API_KEY"

# Monitor institution-wide activity
curl "https://api.escrowgrid.io/ledger-events" \
  -H "X-API-KEY: $ROOT_API_KEY"
```

#### Policy Compliance Check
```bash
# Verify position creation compliance
curl -X POST https://api.escrowgrid.io/positions \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $INST_API_KEY" \
  -d '{
    "assetId": "{asset-id}",
    "holderReference": "COMPANY_A",
    "currency": "USD",
    "amount": 5000
  }'

# This would fail with:
# {
#   "error": "Amount below minimum for policy",
#   "details": "minAmount=10000"
# }
```

## Schema Definitions

### Core Types

#### Institution
```typescript
interface Institution {
  id: string;
  name: string;
  regions: Region[];           // ['US', 'EU_UK', 'SG', 'UAE']
  verticals: Vertical[];      // ['CONSTRUCTION', 'TRADE_FINANCE']
  createdAt: string;          // ISO date-time
  updatedAt: string;          // ISO date-time
}
```

#### Asset Template
```typescript
interface AssetTemplate {
  id: string;
  institutionId: string;
  code: string;               // Template identifier
  name: string;
  vertical: Vertical;
  region: Region;
  config: Record<string, unknown>;  // Template-specific configuration
  createdAt: string;
  updatedAt: string;
}
```

#### Position
```typescript
interface Position {
  id: string;
  institutionId: string;
  assetId: string;
  holderReference: string;
  currency: string;
  amount: number;
  state: PositionState;       // ['CREATED', 'FUNDED', 'PARTIALLY_RELEASED', 'RELEASED', 'CANCELLED', 'EXPIRED']
  externalReference?: string;
  createdAt: string;
  updatedAt: string;
  events: PositionLifecycleEvent[];
}
```

#### Position Lifecycle Event
```typescript
interface PositionLifecycleEvent {
  id: string;
  positionId: string;
  fromState: PositionState | null;
  toState: PositionState;
  reason?: string;
  at: string;
  metadata?: Record<string, unknown>;
}
```

### Policy Configuration

#### Policy Config
```typescript
interface PolicyConfig {
  region: Region;
  position: {
    minAmount?: number;
    maxAmount?: number;
    allowedCurrencies?: string[];
  };
}
```

### Error Handling Schema
```typescript
interface ApiErrorPayload {
  error: string;
  details?: unknown;
}
```

**Section sources**
- [types.ts](file://src/domain/types.ts#L7-L85)
- [openapi.ts](file://src/openapi.ts#L35-L263)