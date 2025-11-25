# Security & Authentication

<cite>
**Referenced Files in This Document**
- [auth.ts](file://src/middleware/auth.ts)
- [apiKeys.ts](file://src/api/apiKeys.ts)
- [apiKeyStore.ts](file://src/infra/apiKeyStore.ts)
- [config.ts](file://src/config.ts)
- [types.ts](file://src/domain/types.ts)
- [auditLogger.ts](file://src/infra/auditLogger.ts)
- [server.ts](file://src/server.ts)
- [rateLimit.ts](file://src/middleware/rateLimit.ts)
- [requestLogger.ts](file://src/middleware/requestLogger.ts)
- [audit.ts](file://src/domain/audit.ts)
- [postgresStore.ts](file://src/store/postgresStore.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication Architecture](#authentication-architecture)
3. [API Key System](#api-key-system)
4. [Role-Based Access Control](#role-based-access-control)
5. [Authentication Middleware](#authentication-middleware)
6. [API Key Lifecycle Management](#api-key-lifecycle-management)
7. [Security Features](#security-features)
8. [Audit and Monitoring](#audit-and-monitoring)
9. [Security Best Practices](#security-best-practices)
10. [Threat Model](#threat-model)
11. [Troubleshooting](#troubleshooting)

## Introduction

EscrowGrid implements a comprehensive security and authentication system designed for institutional use cases. The platform employs a multi-layered approach combining API key-based authentication, role-based access control, and robust security measures to protect sensitive financial data and ensure tenant isolation.

The authentication system supports two primary authentication methods:
- **Root API Keys**: Full administrative access for system administrators
- **Institutional API Keys**: Role-based access scoped to specific institutions

## Authentication Architecture

The authentication system follows a layered architecture with clear separation of concerns:

```mermaid
graph TB
subgraph "Client Layer"
Client[HTTP Client]
Headers[API Headers]
end
subgraph "Middleware Layer"
Auth[Auth Middleware]
RateLimit[Rate Limiting]
Logger[Request Logger]
end
subgraph "Authentication Layer"
TokenExtractor[Token Extractor]
RootAuth[Root Key Validation]
KeyStore[API Key Store]
RoleResolver[Role Resolution]
end
subgraph "Storage Layer"
MemoryStore[In-Memory Store]
PostgresStore[PostgreSQL Store]
AuditLog[Audit Logger]
end
Client --> Headers
Headers --> Auth
Auth --> RateLimit
RateLimit --> Logger
Logger --> TokenExtractor
TokenExtractor --> RootAuth
RootAuth --> KeyStore
KeyStore --> RoleResolver
RoleResolver --> MemoryStore
RoleResolver --> PostgresStore
RoleResolver --> AuditLog
```

**Diagram sources**
- [auth.ts](file://src/middleware/auth.ts#L35-L95)
- [apiKeyStore.ts](file://src/infra/apiKeyStore.ts#L13-L23)
- [server.ts](file://src/server.ts#L21-L24)

**Section sources**
- [auth.ts](file://src/middleware/auth.ts#L1-L95)
- [server.ts](file://src/server.ts#L19-L24)

## API Key System

### Key Generation and Storage

The API key system generates cryptographically secure tokens using industry-standard cryptographic practices:

```mermaid
flowchart TD
Start([Key Creation Request]) --> GenID[Generate Unique ID]
GenID --> GenToken[Generate Random Token<br/>ak_{24-byte-hex}]
GenToken --> HashToken[SHA-256 Hash Token]
HashToken --> StoreHash[Store Hashed Token]
StoreHash --> StoreMeta[Store Metadata]
StoreMeta --> ReturnToken[Return Plain Token]
ReturnToken --> Client[Client Receives Token]
Client --> StoreHash
StoreHash --> Verify[Verify During Auth]
Verify --> CompareHash[Compare Hashes]
CompareHash --> GrantAccess[Grant Access]
```

**Diagram sources**
- [apiKeyStore.ts](file://src/infra/apiKeyStore.ts#L33-L39)
- [apiKeyStore.ts](file://src/infra/apiKeyStore.ts#L41-L94)

### Token Format and Security

API tokens follow a specific format and security pattern:
- **Format**: `ak_{24-byte-hex-string}`
- **Generation**: Cryptographically secure random bytes (24 bytes = 48 hex characters)
- **Storage**: Only hashed tokens stored in database (SHA-256)
- **Comparison**: Secure constant-time comparison during authentication

**Section sources**
- [apiKeyStore.ts](file://src/infra/apiKeyStore.ts#L33-L39)
- [apiKeyStore.ts](file://src/infra/apiKeyStore.ts#L41-L94)

## Role-Based Access Control

### Available Roles

The system implements a hierarchical role-based access control (RBAC) model:

| Role | Permissions | Scope | Description |
|------|-------------|-------|-------------|
| `root` | Full system access | Global | System administrators with unrestricted access |
| `admin` | Full CRUD operations | Institution-scoped | Institutional administrators with full access to their institution |
| `read_only` | Read-only access | Institution-scoped | Limited access for monitoring and reporting |

### Role Validation Flow

```mermaid
sequenceDiagram
participant Client as HTTP Client
participant Auth as Auth Middleware
participant Store as API Key Store
participant Validator as Permission Validator
Client->>Auth : Request with API Key
Auth->>Auth : Extract Token
Auth->>Store : Validate Token
Store-->>Auth : Return Key Record
Auth->>Validator : Check Permissions
Validator->>Validator : Validate Role
Validator-->>Auth : Grant/Deny Access
Auth-->>Client : 200 OK / 403 Forbidden
```

**Diagram sources**
- [auth.ts](file://src/middleware/auth.ts#L35-L95)
- [apiKeys.ts](file://src/api/apiKeys.ts#L25-L30)

### Write Access Protection

The system includes explicit write access protection for read-only keys:

```mermaid
flowchart TD
Request[API Request] --> HasAuth{Has Auth Context?}
HasAuth --> |No| ThrowError[Throw Missing Auth Error]
HasAuth --> |Yes| CheckRole{Role == read_only?}
CheckRole --> |Yes| WriteError[Throw Write Forbidden Error<br/>Status: 403]
CheckRole --> |No| AllowAccess[Allow Access]
WriteError --> ErrorResponse[Return 403 Response]
ThrowError --> ErrorResponse
AllowAccess --> Continue[Continue Processing]
```

**Diagram sources**
- [auth.ts](file://src/middleware/auth.ts#L84-L95)

**Section sources**
- [auth.ts](file://src/middleware/auth.ts#L84-L95)
- [types.ts](file://src/domain/types.ts#L5)

## Authentication Middleware

### Token Extraction

The authentication middleware supports multiple token extraction methods:

| Header Type | Format | Priority |
|-------------|--------|----------|
| `x-api-key` | Plain API key | High |
| `Authorization` | Bearer token | Medium |
| Root API Key | Environment variable | Highest |

### Authentication Flow

```mermaid
sequenceDiagram
participant Request as Incoming Request
participant Auth as Auth Middleware
participant Config as Configuration
participant Store as API Key Store
participant Response as HTTP Response
Request->>Auth : Extract Token
Auth->>Auth : Check Path (Health checks)
Auth->>Config : Check Root API Key
Config-->>Auth : Root Key Value
Auth->>Auth : Compare with Root Key
alt Root Key Match
Auth->>Response : Set root role context
Auth-->>Request : Continue
else No Root Key or No Match
Auth->>Store : Find by Token Hash
Store-->>Auth : Key Record or Undefined
alt Valid Key Found
Auth->>Response : Set role context
Auth-->>Request : Continue
else Invalid Key
Auth->>Response : 401 Unauthorized
Auth-->>Request : Stop
end
end
```

**Diagram sources**
- [auth.ts](file://src/middleware/auth.ts#L35-L95)

### Health Check Bypass

The authentication middleware automatically bypasses authentication for essential health and documentation endpoints to ensure system monitoring and API discovery remain accessible.

**Section sources**
- [auth.ts](file://src/middleware/auth.ts#L35-L95)

## API Key Lifecycle Management

### Key Creation

API keys are created through a controlled process with institutional validation:

```mermaid
flowchart TD
CreateReq[Create API Key Request] --> ValidateAuth{Valid Auth Context?}
ValidateAuth --> |No| AuthError[401 Unauthenticated]
ValidateAuth --> |Yes| CheckPermissions{Has Permission?}
CheckPermissions --> |No| PermError[403 Forbidden]
CheckPermissions --> |Yes| ValidateInst{Institution Exists?}
ValidateInst --> |No| NotFound[404 Not Found]
ValidateInst --> |Yes| GenKey[Generate API Key]
GenKey --> StoreKey[Store in Database]
StoreKey --> LogAudit[Audit Log Entry]
LogAudit --> ReturnKey[Return Key + Token]
AuthError --> ErrorResponse[Error Response]
PermError --> ErrorResponse
NotFound --> ErrorResponse
ReturnKey --> Success[201 Created]
```

**Diagram sources**
- [apiKeys.ts](file://src/api/apiKeys.ts#L15-L68)

### Key Listing and Management

The system provides comprehensive key management capabilities:

| Operation | Endpoint | Permissions Required |
|-----------|----------|---------------------|
| List Keys | GET `/institutions/{id}/api-keys` | Same institution or root |
| Create Key | POST `/institutions/{id}/api-keys` | Same institution (admin) or root |
| Revoke Key | DELETE `/api-keys/{id}` | Same institution (admin) or root |

### Revocation Mechanism

API keys can be revoked by setting the `revokedAt` timestamp in the database. The system automatically filters out revoked keys during authentication.

**Section sources**
- [apiKeys.ts](file://src/api/apiKeys.ts#L15-L110)
- [apiKeyStore.ts](file://src/infra/apiKeyStore.ts#L125-L182)

## Security Features

### Rate Limiting

The system implements distributed rate limiting to prevent abuse:

```mermaid
flowchart TD
Request[Incoming Request] --> CheckEnabled{Rate Limiting Enabled?}
CheckEnabled --> |No| AllowRequest[Allow Request]
CheckEnabled --> |Yes| CheckHealth{Is Health Check?}
CheckHealth --> |Yes| AllowRequest
CheckHealth --> |No| GetAuth[Get Auth Context]
GetAuth --> CheckRoot{Is Root Key?}
CheckRoot --> |Yes| AllowRequest
CheckRoot --> |No| GetBucket[Get Rate Limit Bucket]
GetBucket --> CheckWindow{Within Window?}
CheckWindow --> |No| ResetBucket[Reset Bucket]
CheckWindow --> |Yes| CheckCount{Count < Max?}
CheckCount --> |Yes| IncrementCount[Increment Count]
CheckCount --> |No| RateLimitError[429 Too Many Requests]
ResetBucket --> AllowRequest
IncrementCount --> AllowRequest
RateLimitError --> ErrorResponse[Error Response]
AllowRequest --> Continue[Continue Processing]
```

**Diagram sources**
- [rateLimit.ts](file://src/middleware/rateLimit.ts#L12-L67)

### Configuration-Based Security

Security features are configurable through environment variables:

| Setting | Purpose | Default |
|---------|---------|---------|
| `RATE_LIMIT_ENABLED` | Enable/disable rate limiting | `false` |
| `RATE_LIMIT_WINDOW_MS` | Time window for rate limiting | `60000` (1 minute) |
| `RATE_LIMIT_MAX_REQUESTS` | Maximum requests per window | `1000` |
| `STORE_BACKEND` | Storage backend selection | `'memory'` |

**Section sources**
- [rateLimit.ts](file://src/middleware/rateLimit.ts#L12-L67)
- [config.ts](file://src/config.ts#L3-L16)

## Audit and Monitoring

### Audit Logging

The system maintains comprehensive audit trails for all security-relevant actions:

```mermaid
classDiagram
class AuditLogger {
+record(event : AuditEventInput) Promise~void~
}
class AuditEvent {
+string id
+string occurredAt
+string createdAt
+string apiKeyId?
+string institutionId?
+string method
+string path
+AuditAction action
+string resourceType?
+string resourceId?
+Record payload?
}
class AuditEventInput {
+AuditAction action
+string method
+string path
+string resourceType?
+string resourceId?
+Record payload?
+AuthContext auth?
+string occurredAt?
}
AuditLogger --> AuditEvent : creates
AuditLogger --> AuditEventInput : receives
AuditEvent --> AuthContext : references
```

**Diagram sources**
- [auditLogger.ts](file://src/infra/auditLogger.ts#L13-L109)
- [audit.ts](file://src/domain/audit.ts#L11-L36)

### Supported Audit Actions

The system logs the following security-relevant actions:

| Action | Description |
|--------|-------------|
| `API_KEY_CREATED` | New API key creation |
| `INSTITUTION_CREATED` | New institution creation |
| `ASSET_TEMPLATE_CREATED` | New asset template creation |
| `ASSET_CREATED` | New asset creation |
| `POSITION_CREATED` | New position creation |
| `POSITION_TRANSITIONED` | Position state changes |

### Request Logging

Every request is logged with detailed metadata for monitoring and debugging:

```mermaid
sequenceDiagram
participant Request as HTTP Request
participant Logger as Request Logger
participant Metrics as Metrics Collector
participant Console as Console Output
Request->>Logger : Start Timer
Logger->>Logger : Capture Request Details
Request->>Logger : Response Complete
Logger->>Logger : Calculate Duration
Logger->>Console : Log Request Event
Logger->>Metrics : Record Metrics
```

**Diagram sources**
- [requestLogger.ts](file://src/middleware/requestLogger.ts#L5-L29)

**Section sources**
- [auditLogger.ts](file://src/infra/auditLogger.ts#L1-L109)
- [audit.ts](file://src/domain/audit.ts#L1-L36)
- [requestLogger.ts](file://src/middleware/requestLogger.ts#L1-L29)

## Security Best Practices

### Key Management

1. **Secure Storage**: API keys are stored as SHA-256 hashes only, never in plaintext
2. **Rotation**: Regular key rotation is recommended for enhanced security
3. **Revocation**: Immediate revocation of compromised keys
4. **Environment Variables**: All secrets should be managed through environment variables or dedicated secret management systems

### Network Security

1. **TLS Only**: All communications should occur over HTTPS/TLS
2. **IP Restrictions**: Deployments should implement IP-based access controls
3. **WAF Integration**: Web Application Firewalls should be deployed at the network boundary

### Operational Security

1. **Principle of Least Privilege**: Use read-only keys when possible
2. **Monitoring**: Implement comprehensive monitoring and alerting
3. **Incident Response**: Establish procedures for key compromise scenarios

**Section sources**
- [config.ts](file://src/config.ts#L1-L47)

## Threat Model

### Protected Assets

The system protects several critical assets:

| Asset Category | Examples | Protection Level |
|----------------|----------|------------------|
| **API Keys** | Root keys, institutional keys | Cryptographic hashing, secure storage |
| **Database Content** | Positions, ledger events, audit trails | Role-based access control |
| **On-chain Private Key** | When enabled | Environment variable storage |

### Primary Threats and Mitigations

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| **API Key Theft** | High | Critical | Strong random keys, TLS-only transport |
| **Brute Force Attacks** | Medium | High | Rate limiting, key complexity |
| **Abuse via Valid Keys** | Medium | Medium | Per-key rate limiting |
| **Data Exfiltration** | Low | Critical | Role-based access, audit logging |

### Trust Boundaries

```mermaid
graph LR
subgraph "External Clients"
ExtClients[External Applications]
end
subgraph "Network Boundary"
TLS[TLS Termination]
WAF[Web Application Firewall]
end
subgraph "Application Layer"
API[TAAS HTTP API]
Auth[Authentication Service]
DB[(PostgreSQL Database)]
end
subgraph "Blockchain Layer"
Chain[On-chain Node]
end
ExtClients --> TLS
TLS --> WAF
WAF --> API
API --> Auth
Auth --> DB
API --> Chain
```

**Section sources**
- [product.md](file://product.md#L63-L85)

## Troubleshooting

### Common Authentication Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Missing API key` | No token provided | Include `x-api-key` or `Authorization: Bearer` header |
| `401 Invalid API key` | Token not found or revoked | Verify key validity and check revocation status |
| `403 Write access forbidden` | Using read-only key for write operation | Use admin key or remove write operation |
| `403 Forbidden` | Insufficient permissions | Verify institutional ownership or root access |

### Debugging Authentication

1. **Check Token Format**: Ensure tokens follow `ak_{hex}` format
2. **Verify Role**: Confirm the key has appropriate role permissions
3. **Review Logs**: Check audit logs for authentication attempts
4. **Test Connectivity**: Verify database connectivity for key validation

### Performance Considerations

1. **Key Lookup Performance**: API key validation involves database lookups
2. **Rate Limiting**: Monitor rate limit bucket growth for potential abuse
3. **Audit Logging**: Production deployments should use PostgreSQL for audit logging

**Section sources**
- [auth.ts](file://src/middleware/auth.ts#L52-L95)
- [apiKeyStore.ts](file://src/infra/apiKeyStore.ts#L125-L182)