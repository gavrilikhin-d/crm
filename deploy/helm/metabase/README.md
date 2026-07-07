# Metabase Helm Chart

Deploys self-hosted Metabase for CRM platform analytics.

## Prerequisites

- Kubernetes cluster with Traefik ingress and cert-manager (same as the CRM chart)
- Kubernetes secret `metabase-secrets` in the target namespace
- DNS for `ingress.host` (default `analytics.vocalcrm.site`)
- CRM migration `0006_analytics_views` applied and `metabase_readonly` password set

Use [`deploy/analytics/create-secrets.sh`](../../analytics/create-secrets.sh) to generate secret values.

## Install

```bash
helm upgrade --install metabase ./deploy/helm/metabase \
  --namespace analytics --create-namespace \
  -f ./deploy/helm/metabase/values.yaml \
  --set ingress.host=analytics.vocalcrm.site \
  --atomic --wait
```

Or run the full pipeline:

```bash
./deploy/analytics/deploy-metabase.sh
```

## IP allowlist

```bash
helm upgrade --install metabase ./deploy/helm/metabase \
  --namespace analytics \
  --set ingress.ipWhitelist.enabled=true \
  --set ingress.ipWhitelist.sourceRange[0]=203.0.113.10/32
```

## Secret keys

| Key | Purpose |
|-----|---------|
| `MB_ENCRYPTION_SECRET_KEY` | Metabase encryption key |
| `METABASE_APP_DB_PASSWORD` | Internal Postgres password for Metabase metadata |
| `METABASE_ADMIN_EMAIL` | Bootstrap admin login |
| `METABASE_ADMIN_PASSWORD` | Bootstrap admin password |
| `METABASE_CRM_DATABASE_URL` | Read-only CRM Postgres URL (`metabase_readonly`, `search_path=analytics`) |

See [`deploy/analytics/README.md`](../../analytics/README.md) for the full workflow.
