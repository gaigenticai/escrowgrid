-- TAAS Platform PostgreSQL schema

CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  regions TEXT[] NOT NULL,
  verticals TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_templates (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  vertical TEXT NOT NULL,
  region TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_templates_institution 
  ON asset_templates (institution_id);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES asset_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_institution 
  ON assets (institution_id);

CREATE INDEX IF NOT EXISTS idx_assets_template 
  ON assets (template_id);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  holder_reference TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount NUMERIC(32, 8) NOT NULL,
  state TEXT NOT NULL,
  external_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_positions_institution 
  ON positions (institution_id);

CREATE INDEX IF NOT EXISTS idx_positions_asset 
  ON positions (asset_id);

CREATE INDEX IF NOT EXISTS idx_positions_holder_reference 
  ON positions (holder_reference);

CREATE TABLE IF NOT EXISTS position_events (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason TEXT,
  at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_position_events_position 
  ON position_events (position_id);

CREATE TABLE IF NOT EXISTS ledger_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_events_position 
  ON ledger_events (position_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_institution
  ON api_keys (institution_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  api_key_id TEXT,
  institution_id TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_events_institution
  ON audit_events (institution_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_audit_events_api_key
  ON audit_events (api_key_id, occurred_at);

CREATE TABLE IF NOT EXISTS institution_policies (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  region TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (institution_id, region)
);

CREATE INDEX IF NOT EXISTS idx_institution_policies_institution
  ON institution_policies (institution_id);
