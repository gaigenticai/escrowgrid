# Institutions API

<cite>
**Referenced Files in This Document**
- [src/api/institutions.ts](file://src/api/institutions.ts)
- [src/middleware/auth.ts](file://src/middleware/auth.ts)
- [src/middleware/rateLimit.ts](file://src/middleware/rateLimit.ts)
- [src/domain/types.ts](file://src/domain/types.ts)
- [src/domain/verticals.ts](file://src/domain/verticals.ts)
- [src/store/postgresStore.ts](file://src/store/postgresStore.ts)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts)
- [src/server.ts](file://src/server.ts)
- [src/openapi.ts](file://src/openapi.ts)
- [src/config.ts](file://src/config.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Integration Features](#integration-features)
8. [Client Implementation Guide](#client-implementation-guide)
9. [Usage Examples](#usage-examples)

## Introduction

The Institutions API provides comprehensive CRUD operations for managing institutional entities within the EscrowGrid platform. This API enables root users to create and manage institutions while providing controlled access to institutional data for authorized users. All endpoints require authentication via API keys and support audit logging for compliance and security purposes.

## Authentication

The Institutions API uses API key authentication through the `authMiddleware`. API keys can be provided either in the `X-API-KEY` header or via Bearer token in the `Authorization` header.

### Authentication Methods

| Method | Header | Example |
|--------|--------|---------|
| API Key | `X-API-KEY` | `X-API-KEY: your-api-key-here` |
| Bearer Token | `Authorization` | `Authorization: Bearer your-token-here` |

### Role-Based Access Control

- **Root Users**: Full access to all institutions, can create new institutions
- **Institution Keys**: Limited to their own institution data only

**Section sources**
- [src/middleware/auth.ts](file://src/middleware/auth.ts#L23-L33)
- [src/api/institutions.ts](file://src/api/institutions.ts#L22-L28)

## Rate Limiting

The API implements rate limiting through the `rateLimitMiddleware`. By default, rate limiting is enabled with configurable parameters.

### Default Rate Limits

| Parameter | Default Value | Environment Variable |
|-----------|---------------|---------------------|
| Window Size | 60 seconds | `RATE_LIMIT_WINDOW_MS` |
| Max Requests | 1000 | `RATE_LIMIT_MAX_REQUESTS` |
| Enabled | true | `RATE_LIMIT_ENABLED` |

### Rate Limiting Behavior

- Root users are exempt from rate limiting
- Health and readiness endpoints are not rate-limited
- Exceeded limits return HTTP 429 with Retry-After header
- Rate limiting applies per API key or institution

**Section sources**
- [src/middleware/rateLimit.ts](file://src/middleware/rateLimit.ts#L12-L66)
- [src/config.ts](file://src/config.ts#L35-L37)

## API Endpoints

### Create Institution

Creates a new institution with specified regions and optional verticals.

**Endpoint**: `POST /institutions`

**Authentication**: Root user only

**Request Body Schema**:
```typescript
{
  name: string;
  regions: Region[]; // ['US', 'EU_UK', 'SG', 'UAE']
  verticals?: Vertical[]; // ['CONSTRUCTION', 'TRADE_FINANCE']
}
```

**Response**:
- **201 Created**: Institution created successfully
- **400 Bad Request**: Invalid request body (missing name or regions)
- **403 Forbidden**: Only root can create institutions
- **500 Internal Server Error**: Failed to create institution

**Section sources**
- [src/api/institutions.ts](file://src/api/institutions.ts#L9-L67)
- [src/openapi.ts](file://src/openapi.ts#L365-L408)

### List Institutions

Retrieves a list of institutions based on user permissions.

**Endpoint**: `GET /institutions`

**Authentication**: Required

**Response**:
- **200 OK**: List of institutions
  - Root users: All institutions
  - Institution users: Only their own institution
- **401 Unauthorized**: Missing or invalid API key
- **403 Forbidden**: No institution associated with API key
- **404 Not Found**: Institution not found (for individual users)

**Section sources**
- [src/api/institutions.ts](file://src/api/institutions.ts#L69-L90)
- [src/openapi.ts](file://src/openapi.ts#L346-L364)

### Get Institution by ID

Retrieves a specific institution by its ID.

**Endpoint**: `GET /institutions/{id}`

**Authentication**: Required

**Parameters**:
- `id` (path): Institution ID

**Response**:
- **200 OK**: Institution details
- **401 Unauthorized**: Missing or invalid API key
- **403 Forbidden**: Access denied to this institution
- **404 Not Found**: Institution not found

**Section sources**
- [src/api/institutions.ts](file://src/api/institutions.ts#L91-L111)
- [src/openapi.ts](file://src/openapi.ts#L410-L434)

## Data Models

### Institution Model

The Institution entity represents an organizational unit within the EscrowGrid platform.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `id` | string | Unique identifier | Yes |
| `name` | string | Institution name | Yes |
| `regions` | Region[] | Supported geographic regions | Yes |
| `verticals` | Vertical[] | Supported business verticals | Yes* |
| `createdAt` | string | ISO timestamp | Yes |
| `updatedAt` | string | ISO timestamp | Yes |

*Default: `['CONSTRUCTION', 'TRADE_FINANCE']`

### Region Enum Values

- `'US'`: United States
- `'EU_UK'`: European Union and United Kingdom
- `'SG'`: Singapore
- `'UAE'`: United Arab Emirates

### Vertical Enum Values

- `'CONSTRUCTION'`: Construction industry escrow solutions
- `'TRADE_FINANCE'`: Trade finance escrow solutions

**Section sources**
- [src/domain/types.ts](file://src/domain/types.ts#L7-L14)
- [src/domain/types.ts](file://src/domain/types.ts#L1-L4)

## Error Handling

### Standard Error Responses

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid request body or parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server-side error |

### Institution-Specific Errors

#### Duplicate Name Validation
While not explicitly validated in the current implementation, the database schema likely enforces uniqueness at the persistence layer.

#### Invalid Regions
Regions must be one of the predefined enum values. Invalid regions will cause validation errors.

#### Missing Required Fields
The API validates that `name` and `regions` are provided and that `regions` is a non-empty array.

**Section sources**
- [src/api/institutions.ts](file://src/api/institutions.ts#L30-L36)
- [src/api/institutions.ts](file://src/api/institutions.ts#L59-L66)

## Integration Features

### Audit Logging

All institution creations are automatically logged through the `auditLogger` system.

**Audit Event Details**:
- Action: `INSTITUTION_CREATED`
- Resource Type: `institution`
- Payload includes: name, regions, verticals
- Auth context preserved

### Policy Enforcement

Institutions serve as containers for policy enforcement. Policies can be configured per region within each institution.

### Database Integration

The API integrates with PostgreSQL for persistent storage with automatic schema management.

**Section sources**
- [src/api/institutions.ts](file://src/api/institutions.ts#L45-L58)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L55-L96)

## Client Implementation Guide

### Creating an Institution

```javascript
// Root user client example
const response = await fetch('https://api.escrowgrid.io/institutions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-KEY': 'your-root-api-key'
  },
  body: JSON.stringify({
    name: 'Global Construction Inc.',
    regions: ['US', 'EU_UK'],
    verticals: ['CONSTRUCTION']
  })
});

if (response.ok) {
  const institution = await response.json();
  console.log('Institution created:', institution.id);
}
```

### Listing Institutions

```javascript
// Institution user client example
const response = await fetch('https://api.escrowgrid.io/institutions', {
  headers: {
    'X-API-KEY': 'institution-api-key'
  }
});

const institutions = await response.json();
console.log('Available institutions:', institutions);
```

### Getting Institution Details

```javascript
const response = await fetch('https://api.escrowgrid.io/institutions/inst_abc123', {
  headers: {
    'X-API-KEY': 'institution-api-key'
  }
});

if (response.status === 404) {
  console.log('Institution not found');
}
```

### Error Handling Best Practices

```javascript
async function createInstitution(data) {
  try {
    const response = await fetch('/institutions', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey },
      body: JSON.stringify(data)
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`Rate limit exceeded. Try again in ${retryAfter} seconds.`);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Unknown error');
    }

    return await response.json();
  } catch (error) {
    console.error('Institution creation failed:', error.message);
    throw error;
  }
}
```

## Usage Examples

### Real-World Scenario: Onboarding a New Institution

```javascript
// Step 1: Create institution with appropriate regions and verticals
const newInstitution = await createInstitution({
  name: 'TechBuild Solutions',
  regions: ['US', 'SG'], // Supporting US and Singapore markets
  verticals: ['CONSTRUCTION', 'TRADE_FINANCE'] // Both construction and trade finance
});

console.log('New institution created:', newInstitution.id);

// Step 2: Configure regional policies
await configureRegionalPolicy(newInstitution.id, 'US', {
  position: {
    minAmount: 1000,
    maxAmount: 1000000,
    allowedCurrencies: ['USD', 'SGD']
  }
});

// Step 3: Create API keys for internal systems
const apiKeys = await createInternalApiKeys(newInstitution.id, [
  { label: 'Web Application', role: 'admin' },
  { label: 'Mobile App', role: 'read_only' }
]);
```

### Multi-Region Institution Management

```javascript
// Create a global institution with multiple regions
const globalInstitution = await createInstitution({
  name: 'Global Infrastructure Group',
  regions: ['US', 'EU_UK', 'SG', 'UAE'],
  verticals: ['CONSTRUCTION'] // Focused on construction vertical
});

// Configure different policies per region
const policies = [
  await configureRegionalPolicy(globalInstitution.id, 'US', usPolicyConfig),
  await configureRegionalPolicy(globalInstitution.id, 'EU_UK', euPolicyConfig),
  await configureRegionalPolicy(globalInstitution.id, 'SG', sgPolicyConfig)
];

console.log('Multi-region institution configured with policies:', policies);
```

### Compliance Monitoring

```javascript
// Monitor audit logs for institution activities
const auditLogs = await fetchAuditLogs({
  resourceType: 'institution',
  resourceId: institutionId,
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-12-31T23:59:59Z'
});

const creationEvents = auditLogs.filter(log => log.action === 'INSTITUTION_CREATED');
console.log('Total institution creations:', creationEvents.length);
```

**Section sources**
- [src/api/institutions.ts](file://src/api/institutions.ts#L38-L67)
- [src/infra/auditLogger.ts](file://src/infra/auditLogger.ts#L45-L96)