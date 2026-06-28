FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json

RUN npm install

COPY shared shared
COPY backend backend

WORKDIR /app/backend

ENV NODE_ENV=production
ENV DATA_FILE_PATH=/app/backend/data/db.json
EXPOSE 4000

CMD ["npm", "run", "start"]
