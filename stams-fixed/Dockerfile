FROM node:18-alpine AS builder
LABEL "language"="nodejs"
LABEL "framework"="nest.js"

WORKDIR /app

COPY stams-fixed/package.json ./
COPY stams-fixed/prisma ./prisma/

RUN npm install --legacy-peer-deps

COPY stams-fixed/tsconfig*.json ./
COPY stams-fixed/nest-cli.json ./
COPY stams-fixed/src ./src

RUN npx prisma generate
RUN npx nest build

FROM node:18-alpine

WORKDIR /app

COPY stams-fixed/package.json ./
RUN npm install --legacy-peer-deps --omit=dev

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/main.js"]
