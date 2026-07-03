# syntax=docker/dockerfile:1

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

RUN bun --filter @crm/bot build \
  && /app/node_modules/.bin/sentry-cli sourcemaps inject bot/dist

FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app/bot

ENV NODE_ENV=production
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE

COPY --from=builder /app/bot/dist ./dist

CMD ["dist/main.cjs"]
