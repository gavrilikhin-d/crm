# Metabase Helm Chart

Deploys self-hosted Metabase for CRM platform analytics.

Full manual workflow: [`deploy/analytics/README.md`](../../analytics/README.md)

## Prerequisites

- k3s cluster with Traefik ingress and cert-manager (same as the CRM chart)
- DNS A record: `analytics.vocalcrm.site` → EC2 IP
- Kubernetes secret `metabase-secrets` in namespace `analytics`
- CRM migration `0006_analytics_views` applied on RDS
- `metabase_readonly` role password set on RDS

## Secret keys

| Key | Purpose |
|-----|---------|
| `MB_ENCRYPTION_SECRET_KEY` | Metabase encryption key (`openssl rand -hex 32`) |
| `METABASE_APP_DB_PASSWORD` | Password for Metabase's internal Postgres pod |

## Install

```bash
kubectl create namespace analytics

kubectl create secret generic metabase-secrets \
  --namespace analytics \
  --from-literal=MB_ENCRYPTION_SECRET_KEY='...' \
  --from-literal=METABASE_APP_DB_PASSWORD='...'

helm upgrade --install metabase ./deploy/helm/metabase \
  --namespace analytics \
  -f ./deploy/helm/metabase/values.yaml \
  --set ingress.host=analytics.vocalcrm.site \
  --atomic --wait
```

Then complete setup in the browser and connect RDS manually — see [`deploy/analytics/README.md`](../../analytics/README.md).

## Update

```bash
helm upgrade metabase ./deploy/helm/metabase \
  --namespace analytics \
  -f ./deploy/helm/metabase/values.yaml \
  --set ingress.host=analytics.vocalcrm.site \
  --atomic --wait
```

## Rollback

```bash
helm rollback metabase --namespace analytics
```
