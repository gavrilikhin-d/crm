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
COPY reminder reminder

ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_RELEASE

RUN bun --filter @crm/reminder build \
  && if [ -n "$SENTRY_AUTH_TOKEN" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_PROJECT" ] && [ -n "$SENTRY_RELEASE" ]; then \
    /app/node_modules/.bin/sentry-cli sourcemaps inject reminder/dist \
    && /app/node_modules/.bin/sentry-cli sourcemaps upload --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" --release "$SENTRY_RELEASE" reminder/dist; \
  else \
    echo "Skipping reminder source map upload; Sentry release upload variables are incomplete."; \
  fi

FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app/reminder

ENV NODE_ENV=production
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE

COPY --from=builder /app/reminder/dist ./dist

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=30s \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:4001/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["dist/main.cjs"]
