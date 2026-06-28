FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY frontend/package.json frontend/package.json

RUN npm install

COPY shared shared
COPY frontend frontend

ARG BACKEND_INTERNAL_URL=http://backend:4000
ARG REMINDER_INTERNAL_URL=http://reminder:4001
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV REMINDER_INTERNAL_URL=$REMINDER_INTERNAL_URL

RUN npm --workspace frontend run build

WORKDIR /app/frontend

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
