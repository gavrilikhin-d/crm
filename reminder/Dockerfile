FROM oven/bun:1.2.10-alpine AS builder

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

RUN bun --filter @crm/reminder build

FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app/reminder

ENV NODE_ENV=production

COPY --from=builder /app/reminder/dist ./dist

EXPOSE 4001

CMD ["dist/main.cjs"]
