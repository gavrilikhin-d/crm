#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://vocalcrm.site/}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-1}"

echo "Polling $URL every ${INTERVAL_SECONDS}s. Stop with Ctrl+C."

while true; do
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  if curl -fsS "$URL" >/dev/null; then
    echo "$timestamp ok"
  else
    echo "$timestamp failed"
  fi
  sleep "$INTERVAL_SECONDS"
done
