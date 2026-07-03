FROM oven/bun:1.2.10 AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY bot/package.json bot/package.json
COPY reminder/package.json reminder/package.json

RUN bun install --frozen-lockfile

COPY shared shared
COPY frontend frontend

ARG BACKEND_INTERNAL_URL=http://backend:4000
ARG REMINDER_INTERNAL_URL=http://reminder:4001
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_RELEASE
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV REMINDER_INTERNAL_URL=$REMINDER_INTERNAL_URL
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
ENV SENTRY_RELEASE=$SENTRY_RELEASE
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

RUN bun --filter @crm/frontend build

FROM gcr.io/distroless/nodejs22-debian12 AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=40s \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3000').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["frontend/server.js"]
