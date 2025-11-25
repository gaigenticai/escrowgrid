## TAAS Platform

Tokenization-as-a-Service (TAAS) infra backend for institutions, focusing on escrowable assets in construction and trade finance.

### Stack
- **Language**: TypeScript
- **Runtime**: Node.js
- **Framework**: Express

### Getting started (default: in-memory)

1. **Install dependencies**

   ```bash
   cd taas-platform
   npm install
   ```

2. **Run the dev server (in-memory backend)**

   ```bash
   npm run dev
   ```

3. **Health check**

   ```bash
   curl http://localhost:4000/health
   ```

   The response includes the current store backend, for example:

   ```json
   { "status": "ok", "service": "taas-platform", "storeBackend": "memory" }
   ```

### Using PostgreSQL for persistence

1. **Create a Postgres database and apply the schema (or run migrations)**

   ```bash
   createdb taas_platform

   # Option A: apply the full schema directly
   psql taas_platform < db/schema.sql

   # Option B: run migrations (recommended for long-lived environments)
   export DATABASE_URL="postgres://user:password@localhost:5432/taas_platform"
   ./db/migrate.sh
   ```

2. **Run the server with Postgres backend**

   ```bash
   export STORE_BACKEND=postgres
   export DATABASE_URL="postgres://user:password@localhost:5432/taas_platform"
   npm run dev
   ```

3. **Verify backend selection**

   ```bash
   curl http://localhost:4000/health
   # => { "status": "ok", "service": "taas-platform", "storeBackend": "postgres" }
   ```

### Core concepts

- **Institution**: a bank, fund, or enterprise using the platform.
- **Asset template**: describes a tokenizable asset type (e.g. construction escrow, invoice claim).
- **Asset**: a specific instance under an asset template (e.g. a particular project escrow or invoice program).
- **Position**: a holder-specific claim on an asset, with a lifecycle (CREATED, FUNDED, RELEASED, etc.).

### Vertical templates

- **Construction (`vertical: \"CONSTRUCTION\"`)**
  - **`CONSTR_ESCROW`**
    - Config (`config` field):
      - **currency**: string, required (e.g. `\"USD\"`).
      - **region**: one of `\"US\" | \"EU_UK\" | \"SG\" | \"UAE\"`, must match template `region`.
      - **minAmount**: number, optional.
      - **maxAmount**: number, optional.
  - **`CONSTR_RETAINAGE`**
    - Config:
      - **currency**: string, required.
      - **retainagePercentage**: number between 0 and 100, required.

- **Trade finance (`vertical: \"TRADE_FINANCE\"`)**
  - **`TF_INVOICE`**
    - Config:
      - **currency**: string, required.
      - **maxTenorDays**: positive number, required.
      - **country**: string, required.
  - **`TF_LC`**
    - Config:
      - **currency**: string, required.
      - **issuingBankCountry**: string, required.
      - **maxTenorDays**: positive number, required.

### Authentication model

- **Root API key**
  - Set via environment: `ROOT_API_KEY=...`
  - Can:
    - Create institutions (`POST /institutions`).
    - Create and list API keys for any institution.
    - Access all institutions, assets, positions, and ledger events.

- **Institution API keys**
  - Created per institution via:
    - `POST /institutions/:id/api-keys` (requires root or institution `admin` key).
  - Roles:
    - `admin`: full read/write within its institution.
    - `read_only`: read-only access to its institution data.
  - Usage:
    - Send as `X-API-KEY: <token>` or `Authorization: Bearer <token>`.

All routes except `/health` and `/ready` require a valid API key. Documentation endpoints
(`/openapi.json`, `/docs`, `/docs/redoc`) can be configured to be public or API-key protected.

For interactive, self-describing API documentation:

- **OpenAPI JSON**: `GET /openapi.json`
- **Swagger UI explorer**: `GET /docs`
- **ReDoc reference**: `GET /docs/redoc`

### CORS and documentation exposure

For production deployments behind an API gateway you will typically:

- Lock down CORS to known frontends (admin console and any internal tools).
- Protect API documentation with the same API key model as the rest of the API.

Configuration knobs:

- `CORS_ALLOWED_ORIGINS`: optional comma-separated list of allowed origins.
  - Example: `CORS_ALLOWED_ORIGINS="https://admin.escrowgrid.io,https://console.internal.bank"`.
  - If unset, the API does not emit `Access-Control-Allow-Origin` headers (safe default when a gateway handles CORS).
- `PUBLIC_DOCS_ENABLED`:
  - When `true`, `/openapi.json`, `/docs`, and `/docs/redoc` are served without authentication.
  - When `false` (recommended for production), docs require a valid API key like any other endpoint.

Every response includes an `X-Request-Id` header. If clients send an incoming `X-Request-Id`
or `X-Correlation-Id`, that value is propagated; otherwise, the service generates a UUID.

### Example flow (happy path, with auth)

> **Note**: These examples assume the API is listening on `http://localhost:4000` (local dev via `npm run dev`). If you run the stack via Docker Compose, the API host port is assigned dynamically; replace `4000` with the host port shown for the `api` service in `docker compose ps` (see **Running with Docker** below).

1. **Create an institution (root only)**

   ```bash
   curl -X POST http://localhost:4000/institutions \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: $ROOT_API_KEY" \
     -d '{
       "name": "Example Bank",
       "regions": ["EU_UK"],
       "verticals": ["CONSTRUCTION", "TRADE_FINANCE"]
     }'
   ```

2. **Create an institution API key**

   ```bash
   curl -X POST http://localhost:4000/institutions/<institution-id>/api-keys \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: $ROOT_API_KEY" \
     -d '{
       "label": "example-admin-key",
       "role": "admin"
     }'
   ```

   The response includes an `apiKey` field; export it:

   ```bash
   export INST_API_KEY="<api-key-from-response>"
   ```

3. **Create an asset template (institution admin key)**

   ```bash
   curl -X POST http://localhost:4000/asset-templates \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: $INST_API_KEY" \
     -d '{
       "code": "CONSTR_ESCROW",
       "name": "Construction Escrow",
       "vertical": "CONSTRUCTION",
       "region": "EU_UK",
       "config": { "currency": "USD" }
     }'
   ```

4. **Create an asset under the template**

   ```bash
   curl -X POST http://localhost:4000/assets \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: $INST_API_KEY" \
     -d '{
       "templateId": "<template-id>",
       "label": "Project Alpha Escrow",
       "metadata": { "projectCode": "ALPHA-001" }
     }'
   ```

5. **Create a position (escrowed claim)**

   ```bash
   curl -X POST http://localhost:4000/positions \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: $INST_API_KEY" \
     -d '{
       "assetId": "<asset-id>",
       "holderReference": "SUBCONTRACTOR_123",
       "currency": "USD",
       "amount": 100000
     }'
   ```

6. **Transition a position through its lifecycle**

   ```bash
   curl -X POST http://localhost:4000/positions/<position-id>/transition \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: $INST_API_KEY" \
     -d '{
       "toState": "FUNDED",
       "reason": "Funds received into escrow"
     }'
   ```

7. **Inspect ledger events for a position**

   ```bash
   curl "http://localhost:4000/ledger-events?positionId=<position-id>" \
     -H "X-API-KEY: $INST_API_KEY"
   ```

   This returns a list of immutable events representing:
   - **`POSITION_CREATED`**: when the position is first created.
   - **`POSITION_STATE_CHANGED`**: for each valid lifecycle transition (e.g. `CREATED -> FUNDED`).

### Policy model

Policies are configured per **institution + region** and currently govern **position creation**:

- **Endpoint**:
  - `PUT /institutions/:id/policies/:region`
  - `GET /institutions/:id/policies`
  - `GET /institutions/:id/policies/:region`
- **Config shape** (`position` block):
  - `minAmount` (number, optional): minimum allowed position amount.
  - `maxAmount` (number, optional): maximum allowed position amount.
  - `allowedCurrencies` (string[], optional): list of allowed currency codes.

On `POST /positions`, before a position is created:
- The service looks up the asset’s template region and the institution’s policy for that region.
- If a policy exists:
  - Rejects amounts below `minAmount` or above `maxAmount`.
  - Rejects currencies not in `allowedCurrencies`.

### On-chain ledger configuration (per template)

When `ONCHAIN_LEDGER_ENABLED=true` and the on-chain adapter is configured via:

- `ONCHAIN_RPC_URL`
- `ONCHAIN_PRIVATE_KEY`
- `ONCHAIN_CONTRACT_ADDRESS`
- `ONCHAIN_CHAIN_ID` (optional)

you can enable on-chain writes **per asset template** using its `config.onchain` block:

- Add an asset template with on-chain enabled:

  ```bash
  curl -X POST http://localhost:4000/asset-templates \
    -H "Content-Type: application/json" \
    -H "X-API-KEY: $INST_API_KEY" \
    -d '{
      "code": "CONSTR_ESCROW_ONCHAIN",
      "name": "On-chain Construction Escrow",
      "vertical": "CONSTRUCTION",
      "region": "EU_UK",
      "config": {
        "currency": "USD",
        "onchain": {
          "enabled": true,
          "chainId": 11155111
        }
      }
    }'
  ```

- Behavior:
  - For positions whose assets use this template:
    - On `POSITION_CREATED` and `POSITION_STATE_CHANGED`, the on-chain adapter calls `recordPositionEvent(positionId, kind, payloadJson)` on the configured contract.
  - If `config.onchain.enabled` is `false` or absent, or `onchain.chainId` is set and differs from `ONCHAIN_CHAIN_ID`, on-chain writes are skipped and a structured JSON log of type `onchain_ledger_skip` is emitted.

### Running with Docker (Postgres + admin console)

1. **Start the stack**

   ```bash
   cd taas-platform
   docker compose up --build
   ```

   This brings up:
   - `db` – PostgreSQL with the schema from `db/schema.sql`.
   - `api` – TAAS backend, listening on container port `4000`.
   - `admin` – Admin console served by nginx.

   The API container always listens on port `4000` internally, but Docker assigns a free **host** port to avoid conflicts with anything already bound to `localhost:4000`.

2. **Discover the API host port**

   ```bash
   docker compose ps
   ```

   Look at the `PORTS` column for the `taas-api` service, for example:

   ```text
   taas-api  0.0.0.0:56888->4000/tcp, [::]:56888->4000/tcp
   ```

   In this case the API is reachable at `http://localhost:56888`.

3. **Health/readiness checks via Docker**

   ```bash
   API_PORT=<host-port-from-previous-step>
   curl "http://localhost:${API_PORT}/health"
   curl "http://localhost:${API_PORT}/ready"
   ```

4. **Admin console**

   The admin console is exposed on a fixed host port:

   ```bash
   # open in your browser
   http://localhost:8080
   ```

### Next steps

- Add richer regional rule packs for US, EU/UK, SG, and UAE (beyond basic amount/currency checks).

### Postgres backup and restore

These scripts assume `pg_dump` and `psql` are installed and available on `PATH`. They do **not** manage retention; use your backup system (S3/Blob storage) to store and rotate dump files.

1. **Backup**

   ```bash
   # Using DATABASE_URL
   export DATABASE_URL="postgres://user:password@localhost:5432/taas_platform"
   ./db/backup.sh > taas-backup-$(date +%Y%m%d-%H%M%S).sql

   # Or using PG* environment variables
   export PGDATABASE=taas_platform
   export PGUSER=...
   export PGPASSWORD=...
   ./db/backup.sh > taas-backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Restore (WARNING: destructive)**

   ```bash
   # This will drop and recreate the public schema before restoring.
   export DATABASE_URL="postgres://user:password@localhost:5432/taas_platform"
   ./db/restore.sh taas-backup-YYYYMMDD-HHMMSS.sql
   ```

   Only use this against a database you intend to overwrite (e.g. staging, a restore test database, or a new environment).

### Monitoring and SLOs

The service exposes basic signals that can be wired into your monitoring stack:

- `GET /health` – liveness check.
- `GET /ready` – readiness check (includes DB connectivity when using Postgres).
- `GET /metrics` – JSON metrics snapshot (root-only).
- `GET /metrics/prometheus` – Prometheus exposition format (root-only).

Example Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: 'taas-backend'
    metrics_path: /metrics/prometheus
    static_configs:
      - targets: ['taas-backend:4000']
```

If you run an external metrics pipeline or sidecar and do not want in-process metrics:

- Set `METRICS_ENABLED=false` to disable `/metrics` and `/metrics/prometheus`.
- Set `RATE_LIMIT_ENABLED=false` to disable the in-process rate limiter when rate limiting is
  handled at the API gateway or WAF layer.

Suggested initial SLOs (tune per environment):

- **Availability**: 99.9% successful responses for core read/write APIs over 30 days.
- **Latency**: 95th percentile < 300ms and 99th percentile < 1s for core APIs under normal load.
- **Error budget policy**: if error budget is consumed by 50% before period end, trigger investigation and limit new changes until stabilized.

### Secrets and configuration in production

All sensitive configuration is provided via environment variables. In production you should wire
these from a dedicated secrets manager (e.g. AWS Secrets Manager, GCP Secret Manager, Azure Key
Vault, HashiCorp Vault), not from `.env` files:

- `DATABASE_URL`: Postgres connection string for the primary ledger database.
- `ROOT_API_KEY`: root administrative API key; can create institutions and manage all keys.
- `ONCHAIN_RPC_URL`, `ONCHAIN_PRIVATE_KEY`, `ONCHAIN_CONTRACT_ADDRESS`, `ONCHAIN_CHAIN_ID`:
  configure the optional on-chain ledger adapter.

Operational guidance:

- Restrict who can read and set these env vars; treat them like database passwords.
- Rotate `ROOT_API_KEY` and `ONCHAIN_PRIVATE_KEY` on a regular cadence; roll out rotations using
  your orchestration system (e.g. Kubernetes or ECS task/secret updates).
- Prefer short-lived infrastructure credentials (e.g. IAM roles) for accessing Postgres instead
  of long-lived usernames/passwords when your environment supports it.
