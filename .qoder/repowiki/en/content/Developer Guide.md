# Developer Guide

<cite>
**Referenced Files in This Document**
- [package.json](file://package.json)
- [README.md](file://README.md)
- [docker-compose.yml](file://docker-compose.yml)
- [Dockerfile](file://Dockerfile)
- [tsconfig.json](file://tsconfig.json)
- [vitest.config.ts](file://vitest.config.ts)
- [vitest.postgres.config.ts](file://vitest.postgres.config.ts)
- [src/config.ts](file://src/config.ts)
- [src/server.ts](file://src/server.ts)
- [src/domain/types.ts](file://src/domain/types.ts)
- [src/store/store.ts](file://src/store/store.ts)
- [src/api/positions.ts](file://src/api/positions.ts)
- [db/schema.sql](file://db/schema.sql)
- [admin-console/package.json](file://admin-console/package.json)
- [admin-console/eslint.config.js](file://admin-console/eslint.config.js)
- [admin-console/vite.config.ts](file://admin-console/vite.config.ts)
- [admin-console/README.md](file://admin-console/README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Development Environment Setup](#development-environment-setup)
4. [Project Structure](#project-structure)
5. [Local Development](#local-development)
6. [Database Configuration](#database-configuration)
7. [Service Startup](#service-startup)
8. [Coding Standards and Tooling](#coding-standards-and-tooling)
9. [Testing](#testing)
10. [Development Server Commands](#development-server-commands)
11. [IDE Setup Recommendations](#ide-setup-recommendations)
12. [Debugging Tips](#debugging-tips)
13. [Contribution Workflow](#contribution-workflow)
14. [Docker Development](#docker-development)
15. [Troubleshooting](#troubleshooting)

## Introduction

The escrowgrid platform is a Tokenization-as-a-Service (TAAS) infrastructure backend designed for institutions dealing with escrowable assets in construction and trade finance. This guide provides comprehensive instructions for setting up a local development environment, understanding the codebase architecture, and contributing effectively to the project.

The platform consists of:
- **Core Backend**: Node.js/Express server with TypeScript
- **Admin Console**: React-based administration interface
- **Database**: PostgreSQL with configurable persistence layer
- **API Services**: RESTful endpoints for institutional asset management

## Prerequisites

Before setting up the development environment, ensure you have the following prerequisites installed:

### Required Software
- **Node.js**: Version 20.x or higher
- **npm**: Version 8.x or higher
- **PostgreSQL**: Version 16.x or higher (for persistent storage)
- **Git**: For version control
- **Docker**: Optional, for containerized development (version 20.10+)

### Development Tools
- **Code Editor**: VS Code, WebStorm, or equivalent
- **Browser**: Modern browser with developer tools
- **API Testing Tool**: Postman, cURL, or Insomnia

## Development Environment Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/gaigenticai/escrowgrid.git
cd escrowgrid
```

### Step 2: Install Dependencies

The project uses a monorepo structure with separate packages:

```bash
# Install root dependencies
npm install

# Navigate to admin-console and install frontend dependencies
cd admin-console
npm install
cd ..
```

### Step 3: Environment Configuration

Create a `.env` file in the root directory with the following configuration:

```bash
# Server Configuration
PORT=4000
NODE_ENV=development

# Storage Backend
STORE_BACKEND=memory  # or 'postgres' for persistent storage

# API Keys
ROOT_API_KEY=your-root-api-key-here

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Database Configuration (if using PostgreSQL)
# DATABASE_URL=postgresql://user:password@localhost:5432/taas_platform

# On-chain Ledger Configuration (optional)
# ONCHAIN_LEDGER_ENABLED=false
# ONCHAIN_RPC_URL=https://rpc-url.example.com
# ONCHAIN_PRIVATE_KEY=your-private-key
# ONCHAIN_CONTRACT_ADDRESS=your-contract-address
# ONCHAIN_CHAIN_ID=11155111
```

## Project Structure

The escrowgrid codebase follows a modular architecture organized into several key directories:

```mermaid
graph TB
subgraph "Root Directory"
A[src/] --> B[Domain Layer]
A --> C[Infrastructure Layer]
A --> D[API Layer]
A --> E[Middleware]
A --> F[Store Layer]
G[admin-console/] --> H[React Frontend]
I[website/] --> J[Static Website]
K[db/] --> L[Database Schema]
end
subgraph "Configuration"
M[package.json] --> N[Root Package]
O[admin-console/package.json] --> P[Frontend Package]
Q[docker-compose.yml] --> R[Docker Configuration]
S[Dockerfile] --> T[Build Configuration]
end
```

**Diagram sources**
- [package.json](file://package.json#L1-L37)
- [admin-console/package.json](file://admin-console/package.json#L1-L31)
- [docker-compose.yml](file://docker-compose.yml#L1-L55)

### Directory Breakdown

- **`src/`**: Core backend application code
  - `domain/`: Business logic and type definitions
  - `infra/`: Infrastructure implementations (storage, logging, etc.)
  - `api/`: REST API route handlers
  - `middleware/`: Express middleware components
  - `store/`: Data access abstractions

- **`admin-console/`**: React-based administration interface
- **`website/`**: Static marketing website
- **`db/`**: Database schema and migration scripts
- **`load/`**: Load testing scripts

**Section sources**
- [package.json](file://package.json#L1-L37)
- [admin-console/package.json](file://admin-console/package.json#L1-L31)

## Local Development

### Starting the Development Server

The platform provides multiple ways to run the development server depending on your needs:

#### Option 1: One-Command Docker Demo (API + Admin + Postgres)

For a fully wired local demo (API, PostgreSQL, and admin console) with automatic port selection and no manual
configuration, use the `run-demo.sh` helper script:

```bash
./run-demo.sh
```

This script:
- Chooses a free host port starting from `4000` for the API (`API_PORT`).
- Sets `VITE_API_URL` so the admin console is built to call the correct API URL.
- Runs `docker compose up --build` with these environment variables.

Result:
- API available at `http://localhost:${API_PORT}` (printed by the script).
- Admin console available at `http://localhost:8080`.

This is the recommended path for non-technical users or quick end-to-end testing.

**Section sources**
- [run-demo.sh](file://run-demo.sh#L1-L63)
- [docker-compose.yml](file://docker-compose.yml#L23-L32)
- [admin-console/Dockerfile](file://admin-console/Dockerfile#L1-L10)

#### Option 2: Memory Backend (Default)
```bash
# Start the development server with in-memory storage
npm run dev
```

This mode is ideal for quick testing and development without database setup.

#### Option 3: PostgreSQL Backend
```bash
# Set environment variables
export STORE_BACKEND=postgres
export DATABASE_URL="postgresql://user:password@localhost:5432/taas_platform"

# Start the development server
npm run dev
```

#### Option 4: Production Build
```bash
# Build the TypeScript code
npm run build

# Start the production server
npm start
```

### Development Server Features

The development server provides:
- **Hot Module Replacement**: Automatic reloading on code changes
- **TypeScript Compilation**: Real-time type checking
- **API Documentation**: Interactive Swagger UI at `/docs`
- **Health Checks**: `/health` and `/ready` endpoints
- **Metrics Endpoint**: `/metrics` for monitoring

**Section sources**
- [src/server.ts](file://src/server.ts#L1-L100)
- [package.json](file://package.json#L6-L12)

## Database Configuration

### PostgreSQL Setup

For persistent storage, configure PostgreSQL with the provided schema:

#### 1. Create Database and Apply Schema

```bash
# Create database
createdb taas_platform

# Apply schema
psql taas_platform < db/schema.sql
```

#### 2. Environment Variables

Set the following environment variables for PostgreSQL:

```bash
export STORE_BACKEND=postgres
export DATABASE_URL="postgresql://user:password@localhost:5432/taas_platform"
```

#### 3. Database Schema Overview

The database schema includes the following key tables:

```mermaid
erDiagram
INSTITUTIONS {
text id PK
text name
text[] regions
text[] verticals
timestamptz created_at
timestamptz updated_at
}
ASSET_TEMPLATES {
text id PK
text institution_id FK
text code
text name
text vertical
text region
jsonb config
timestamptz created_at
timestamptz updated_at
}
ASSETS {
text id PK
text institution_id FK
text template_id FK
text label
jsonb metadata
timestamptz created_at
timestamptz updated_at
}
POSITIONS {
text id PK
text institution_id FK
text asset_id FK
text holder_reference
text currency
numeric amount
text state
text external_reference
timestamptz created_at
timestamptz updated_at
}
POSITION_EVENTS {
text id PK
text position_id FK
text from_state
text to_state
text reason
timestamptz at
jsonb metadata
timestamptz created_at
}
LEDGER_EVENTS {
text id PK
text kind
text position_id FK
timestamptz at
text previous_state
text new_state
jsonb payload
timestamptz created_at
}
API_KEYS {
text id PK
text institution_id FK
text key_hash UK
text label
text role
timestamptz created_at
timestamptz revoked_at
}
AUDIT_EVENTS {
text id PK
timestamptz occurred_at
timestamptz created_at
text api_key_id
text institution_id
text method
text path
text action
text resource_type
text resource_id
jsonb payload
}
INSTITUTION_POLICIES {
text id PK
text institution_id FK
text region
jsonb config
timestamptz created_at
timestamptz updated_at
}
INSTITUTIONS ||--o{ ASSET_TEMPLATES : "owns"
INSTITUTIONS ||--o{ ASSETS : "manages"
INSTITUTIONS ||--o{ API_KEYS : "has"
INSTITUTIONS ||--o{ AUDIT_EVENTS : "generates"
INSTITUTIONS ||--o{ INSTITUTION_POLICIES : "has"
ASSET_TEMPLATES ||--o{ ASSETS : "defines"
ASSETS ||--o{ POSITIONS : "contains"
POSITIONS ||--o{ POSITION_EVENTS : "tracks"
POSITIONS ||--o{ LEDGER_EVENTS : "logs"
```

**Diagram sources**
- [db/schema.sql](file://db/schema.sql#L1-L138)

**Section sources**
- [db/schema.sql](file://db/schema.sql#L1-L138)
- [src/config.ts](file://src/config.ts#L1-L47)

## Service Startup

### Development Mode

```bash
# Start with in-memory backend (default)
npm run dev

# Start with PostgreSQL backend
export STORE_BACKEND=postgres
export DATABASE_URL="postgresql://user:password@localhost:5432/taas_platform"
npm run dev
```

### Production Mode

```bash
# Build the application
npm run build

# Start the production server
npm start
```

### Health Checks

Monitor service health using the following endpoints:

```bash
# Basic health check
curl http://localhost:4000/health

# Readiness check (includes database connectivity)
curl http://localhost:4000/ready
```

### API Documentation

Access interactive API documentation:
- **Swagger UI**: `http://localhost:4000/docs`
- **ReDoc**: `http://localhost:4000/docs/redoc`
- **OpenAPI Spec**: `http://localhost:4000/openapi.json`

## Coding Standards and Tooling

### TypeScript Configuration

The project uses strict TypeScript configuration with comprehensive type checking:

#### Key TypeScript Features
- **Strict Mode**: Enabled for comprehensive type safety
- **ES2020 Target**: Modern JavaScript features
- **CommonJS Modules**: Compatible with Node.js
- **Source Maps**: Debugging support
- **Declaration Files**: Type definition generation

#### TypeScript Configuration Details

| Setting | Value | Purpose |
|---------|-------|---------|
| `strict` | `true` | Enable all strict type-checking options |
| `target` | `es2020` | Modern JavaScript features |
| `module` | `commonjs` | Node.js compatibility |
| `sourceMap` | `true` | Debugging support |
| `declaration` | `true` | Type definition files |
| `noUncheckedIndexedAccess` | `true` | Array indexing safety |
| `exactOptionalPropertyTypes` | `true` | Optional property safety |

**Section sources**
- [tsconfig.json](file://tsconfig.json#L1-L49)

### ESLint Configuration

The admin-console uses a comprehensive ESLint setup for React development:

#### ESLint Features
- **TypeScript Support**: Full TypeScript linting
- **React Hooks**: Custom hooks linting
- **React Refresh**: Fast refresh support
- **Modern Rules**: Latest best practices

#### ESLint Configuration

The admin-console uses the following ESLint configuration:

```javascript
// Key ESLint features
- TypeScript ESLint (@typescript-eslint)
- React Hooks plugin
- React Refresh plugin
- Global browser environment
- Strict TypeScript rules
```

**Section sources**
- [admin-console/eslint.config.js](file://admin-console/eslint.config.js#L1-L24)
- [admin-console/README.md](file://admin-console/README.md#L16-L74)

### Code Quality Tools

#### Available Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `npm run dev` | Start development server |
| `build` | `npm run build` | Compile TypeScript |
| `start` | `npm start` | Start production server |
| `test` | `npm run test` | Run Vitest tests |
| `test:postgres` | `npm run test:postgres` | Run PostgreSQL tests |
| `security:audit` | `npm run security:audit` | Security vulnerability scan |

#### Test Configuration

The project uses Vitest for testing with separate configurations:

- **Memory Tests**: `vitest run` - Tests with in-memory store
- **PostgreSQL Tests**: `vitest run --config vitest.postgres.config.ts` - Tests with PostgreSQL

**Section sources**
- [package.json](file://package.json#L6-L12)
- [vitest.config.ts](file://vitest.config.ts#L1-L10)
- [vitest.postgres.config.ts](file://vitest.postgres.config.ts#L1-L10)

## Testing

### Test Architecture

The testing strategy includes multiple environments and configurations:

```mermaid
flowchart TD
A[Test Suite] --> B[Memory Tests]
A --> C[PostgreSQL Tests]
B --> D[Fast Execution]
B --> E[Isolated Environment]
C --> F[Real Database]
C --> G[Integration Testing]
D --> H[CI/CD Pipeline]
F --> I[Production Validation]
```

**Diagram sources**
- [vitest.config.ts](file://vitest.config.ts#L1-L10)
- [vitest.postgres.config.ts](file://vitest.postgres.config.ts#L1-L10)

### Running Tests

#### Memory-Based Tests
```bash
# Run all memory-based tests
npm test

# Run specific test file
npx vitest run src/__tests__/api.test.ts
```

#### PostgreSQL Tests
```bash
# Configure PostgreSQL connection
export DATABASE_URL="postgresql://user:password@localhost:5432/test_db"

# Run PostgreSQL tests
npm test:postgres

# Run specific PostgreSQL test
npx vitest run --config vitest.postgres.config.ts src/__tests__/api.postgres.test.ts
```

### Test Coverage

The test suite covers:
- **API Endpoints**: Complete REST API testing
- **Business Logic**: Domain model validation
- **Storage Layer**: CRUD operations and transactions
- **Authentication**: API key validation and authorization
- **Error Handling**: Edge cases and failure scenarios

**Section sources**
- [vitest.config.ts](file://vitest.config.ts#L1-L10)
- [vitest.postgres.config.ts](file://vitest.postgres.config.ts#L1-L10)

## Development Server Commands

### Root Project Commands

```bash
# Development server (in-memory)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run tests
npm test

# Run PostgreSQL tests
npm test:postgres

# Security audit
npm run security:audit
```

### Admin Console Commands

```bash
# Development server
cd admin-console
npm run dev

# Build production
npm run build

# Run linting
npm run lint

# Preview build
npm run preview
```

### Docker Commands

```bash
# Build and start with Docker Compose
docker compose up --build

# View service status
docker compose ps

# Stop services
docker compose down

# View logs
docker compose logs api
```

**Section sources**
- [package.json](file://package.json#L6-L12)
- [admin-console/package.json](file://admin-console/package.json#L6-L11)
- [docker-compose.yml](file://docker-compose.yml#L1-L55)

## IDE Setup Recommendations

### Visual Studio Code

Recommended extensions for optimal development experience:

#### Essential Extensions
- **TypeScript Importer**: Automatic import management
- **ES7+ React/Redux/React-Native snippets**: React development shortcuts
- **Auto Rename Tag**: HTML/XML tag renaming
- **Prettier**: Code formatting
- **ESLint**: Real-time linting
- **PostgreSQL**: SQL language support

#### Workspace Configuration

Create a `.vscode/settings.json` file:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  }
}
```

### WebStorm/IntelliJ IDEA

#### Project Configuration
- **Node.js Interpreter**: Configure Node.js 20+
- **TypeScript**: Enable TypeScript compilation
- **ESLint**: Integrate ESLint for real-time feedback
- **Database Tools**: PostgreSQL database integration

#### Key Settings
- **File Watchers**: Auto-compile TypeScript
- **Code Style**: Use project ESLint configuration
- **Version Control**: Git integration

### General IDE Recommendations

1. **TypeScript Support**: Ensure full TypeScript IntelliSense
2. **ESLint Integration**: Real-time linting and fixes
3. **Git Integration**: Built-in version control
4. **Debugging Tools**: Node.js debugger configuration
5. **Code Formatting**: Consistent formatting rules

## Debugging Tips

### Local Development Debugging

#### 1. Node.js Debugger

```bash
# Start with debugger
node --inspect dist/server.js

# Start development with debugger
node --inspect --inspect-brk src/server.ts
```

#### 2. VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Program",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/server.ts",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "sourceMaps": true,
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

#### 3. Logging Configuration

Enable detailed logging for development:

```bash
# Enable request logging
export REQUEST_LOG_LEVEL=debug

# Enable audit logging
export AUDIT_LOG_LEVEL=debug
```

### Database Debugging

#### PostgreSQL Connection Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check database schema
psql $DATABASE_URL -c "\dt"
```

#### Migration Issues

```bash
# Reapply schema
psql $DATABASE_URL < db/schema.sql

# Check table structure
psql $DATABASE_URL -c "\d+ institutions"
```

### API Debugging

#### 1. Request/Response Logging

Enable verbose logging:

```bash
# Set log level
export LOG_LEVEL=debug

# Monitor API requests
curl -v http://localhost:4000/health
```

#### 2. API Testing Tools

Use Postman or Insomnia to test endpoints:
- **Authentication**: Set `X-API-KEY` header
- **Headers**: Content-Type: application/json
- **Environment Variables**: Store API keys and base URLs

### Common Debugging Scenarios

#### Service Won't Start
```bash
# Check port availability
netstat -an | grep 4000

# Check environment variables
printenv | grep -E "(PORT|DATABASE_URL|STORE_BACKEND)"

# Review logs
npm run dev 2>&1 | tee debug.log
```

#### Database Connection Issues
```bash
# Test connection
telnet localhost 5432

# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log
```

#### API Authentication Problems
```bash
# Verify API key
curl -H "X-API-KEY: $API_KEY" http://localhost:4000/institutions

# Check root API key
echo $ROOT_API_KEY
```

## Contribution Workflow

### Branch Management Strategy

The project follows a feature-branch workflow:

```mermaid
gitGraph
commit id: "Initial Commit"
branch develop
checkout develop
commit id: "Feature A"
commit id: "Feature B"
branch feature/new-endpoint
checkout feature/new-endpoint
commit id: "New API Endpoint"
commit id: "Tests Added"
checkout develop
merge feature/new-endpoint
commit id: "Integration"
branch hotfix/critical-bug
checkout hotfix/critical-bug
commit id: "Bug Fix"
checkout develop
merge hotfix/critical-bug
commit id: "Hotfix Applied"
```

### Pull Request Process

#### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/add-new-api-endpoint

# Make changes and commit
git add .
git commit -m "feat(api): add new endpoint for position management"

# Push feature branch
git push origin feature/add-new-api-endpoint
```

#### 2. Code Quality Checks

Before submitting a pull request:

```bash
# Run tests
npm test
npm run test:postgres

# Run linting
npm run lint  # For admin-console
npx eslint src/

# Check TypeScript compilation
npm run build

# Security audit
npm run security:audit
```

#### 3. Pull Request Template

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

### Code Review Guidelines

#### Review Checklist
- **Functionality**: Does the code work as intended?
- **Type Safety**: Are TypeScript types correctly defined?
- **Error Handling**: Are edge cases handled appropriately?
- **Performance**: Are there unnecessary computations?
- **Security**: Are there potential vulnerabilities?
- **Documentation**: Is the code well-documented?

#### Best Practices
- **Atomic Commits**: Small, focused commits
- **Clear Messages**: Descriptive commit messages
- **Test Coverage**: Add tests for new functionality
- **Backward Compatibility**: Consider existing integrations

### Continuous Integration

The project uses automated CI/CD pipelines:

- **Automated Testing**: Runs on every pull request
- **Security Scanning**: Vulnerability assessment
- **Code Quality**: ESLint and TypeScript checks
- **Deployment**: Automated deployment on approved merges

**Section sources**
- [README.md](file://README.md#L1-L378)

## Docker Development

### Container Architecture

The Docker setup provides a complete development environment:

```mermaid
graph TB
subgraph "Docker Compose Stack"
A[api] --> B[PostgreSQL Database]
C[admin-console] --> D[Nginx Web Server]
A --> E[Environment Variables]
E --> F[STORE_BACKEND=postgres]
E --> G[DATABASE_URL]
E --> H[ROOT_API_KEY]
B --> I[Schema.sql]
B --> J[Data Persistence]
end
subgraph "External Access"
K[localhost:4000] --> A
L[localhost:8080] --> C
end
```

**Diagram sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)
- [Dockerfile](file://Dockerfile#L1-L27)

### Docker Development Commands

#### 1. Building and Starting Services

```bash
# Build and start all services
docker compose up --build

# Start services in detached mode
docker compose up -d

# Start specific service
docker compose up api
```

#### 2. Service Management

```bash
# View service status
docker compose ps

# View service logs
docker compose logs api
docker compose logs db

# Stop services
docker compose down

# Restart services
docker compose restart api
```

#### 3. Database Operations

```bash
# Access PostgreSQL container
docker exec -it taas-db psql -U taas_user taas_platform

# Backup database
docker exec taas-db pg_dump -U taas_user taas_platform > backup.sql

# Restore database
cat backup.sql | docker exec -i taas-db psql -U taas_user taas_platform
```

### Docker Configuration Details

#### Environment Variables

The Docker Compose configuration sets the following environment variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `production` | Production mode |
| `STORE_BACKEND` | `postgres` | Persistent storage |
| `DATABASE_URL` | `postgresql://taas_user:taas_pass@db:5432/taas_platform` | Database connection |
| `ROOT_API_KEY` | `replace-me-root-key` | API authentication |
| `RATE_LIMIT_ENABLED` | `true` | Rate limiting |

#### Port Mapping

- **API Service**: Automatically mapped to host port (e.g., `localhost:56888`)
- **Admin Console**: Fixed port `8080` (e.g., `localhost:8080`)
- **PostgreSQL**: Fixed port `15432` (e.g., `localhost:15432`)

### Development with Docker

#### 1. Initial Setup

```bash
# Clone and navigate to project
git clone https://github.com/gaigenticai/escrowgrid.git
cd escrowgrid

# Build and start services
docker compose up --build
```

#### 2. Finding Service Ports

```bash
# Check service ports
docker compose ps

# Example output:
# NAME                COMMAND                  SERVICE             STATUS              PORTS
# taas-api            "node dist/server.js"    api                 running             0.0.0.0:56888->4000/tcp
# taas-db             "docker-entrypoint.s…"   db                  running             0.0.0.0:15432->5432/tcp
# taas-admin          "nginx ..."              admin               running             0.0.0.0:8080->80/tcp
```

#### 3. API Access

```bash
# Health check
API_PORT=56888
curl "http://localhost:${API_PORT}/health"

# Ready check
curl "http://localhost:${API_PORT}/ready"
```

#### 4. Admin Console Access

```bash
# Open in browser
open http://localhost:8080
```

**Section sources**
- [docker-compose.yml](file://docker-compose.yml#L1-L55)
- [Dockerfile](file://Dockerfile#L1-L27)
- [README.md](file://README.md#L276-L322)

## Troubleshooting

### Common Issues and Solutions

#### 1. Port Conflicts

**Problem**: Port 4000 already in use
```bash
# Solution: Docker automatically assigns different ports
docker compose ps  # Check actual port mapping
```

**Alternative**: Change local port
```bash
export PORT=4001
npm run dev
```

#### 2. Database Connection Issues

**Problem**: Cannot connect to PostgreSQL
```bash
# Check database status
docker compose ps db

# Test connection
docker exec taas-db pg_isready -U taas_user

# Reset database
docker compose down
docker volume rm escrowgrid_db_data
docker compose up -d
```

#### 3. TypeScript Compilation Errors

**Problem**: Build fails with TypeScript errors
```bash
# Clean and rebuild
npm run build

# Check TypeScript configuration
npx tsc --noEmit

# Review type definitions
npx tsc --noEmit --strict
```

#### 4. API Authentication Failures

**Problem**: 401 Unauthorized responses
```bash
# Verify API key
echo $ROOT_API_KEY

# Test with cURL
curl -H "X-API-KEY: $ROOT_API_KEY" http://localhost:4000/health

# Check environment variables
printenv | grep API_KEY
```

#### 5. Memory vs PostgreSQL Issues

**Problem**: Data not persisting between restarts
```bash
# Switch to PostgreSQL
export STORE_BACKEND=postgres
export DATABASE_URL="postgresql://user:password@localhost:5432/taas_platform"
npm run dev
```

### Performance Issues

#### 1. Slow API Responses

**Diagnosis**:
```bash
# Enable timing logs
export LOG_LEVEL=debug

# Monitor performance
curl -w "@curl-format.txt" http://localhost:4000/health
```

**Solutions**:
- Increase database connection pool
- Optimize queries in `src/store/`
- Enable PostgreSQL query logging

#### 2. Memory Usage

**Monitoring**:
```bash
# Check memory usage
ps aux | grep node

# Monitor database connections
docker exec taas-db psql -U taas_user taas_platform -c "SELECT * FROM pg_stat_activity;"
```

### Recovery Procedures

#### 1. Database Corruption

```bash
# Stop services
docker compose down

# Backup current data
docker exec taas-db pg_dump -U taas_user taas_platform > corrupted-backup.sql

# Recreate database
docker volume rm escrowgrid_db_data
docker compose up -d

# Restore clean data
docker exec -i taas-db psql -U taas_user taas_platform < fresh-schema.sql
```

#### 2. Application Crashes

```bash
# Check logs
docker compose logs api

# Restart services
docker compose restart api

# Clear cache
rm -rf node_modules/.cache
npm install
```

### Debug Information Collection

For issue reporting, collect the following information:

```bash
# System information
node --version
npm --version
docker --version

# Environment variables
printenv | grep -E "(NODE_ENV|DATABASE_URL|STORE_BACKEND|ROOT_API_KEY)"

# Service status
docker compose ps
curl http://localhost:4000/health

# Logs
docker compose logs api | tail -100
```

**Section sources**
- [README.md](file://README.md#L327-L378)
- [src/config.ts](file://src/config.ts#L1-L47)
