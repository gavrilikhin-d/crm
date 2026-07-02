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
COPY backend backend

RUN bun --filter @crm/backend build

FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app/backend

ENV NODE_ENV=production

COPY --from=builder /app/backend/dist ./dist

VOLUME ["/app/backend/data"]

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:4000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["dist/server.cjs"]
