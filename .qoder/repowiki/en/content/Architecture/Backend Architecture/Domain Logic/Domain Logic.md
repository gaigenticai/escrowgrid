# Domain Logic

<cite>
**Referenced Files in This Document**
- [types.ts](file://src/domain/types.ts)
- [lifecycle.ts](file://src/domain/lifecycle.ts)
- [policy.ts](file://src/domain/policy.ts)
- [audit.ts](file://src/domain/audit.ts)
- [verticals.ts](file://src/domain/verticals.ts)
- [ledger.ts](file://src/domain/ledger.ts)
- [positions.ts](file://src/api/positions.ts)
- [policies.ts](file://src/api/policies.ts)
- [auditLogger.ts](file://src/infra/auditLogger.ts)
- [policyStore.ts](file://src/infra/policyStore.ts)
- [ledgerClient.ts](file://src/infra/ledgerClient.ts)
- [store.ts](file://src/store/store.ts)
- [auth.ts](file://src/middleware/auth.ts)
- [config.ts](file://src/config.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Core Domain Models](#core-domain-models)
3. [Position Lifecycle Management](#position-lifecycle-management)
4. [Policy Enforcement System](#policy-enforcement-system)
5. [Audit Logging Framework](#audit-logging-framework)
6. [Vertical and Region Constraints](#vertical-and-region-constraints)
7. [Infrastructure Integration](#infrastructure-integration)
8. [Common Issues and Error Handling](#common-issues-and-error-handling)
9. [Performance Considerations](#performance-considerations)
10. [Event Sourcing Implementation](#event-sourcing-implementation)

## Introduction

The escrowgrid domain logic layer implements a sophisticated financial escrow system with strict business rules, comprehensive audit trails, and multi-tenant governance. The domain layer defines core business concepts including positions, assets, institutions, and their relationships while enforcing complex state transitions, policy compliance, and regulatory constraints.

The system operates on a multi-vertical architecture supporting construction escrow and trade finance applications, with region-specific compliance requirements and institutional governance policies. All business logic is encapsulated within the domain layer, ensuring clean separation from infrastructure concerns.

## Core Domain Models

### Position Model

The Position model represents the central business entity in the escrow system, tracking funds held in escrow with complete lifecycle state management.

```mermaid
classDiagram
class Position {
+string id
+string institutionId
+string assetId
+string holderReference
+string currency
+number amount
+PositionState state
+string externalReference
+string createdAt
+string updatedAt
+PositionLifecycleEvent[] events
+getCurrentState() PositionState
+hasPendingTransitions() boolean
+getTotalReleasedAmount() number
}
class PositionState {
<<enumeration>>
CREATED
FUNDED
PARTIALLY_RELEASED
RELEASED
CANCELLED
EXPIRED
}
class PositionLifecycleEvent {
+string id
+string positionId
+PositionState fromState
+PositionState toState
+string reason
+string at
+Record metadata
}
Position --> PositionState : "has current state"
Position --> PositionLifecycleEvent : "tracks history"
```

**Diagram sources**
- [types.ts](file://src/domain/types.ts#L38-L68)

### Asset and Institution Models

The system supports hierarchical asset management with template-based configuration and multi-tenant institutional governance.

```mermaid
classDiagram
class Institution {
+string id
+string name
+Region[] regions
+Vertical[] verticals
+string createdAt
+string updatedAt
+canOperateInRegion(region) boolean
+supportsVertical(vertical) boolean
}
class AssetTemplate {
+string id
+string institutionId
+string code
+string name
+Vertical vertical
+Region region
+Record config
+string createdAt
+string updatedAt
+validateConfiguration(config) void
}
class Asset {
+string id
+string institutionId
+string templateId
+string label
+Record metadata
+string createdAt
+string updatedAt
+getConfiguration() Record
+isValidForPosition(position) boolean
}
Institution --> AssetTemplate : "owns"
AssetTemplate --> Asset : "generates"
Asset --> Position : "backed by"
```

**Diagram sources**
- [types.ts](file://src/domain/types.ts#L7-L68)

**Section sources**
- [types.ts](file://src/domain/types.ts#L1-L85)

## Position Lifecycle Management

### State Transition Engine

The position lifecycle management implements a finite state machine with predefined allowed transitions and comprehensive validation.

```mermaid
stateDiagram-v2
[*] --> CREATED : "Initial creation"
CREATED --> FUNDED : "Funds deposited"
CREATED --> CANCELLED : "Administrative cancel"
CREATED --> EXPIRED : "Time-based expiry"
FUNDED --> PARTIALLY_RELEASED : "Partial release"
FUNDED --> RELEASED : "Full release"
FUNDED --> CANCELLED : "Administrative cancel"
FUNDED --> EXPIRED : "Time-based expiry"
PARTIALLY_RELEASED --> PARTIALLY_RELEASED : "Additional partial releases"
PARTIALLY_RELEASED --> RELEASED : "Final release"
PARTIALLY_RELEASED --> CANCELLED : "Administrative cancel"
PARTIALLY_RELEASED --> EXPIRED : "Time-based expiry"
RELEASED --> [*] : "Terminal state"
CANCELLED --> [*] : "Terminal state"
EXPIRED --> [*] : "Terminal state"
note right of CREATED : "Initial state<br/>No funds yet"
note right of FUNDED : "Funds received<br/>Ready for releases"
note right of PARTIALLY_RELEASED : "Multiple releases<br/>Remaining balance"
note right of RELEASED : "Complete fulfillment<br/>System termination"
```

**Diagram sources**
- [lifecycle.ts](file://src/domain/lifecycle.ts#L3-L10)

### Transition Validation Logic

The transition engine enforces business rules and prevents invalid state changes through comprehensive validation.

```mermaid
flowchart TD
Start([Transition Request]) --> ValidateFrom["Validate Current State"]
ValidateFrom --> CheckAllowed{"Is Transition<br/>Allowed?"}
CheckAllowed --> |No| ThrowError["Throw Invalid Transition Error"]
CheckAllowed --> |Yes| CreateEvent["Create Lifecycle Event"]
CreateEvent --> UpdatePosition["Update Position State"]
UpdatePosition --> AddToHistory["Add to Events History"]
AddToHistory --> ReturnUpdated["Return Updated Position"]
ThrowError --> End([End])
ReturnUpdated --> End
```

**Diagram sources**
- [lifecycle.ts](file://src/domain/lifecycle.ts#L12-L51)

### Real-world Transition Examples

The system handles various real-world scenarios through its state transition engine:

**Example 1: Standard Escrow Release Workflow**
- Position starts in `CREATED` state
- Funds deposited → transitions to `FUNDED`
- Partial release for milestone completion → transitions to `PARTIALLY_RELEASED`
- Final milestone → transitions to `RELEASED`

**Example 2: Administrative Cancellation**
- Position in `FUNDED` state
- Administrative error discovered → transitions to `CANCELLED`
- Refund process initiated through separate system

**Example 3: Expiration Handling**
- Position in `CREATED` state exceeding timeout
- Automatic transition to `EXPIRED`
- Funds returned to original account

**Section sources**
- [lifecycle.ts](file://src/domain/lifecycle.ts#L1-L51)
- [positions.ts](file://src/api/positions.ts#L220-L298)

## Policy Enforcement System

### Institutional Policy Architecture

The policy system implements region-specific and vertical-specific governance rules with configurable limits and restrictions.

```mermaid
classDiagram
class InstitutionPolicy {
+string id
+string institutionId
+Region region
+InstitutionPolicyConfig config
+string createdAt
+string updatedAt
+enforcePolicy(position) boolean
}
class InstitutionPolicyConfig {
+Region region
+PositionPolicyConfig position
}
class PositionPolicyConfig {
+number minAmount
+number maxAmount
+string[] allowedCurrencies
}
InstitutionPolicy --> InstitutionPolicyConfig : "contains"
InstitutionPolicyConfig --> PositionPolicyConfig : "defines"
```

**Diagram sources**
- [policy.ts](file://src/domain/policy.ts#L3-L22)

### Policy Evaluation Process

```mermaid
sequenceDiagram
participant Client as "API Client"
participant API as "Positions API"
participant Policy as "Policy Store"
participant Validator as "Policy Validator"
participant Store as "Position Store"
Client->>API : POST /positions
API->>API : Extract position data
API->>Store : Get asset and template
API->>Policy : Get policy for region
Policy-->>API : Return policy config
API->>Validator : Validate against policy
Validator->>Validator : Check min/max amounts
Validator->>Validator : Verify allowed currencies
Validator-->>API : Policy validation result
API->>Store : Create position if valid
Store-->>API : Created position
API-->>Client : Return position
```

**Diagram sources**
- [positions.ts](file://src/api/positions.ts#L75-L118)
- [policyStore.ts](file://src/infra/policyStore.ts#L14-L24)

### Regional Compliance Matrix

| Region | Supported Verticals | Currency Restrictions | Amount Limits |
|--------|-------------------|---------------------|---------------|
| US | CONSTRUCTION, TRADE_FINANCE | USD, EUR, GBP | Min: $1k, Max: $10M |
| EU_UK | CONSTRUCTION, TRADE_FINANCE | EUR, GBP, USD | Min: €1k, Max: €5M |
| SG | TRADE_FINANCE | SGD, USD, EUR | Min: S$1k, Max: S$50M |
| UAE | TRADE_FINANCE | AED, USD, EUR | Min: AED10k, Max: AED500M |

**Section sources**
- [policy.ts](file://src/domain/policy.ts#L1-L23)
- [policies.ts](file://src/api/policies.ts#L1-L180)
- [policyStore.ts](file://src/infra/policyStore.ts#L1-L133)

## Audit Logging Framework

### Audit Event Architecture

The audit system provides comprehensive tracking of all system activities with structured event logging and compliance reporting capabilities.

```mermaid
classDiagram
class AuditEvent {
+string id
+string occurredAt
+string createdAt
+string apiKeyId
+string institutionId
+string method
+string path
+AuditAction action
+string resourceType
+string resourceId
+Record payload
}
class AuditAction {
<<enumeration>>
INSTITUTION_CREATED
API_KEY_CREATED
ASSET_TEMPLATE_CREATED
ASSET_CREATED
POSITION_CREATED
POSITION_TRANSITIONED
}
class AuditLogger {
<<interface>>
+record(event : AuditEventInput) Promise~void~
}
AuditLogger --> AuditEvent : "produces"
AuditEvent --> AuditAction : "has type"
```

**Diagram sources**
- [audit.ts](file://src/domain/audit.ts#L3-L36)

### Audit Event Types and Triggers

The system automatically generates audit events for all significant operations:

**Position Lifecycle Events**
- `POSITION_CREATED`: New position establishment
- `POSITION_TRANSITIONED`: State changes during lifecycle
- `POSITION_UPDATED`: Metadata modifications

**Institution Management Events**
- `INSTITUTION_CREATED`: New institution registration
- `API_KEY_CREATED`: Authentication credential issuance

**Asset Management Events**
- `ASSET_TEMPLATE_CREATED`: Template definition
- `ASSET_CREATED`: Asset instantiation from templates

### Audit Storage Backends

```mermaid
classDiagram
class AuditLogger {
<<interface>>
+record(event : AuditEventInput) Promise~void~
}
class InMemoryAuditLogger {
-events : AuditEvent[]
+record(event : AuditEventInput) Promise~void~
}
class PostgresAuditLogger {
-pool : Pool
+record(event : AuditEventInput) Promise~void~
}
AuditLogger <|-- InMemoryAuditLogger
AuditLogger <|-- PostgresAuditLogger
```

**Diagram sources**
- [auditLogger.ts](file://src/infra/auditLogger.ts#L13-L109)

**Section sources**
- [audit.ts](file://src/domain/audit.ts#L1-L36)
- [auditLogger.ts](file://src/infra/auditLogger.ts#L1-L109)
- [positions.ts](file://src/api/positions.ts#L128-L144)

## Vertical and Region Constraints

### Construction Vertical Specifications

The construction vertical supports specialized escrow configurations for construction projects and retainage arrangements.

```mermaid
classDiagram
class ConstructionEscrowConfig {
+string currency
+Region region
+number minAmount
+number maxAmount
+validate() void
}
class ConstructionRetainageConfig {
+string currency
+number retainagePercentage
+validate() void
}
class ConstructionTemplateCode {
<<enumeration>>
CONSTR_ESCROW
CONSTR_RETAINAGE
}
ConstructionTemplateCode --> ConstructionEscrowConfig : "validates"
ConstructionTemplateCode --> ConstructionRetainageConfig : "validates"
```

**Diagram sources**
- [verticals.ts](file://src/domain/verticals.ts#L3-L19)

### Trade Finance Vertical Specifications

The trade finance vertical handles invoice financing and letter of credit operations with international banking compliance.

```mermaid
classDiagram
class TradeFinanceInvoiceConfig {
+string currency
+number maxTenorDays
+string country
+validate() void
}
class TradeFinanceLcConfig {
+string currency
+string issuingBankCountry
+number maxTenorDays
+validate() void
}
class TradeFinanceTemplateCode {
<<enumeration>>
TF_INVOICE
TF_LC
}
TradeFinanceTemplateCode --> TradeFinanceInvoiceConfig : "validates"
TradeFinanceTemplateCode --> TradeFinanceLcConfig : "validates"
```

**Diagram sources**
- [verticals.ts](file://src/domain/verticals.ts#L20-L31)

### Template Validation Framework

```mermaid
flowchart TD
Start([Template Validation]) --> CheckVertical{"Vertical Type?"}
CheckVertical --> |CONSTRUCTION| ValidateConstruction["Validate Construction Config"]
CheckVertical --> |TRADE_FINANCE| ValidateTradeFinance["Validate Trade Finance Config"]
ValidateConstruction --> CheckEscrow{"Template Code?"}
CheckEscrow --> |CONSTR_ESCROW| ValidateEscrowConfig["Validate Currency, Region, Amounts"]
CheckEscrow --> |CONSTR_RETAINAGE| ValidateRetainageConfig["Validate Percentage Range"]
ValidateTradeFinance --> CheckInvoice{"Template Code?"}
CheckInvoice --> |TF_INVOICE| ValidateInvoiceConfig["Validate Tenor, Country"]
CheckInvoice --> |TF_LC| ValidateLcConfig["Validate Issuing Bank, Tenor"]
ValidateEscrowConfig --> Success([Validation Success])
ValidateRetainageConfig --> Success
ValidateInvoiceConfig --> Success
ValidateLcConfig --> Success
ValidateEscrowConfig --> Error([Validation Error])
ValidateRetainageConfig --> Error
ValidateInvoiceConfig --> Error
ValidateLcConfig --> Error
```

**Diagram sources**
- [verticals.ts](file://src/domain/verticals.ts#L32-L125)

**Section sources**
- [verticals.ts](file://src/domain/verticals.ts#L1-L125)

## Infrastructure Integration

### Domain-Infrastructure Layer Communication

The domain logic integrates seamlessly with infrastructure services through well-defined interfaces and dependency injection patterns.

```mermaid
graph TB
subgraph "Domain Layer"
DT[Domain Types]
DL[Lifecycle Manager]
DP[Policy Engine]
DA[Audit Framework]
DE[Ledger Interface]
end
subgraph "API Layer"
PA[Positions API]
PC[Policies API]
AA[Audit API]
end
subgraph "Infrastructure Layer"
PS[Policy Store]
AL[Audit Logger]
LC[Ledger Client]
ST[Storage Backend]
end
PA --> DL
PA --> DP
PA --> AL
PA --> LC
PC --> PS
AA --> AL
DL --> ST
DP --> PS
AL --> ST
LC --> ST
```

**Diagram sources**
- [positions.ts](file://src/api/positions.ts#L1-L10)
- [policies.ts](file://src/api/policies.ts#L1-L5)
- [auditLogger.ts](file://src/infra/auditLogger.ts#L1-L10)

### Store Abstraction Pattern

The system uses a store abstraction to support multiple persistence backends while maintaining domain logic independence.

```mermaid
classDiagram
class Store {
<<interface>>
+createPosition(input) Promise~Position~
+getPosition(id) Promise~Position~
+updatePosition(position, event) Promise~Position~
+listPositions(params) Promise~Position[]~
}
class MemoryStore {
-positions : Map
+createPosition(input) Promise~Position~
+getPosition(id) Promise~Position~
+updatePosition(position, event) Promise~Position~
+listPositions(params) Promise~Position[]~
}
class PostgresStore {
-pool : Pool
+createPosition(input) Promise~Position~
+getPosition(id) Promise~Position~
+updatePosition(position, event) Promise~Position~
+listPositions(params) Promise~Position[]~
}
Store <|-- MemoryStore
Store <|-- PostgresStore
```

**Diagram sources**
- [store.ts](file://src/store/store.ts#L4-L58)

### Ledger Integration Patterns

The ledger system provides event sourcing capabilities with both local and blockchain storage options.

```mermaid
sequenceDiagram
participant API as "API Handler"
participant Domain as "Domain Logic"
participant Ledger as "Ledger Client"
participant Store as "Store"
participant Chain as "Blockchain"
API->>Domain : Apply state transition
Domain->>Store : Update position state
Store-->>Domain : Updated position
Domain->>Ledger : Record state change
Ledger->>Ledger : Generate ledger event
Ledger->>Store : Persist event
Ledger->>Chain : Optionally replicate to chain
Chain-->>Ledger : Confirmation
Ledger-->>API : Success
```

**Diagram sources**
- [ledgerClient.ts](file://src/infra/ledgerClient.ts#L8-L37)
- [positions.ts](file://src/api/positions.ts#L268-L271)

**Section sources**
- [store.ts](file://src/store/store.ts#L1-L59)
- [ledgerClient.ts](file://src/infra/ledgerClient.ts#L1-L64)
- [positions.ts](file://src/api/positions.ts#L1-L298)

## Common Issues and Error Handling

### Invalid State Transitions

The system handles various error scenarios through comprehensive validation and clear error messaging.

**Common Transition Errors:**
- Attempting to transition from `RELEASED` to any other state
- Transitioning from `CREATED` to `PARTIALLY_RELEASED` (invalid intermediate state)
- Circular transitions between same states

**Error Handling Pattern:**
```typescript
// Example error handling from lifecycle.ts
if (!canTransition(position.state, toState)) {
  throw new Error(`Invalid transition from ${position.state} to ${toState}`);
}
```

### Policy Violation Scenarios

Policy violations trigger specific error responses with detailed context:

**Amount Constraint Violations:**
- Amount below minimum threshold
- Amount exceeding maximum limit
- Currency not permitted by policy

**Regional Compliance Errors:**
- Asset template not available in region
- Institution lacks regional authorization
- Vertical not supported in region

### Authentication and Authorization Issues

The system implements multi-tier access control with clear error responses:

**Authentication Failures:**
- Missing API key header
- Invalid API key format
- Expired or revoked credentials

**Authorization Errors:**
- Insufficient permissions for operation
- Cross-institution access attempts
- Role-based access restrictions

**Section sources**
- [lifecycle.ts](file://src/domain/lifecycle.ts#L28-L31)
- [positions.ts](file://src/api/positions.ts#L45-L118)
- [auth.ts](file://src/middleware/auth.ts#L1-L95)

## Performance Considerations

### Rule Evaluation Optimization

The domain logic implements several performance optimization strategies:

**State Transition Caching:**
- Allowed transitions pre-computed in static lookup tables
- No runtime computation overhead for state validation
- O(1) complexity for transition validity checks

**Policy Evaluation Efficiency:**
- Lazy loading of policy configurations
- Regional caching of frequently accessed policies
- Minimal database queries for policy lookups

**Template Validation Performance:**
- Compile-time validation rule generation
- Early exit patterns for invalid configurations
- Efficient type checking and constraint validation

### Event Sourcing Performance

The event sourcing implementation optimizes for high-throughput scenarios:

**Batch Processing:**
- Multiple events processed in single database transaction
- Bulk ledger event recording
- Optimized event replay mechanisms

**Indexing Strategies:**
- Position ID indexing for fast lookups
- Timestamp-based event ordering
- Composite indexes for complex queries

**Memory Management:**
- Event streaming for large datasets
- Garbage collection optimization
- Efficient serialization/deserialization

### Scalability Considerations

**Horizontal Scaling:**
- Stateless domain logic enables easy horizontal scaling
- Shared infrastructure services for coordination
- Distributed policy caching strategies

**Resource Optimization:**
- Connection pooling for database operations
- Async processing for non-critical operations
- Efficient logging and monitoring integration

## Event Sourcing Implementation

### Event Structure and Persistence

The system implements comprehensive event sourcing with structured event persistence and replay capabilities.

```mermaid
classDiagram
class LedgerEvent {
+string id
+LedgerEventKind kind
+string positionId
+string at
+string previousState
+string newState
+Record payload
}
class LedgerEventKind {
<<enumeration>>
POSITION_CREATED
POSITION_STATE_CHANGED
}
class LedgerClient {
<<interface>>
+recordPositionCreated(position) Promise~void~
+recordPositionStateChanged(position, event) Promise~void~
+listEvents(params) Promise~LedgerEvent[]~
}
LedgerClient --> LedgerEvent : "manages"
LedgerEvent --> LedgerEventKind : "has type"
```

**Diagram sources**
- [ledger.ts](file://src/domain/ledger.ts#L1-L24)

### Event Replay and Consistency

The event sourcing system ensures eventual consistency and supports historical analysis:

**Replay Mechanisms:**
- Complete position state reconstruction from events
- Historical audit trail generation
- Compliance reporting and analytics

**Consistency Guarantees:**
- Atomic event persistence with position updates
- Idempotent event processing
- Conflict resolution for concurrent operations

**Historical Analysis:**
- Timeline visualization of position lifecycle
- Policy compliance tracking
- Regulatory audit preparation

**Section sources**
- [ledger.ts](file://src/domain/ledger.ts#L1-L24)
- [ledgerClient.ts](file://src/infra/ledgerClient.ts#L1-L64)