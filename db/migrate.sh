#!/usr/bin/env bash
set -euo pipefail

# Simple SQL migrations runner for the TAAS Platform.
# Applies migrations in db/migrations in lexicographic order, tracking state
# in a schema_migrations table inside the target database.
#
# Usage:
#   DATABASE_URL="postgres://user:pass@host:port/dbname" ./db/migrate.sh
# or
#   PGDATABASE=taas_platform PGUSER=... PGPASSWORD=... ./db/migrate.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "Migrations directory not found: ${MIGRATIONS_DIR}" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but not installed or not on PATH" >&2
  exit 1
fi

run_psql() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" "$@"
  else
    psql "$@"
  fi
}

echo "Ensuring schema_migrations table exists..." >&2
run_psql <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

shopt -s nullglob
migration_files=("${MIGRATIONS_DIR}"/*.sql)
shopt -u nullglob

if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "No migrations to apply in ${MIGRATIONS_DIR}" >&2
  exit 0
fi

for path in "${migration_files[@]}"; do
  file="$(basename "$path")"
  version="${file}"

  echo "Checking migration ${version}..." >&2
  count="$(run_psql -t -A -c "SELECT COUNT(*) FROM schema_migrations WHERE version = '$version'")"
  if [[ "$count" != "0" ]]; then
    echo "  Already applied, skipping." >&2
    continue
  fi

  echo "Applying migration ${version}..." >&2
  run_psql -v ON_ERROR_STOP=1 -f "$path"
  run_psql -c "INSERT INTO schema_migrations(version) VALUES ('$version')"
  echo "  Applied." >&2
done

echo "Migrations complete." >&2


