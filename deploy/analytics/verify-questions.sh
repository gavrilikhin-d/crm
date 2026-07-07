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

if [[ -z "${METABASE_DB_PASSWORD:-}" ]]; then
  echo "METABASE_DB_PASSWORD is required" >&2
  exit 1
fi

crm_url="$(DATABASE_URL="$DATABASE_URL" METABASE_DB_PASSWORD="$METABASE_DB_PASSWORD" node <<'NODE'
const url = new URL(process.env.DATABASE_URL);
url.username = "metabase_readonly";
url.password = process.env.METABASE_DB_PASSWORD;
const option = "options=-c%20search_path%3Danalytics";
url.search = url.search ? `${url.search.slice(1)}&${option}` : option;
console.log(url.toString());
NODE
)"

for file in "$ROOT_DIR"/deploy/analytics/questions/*.sql; do
  echo "==> $(basename "$file")"
  psql "$crm_url" -v ON_ERROR_STOP=1 -f "$file" >/dev/null
done

echo "All analytics questions executed successfully as metabase_readonly."
