FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json

RUN npm install

COPY shared shared
COPY backend backend

RUN npm --workspace backend run build

FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app/backend

ENV NODE_ENV=production
ENV DATA_FILE_PATH=/app/backend/data/db.json

COPY --from=builder /app/backend/dist ./dist

EXPOSE 4000

CMD ["dist/server.cjs"]
