#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${CRM_APP_DIR:-$HOME/crm}"
COMPOSE_FILE="docker-compose.prod.yml"
DEPLOY_REF="${DEPLOY_REF:-main}"
AWS_REGION="${AWS_REGION:-eu-central-1}"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env — create it on the server before deploying." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${CRM_IMAGE_REGISTRY:-}" ]]; then
  echo "CRM_IMAGE_REGISTRY is not set in .env" >&2
  exit 1
fi

if [[ -z "${DEPLOY_SHA:-}" ]]; then
  echo "DEPLOY_SHA is required (image tag from CI)" >&2
  exit 1
fi

export CRM_IMAGE_TAG="$DEPLOY_SHA"

echo "==> Syncing deploy files from git ($DEPLOY_REF @ $DEPLOY_SHA)"
git fetch origin "$DEPLOY_REF"
git checkout "$DEPLOY_REF"
git pull --ff-only origin "$DEPLOY_REF"
git reset --hard "$DEPLOY_SHA"

echo "==> Logging in to ECR"
ECR_HOST="${CRM_IMAGE_REGISTRY%%/*}"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_HOST"

echo "==> Pulling images ($CRM_IMAGE_TAG)"
docker compose -f "$COMPOSE_FILE" pull backend frontend bot reminder migrate

echo "==> Running migrations"
if ! docker compose -f "$COMPOSE_FILE" run --rm -T --no-build migrate; then
  echo "Migration failed — check logs above." >&2
  exit 1
fi

echo "==> Starting services"
docker compose -f "$COMPOSE_FILE" up -d

echo "==> Status"
docker compose -f "$COMPOSE_FILE" ps
