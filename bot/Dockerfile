FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY bot/package.json bot/package.json

RUN npm install

COPY shared shared
COPY bot bot

RUN npm --workspace bot run build

FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app/bot

ENV NODE_ENV=production

COPY --from=builder /app/bot/dist ./dist

CMD ["dist/main.cjs"]
