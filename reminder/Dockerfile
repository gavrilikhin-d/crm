FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY reminder/package.json reminder/package.json

RUN npm install

COPY shared shared
COPY reminder reminder

RUN npm --workspace reminder run build

FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app/reminder

ENV NODE_ENV=production

COPY --from=builder /app/reminder/dist ./dist

EXPOSE 4001

CMD ["dist/main.cjs"]
