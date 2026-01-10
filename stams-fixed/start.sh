#!/bin/sh

# STAMS Deployment Script for Zeabur

echo "🚀 Starting STAMS Deployment..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# 2. Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# 3. Run database migrations
echo "📊 Running database migrations..."
npx prisma migrate deploy

# 4. Start the application
echo "✅ Starting application..."
node dist/main.js
