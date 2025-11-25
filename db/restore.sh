#!/usr/bin/env bash
set -euo pipefail

# Simple Postgres restore script for TAAS Platform
#
# WARNING: This will DROP and recreate all objects in the target database.
# Only run against the database you intend to restore into (e.g. staging or a
# dedicated restore environment), never against production without a clear plan.
#
# Usage:
#   DATABASE_URL="postgres://user:pass@host:port/dbname" ./db/restore.sh taas-backup.sql
# or
#   PGDATABASE=taas_platform PGUSER=... PGPASSWORD=... ./db/restore.sh taas-backup.sql
#
# The script expects a plain SQL dump (as produced by backup.sh).

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup.sql>" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if command -v psql >/dev/null 2>&1; then
  :
else
  echo "psql is required but not installed or not on PATH" >&2
  exit 1
fi

# Drop all objects and restore from the dump
if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Restoring into database defined by DATABASE_URL" >&2
  psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
  psql "$DATABASE_URL" -f "$BACKUP_FILE"
else
  echo "Restoring into database defined by PG* env vars" >&2
  psql -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
  psql -f "$BACKUP_FILE"
fi
