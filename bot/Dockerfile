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
COPY bot bot

ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_RELEASE

RUN bun --filter @crm/bot build \
  && if [ -n "$SENTRY_AUTH_TOKEN" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_PROJECT" ] && [ -n "$SENTRY_RELEASE" ]; then \
    /app/node_modules/.bin/sentry-cli sourcemaps inject bot/dist \
    && /app/node_modules/.bin/sentry-cli sourcemaps upload --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" --release "$SENTRY_RELEASE" bot/dist; \
  else \
    echo "Skipping bot source map upload; Sentry release upload variables are incomplete."; \
  fi

FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app/bot

ENV NODE_ENV=production
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE

COPY --from=builder /app/bot/dist ./dist

CMD ["dist/main.cjs"]
