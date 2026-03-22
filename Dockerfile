# Multi-stage Dockerfile for CaravanWert
# Optimized for production deployment with Coolify/Dokploy

# ============================================================================
# Build Stage
# ============================================================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_GOOGLE_ANALYTICS_ID
ARG VITE_SENTRY_DSN
ARG NODE_ENV=production

# Set environment variables for build
# Support both ANON_KEY and PUBLISHABLE_KEY (they are the same thing)
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:-$VITE_SUPABASE_PUBLISHABLE_KEY}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY:-$VITE_SUPABASE_ANON_KEY}
ENV VITE_GOOGLE_ANALYTICS_ID=$VITE_GOOGLE_ANALYTICS_ID
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV NODE_ENV=$NODE_ENV
ENV VITE_APP_VERSION=$npm_package_version
ENV VITE_BUILD_TIME=$BUILD_TIME

# Build the application
RUN pnpm run build

# ============================================================================
# Development Stage (for local development with Docker)
# ============================================================================
FROM node:20-alpine AS development

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev dependencies)
RUN pnpm install

# Copy source code
COPY . .

# Expose development port
EXPOSE 8080

# Start development server
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0"]

# ============================================================================
# Production Stage (DEFAULT - used when no target specified)
# ============================================================================
FROM nginx:alpine AS production

# Install security updates
RUN apk upgrade --no-cache

# Copy custom nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Create health check endpoint
RUN echo '<!DOCTYPE html><html><body><h1>OK</h1></body></html>' > /usr/share/nginx/html/health

# Set proper permissions for nginx user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /tmp/nginx.pid && \
    chown -R nginx:nginx /tmp/nginx.pid

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

# Expose port
EXPOSE 80

# Use nginx user
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
