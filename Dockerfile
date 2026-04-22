# Multi-stage Dockerfile for CaravanWert
# Optimized for production deployment with Coolify/Dokploy

# ============================================================================
# Build Stage
# ============================================================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for native modules + image optimization tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    libwebp-tools

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
#
# OLD-CHUNK-PRESERVATION ARCHITECTURE (siehe docker/sync-assets.sh):
# Statt dist/ direkt nach /usr/share/nginx/html zu kopieren (was bei jedem
# Deploy alle alten Chunks zerstört) wird der Build-Output in /tmp/dist-stage
# abgelegt und beim Container-Start via /docker-entrypoint.d/ Hook in das
# nginx-html-Verzeichnis gesynced. Der Sync ist additiv für assets/, sodass
# alte Chunk-Hashes erhalten bleiben wenn /usr/share/nginx/html/assets als
# persistent volume gemountet ist. Ohne Volume = identisches Verhalten zu
# vorher (kein Regress).
FROM nginx:alpine AS production

RUN apk upgrade --no-cache

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf /etc/nginx/conf.d/default.conf

# Build-Output in Staging-Pfad (NICHT direkt nach /usr/share/nginx/html).
# Der Sync vom Staging-Pfad in das html-Verzeichnis übernimmt das
# Entrypoint-Script bei jedem Container-Start.
COPY --from=builder /app/dist /tmp/dist-stage

# Health-Endpoint im Staging-Pfad — wird vom Sync-Script in das html-dir
# kopiert.
RUN echo '<!DOCTYPE html><html><body><h1>OK</h1></body></html>' > /tmp/dist-stage/health

# Sync-Script registrieren. nginx:alpine führt alle .sh in
# /docker-entrypoint.d/ vor dem nginx-Start aus. Prefix 40-* damit es
# nach den nginx-eigenen Setup-Scripts (10-30) läuft.
COPY docker/sync-assets.sh /docker-entrypoint.d/40-sync-assets.sh
RUN chmod +x /docker-entrypoint.d/40-sync-assets.sh

# Permissions vorbereiten. Das eigentliche chown auf /usr/share/nginx/html
# macht das Sync-Script nach jedem Sync (nötig falls Volume-Mount andere
# Ownership hat).
RUN chown -R nginx:nginx /tmp/dist-stage && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /tmp/nginx.pid && \
    chown -R nginx:nginx /tmp/nginx.pid && \
    mkdir -p /usr/share/nginx/html/assets && \
    chown -R nginx:nginx /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

EXPOSE 80

# WICHTIG: kein USER nginx mehr — die /docker-entrypoint.d/ Scripts
# brauchen root für chown auf gemountete Volumes. nginx:alpine wechselt
# automatisch über die master-process-config in nginx.conf zum
# unprivileged worker-user nach dem Bind auf Port 80.
# (Setzen wir USER nginx, schlägt der sync-Hook auf gemountete Volumes
# mit chown-EPERM fehl, was zwar non-fatal ist, aber unnötiges Rauschen
# in den Logs erzeugt.)

CMD ["nginx", "-g", "daemon off;"]
