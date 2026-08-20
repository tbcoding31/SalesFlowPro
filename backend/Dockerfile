# ── Stage 1: Build ──
FROM node:24.18.0-alpine AS build
WORKDIR /app

# Install dependencies first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY . .
RUN npx tsc

# ── Stage 2: Production Runtime ──
FROM node:24.18.0-alpine AS production
WORKDIR /app

# Copy only production artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/tenants || exit 1

CMD ["node", "dist/server.js"]
