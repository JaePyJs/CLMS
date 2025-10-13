# ============================================================================
# CLMS Backend Production Dockerfile - Multi-Stage Build
# ============================================================================
# Purpose: Optimized production image with minimal footprint
# Features: Multi-stage build, non-root user, health checks, security hardening
# Build: docker build -t clms-backend:prod .
# ============================================================================

# Stage 1: Base image with Node.js 20 LTS
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Stage 3: Build application
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript application
RUN npm run build && \
    rm -rf src tests *.test.ts

# Stage 4: Production runner
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    PORT=3001

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy only necessary files from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Create directories for runtime data
RUN mkdir -p logs uploads generated && \
    chown -R nodejs:nodejs logs uploads generated

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3001

# Health check with proper timeouts for production
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["node", "dist/src/server.js"]