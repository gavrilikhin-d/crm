#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${METABASE_DB_PASSWORD:-}" ]]; then
  echo "METABASE_DB_PASSWORD is required" >&2
  echo "Generate one with: openssl rand -base64 24" >&2
  exit 1
fi

escaped_password="${METABASE_DB_PASSWORD//\'/\'\'}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
ALTER ROLE metabase_readonly WITH LOGIN PASSWORD '${escaped_password}';
SQL

echo "metabase_readonly login enabled."
