# ============================================================================
# CLMS Backend Production Dockerfile - Multi-Stage Build with TypeScript Compilation
# ============================================================================
# Purpose: Optimized production image with compiled TypeScript for better performance
# Features: Multi-stage build, TypeScript compilation, non-root user, health checks, security hardening
# Build: docker build -t clms-backend:prod .
# Run: docker run -p 3001:3001 --env-file .env clms-backend:prod
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

# Install all dependencies (including dev dependencies for build)
RUN npm install && \
    npm cache clean --force

# Stage 3: Build and compile TypeScript
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code and configuration files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript to JavaScript
RUN npm run build

# Copy production register-paths.js to the dist directory (if exists)
RUN if [ -f register-paths.prod.cjs ]; then cp register-paths.prod.cjs dist/register-paths.cjs; fi

# Stage 4: Production runner with compiled JavaScript
FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    PORT=3001

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    dumb-init

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy package files
COPY package.json package-lock.json* ./

# Install app dependencies (including dev ones needed for build/runtime)
RUN rm -f package-lock.json && \
    npm install && \
    npm cache clean --force

# Copy compiled application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
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
    CMD curl -f http://localhost:3001/health || exit 1

# Start the application with compiled JavaScript using dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "./dist/index.js"]