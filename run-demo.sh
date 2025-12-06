#!/usr/bin/env bash
set -euo pipefail

# Simple demo launcher for EscrowGrid TAAS + admin console.
# - Chooses a free host port for the API.
# - Sets API_PORT and VITE_API_URL so the API and admin console agree.
# - Runs `docker compose up --build` in the foreground.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not on PATH." >&2
  exit 1
fi

if ! command -v docker compose >/dev/null 2>&1; then
  echo "Error: docker compose is not available (Docker Desktop 2.20+ or equivalent is required)." >&2
  exit 1
fi

find_free_port() {
  local port="$1"
  while :; do
    if command -v lsof >/dev/null 2>&1; then
      if ! lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "$port"
        return 0
      fi
    else
      # Fallback: assume the first candidate is fine if lsof is unavailable.
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done
}

API_PORT="${API_PORT:-$(find_free_port 4000)}"
VITE_API_URL="${VITE_API_URL:-http://localhost:${API_PORT}}"

export API_PORT
export VITE_API_URL

echo "Starting EscrowGrid demo..."
echo "  API will be exposed on:  ${VITE_API_URL}"
echo "  Admin console UI on:     http://localhost:8080"
echo
echo "To stop the demo, press Ctrl+C."
echo

docker compose up --build

