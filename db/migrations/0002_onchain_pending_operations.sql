-- 0002_onchain_pending_operations.sql
-- Persistent queue for on-chain ledger retries.

CREATE TABLE IF NOT EXISTS onchain_pending_operations (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_onchain_pending_operations_position
  ON onchain_pending_operations (position_id);

CREATE INDEX IF NOT EXISTS idx_onchain_pending_operations_attempts
  ON onchain_pending_operations (attempt_count, updated_at);

