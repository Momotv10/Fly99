FROM node:18-alpine AS builder
LABEL "language"="nodejs"
LABEL "framework"="nest.js"

WORKDIR /app

COPY stams-fixed/package.json ./
COPY stams-fixed/prisma ./prisma/

RUN npm install

COPY stams-fixed/tsconfig*.json ./
COPY stams-fixed/nest-cli.json ./
COPY stams-fixed/src ./src

RUN npx prisma generate
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY stams-fixed/package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
