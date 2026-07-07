# Platform Analytics (Metabase)

Self-hosted Metabase for cross-teacher CRM metrics. It reads from the `analytics` schema in PostgreSQL through a read-only role.

## What gets deployed

- Migration [`backend/drizzle/0006_analytics_views.sql`](../../backend/drizzle/0006_analytics_views.sql): safe views + `metabase_readonly` role
- Helm chart [`deploy/helm/metabase/`](../helm/metabase/): Metabase + internal Postgres for Metabase metadata
- Ingress host default: `analytics.vocalcrm.site`
- Saved questions in [`questions/`](questions/) and bootstrap script [`bootstrap-metabase.mjs`](bootstrap-metabase.mjs)

## One-time database setup

Run CRM migrations as usual (`bun run db:migrate` in `backend/`). Then enable the read-only login:

```bash
METABASE_DB_PASSWORD="$(openssl rand -base64 24)" ./deploy/analytics/ensure-readonly-user.sh
```

Or generate all required secrets and print env values:

```bash
METABASE_ADMIN_EMAIL=you@example.com ./deploy/analytics/create-secrets.sh
```

The CRM connection URL should use `metabase_readonly` and `search_path=analytics`.

## Kubernetes deploy

1. Point DNS `analytics.vocalcrm.site` at the cluster ingress.
2. Put the generated values in `.env` on the deploy host.
3. Deploy:

```bash
./deploy/analytics/deploy-metabase.sh
```

Optional IP restriction (Traefik middleware):

```bash
METABASE_IP_WHITELIST="203.0.113.10/32" ./deploy/analytics/deploy-metabase.sh
```

## Security notes

- Metabase requires login; only platform admins should receive credentials.
- The readonly role can `SELECT` only from `analytics.*` views (OAuth tokens and bind tokens are excluded).
- Keep `metabase-secrets` out of git. Rotate `METABASE_ADMIN_PASSWORD` and `METABASE_DB_PASSWORD` if leaked.
- Prefer private network access from Metabase pods to CRM Postgres (EC2 private IP, not `localhost` from inside Kubernetes).

## Local bootstrap test

After starting Metabase locally on port 3000:

```bash
METABASE_URL=http://localhost:3000 \
METABASE_ADMIN_EMAIL=admin@example.com \
METABASE_ADMIN_PASSWORD=secret \
METABASE_CRM_DATABASE_URL='postgres://metabase_readonly:secret@localhost:5432/crm?options=-c%20search_path%3Danalytics' \
node deploy/analytics/bootstrap-metabase.mjs
```

## Dashboard contents

The bootstrap script creates a **Platform Overview** dashboard with:

- Registered teachers, active students, total lessons, payment volume
- Teachers by plan, lessons by kind (one-off vs recurring)
- Teacher signups by month, payments by month
- Per-teacher overview table
