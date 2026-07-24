# Vocal Teacher CRM

A mini CRM for vocal teachers and private tutors. It manages students, individual and group lessons, recurring schedules, lesson packages, payments, lesson balances, debts, vacations, Telegram notifications, and Google Calendar sync.

## Stack

- **Frontend:** Next.js, React, TypeScript, shadcn/ui, Storybook.
- **Backend:** Node.js HTTP API, PostgreSQL, Drizzle ORM.
- **Bot:** Telegram webhook service built with Telegraf.
- **Reminder:** background worker for lesson reminders and reminder state.
- **Shared:** common TypeScript types and business helpers used by all services.
- **Observability:** optional Loki/Grafana logs and Sentry errors, logs, tracing, and profiling.

## Repository Layout

```text
frontend/   Next.js app, UI, auth proxy routes, Storybook
backend/    API server, Drizzle schema/migrations, store logic
bot/        Telegram webhook service
reminder/   Scheduled reminder worker
shared/     Shared types and helpers
deploy/     Production Caddy and Helm deployment files
scripts/    Local environment checks
```

## Quick Start

Install dependencies and create your environment file:

```bash
bun install
cp .env.example .env
```

Fill the required local development variables in `.env`:

```bash
AUTH_SECRET=...          # generate with: openssl rand -base64 32
AUTH_GOOGLE_ID=...       # Google OAuth client ID
AUTH_GOOGLE_SECRET=...   # Google OAuth client secret
INTERNAL_API_TOKEN=...   # generate with: openssl rand -base64 32
```

Start PostgreSQL, apply the schema, seed demo data, and run the full local stack:

```bash
docker compose up -d postgres
bun run db:migrate
bun run seed
bun run dev:all
```

The web app runs at `http://localhost:3000`. The default local database URL is `postgres://crm:crm@localhost:5432/crm`.

For iterative schema work, `bun run db:push` is also available. For committed schema changes, generate a named migration from the backend package:

```bash
bun --filter @crm/backend db:generate -- --name=add_student_reminder_minutes
bun run db:migrate
```

Use a short descriptive `--name` for the schema change you are making.

## Running Services Individually

```bash
bun run dev:backend
bun run dev:frontend
bun run dev:bot
bun run dev:reminder
```

Useful checks:

```bash
bun run lint
bun run typecheck
bun run test
bun run storybook
```

## End-to-End Tests

The e2e suite uses Playwright with a local Dex OIDC provider, so it exercises a real OAuth redirect flow without contacting Google. It uses isolated local ports by default:

- Frontend: `http://localhost:3100`
- Backend: `http://localhost:4100`
- Dex OIDC: `http://localhost:5556/dex`
- PostgreSQL: `localhost:55432`, database `crm_e2e`

Install the Playwright browser once:

```bash
bun run test:e2e:install-browsers
```

Run the full e2e flow headlessly:

```bash
bun run test:e2e
```

This starts the e2e Postgres and Dex containers, creates/migrates the e2e database, starts the backend/frontend dev servers, and runs the Playwright spec.

For Playwright UI mode, start the supporting services and migrate first:

```bash
bun run test:e2e:services
bun run test:e2e:setup-db
DATABASE_URL=${E2E_DATABASE_URL:-postgres://crm:crm@localhost:${E2E_POSTGRES_PORT:-55432}/crm_e2e} bun run db:migrate
cd frontend
E2E_DATABASE_URL=${E2E_DATABASE_URL:-postgres://crm:crm@localhost:${E2E_POSTGRES_PORT:-55432}/crm_e2e} bun run test:e2e -- --ui
```

For a visible browser without the Playwright UI:

```bash
cd frontend
E2E_DATABASE_URL=${E2E_DATABASE_URL:-postgres://crm:crm@localhost:${E2E_POSTGRES_PORT:-55432}/crm_e2e} bun run test:e2e -- --headed
```

When finished, stop the e2e containers:

```bash
docker compose --profile e2e stop postgres oidc
```

## Docker

Local container stack:

```bash
docker compose up --build
```

Production-style stack:

```bash
bun run prod:build
bun run prod:migrate
bun run prod:up
```

`docker-compose.prod.yml` runs PostgreSQL, migration job, backend, frontend, bot, reminder, and Caddy. Set `POSTGRES_PASSWORD`, `DOMAIN`, `ACME_EMAIL`, and image registry variables in `.env` before deploying.

## Current Features

- Google OAuth login and per-account data isolation.
- Student cards with name, avatar, status, Telegram connection token, and detailed student page.
- Day/week/month calendar with drag-and-drop rescheduling, resize previews, vacations, and live snapshot updates.
- Individual and group lessons with lesson status and per-participant attendance status.
- Recurring weekly lessons, represented as generated lesson instances.
- Vacation periods that cancel scheduled lessons for whole days or specific time ranges.
- Lesson packages and payments, with currency stored per package/payment.
- Lesson balances: paid, charged, remaining, and debt counts.
- Debt handling per student, including group lessons where one student's debt does not affect others.
- Teacher-wide default lesson reminder lead times in CRM settings.
- Student-specific reminder preferences through the Telegram bot, including custom minute intervals.
- Telegram lesson reminders with attendance buttons and `/notifications` preferences.
- Google Calendar one-way sync from CRM to Calendar.
- Runtime UI language switching between Russian and English, with browser preference detection and stored locale.
- Account deletion from settings.

## Settings

CRM settings currently include:

- UI language (`ru`, `en`), persisted in local storage and a cookie so SSR uses the selected language.
- Default currency for newly created payments and lesson packages.
- Default lesson reminder lead times, including custom intervals.
- Google Calendar connection and sync toggle.
- Account deletion.

## Telegram Bot

Telegram is optional. If no bot token is configured, the web app still works and the bot service exposes only its health endpoint.

### Production

1. Create a bot with BotFather.
2. Set the production bot variables:

```bash
TELEGRAM_BOT_TOKEN=123456:token
TELEGRAM_WEBHOOK_BASE_URL=https://vocalcrm.site
TELEGRAM_WEBHOOK_SECRET=replace-with-url-safe-random-value
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=VocalLessonBot
```

3. Run the web app and bot service.
4. Open a student card, copy the Telegram connection link, and send it to the student.
5. The student opens the link; the bot receives `/start <token>` and binds the Telegram chat to that student.

### Local Development

Use a separate test bot so local development does not re-register the production webhook.

1. Create a test bot with BotFather.
2. Install [ngrok](https://ngrok.com/download) and ensure `ngrok` is on your `PATH`.
3. Add local bot variables:

```bash
TELEGRAM_DEV_BOT_TOKEN=123456:test-token
TELEGRAM_DEV_WEBHOOK_SECRET=replace-with-url-safe-random-value
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YourTestBot
BOT_PORT=4002
```

4. Run `bun run dev:all`.

`dev:all` starts `ngrok http $BOT_PORT` (default `4002`) and injects `TELEGRAM_DEV_WEBHOOK_BASE_URL` with the public HTTPS URL before starting the bot. If an ngrok agent is already running, that tunnel is reused.

Outside `NODE_ENV=production`, `TELEGRAM_DEV_BOT_TOKEN` overrides `TELEGRAM_BOT_TOKEN` for the bot and reminder services.

### Reminder Timing

Pending lesson reminder rows are scheduled at write time (lesson create/update/cancel, participant changes, and reminder preference updates). The reminder service claims due rows (`FOR UPDATE SKIP LOCKED`) every minute and sends Telegram messages.

Lead times are resolved in this order:

1. Student-specific Telegram preferences.
2. Teacher/account defaults from CRM settings.
3. Environment fallback from `LESSON_REMINDER_MINUTES`.

`LESSON_REMINDER_MINUTES=1440,120` means reminders 24 hours and 2 hours before the lesson.

## Google Calendar

Google Calendar sync is one-way: CRM creates and updates scheduled lessons in Google Calendar, and removes cancelled or completed lessons from the calendar.

1. In [Google Cloud Console](https://console.cloud.google.com/), enable **Google Calendar API** for the same OAuth client used by sign-in (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`).
2. Add the redirect URI: `{APP_BASE_URL}/api/google-calendar/callback`.
   For local development: `http://localhost:3000/api/google-calendar/callback`.
3. In CRM settings, click **Connect Google Calendar**, then enable sync.

Optional event timezone:

```bash
APP_TIMEZONE=Europe/Minsk
```

## Internationalization

The frontend has a custom typed i18n layer with Russian and English dictionaries. The selected locale is stored in `localStorage` and in a cookie. The cookie allows the first server render to use the selected language; browser preferences are used when no stored locale exists.

When adding UI text:

- Add keys to `frontend/src/i18n/locales/ru.ts`.
- Add matching English values to `frontend/src/i18n/locales/en.ts`.
- Use `useI18n()` and `t(...)` in client components.
- Use locale-aware date/label helpers where dates, statuses, currencies, or weekdays are displayed.

## Observability

### Loki and Grafana

For local development with `bun run dev:all`, the bot and reminder services can push JSON logs directly to Loki:

```bash
bun run observability:up
```

Set:

```bash
LOKI_PUSH_URL=http://127.0.0.1:3100/loki/api/v1/push
```

Restart `bun run dev:all`, then open Grafana at `http://localhost:3030`.

For a Docker stack, Alloy collects stdout logs from CRM containers:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

- **Grafana:** `http://localhost:3030`
- **Dashboard:** CRM → CRM Logs

Example LogQL queries:

```logql
{service="bot"} | json | level="error"
{service="reminder"} | json | msg=~"backend unreachable"
{service="bot"} | json | handler=~"command:.*"
```

Backend logs in local `bun` development are still plain terminal output.

### Sentry

Sentry is optional and can receive errors, warning/error logs, tracing, runtime metrics, and profiling data:

```bash
NEXT_PUBLIC_SENTRY_DSN=https://...@....ingest.de.sentry.io/...   # Next.js browser
SENTRY_DSN=https://...@....ingest.de.sentry.io/...               # Next.js server
BACKEND_SENTRY_DSN=https://...@....ingest.de.sentry.io/...       # backend API
BOT_SENTRY_DSN=https://...@....ingest.de.sentry.io/...           # Telegram bot
REMINDER_SENTRY_DSN=https://...@....ingest.de.sentry.io/...      # reminder service
SENTRY_AUTH_TOKEN=...                                            # source map upload
```

The frontend uses `/monitoring` as the browser tunnel route to reduce ad-blocker interference.

## Main API Endpoints

Public/backend routes:

- `GET /api/health`
- `POST /api/auth/sync`
- `GET /api/google-calendar/callback`

Authenticated CRM routes:

- `GET /api/account`
- `DELETE /api/account`
- `GET /api/snapshot`
- `GET /api/dashboard`
- `GET /api/balances`
- `PATCH /api/settings`
- `POST /api/vacation-periods`
- `DELETE /api/vacation-periods/:id`
- `GET /api/google-calendar/status`
- `GET /api/google-calendar/connect`
- `POST /api/google-calendar/sync`
- `DELETE /api/google-calendar/disconnect`
- `GET /api/students/:id/avatar`
- `POST /api/students`
- `PATCH /api/students/:id`
- `DELETE /api/students/:id`
- `POST /api/lesson-packages`
- `DELETE /api/lesson-packages/:id`
- `POST /api/lessons`
- `PATCH /api/lessons/:id`
- `DELETE /api/lessons/:id?scope=single|following|all`
- `POST /api/lessons/:id/cancel`
- `POST /api/lessons/:id/complete`
- `POST /api/lessons/:id/participants`
- `DELETE /api/lessons/:id/participants/:studentId`
- `POST /api/lessons/:id/participants/:studentId/status`
- `POST /api/payments`
- `POST /api/balance-adjustments`

Internal worker/bot routes are protected by `INTERNAL_API_TOKEN`:

- `POST /internal/lessons/:id/participants/:studentId/status`
- `POST /internal/telegram/bind`
- `GET /internal/telegram/profile`
- `PATCH /internal/telegram/preferences`
- `POST /internal/reminders`
- `POST /internal/reminders/claim`
- `POST /internal/reminders/backfill`
- `PATCH /internal/reminders/:id`
- `GET /internal/payment-reminder-context/:studentId`

## Production database (RDS)

Prod Postgres is AWS RDS (not a container on the EC2/k3s host). App images are distroless — do **not** try `psql`, shells, or `printenv` inside running pods.

### Prefer safer read paths first

1. **Metabase** (`https://analytics.vocalcrm.site`) — connects as `metabase_readonly`, which can only `SELECT` from `analytics.*` views. Use this for exploration and custom SQL when the data is already exposed there. See [`deploy/analytics/README.md`](deploy/analytics/README.md).
2. **Admin SQL** — only when you need `public.*` or writes. Connect from the EC2 deploy host with a short-lived Docker client and `DATABASE_URL` from `~/crm/.env`.

### Connect for admin SQL (EC2)

```bash
cd ~/crm
source .env

docker run --rm -it --network host \
  -e PGURL="$DATABASE_URL" \
  postgres:16-alpine \
  sh -c 'psql "$PGURL" -v ON_ERROR_STOP=1'
```

### Safe write workflow

Treat every write as dangerous until proven otherwise:

1. Open an interactive `psql` session (above), not a one-shot heredoc for multi-step edits.
2. Start a transaction and **do not COMMIT until you have checked the result**:

```sql
BEGIN;

-- 1) Find the exact row(s)
SELECT id, email, name, plan
FROM accounts
WHERE email = 'teacher@example.com';

-- 2) Mutate with a narrow WHERE (prefer primary key / unique email)
UPDATE accounts
SET plan = 'premium',
    updated_at = now()
WHERE email = 'teacher@example.com'
RETURNING id, email, plan, updated_at;

-- 3) Confirm: exactly one row, expected values
-- If anything looks wrong:
ROLLBACK;

-- Only when the RETURNING row is correct:
COMMIT;
```

Rules of thumb:

- Always `BEGIN` … inspect … `COMMIT` or `ROLLBACK`. Prefer `ROLLBACK` if unsure.
- Never run bare `UPDATE` / `DELETE` without a transaction and a `RETURNING` (or a follow-up `SELECT`).
- Prefer `WHERE id = '…'` or unique `email`; avoid broad predicates (`WHERE plan = 'free'`, etc.).
- Use `-v ON_ERROR_STOP=1` so a failed statement aborts instead of continuing.
- Account plans in DB are `free`, `standard`, or `premium` (paid = `standard` or `premium`).

### Set an account to premium

```sql
BEGIN;

SELECT id, email, plan FROM accounts WHERE email = 'teacher@example.com';

UPDATE accounts
SET plan = 'premium',
    updated_at = now()
WHERE email = 'teacher@example.com'
RETURNING id, email, plan, updated_at;

-- COMMIT;   -- only after RETURNING shows exactly one correct row
-- ROLLBACK; -- if not
```

## Legacy Data Import

If you still have a legacy JSON database at `backend/data/db.json`, import it after applying the schema:

```bash
bun run db:migrate
bun run migrate:json
```

Set `DATA_FILE_PATH` if the file is elsewhere.

## Known MVP Limits

- Lessons are treated as offline and use the teacher/account timezone.
- Students are assumed to be adults.
- There are no student notes, rich analytics, revenue reports, or lesson materials.
- Recurring lessons are stored as a generated weekly series rather than a fully dynamic recurrence engine.
