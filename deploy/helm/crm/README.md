# CRM Helm Chart

This chart packages the CRM app for Kubernetes with small-host defaults. It is intended to run on a tiny single-node setup now and move later to a larger cluster by changing values.

## Prerequisites

- A Kubernetes cluster with an ingress controller.
- A PostgreSQL database reachable from the cluster. The chart does not run PostgreSQL.
- A Kubernetes secret named `crm-secrets` by default.
- The CRM images pushed to a registry:
  - `crm-frontend`
  - `crm-backend`
  - `crm-bot`
  - `crm-reminder`
  - `crm-migrate`

## Secret Contract

Create the secret outside Helm so secrets do not land in chart values:

```bash
kubectl create secret generic crm-secrets \
  --from-literal=DATABASE_URL='postgres://user:password@host:5432/crm' \
  --from-literal=AUTH_SECRET='replace-me' \
  --from-literal=AUTH_SYNC_SECRET='replace-me' \
  --from-literal=AUTH_GOOGLE_ID='replace-me' \
  --from-literal=AUTH_GOOGLE_SECRET='replace-me' \
  --from-literal=INTERNAL_API_TOKEN='replace-me' \
  --from-literal=TELEGRAM_BOT_TOKEN='replace-me'
```

Optional Sentry keys can also live in the same secret: `SENTRY_DSN`, `BACKEND_SENTRY_DSN`, `BOT_SENTRY_DSN`, and `REMINDER_SENTRY_DSN`.

## Database Placement

For the current small deployment, keep PostgreSQL outside the chart and point the app at it through the `DATABASE_URL` secret key. When moving off the current machine, prefer RDS PostgreSQL over an in-cluster single-pod database. The optional Terraform in `deploy/terraform` can create RDS later, but the Helm chart only needs the final connection string.

## Small-Host Install

```bash
helm upgrade --install crm ./deploy/helm/crm \
  --namespace crm --create-namespace \
  -f ./deploy/helm/crm/values-small.yaml \
  --set global.imageRegistry=982081063376.dkr.ecr.eu-central-1.amazonaws.com/gavrilikhin \
  --set global.imageTag=<git-sha> \
  --set ingress.host=vocalcrm.site \
  --atomic --wait
```

This keeps each service at one steady-state replica. Frontend and backend can briefly surge to two pods during rollout.

## Later Production Install

After moving to a larger cluster, use `values-prod.yaml` or override `frontend.replicaCount` and `backend.replicaCount` directly.

## Staging Rollout Validation

Use a separate namespace and host when validating rollout behavior:

```bash
helm upgrade --install crm-staging ./deploy/helm/crm \
  --namespace crm-staging --create-namespace \
  -f ./deploy/helm/crm/values-staging.yaml \
  --set global.imageRegistry=982081063376.dkr.ecr.eu-central-1.amazonaws.com/gavrilikhin \
  --set global.imageTag=<git-sha> \
  --atomic --wait
```

In another terminal, poll the staging hostname while deploying a second image tag:

```bash
./deploy/smoke-rollout.sh https://staging.vocalcrm.site/
```

## Rollback

```bash
helm rollback crm --namespace crm
```

## Rollout Smoke Test

Run this from a machine that can reach the public hostname while deploying a new image tag:

```bash
./deploy/smoke-rollout.sh https://vocalcrm.site/
```

For staging, install the same chart into a separate namespace with a different host and image tag. A successful validation has no `failed` lines while Helm replaces the frontend and backend pods.
