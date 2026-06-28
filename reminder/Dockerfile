FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY reminder/package.json reminder/package.json

RUN npm install

COPY shared shared
COPY reminder reminder

WORKDIR /app/reminder

ENV NODE_ENV=production
EXPOSE 4001

CMD ["npm", "run", "start"]
