# Security & Transaction Safety

<cite>
**Referenced Files in This Document**
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts)
- [src/config.ts](file://src/config.ts)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts)
- [src/middleware/auth.ts](file://src/middleware/auth.ts)
- [src/middleware/rateLimit.ts](file://src/middleware/rateLimit.ts)
- [src/middleware/requestLogger.ts](file://src/middleware/requestLogger.ts)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
- [docker-compose.yml](file://docker-compose.yml)
- [Dockerfile](file://Dockerfile)
- [README.md](file://README.md)
- [product.md](file://product.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Private Key Management](#private-key-management)
3. [Secure Transaction Signing](#secure-transaction-signing)
4. [Validation and Checks](#validation-and-checks)
5. [Logging and Auditability](#logging-and-auditability)
6. [Deployment Security](#deployment-security)
7. [Monitoring and Detection](#monitoring-and-detection)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Introduction

EscrowGrid implements a comprehensive security framework designed to protect financial transactions and sensitive data in a decentralized finance (DeFi) environment. The system employs multiple layers of security controls, from API authentication to on-chain transaction safety, ensuring institutional-grade protection for tokenized asset management.

The security architecture follows defense-in-depth principles, combining cryptographic security, access controls, rate limiting, comprehensive logging, and operational monitoring to create a robust foundation for financial operations.

## Private Key Management

### Environment Variable Configuration

EscrowGrid handles private key management through secure environment variable configuration, eliminating the risk of hard-coded credentials in source code.

```mermaid
flowchart TD
A["Environment Variables"] --> B["Config Validation"]
B --> C{"All Required Keys Present?"}
C --> |No| D["Throw Configuration Error"]
C --> |Yes| E["Initialize Wallet"]
E --> F["Create JsonRpcProvider"]
F --> G["Bind Wallet to Provider"]
G --> H["Deploy Contract Instance"]
I["Security Risks"] --> J["Hardcoded Credentials"]
I --> K["Source Control Exposure"]
I --> L["Development/Prod Mixing"]
M["Mitigation Strategies"] --> N["Environment Isolation"]
M --> O["Secret Management Services"]
M --> P["Key Rotation Policies"]
```

**Diagram sources**
- [src/config.ts](file://src/config.ts#L18-L33)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L16-L22)

The system requires four critical environment variables for on-chain operations:

| Variable | Purpose | Security Level | Risk Mitigation |
|----------|---------|----------------|-----------------|
| `ONCHAIN_RPC_URL` | Blockchain node endpoint | Public | Use HTTPS/TLS, CDN distribution |
| `ONCHAIN_PRIVATE_KEY` | Signing authority | Secret | Environment-only, rotation |
| `ONCHAIN_CONTRACT_ADDRESS` | Target smart contract | Public | Verified on-chain |
| `ONCHAIN_CHAIN_ID` | Network identifier | Public | Prevents cross-chain attacks |

**Section sources**
- [src/config.ts](file://src/config.ts#L28-L33)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L16-L22)

### Key Exposure Risks

**Critical Security Concerns:**
- **Hardcoded Credentials**: Never commit private keys to version control
- **Development/Production Mixing**: Separate environments prevent accidental exposure
- **Source Code Disclosure**: Environment variables prevent credential leakage
- **Accidental Logging**: No hardcoded keys in logs or error messages

**Recommended Protection Measures:**
- Use dedicated secret management systems (HashiCorp Vault, AWS Secrets Manager)
- Implement automatic key rotation policies
- Enforce strict access controls on environment variables
- Monitor for unauthorized access attempts

## Secure Transaction Signing

### Ethers.js Wallet Implementation

EscrowGrid utilizes the Ethers.js library for secure transaction signing, leveraging industry-standard cryptographic protocols.

```mermaid
sequenceDiagram
participant Client as "API Client"
participant Middleware as "Auth Middleware"
participant Ledger as "OnchainLedger"
participant Provider as "JsonRpcProvider"
participant Wallet as "Ethers Wallet"
participant Chain as "Blockchain"
Client->>Middleware : API Request with Auth
Middleware->>Ledger : recordPositionCreated()
Ledger->>Wallet : Initialize with Private Key
Wallet->>Provider : Connect to RPC Endpoint
Ledger->>Wallet : Sign Transaction
Wallet->>Chain : Submit Signed Transaction
Chain-->>Wallet : Transaction Receipt
Wallet-->>Ledger : Transaction Hash
Ledger-->>Client : Success Response
Note over Wallet,Chain : Cryptographic signing ensures authenticity
Note over Provider : Secure RPC communication
```

**Diagram sources**
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L16-L22)

### Transaction Security Features

**Cryptographic Security:**
- ECDSA signatures using secp256k1 curve
- Deterministic nonce generation
- Replay attack prevention through chain ID verification
- Gas limit and gas price optimization

**Implementation Details:**
- Private key never leaves memory during signing
- Hardware wallet support through custom provider interfaces
- Transaction simulation before submission
- Automatic retry mechanisms with exponential backoff

**Section sources**
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L16-L22)

## Validation and Checks

### Pre-Transaction Validation

EscrowGrid implements comprehensive validation before any on-chain transaction is attempted, preventing invalid operations and reducing network congestion.

```mermaid
flowchart TD
A["Position Event Triggered"] --> B["Asset Existence Check"]
B --> C{"Asset Found?"}
C --> |No| D["Log Skip Reason<br/>Asset Not Found"]
C --> |Yes| E["Template Existence Check"]
E --> F{"Template Found?"}
F --> |No| G["Log Skip Reason<br/>Template Not Found"]
F --> |Yes| H["On-chain Enabled Check"]
H --> I{"On-chain Enabled?"}
I --> |No| J["Log Skip Reason<br/>Disabled for Template"]
I --> |Yes| K["Chain ID Verification"]
K --> L{"Chain ID Match?"}
L --> |No| M["Log Skip Reason<br/>Chain ID Mismatch"]
L --> |Yes| N["Execute Transaction"]
D --> O["Continue Processing"]
G --> O
J --> O
M --> O
N --> P["Log Transaction Hash"]
P --> Q["Success"]
```

**Diagram sources**
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L25-L82)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L121-L181)

### Validation Layers

**Asset and Template Validation:**
- Asset existence verification in database
- Template configuration validation
- Institution ownership verification
- Regional compliance checking

**Technical Validation:**
- Smart contract method availability
- ABI compatibility verification
- Gas estimation and limits
- Nonce management and ordering

**Business Logic Validation:**
- Position state transitions
- Amount and currency restrictions
- Geographic compliance
- Policy enforcement

**Section sources**
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L25-L82)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L121-L181)

## Logging and Auditability

### Comprehensive Logging Architecture

EscrowGrid implements structured logging for all security-relevant operations, enabling comprehensive audit trails and incident investigation.

```mermaid
classDiagram
class AuditLogger {
+record(event : AuditEventInput) Promise~void~
}
class InMemoryAuditLogger {
-events : AuditEvent[]
+record(event : AuditEventInput) Promise~void~
}
class PostgresAuditLogger {
-pool : Pool
+constructor()
+record(event : AuditEventInput) Promise~void~
}
class OnchainLogger {
+logTransaction(txHash : string) void
+logError(operation : string, error : string) void
+logSkip(reason : string, context : object) void
}
class RequestLogger {
+logRequest(method : string, path : string, status : number) void
+logDuration(durationMs : number) void
}
AuditLogger <|-- InMemoryAuditLogger
AuditLogger <|-- PostgresAuditLogger
OnchainLogger --> Console : "emits structured logs"
RequestLogger --> Console : "emits structured logs"
```

**Diagram sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L13-L108)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L101-L118)

### Log Categories and Structure

**Audit Events:**
```typescript
// Structured audit log format
{
  type: 'audit',
  id: string,
  occurredAt: string,
  createdAt: string,
  apiKeyId: string | null,
  institutionId: string | null,
  method: string,
  path: string,
  action: string,
  resourceType: string | null,
  resourceId: string | null,
  payload: object | null
}
```

**On-chain Transaction Logs:**
```typescript
// Successful transaction log
{
  type: 'onchain_ledger',
  kind: 'POSITION_CREATED' | 'POSITION_STATE_CHANGED',
  positionId: string,
  txHash: string
}

// Error transaction log
{
  type: 'onchain_ledger_error',
  operation: string,
  positionId: string,
  error: string
}

// Skip transaction log
{
  type: 'onchain_ledger_skip',
  reason: string,
  positionId: string,
  context: object
}
```

**Request Metrics:**
```typescript
// Request logging format
{
  type: 'request',
  method: string,
  path: string,
  status: number,
  durationMs: number,
  apiKeyId: string | null,
  institutionId: string | null
}
```

**Section sources**
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L13-L108)
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L101-L118)
- [src/middleware/requestLogger.ts](file://src/middleware/requestLogger.ts#L13-L22)

## Deployment Security

### Container Security

EscrowGrid employs multi-stage Docker builds and security best practices for production deployments.

```mermaid
flowchart LR
A["Development"] --> B["Multi-stage Build"]
B --> C["Builder Stage"]
B --> D["Runner Stage"]
C --> E["Install Dependencies"]
C --> F["Build Application"]
C --> G["Copy Artifacts"]
D --> H["Minimal Runtime"]
D --> I["Security Updates"]
D --> J["Non-root User"]
K["Security Hardening"] --> L["Environment Isolation"]
K --> M["Network Policies"]
K --> N["Resource Limits"]
K --> O["Health Checks"]
```

**Diagram sources**
- [Dockerfile](file://Dockerfile#L1-L27)
- [docker-compose.yml](file://docker-compose.yml#L23-L46)

### Production Configuration

**Environment Security:**
- Immutable container images with minimal attack surface
- Non-root user execution for application processes
- Readonly filesystems for application directories
- Environment variable injection only

**Infrastructure Security:**
- TLS termination at reverse proxy or CDN level
- Network segmentation between services
- Resource quotas and limits
- Health check endpoints for monitoring

**Secret Management:**
- External secret management integration
- Automatic key rotation support
- Audit logging for secret access
- Principle of least privilege

**Section sources**
- [Dockerfile](file://Dockerfile#L1-L27)
- [docker-compose.yml](file://docker-compose.yml#L23-L46)

## Monitoring and Detection

### Rate Limiting and Abuse Prevention

EscrowGrid implements sophisticated rate limiting to prevent abuse while maintaining system availability.

```mermaid
sequenceDiagram
participant Client as "Client Request"
participant Middleware as "Rate Limit Middleware"
participant Bucket as "Rate Bucket"
participant Response as "API Response"
Client->>Middleware : API Request
Middleware->>Bucket : Check Request Count
Bucket-->>Middleware : Current Window Stats
alt Within Rate Limit
Middleware->>Bucket : Increment Counter
Middleware->>Response : Allow Request
Client->>Response : Process Request
else Rate Limit Exceeded
Middleware->>Response : 429 Too Many Requests
Note over Response : Retry-After Header
end
```

**Diagram sources**
- [src/middleware/rateLimit.ts](file://src/middleware/rateLimit.ts#L12-L64)

### Security Monitoring Signals

**Key Metrics for Monitoring:**
- Request rate by API key and institution
- Transaction failure rates
- Authentication failures
- Rate limit violations
- Unusual geographic patterns
- Abnormal request patterns

**Alerting Thresholds:**
- API key authentication failures > 5 per minute
- Rate limit bypass attempts
- High-frequency position updates
- Multiple failed transaction submissions
- Geographic anomalies in request patterns

**Section sources**
- [src/middleware/rateLimit.ts](file://src/middleware/rateLimit.ts#L12-L64)
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L35-L81)

## Best Practices

### Secure Configuration Guidelines

**Environment Setup:**
```bash
# Production environment variables
export NODE_ENV=production
export STORE_BACKEND=postgres
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export ROOT_API_KEY="$(generate_secure_random_key)"
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_WINDOW_MS=60000
export RATE_LIMIT_MAX_REQUESTS=1000

# On-chain configuration (when enabled)
export ONCHAIN_LEDGER_ENABLED=true
export ONCHAIN_RPC_URL="https://rpc.example.com"
export ONCHAIN_PRIVATE_KEY="$(vault kv get -field=private_key secret/onchain)"
export ONCHAIN_CONTRACT_ADDRESS="0x..."
export ONCHAIN_CHAIN_ID=1
```

### Key Management Best Practices

**Private Key Security:**
- Use hardware security modules (HSM) for production
- Implement multi-signature requirements
- Regular key rotation schedules
- Separate keys for different environments
- Audit access to private keys

**API Key Management:**
- Generate cryptographically secure keys
- Implement key revocation mechanisms
- Monitor key usage patterns
- Rotate keys quarterly for production
- Use hierarchical key structures

### Operational Security

**Deployment Security:**
- Infrastructure as code with security reviews
- Automated security testing in CI/CD
- Regular penetration testing
- Incident response procedures
- Backup and disaster recovery plans

**Data Protection:**
- Encrypt data at rest and in transit
- Implement data retention policies
- Regular security assessments
- Compliance monitoring
- Privacy impact assessments

## Troubleshooting

### Common Security Issues

**Authentication Problems:**
- Verify API key format and validity
- Check authentication middleware configuration
- Review rate limiting settings
- Confirm environment variable setup

**Transaction Failures:**
- Validate blockchain connectivity
- Check private key permissions
- Verify contract address and ABI
- Review gas limits and prices
- Monitor for nonce conflicts

**Performance Issues:**
- Analyze rate limiting thresholds
- Review request patterns
- Check database connection pools
- Monitor memory usage
- Investigate network latency

### Diagnostic Commands

**Health Checks:**
```bash
# Basic service health
curl http://localhost:4000/health

# Database connectivity
curl http://localhost:4000/ready

# Metrics endpoint (root only)
curl -H "X-API-KEY: $ROOT_API_KEY" http://localhost:4000/metrics
```

**Log Analysis:**
```bash
# On-chain transaction logs
grep '"type":"onchain_ledger"' /var/log/app/*.log

# Authentication failures
grep '"type":"audit".*"action":"auth_failure"' /var/log/app/*.log

# Rate limiting events
grep '"type":"request".*"status":429' /var/log/app/*.log
```

**Section sources**
- [src/infra/onchainLedger.ts](file://src/infra/onchainLedger.ts#L101-L118)
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L35-L81)