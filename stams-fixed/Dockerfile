# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and config files
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Generate Prisma Client in production
RUN npx prisma generate

# Copy built application
COPY --from=builder /app/dist ./dist

# Set environment
ENV NODE_ENV=production

# Expose port (Zeabur will override this)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/v1/health/ping', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application with migrations
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
