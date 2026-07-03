#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${CRM_APP_DIR:-$HOME/crm}"
DEPLOY_REF="${DEPLOY_REF:-main}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
KUBE_NAMESPACE="${KUBE_NAMESPACE:-crm}"
HELM_RELEASE="${HELM_RELEASE:-crm}"
KUBE_INGRESS_HOST="${KUBE_INGRESS_HOST:-vocalcrm.site}"
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
PASSED_CRM_IMAGE_REGISTRY="${CRM_IMAGE_REGISTRY:-}"

cd "$APP_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -n "$PASSED_CRM_IMAGE_REGISTRY" ]]; then
  CRM_IMAGE_REGISTRY="$PASSED_CRM_IMAGE_REGISTRY"
fi

if [[ -z "${DEPLOY_SHA:-}" ]]; then
  echo "DEPLOY_SHA is required (image tag from CI)" >&2
  exit 1
fi

if [[ -z "${CRM_IMAGE_REGISTRY:-}" ]]; then
  echo "CRM_IMAGE_REGISTRY is required (for example: 982081063376.dkr.ecr.eu-central-1.amazonaws.com/gavrilikhin)" >&2
  exit 1
fi

if [[ ! -f "$KUBECONFIG" ]]; then
  echo "Missing kubeconfig at $KUBECONFIG. Copy /etc/rancher/k3s/k3s.yaml to this path first." >&2
  exit 1
fi

export KUBECONFIG

echo "==> Syncing deploy files from git ($DEPLOY_REF @ $DEPLOY_SHA)"
git fetch origin "$DEPLOY_REF"
git checkout "$DEPLOY_REF"
git pull --ff-only origin "$DEPLOY_REF"
git reset --hard "$DEPLOY_SHA"

echo "==> Ensuring namespace exists ($KUBE_NAMESPACE)"
kubectl create namespace "$KUBE_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo "==> Checking required app secret"
if ! kubectl get secret crm-secrets --namespace "$KUBE_NAMESPACE" >/dev/null 2>&1; then
  echo "Missing Kubernetes secret crm-secrets in namespace $KUBE_NAMESPACE." >&2
  echo "Create it from your production .env before deploying:" >&2
  echo "  kubectl create secret generic crm-secrets --namespace $KUBE_NAMESPACE --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -" >&2
  exit 1
fi

echo "==> Refreshing ECR image pull secret"
ECR_HOST="${CRM_IMAGE_REGISTRY%%/*}"
ECR_PASSWORD="$(aws ecr get-login-password --region "$AWS_REGION")"
kubectl create secret docker-registry ecr-pull-secret \
  --namespace "$KUBE_NAMESPACE" \
  --docker-server="$ECR_HOST" \
  --docker-username=AWS \
  --docker-password="$ECR_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Deploying Helm release ($HELM_RELEASE -> $DEPLOY_SHA)"
helm upgrade --install "$HELM_RELEASE" deploy/helm/crm \
  --namespace "$KUBE_NAMESPACE" \
  --create-namespace \
  -f deploy/helm/crm/values-small.yaml \
  --set global.imageRegistry="$CRM_IMAGE_REGISTRY" \
  --set global.imageTag="$DEPLOY_SHA" \
  --set global.imagePullSecrets[0].name=ecr-pull-secret \
  --set ingress.host="$KUBE_INGRESS_HOST" \
  --set config.appBaseUrl="https://$KUBE_INGRESS_HOST" \
  --set config.authUrl="https://$KUBE_INGRESS_HOST" \
  --rollback-on-failure \
  --wait \
  --timeout 10m

echo "==> Verifying rollouts"
kubectl rollout status "deployment/${HELM_RELEASE}-crm-backend" --namespace "$KUBE_NAMESPACE" --timeout=5m
kubectl rollout status "deployment/${HELM_RELEASE}-crm-frontend" --namespace "$KUBE_NAMESPACE" --timeout=5m
kubectl rollout status "deployment/${HELM_RELEASE}-crm-reminder" --namespace "$KUBE_NAMESPACE" --timeout=5m
kubectl rollout status "deployment/${HELM_RELEASE}-crm-bot" --namespace "$KUBE_NAMESPACE" --timeout=5m

echo "==> Helm status"
helm status "$HELM_RELEASE" --namespace "$KUBE_NAMESPACE"
