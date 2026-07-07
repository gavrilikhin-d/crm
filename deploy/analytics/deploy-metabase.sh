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

NAMESPACE="${METABASE_NAMESPACE:-analytics}"
RELEASE="${METABASE_HELM_RELEASE:-metabase}"
HOST="${METABASE_INGRESS_HOST:-analytics.vocalcrm.site}"
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"

require_var() {
  if [[ -z "${!1:-}" ]]; then
    echo "$1 is required" >&2
    exit 1
  fi
}

require_var METABASE_ADMIN_EMAIL
require_var METABASE_ADMIN_PASSWORD
require_var METABASE_APP_DB_PASSWORD
require_var MB_ENCRYPTION_SECRET_KEY
require_var METABASE_CRM_DATABASE_URL

if [[ ! -f "$KUBECONFIG" ]]; then
  echo "Missing kubeconfig at $KUBECONFIG" >&2
  exit 1
fi

export KUBECONFIG

echo "==> Ensuring namespace $NAMESPACE"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo "==> Applying metabase-secrets"
kubectl create secret generic metabase-secrets \
  --namespace "$NAMESPACE" \
  --from-literal=MB_ENCRYPTION_SECRET_KEY="$MB_ENCRYPTION_SECRET_KEY" \
  --from-literal=METABASE_APP_DB_PASSWORD="$METABASE_APP_DB_PASSWORD" \
  --from-literal=METABASE_ADMIN_EMAIL="$METABASE_ADMIN_EMAIL" \
  --from-literal=METABASE_ADMIN_PASSWORD="$METABASE_ADMIN_PASSWORD" \
  --from-literal=METABASE_CRM_DATABASE_URL="$METABASE_CRM_DATABASE_URL" \
  --dry-run=client -o yaml | kubectl apply -f -

IP_WHITELIST_ARGS=()
if [[ -n "${METABASE_IP_WHITELIST:-}" ]]; then
  IFS=',' read -r -a ranges <<< "$METABASE_IP_WHITELIST"
  IP_WHITELIST_ARGS+=(--set ingress.ipWhitelist.enabled=true)
  for index in "${!ranges[@]}"; do
    IP_WHITELIST_ARGS+=(--set "ingress.ipWhitelist.sourceRange[$index]=${ranges[$index]}")
  done
fi

echo "==> Deploying Helm release $RELEASE"
helm upgrade --install "$RELEASE" deploy/helm/metabase \
  --namespace "$NAMESPACE" \
  --create-namespace \
  -f deploy/helm/metabase/values.yaml \
  --set ingress.host="$HOST" \
  "${IP_WHITELIST_ARGS[@]}" \
  --atomic \
  --wait \
  --timeout 15m

echo "==> Waiting for Metabase health"
kubectl rollout status "deployment/${RELEASE}-metabase" --namespace "$NAMESPACE" --timeout=10m || \
kubectl rollout status "deployment/${RELEASE}" --namespace "$NAMESPACE" --timeout=10m

echo "==> Bootstrapping Metabase content"
METABASE_URL="https://${HOST}" \
  METABASE_ADMIN_EMAIL="$METABASE_ADMIN_EMAIL" \
  METABASE_ADMIN_PASSWORD="$METABASE_ADMIN_PASSWORD" \
  METABASE_CRM_DATABASE_URL="$METABASE_CRM_DATABASE_URL" \
  node deploy/analytics/bootstrap-metabase.mjs

echo "Metabase is ready at https://${HOST}"
