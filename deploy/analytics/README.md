# Platform Analytics (Metabase)

Self-hosted Metabase for cross-teacher CRM metrics. It reads from the `analytics` schema in RDS through a read-only Postgres role.

Helm chart: [`deploy/helm/metabase/`](../helm/metabase/)

## Prerequisites

1. **CRM migration applied** — deploy `main` so migration `0006_analytics_views` runs. It creates `analytics.*` views and the `metabase_readonly` role (no password yet).

2. **DNS** — A record `analytics` → same EC2 IP as `vocalcrm.site`.

3. **RDS access from k3s** — security groups allow the node to reach RDS on port 5432.

4. **kubectl + helm** on the deploy host, with kubeconfig pointing at k3s.

---

## One-time: enable the readonly DB user

Generate a **new** password for `metabase_readonly` (not your CRM `DATABASE_URL` password):

```bash
openssl rand -base64 24
```

Connect to RDS as the admin user from `.env` (`DATABASE_URL`) and run:

```sql
ALTER ROLE metabase_readonly WITH LOGIN PASSWORD 'paste-new-password-here';
```

On EC2 without host `psql`:

```bash
cd ~/crm
source .env

docker run --rm -i --network host \
  -e PGURL="$DATABASE_URL" \
  postgres:16-alpine \
  sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1' <<'SQL'
ALTER ROLE metabase_readonly WITH LOGIN PASSWORD 'paste-new-password-here';
SQL
```

Save that password — you enter it in the Metabase UI when adding the CRM database.

---

## One-time: deploy Metabase

### 1. Generate secrets

```bash
openssl rand -hex 32          # MB_ENCRYPTION_SECRET_KEY
openssl rand -base64 24       # METABASE_APP_DB_PASSWORD
```

### 2. Create Kubernetes secret

Only these two keys are required by the Helm chart:

```bash
kubectl create namespace analytics

kubectl create secret generic metabase-secrets \
  --namespace analytics \
  --from-literal=MB_ENCRYPTION_SECRET_KEY='paste-hex-key' \
  --from-literal=METABASE_APP_DB_PASSWORD='paste-app-db-password' \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 3. Install Helm release

From the repo root on a machine with the full checkout:

```bash
helm upgrade --install metabase deploy/helm/metabase \
  --namespace analytics \
  --create-namespace \
  -f deploy/helm/metabase/values.yaml \
  --set ingress.host=analytics.vocalcrm.site \
  --atomic --wait --timeout 15m
```

Wait for the pod:

```bash
kubectl rollout status deployment/metabase-metabase -n analytics --timeout=10m
kubectl get pods -n analytics
```

### 4. Optional: reduce memory on small hosts

```bash
kubectl set env deployment/metabase-metabase -n analytics \
  JAVA_OPTS='-Xmx384m -Xms256m'

helm upgrade metabase deploy/helm/metabase \
  --namespace analytics \
  --reuse-values \
  --set resources.limits.memory=768Mi \
  --set resources.requests.memory=384Mi \
  --set appDatabase.resources.limits.memory=128Mi
```

### 5. First-time setup in the browser

Open **https://analytics.vocalcrm.site** and complete the setup wizard:

- Create your **admin** email and password (platform owner only)
- Organization name: e.g. `CRM Analytics`

Then **Admin → Databases → Add database**:

| Field | Value |
|-------|--------|
| Type | PostgreSQL |
| Name | `CRM` |
| Host | RDS endpoint |
| Port | `5432` |
| Database | `crm` |
| Username | `metabase_readonly` |
| Password | password from the `ALTER ROLE` step |
| SSL | On if RDS requires it |

Under advanced options, restrict schemas to **`analytics`** only.

Build dashboards in the Metabase UI (**New → SQL query** or the visual query builder) using tables in the `analytics` schema.

---

## Update Metabase

Pull the latest chart from git, then upgrade in place:

```bash
cd ~/crm
git pull origin main

helm upgrade metabase deploy/helm/metabase \
  --namespace analytics \
  -f deploy/helm/metabase/values.yaml \
  --set ingress.host=analytics.vocalcrm.site \
  --atomic --wait --timeout 15m
```

To pin a specific Metabase version:

```bash
helm upgrade metabase deploy/helm/metabase \
  --namespace analytics \
  --reuse-values \
  --set image.tag=v0.52.6
```

Check rollout:

```bash
kubectl rollout status deployment/metabase-metabase -n analytics
kubectl logs -n analytics deployment/metabase-metabase --tail=50
```

CRM data and saved Metabase questions live in separate stores:

- **CRM metrics** — RDS (`analytics.*` views)
- **Metabase settings/dashboards** — Postgres pod inside the `analytics` namespace (`metabase-metabase-app-db`)

Upgrading the Helm chart does not touch RDS or CRM data.

---

## Optional: IP allowlist

```bash
helm upgrade metabase deploy/helm/metabase \
  --namespace analytics \
  --reuse-values \
  --set ingress.ipWhitelist.enabled=true \
  --set ingress.ipWhitelist.sourceRange[0]=YOUR.PUBLIC.IP/32
```

---

## Uninstall

```bash
helm uninstall metabase -n analytics
kubectl delete namespace analytics   # also removes metabase-secrets and the internal app DB PVC
```

RDS analytics views and `metabase_readonly` remain until you drop them manually.

---

## Troubleshooting

**DNS / NXDOMAIN** — verify with `dig @8.8.8.8 +short analytics.vocalcrm.site`. Flush Mac DNS or use public resolvers if local cache is stale.

**High RAM** — cap JVM with `JAVA_OPTS` (see step 4), add swap as a safety net, or move to a larger instance / Metabase Cloud.

**CRM database connection fails in Metabase** — check RDS security groups, SSL settings, and that `metabase_readonly` password is correct.
