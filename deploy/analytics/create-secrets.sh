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
  METABASE_DB_PASSWORD="$(openssl rand -base64 24)"
  echo "Generated METABASE_DB_PASSWORD"
fi

if [[ -z "${METABASE_APP_DB_PASSWORD:-}" ]]; then
  METABASE_APP_DB_PASSWORD="$(openssl rand -base64 24)"
  echo "Generated METABASE_APP_DB_PASSWORD"
fi

if [[ -z "${MB_ENCRYPTION_SECRET_KEY:-}" ]]; then
  MB_ENCRYPTION_SECRET_KEY="$(openssl rand -hex 32)"
  echo "Generated MB_ENCRYPTION_SECRET_KEY"
fi

if [[ -z "${METABASE_ADMIN_EMAIL:-}" ]]; then
  echo "METABASE_ADMIN_EMAIL is required" >&2
  exit 1
fi

if [[ -z "${METABASE_ADMIN_PASSWORD:-}" ]]; then
  METABASE_ADMIN_PASSWORD="$(openssl rand -base64 18)"
  echo "Generated METABASE_ADMIN_PASSWORD"
fi

./deploy/analytics/ensure-readonly-user.sh

METABASE_CRM_DATABASE_URL="$(DATABASE_URL="$DATABASE_URL" METABASE_DB_PASSWORD="$METABASE_DB_PASSWORD" node <<'NODE'
const url = new URL(process.env.DATABASE_URL);
url.username = "metabase_readonly";
url.password = process.env.METABASE_DB_PASSWORD;
const option = "options=-c%20search_path%3Danalytics";
url.search = url.search ? `${url.search.slice(1)}&${option}` : option;
console.log(url.toString());
NODE
)"

cat <<EOF
Add these values to your production .env / secret manager:

METABASE_DB_PASSWORD=${METABASE_DB_PASSWORD}
METABASE_APP_DB_PASSWORD=${METABASE_APP_DB_PASSWORD}
MB_ENCRYPTION_SECRET_KEY=${MB_ENCRYPTION_SECRET_KEY}
METABASE_ADMIN_EMAIL=${METABASE_ADMIN_EMAIL}
METABASE_ADMIN_PASSWORD=${METABASE_ADMIN_PASSWORD}
METABASE_CRM_DATABASE_URL=${METABASE_CRM_DATABASE_URL}

Optional IP allowlist for Traefik:
METABASE_IP_WHITELIST=203.0.113.10/32

Then deploy with:
  ./deploy/analytics/deploy-metabase.sh
EOF
