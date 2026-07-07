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

cleanup_k3s_space() {
  echo "==> k3s disk usage"
  df -h /var/lib/rancher/k3s 2>/dev/null || true
  sudo du -sh \
    /var/lib/rancher/k3s/agent/containerd \
    /var/log/containers \
    /var/log/pods \
    2>/dev/null || true

  echo "==> Pruning unused Kubernetes images"
  if command -v crictl >/dev/null 2>&1; then
    sudo crictl rmi --prune || true
  elif command -v k3s >/dev/null 2>&1; then
    sudo k3s crictl rmi --prune || true
  else
    echo "crictl/k3s not found; skipping Kubernetes image prune"
  fi

  echo "==> k3s disk usage after cleanup"
  df -h /var/lib/rancher/k3s 2>/dev/null || true
  sudo du -sh \
    /var/lib/rancher/k3s/agent/containerd \
    /var/log/containers \
    /var/log/pods \
    2>/dev/null || true
}

configure_sparse_checkout() {
  echo "==> Configuring sparse deploy checkout"
  git config core.sparseCheckout true
  git config core.sparseCheckoutCone false
  mkdir -p .git/info
  cat > .git/info/sparse-checkout <<'EOF'
/.gitignore
/docker-compose.prod.yml
/deploy/Caddyfile
/deploy/analytics/
/deploy/analytics/**
/deploy/helm/
/deploy/helm-deploy.sh
EOF
}

echo "==> Syncing deploy files from git ($DEPLOY_REF @ $DEPLOY_SHA)"
configure_sparse_checkout
git fetch origin "$DEPLOY_REF"
git checkout --detach "$DEPLOY_SHA"
git reset --hard "$DEPLOY_SHA"
configure_sparse_checkout
if git sparse-checkout reapply >/dev/null 2>&1; then
  :
else
  git read-tree -mu HEAD
fi
git clean -ffd

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

cleanup_k3s_space

BAD_POD_REASONS="CreateContainerConfigError|CreateContainerError|InvalidImageName|ErrImagePull|ImagePullBackOff|CrashLoopBackOff"

find_bad_pod() {
  kubectl get pods --namespace "$KUBE_NAMESPACE" \
    -o go-template='{{range .items}}{{if not .metadata.deletionTimestamp}}{{.metadata.name}} {{range .status.containerStatuses}}{{if .state.waiting}}{{.state.waiting.reason}} {{end}}{{end}}{{"\n"}}{{end}}{{end}}' \
    | awk -v reasons="$BAD_POD_REASONS" '$0 ~ reasons { print $1; exit }'
}

print_failed_hook_diagnostics() {
  echo "==> Failed hook diagnostics" >&2
  kubectl get jobs,pods --namespace "$KUBE_NAMESPACE" \
    -l "app.kubernetes.io/instance=$HELM_RELEASE,app.kubernetes.io/component=migrate" >&2 || true
  kubectl describe jobs --namespace "$KUBE_NAMESPACE" \
    -l "app.kubernetes.io/instance=$HELM_RELEASE,app.kubernetes.io/component=migrate" >&2 || true
  kubectl logs --namespace "$KUBE_NAMESPACE" \
    -l "app.kubernetes.io/instance=$HELM_RELEASE,app.kubernetes.io/component=migrate" \
    --all-containers=true --tail=-1 >&2 || true
}

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
  --set certManager.clusterIssuer.email="${ACME_EMAIL:?ACME_EMAIL is required for cert-manager ClusterIssuer}" \
  --atomic \
  --wait \
  --timeout 10m &
helm_pid=$!
monitor_failure_file="$(mktemp)"

(
  while kill -0 "$helm_pid" >/dev/null 2>&1; do
    bad_pod="$(find_bad_pod || true)"
    if [[ -n "$bad_pod" ]]; then
      echo "Detected unrecoverable pod state while Helm is waiting: $bad_pod" >&2
      if ! kubectl describe pod "$bad_pod" --namespace "$KUBE_NAMESPACE" >&2; then
        echo "Pod $bad_pod disappeared before diagnostics could be collected; continuing to watch Helm." >&2
        sleep 5
        continue
      fi
      echo "$bad_pod" > "$monitor_failure_file"
      kill "$helm_pid" >/dev/null 2>&1 || true
      exit 0
    fi
    sleep 10
  done
) &
monitor_pid=$!

set +e
wait "$helm_pid"
helm_rc=$?
set -e

kill "$monitor_pid" >/dev/null 2>&1 || true
wait "$monitor_pid" >/dev/null 2>&1 || true

if [[ -s "$monitor_failure_file" ]]; then
  rm -f "$monitor_failure_file"
  exit 1
fi

rm -f "$monitor_failure_file"
if [[ "$helm_rc" -ne 0 ]]; then
  print_failed_hook_diagnostics
  exit "$helm_rc"
fi

echo "==> Verifying rollouts"
kubectl rollout status "deployment/${HELM_RELEASE}-crm-backend" --namespace "$KUBE_NAMESPACE" --timeout=5m
kubectl rollout status "deployment/${HELM_RELEASE}-crm-frontend" --namespace "$KUBE_NAMESPACE" --timeout=5m
kubectl rollout status "deployment/${HELM_RELEASE}-crm-reminder" --namespace "$KUBE_NAMESPACE" --timeout=5m
kubectl rollout status "deployment/${HELM_RELEASE}-crm-bot" --namespace "$KUBE_NAMESPACE" --timeout=5m

echo "==> Helm status"
helm status "$HELM_RELEASE" --namespace "$KUBE_NAMESPACE"

cleanup_k3s_space
