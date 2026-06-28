FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY bot/package.json bot/package.json

RUN npm install

COPY shared shared
COPY bot bot

WORKDIR /app/bot

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
