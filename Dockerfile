# =========================================================================
# Google Cloud Run Optimized Multi-Stage Dockerfile
# =========================================================================

# Stage 1: Build Application
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies (with fallback so lockfile drift never breaks container builds)
COPY package*.json ./
RUN npm ci || npm install

# Copy project files and build Vite SPA + Express bundled server
COPY . .
RUN npm run build

# Stage 2: Production Execution Image
FROM node:22-alpine AS runner

WORKDIR /app

# Ensure production environment
ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy compiled artifacts and runtime configuration from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.cjs ./server.cjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/api ./api
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

# Set permissions and health check port
EXPOSE 8080

# Cloud Run invokes the bundled Express server listening on 0.0.0.0:PORT
CMD ["node", "server.cjs"]
