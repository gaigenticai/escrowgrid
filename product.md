## TAAS Platform – Product Plan

This document tracks the product-level scope, current state, and remaining work for the TAAS infra backend.

### 1. Current capabilities (implemented)
- **Core domain**: Institutions, asset templates (construction + trade finance), assets, positions with lifecycle.
- **Vertical logic**: Validated configs for `CONSTR_ESCROW`, `CONSTR_RETAINAGE`, `TF_INVOICE`, `TF_LC`.
- **Lifecycle engine**: Valid state transitions and event history on positions.
- **Ledger abstraction**: In-memory and Postgres-backed ledgers for position creation and state changes.
- **Storage abstraction**: In-memory and Postgres-backed stores for all entities.
- **API surface**: REST endpoints for institutions, asset templates, assets, positions, ledger events, and API key management.

### 2. High-priority product work (recently implemented)
- **API authentication & tenancy**
  - API key model per institution with storage in-memory and in Postgres (`api_keys` table).
  - API key management endpoints:
    - `POST /institutions/:id/api-keys` (create key, returns token once).
    - `GET /institutions/:id/api-keys` (list keys metadata, no token).
  - Global auth middleware:
    - Requires API key on all routes except `/health`.
    - Supports `ROOT_API_KEY` for root admin access.
  - Tenant isolation:
    - Non-root keys are scoped to a single institution and can only see or mutate their own data across institutions, templates, assets, positions, and ledger events.

- **Basic RBAC**
  - Roles: `admin` and `read_only` for institution keys; `root` for the global admin.
  - `read_only` keys:
    - Can call `GET` endpoints but are forbidden from `POST`/mutating endpoints (enforced via `requireWriteAccess`).
  - `root`:
    - Can create institutions.
    - Can manage API keys for any institution.
    - Can list and access all institutions and ledger events.

### 3. High-priority product work (next up)
- **Auditability**
  - Add structured request logging (including API key id and institution id).
  - Persist minimal audit trail for critical operations (institution creation, API key creation, position transitions).

- **Policy / rules engine (v1)**
  - Configurable rules per institution and region (US, EU/UK, SG, UAE).
  - Enforce amount, tenor, currency, and jurisdiction constraints at position creation and transition time.
  - Simple, declarative config model (JSON-based) with clear error reporting.

### 4. Medium-term product work
- **Admin console (internal + institutional)** (initial version implemented)
  - Web UI (admin-console React app) to manage institutions, API keys, templates, assets, positions, policies.
  - Views for policy configuration and ledger/position events.

- **Observability & operations** (implemented)
  - Structured JSON logging for all requests via request logger middleware (including API key id and institution id).
  - Basic in-memory request metrics exposed at `GET /metrics` (root-only).
  - Health endpoint (`/health`) and readiness endpoint (`/ready`) suitable for load balancers and orchestration.
  - Per-API-key rate limiting middleware with env-configurable limits (`RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`).

- **On-chain ledger adapter (future)**
  - Plug-in adapter to write selected ledger events and position states to an EVM L2 or permissioned chain.
  - Configurable per institution / per asset template.

- **Testing & quality**
  - Integration tests for core flows on both in-memory and Postgres backends (implemented).
  - Load and resilience tests for key flows (position creation, transitions, ledger writes) – recommended to run via external tooling (e.g. k6, autocannon) against staging.

### 5. Security & compliance guidance
- **Threat model (high level)**
  - Assets to protect:
    - API keys (root and institution).
    - Database contents (positions, ledger events, audit trail, policies).
    - On-chain private key (when on-chain ledger is enabled).
  - Primary threats:
    - API key theft or brute force → mitigated by strong random keys, TLS-only transport, and IP-based/WAF controls at deployment.
    - Abuse via valid keys (excessive requests) → mitigated by per-key rate limiting.
    - Data exfiltration from DB → mitigated by DB access control, encryption at rest (configured at infra layer), and limited roles.
  - Trust boundaries:
    - External clients ↔ TAAS HTTP API (behind TLS and WAF).
    - TAAS service ↔ Postgres.
    - TAAS service ↔ on-chain node/provider.

- **Dependency scanning & hardening**
  - Script `npm run security:audit` runs `npm audit --omit=dev` and should be wired into CI (best-effort; triage & upgrade on findings).
  - Keep Node.js and dependencies updated regularly; avoid unnecessary packages in the critical path.

- **Secrets management**
  - All secrets (DB URL, ROOT_API_KEY, ONCHAIN_PRIVATE_KEY, etc.) are read via environment variables; in production, these should come from a dedicated secrets manager (e.g. Vault, AWS/GCP/Azure secrets services), not `.env` files.
  - Rotate API keys regularly and revoke compromised keys; rotate ROOT_API_KEY via config + coordinated rollout.

- **Logging & retention**
  - Structured logs (requests, audits, on-chain events) are emitted as JSON; ship them to a central log system (e.g. ELK, Datadog) and configure:
    - Retention windows appropriate for your regulatory context (e.g. 30–365 days).
    - Access controls so only authorized operators can read sensitive logs.

### 5. Tracking conventions
- This file is the **single source of truth** for product-level tasks.
- As we implement each major item above, we will:
  - Mark it as **implemented** or expand it into more granular bullets.
  - Add any newly discovered follow-up tasks under the appropriate section.
