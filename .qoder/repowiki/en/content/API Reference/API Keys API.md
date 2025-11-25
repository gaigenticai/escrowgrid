# API Keys API

<cite>
**Referenced Files in This Document**
- [src/api/apiKeys.ts](file://src/api/apiKeys.ts)
- [src/middleware/auth.ts](file://src/middleware/auth.ts)
- [src/infra/apiKeyStore.ts](file://src/infra/apiKeyStore.ts)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts)
- [src/domain/types.ts](file://src/domain/types.ts)
- [src/server.ts](file://src/server.ts)
- [src/config.ts](file://src/config.ts)
- [src/openapi.ts](file://src/openapi.ts)
- [db/schema.sql](file://db/schema.sql)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication Flow](#authentication-flow)
3. [API Key Management Endpoints](#api-key-management-endpoints)
4. [Security Architecture](#security-architecture)
5. [Data Models](#data-models)
6. [Integration Components](#integration-components)
7. [Security Best Practices](#security-best-practices)
8. [Usage Examples](#usage-examples)
9. [Error Handling](#error-handling)
10. [Monitoring and Auditing](#monitoring-and-auditing)

## Introduction

The API Keys API provides secure access control for institutions and root users in the EscrowGrid platform. It enables programmatic access to the TAAS (Tokenization-as-a-Service) infrastructure through bearer tokens with role-based permissions. The system supports two distinct roles: `admin` for full access and `read_only` for read-only operations.

API keys serve as the primary authentication mechanism for automated clients, institutional integrations, and third-party applications requiring secure access to the platform's resources. Each key is scoped to a specific institution and carries explicit permissions that can be audited and revoked.

## Authentication Flow

The authentication system implements a hierarchical permission model with three distinct access levels:

```mermaid
flowchart TD
A["Incoming Request"] --> B["Extract Token"]
B --> C{"Token Present?"}
C --> |No| D["401 Missing API Key"]
C --> |Yes| E{"Root API Key?"}
E --> |Yes| F["Grant Root Access"]
E --> |No| G["Validate Against Store"]
G --> H{"Valid Key?"}
H --> |No| I["401 Invalid API Key"]
H --> |Yes| J["Set Auth Context"]
J --> K["Continue Request"]
F --> L["Full Platform Access"]
K --> M{"Endpoint Requires Write?"}
M --> |Yes| N{"Role = read_only?"}
N --> |Yes| O["403 Write Forbidden"]
N --> |No| P["Allow Write Operation"]
M --> |No| Q["Allow Read Operation"]
```

**Diagram sources**
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L35-L95)

### Token Validation Process

The authentication middleware validates tokens through multiple channels:

1. **Root API Key Bypass**: Pre-configured root keys bypass normal validation
2. **Bearer Token Validation**: Standard OAuth2 Bearer tokens
3. **X-API-Key Header**: Alternative header-based authentication
4. **Role Assignment**: Automatic role determination based on stored key metadata

**Section sources**
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L23-L95)

## API Key Management Endpoints

### Create API Key Endpoint

**POST** `/institutions/:id/api-keys`

Creates a new API key for an institution with specified role assignment.

#### Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `id` | string | Path | Yes | Institution identifier |
| `label` | string | Body | No | Human-readable key identifier (default: "default") |
| `role` | ApiKeyRole | Body | No | Key permission level ("admin" or "read_only", default: "admin") |

#### Authorization Requirements

- **Root users**: Can create keys for any institution
- **Institution admins**: Can create keys for their own institution
- **Other users**: Forbidden access

#### Response Format

```json
{
  "id": "ak_abc123def456",
  "institutionId": "inst_789xyz",
  "label": "automated-client",
  "role": "admin",
  "createdAt": "2024-01-15T10:30:00Z",
  "apiKey": "ak_5f4dcc3b5aa765d61d8327deb882cf99"
}
```

#### Security Notes

- **Token Storage**: The `apiKey` field contains the plaintext token, returned only once during creation
- **Token Retrieval**: Tokens cannot be retrieved after creation for security reasons
- **Hash Storage**: Only SHA-256 hashes are stored in the database for security

**Section sources**
- [src/api/apiKeys.ts](file://src/api/apiKeys.ts#L15-L70)

### List API Keys Endpoint

**GET** `/institutions/:id/api-keys`

Retrieves all active API keys for a specified institution.

#### Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `id` | string | Path | Yes | Institution identifier |

#### Authorization Requirements

- **Root users**: Can list keys for any institution
- **Institution admins**: Can list keys for their own institution
- **Other users**: Forbidden access

#### Response Format

```json
[
  {
    "id": "ak_abc123def456",
    "institutionId": "inst_789xyz",
    "label": "production-client",
    "role": "admin",
    "createdAt": "2024-01-15T10:30:00Z",
    "revokedAt": null
  },
  {
    "id": "ak_xyz789uvw123",
    "institutionId": "inst_789xyz",
    "label": "read-only-monitor",
    "role": "read_only",
    "createdAt": "2024-01-16T14:20:00Z",
    "revokedAt": "2024-01-20T09:15:00Z"
  }
]
```

**Section sources**
- [src/api/apiKeys.ts](file://src/api/apiKeys.ts#L72-L108)

## Security Architecture

### Token Generation and Storage

The system implements robust security measures for API key management:

```mermaid
sequenceDiagram
participant Client as "Client Application"
participant API as "API Keys Endpoint"
participant Store as "API Key Store"
participant DB as "Database"
participant Logger as "Audit Logger"
Client->>API : POST /api-keys
API->>Store : generateToken()
Store->>Store : crypto.randomBytes(24)
Store-->>API : plaintext_token
API->>Store : hashToken(token)
Store-->>API : sha256_hash
API->>DB : INSERT hashed_token
API->>Logger : record(CREATED)
API-->>Client : {apiKey, metadata}
Note over Client,DB : Token never stored in plaintext
Client->>API : Subsequent Requests
API->>Store : findByToken(token)
Store->>DB : SELECT WHERE key_hash = ?
DB-->>Store : record
Store-->>API : ApiKeyRecord
API-->>Client : Authorized Request
```

**Diagram sources**
- [src/infra/apiKeyStore.ts](file://src/infra/apiKeyStore.ts#L33-L39)
- [src/api/apiKeys.ts](file://src/api/apiKeys.ts#L41-L58)

### Role-Based Access Control

The system enforces strict role-based permissions:

| Role | Permissions | Write Operations | Read Operations |
|------|-------------|------------------|-----------------|
| `admin` | Full access | ✓ All CRUD operations | ✓ All data access |
| `read_only` | Read-only access | ✗ Forbidden | ✓ All data access |
| `root` | Superuser access | ✓ All operations | ✓ All data access |

**Section sources**
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L84-L95)

## Data Models

### ApiKey Domain Model

```typescript
interface ApiKey {
  id: string;           // Unique identifier (ak_{random})
  institutionId: string; // Associated institution
  keyHash: string;      // SHA-256 hash of the token
  label: string;        // Human-readable identifier
  role: ApiKeyRole;     // Permission level
  createdAt: string;    // ISO timestamp
  revokedAt?: string;   // Revocation timestamp (nullable)
}
```

### ApiKeyRole Enum

```typescript
type ApiKeyRole = 'admin' | 'read_only';
```

### AuthContext Interface

```typescript
interface AuthContext {
  role: AuthRole;        // 'root' | ApiKeyRole
  institutionId?: string; // Associated institution
  apiKeyId?: string;     // Key identifier
}
```

**Section sources**
- [src/domain/types.ts](file://src/domain/types.ts#L70-L78)
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L8-L12)

## Integration Components

### apiKeyStore Implementation

The API key store provides a unified interface for both in-memory and PostgreSQL backends:

```mermaid
classDiagram
class ApiKeyStore {
<<interface>>
+createKey(params) CreatedApiKey
+findByToken(token) ApiKeyRecord
+listByInstitution(id) ApiKeyRecord[]
}
class InMemoryApiKeyStore {
-records Map~string, ApiKeyRecord~
-byHash Map~string, string~
+createKey(params) CreatedApiKey
+findByToken(token) ApiKeyRecord
+listByInstitution(id) ApiKeyRecord[]
}
class PostgresApiKeyStore {
-pool Pool
+createKey(params) CreatedApiKey
+findByToken(token) ApiKeyRecord
+listByInstitution(id) ApiKeyRecord[]
}
ApiKeyStore <|-- InMemoryApiKeyStore
ApiKeyStore <|-- PostgresApiKeyStore
```

**Diagram sources**
- [src/infra/apiKeyStore.ts](file://src/infra/apiKeyStore.ts#L13-L23)

### auditLogger Integration

Every API key operation is automatically logged for compliance and security monitoring:

```mermaid
sequenceDiagram
participant API as "API Endpoint"
participant Store as "API Key Store"
participant Logger as "Audit Logger"
participant DB as "Audit Events Table"
API->>Store : createKey()
Store-->>API : CreatedApiKey
API->>Logger : record(ACTION, payload)
Logger->>DB : INSERT audit_event
Logger-->>API : success
Note over API,DB : All actions logged with timestamps<br/>and contextual information
```

**Diagram sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L55-L96)

**Section sources**
- [src/infra/apiKeyStore.ts](file://src/infra/apiKeyStore.ts#L173-L184)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L100-L109)

## Security Best Practices

### Token Management

1. **Secure Storage**: Store API keys securely in environment variables or encrypted vaults
2. **Rotation Policies**: Implement regular key rotation schedules
3. **Least Privilege**: Assign minimal required permissions (prefer `read_only` when possible)
4. **Immediate Revocation**: Revoke compromised keys immediately

### Network Security

1. **HTTPS Only**: Always use HTTPS for API communications
2. **Token Transmission**: Use Authorization headers instead of URL parameters
3. **Rate Limiting**: Implement client-side rate limiting to prevent abuse
4. **CORS Configuration**: Configure appropriate CORS policies

### Operational Security

1. **Audit Logging**: Monitor all API key usage through audit logs
2. **Access Reviews**: Regularly review active API keys and their permissions
3. **Incident Response**: Have procedures for rapid key revocation in case of compromise
4. **Documentation**: Maintain clear documentation of key purposes and owners

## Usage Examples

### Creating an Administrative API Key

```bash
curl -X POST https://api.escrowgrid.io/institutions/inst_789xyz/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ROOT_OR_ADMIN_TOKEN" \
  -d '{
    "label": "production-service",
    "role": "admin"
  }'
```

Response:
```json
{
  "id": "ak_abc123def456",
  "institutionId": "inst_789xyz",
  "label": "production-service",
  "role": "admin",
  "createdAt": "2024-01-15T10:30:00Z",
  "apiKey": "ak_5f4dcc3b5aa765d61d8327deb882cf99"
}
```

### Creating a Read-Only Monitoring Key

```bash
curl -X POST https://api.escrowgrid.io/institutions/inst_789xyz/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ROOT_OR_ADMIN_TOKEN" \
  -d '{
    "label": "monitoring-service",
    "role": "read_only"
  }'
```

### Using API Key for Subsequent Requests

```bash
curl https://api.escrowgrid.io/institutions/inst_789xyz/api-keys \
  -H "Authorization: Bearer ak_5f4dcc3b5aa765d61d8327deb882cf99"
```

### Bootstrapping Institutional Access

For new institutional deployments:

1. **Create Root Key**: Generate initial administrative key
2. **Configure Services**: Deploy services with appropriate key roles
3. **Establish Rotation**: Implement automated key rotation
4. **Monitor Usage**: Set up alerting for unusual API activity

## Error Handling

### Common Error Responses

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 401 | Unauthenticated | Missing or invalid API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Institution not found |
| 500 | Internal Error | Server-side failure |

### Error Response Format

```json
{
  "error": "Forbidden to create API keys for this institution",
  "details": {
    "requestedInstitutionId": "inst_789xyz",
    "userRole": "admin",
    "userInstitutionId": "inst_123abc"
  }
}
```

**Section sources**
- [src/api/apiKeys.ts](file://src/api/apiKeys.ts#L21-L31)
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L65-L78)

## Monitoring and Auditing

### Audit Event Structure

All API key operations are logged with comprehensive metadata:

```json
{
  "id": "aud_abc123def456",
  "occurredAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-15T10:30:01Z",
  "apiKeyId": "ak_abc123def456",
  "institutionId": "inst_789xyz",
  "method": "POST",
  "path": "/institutions/inst_789xyz/api-keys",
  "action": "API_KEY_CREATED",
  "resourceType": "api_key",
  "resourceId": "ak_abc123def456",
  "payload": {
    "institutionId": "inst_789xyz",
    "label": "production-service",
    "role": "admin"
  }
}
```

### Monitoring Recommendations

1. **Real-time Alerts**: Monitor for unauthorized key creation attempts
2. **Usage Analytics**: Track key usage patterns and identify anomalies
3. **Compliance Reporting**: Generate reports for regulatory compliance
4. **Security Dashboards**: Visualize API key activity and trends

**Section sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L48-L96)