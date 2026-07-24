## Learned User Preferences

- Prefer Bun for installs, scripts, and tests; do not default to npm or ad-hoc Node test runners when Bun is already set up.
- Keep user-facing copy behind i18n (including Storybook strings); use `useI18n()` in client components so locale switching works, and avoid hardcoded English or Russian UI text.
- Always display times in 24-hour format in the calendar and related UI; omit time (including `00:00`) from date-only labels such as day-view headers.
- Put screen UI under `frontend/src/screens/<screen>/` with screen-only pieces in that screen's `components/`; keep frontend-only helpers in the frontend package, not `shared`.
- When fixing bugs or changing behavior, add or update tests covering the regression.
- For Storybook/Chromatic, use CSF Next; only add multi-viewport Chromatic coverage for screens/components that actually change by layout, and keep viewport helpers DRY.
- Prefer compact, less wordy settings and forms; avoid extra labels that do not add meaning.
- Prefer Telegram UX via command hints, reply-keyboard shortcuts, and inline keyboards over typing raw commands or timezone strings; accept natural-language durations (e.g. `30 мин`, `3 ч`) and turn them into buttons.
- Production images are distroless: do not suggest `printenv`, `psql`, or an interactive shell inside running app containers.
- When implementing an attached plan, do not edit the plan file; reuse existing todos and mark them in progress as work proceeds.

## Learned Workspace Facts

- Vocal Teacher CRM is a Bun workspace monorepo with `frontend` (Next.js), `backend` (HTTP API + Drizzle/Postgres), `bot` (Telegraf Telegram webhook), `reminder`, and `shared`.
- Production app host is `vocalcrm.site` on AWS `eu-central-1`: Helm on k3s/EC2, images from ECR, deploys via SSM; keep resource usage modest for a small instance.
- Production database is AWS RDS Postgres, not a Postgres container on the EC2/k3s host.
- Teacher/student avatars and similar uploads are stored in S3, not on the backend filesystem; deleting teachers/students should remove their S3 objects.
- Local full stack is `bun run dev:all`; the Telegram bot uses webhooks in prod and a separate test bot for local development. For local test bot to work, TELEGRAM_DEV_WEBHOOK_BASE_URL should point to a started ngrok
- Platform analytics are served by Metabase (e.g. `analytics.vocalcrm.site`); deploy notes live under `deploy/analytics`.
- Visual coverage uses Storybook plus Chromatic in CI; Chromatic project tokens belong in GitHub secrets/envs, not the repo.
- Auth is Google OAuth via Auth.js; accounts are multi-tenant with plan limits (free tier is deliberately constrained, including recurring-lesson caps).
- UI locales include Russian and English with browser-based default selection; time formatting goes through shared i18n helpers with `hour12: false`.
- Calendar data syncs to the client over WebSocket with month-paged snapshots and incremental updates rather than full resends on every change.
- Bot lesson RSVP (attend/decline) is handled from `/schedule` via inline buttons or text, not separate `/attend` or `/decline` commands.
