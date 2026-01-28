FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json ./
COPY pnpm-lock.yaml* ./
RUN pnpm install

COPY . .

EXPOSE 3000

CMD ["node", "scripts/wait-for-db.js"]
