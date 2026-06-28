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
COPY backend backend

RUN bun --filter @crm/backend build

FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app/backend

ENV NODE_ENV=production
ENV DATA_FILE_PATH=/app/backend/data/db.json

COPY --from=builder /app/backend/dist ./dist

EXPOSE 4000

CMD ["dist/server.cjs"]
