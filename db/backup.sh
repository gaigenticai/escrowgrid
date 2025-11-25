#!/usr/bin/env bash
set -euo pipefail

# Simple Postgres backup script for TAAS Platform
#
# Usage:
#   DATABASE_URL="postgres://user:pass@host:port/dbname" ./db/backup.sh > taas-backup.sql
# or
#   PGDATABASE=taas_platform PGUSER=... PGPASSWORD=... ./db/backup.sh > taas-backup.sql
#
# This script writes a plain SQL dump to stdout so you can redirect it to a file
# and manage retention with your backup system.

if command -v pg_dump >/dev/null 2>&1; then
  :
else
  echo "pg_dump is required but not installed or not on PATH" >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL"
else
  # Fall back to libpq environment variables (PGDATABASE, PGUSER, PGPASSWORD, etc.)
  pg_dump --no-owner --no-privileges --format=plain
fi
