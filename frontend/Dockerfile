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
COPY frontend frontend

ARG BACKEND_INTERNAL_URL=http://backend:4000
ARG REMINDER_INTERNAL_URL=http://reminder:4001
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV REMINDER_INTERNAL_URL=$REMINDER_INTERNAL_URL

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

CMD ["frontend/server.js"]
