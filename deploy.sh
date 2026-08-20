#!/bin/bash
# SalesFlow Pro — Production Deployment Script
# Usage: ./deploy.sh [IMAGE_TAG]
#
# This script is meant to be run on the production server.
# It pulls the latest Docker images and restarts the application.

set -euo pipefail

# ── Configuration ──
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
FRONTEND_URL="http://localhost:3100"
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_INTERVAL=5

# ── Image Tag ──
IMAGE_TAG="${1:-latest}"
export IMAGE_TAG

echo "══════════════════════════════════════════════"
echo "  SalesFlow Pro — Deployment"
echo "  Image Tag: ${IMAGE_TAG}"
echo "  Project:   ${PROJECT_DIR}"
echo "══════════════════════════════════════════════"

cd "${PROJECT_DIR}"

# ── Step 1: Pull latest images ──
echo ""
echo "[1/4] Pulling Docker images..."
docker compose ${COMPOSE_FILES} pull

# ── Step 2: Recreate containers with minimal downtime ──
echo ""
echo "[2/4] Starting containers..."
docker compose ${COMPOSE_FILES} up -d

# ── Step 3: Wait for startup ──
echo ""
echo "[3/4] Waiting for application startup..."
sleep 5

# ── Step 4: Health check ──
echo ""
echo "[4/4] Running health check..."

for i in $(seq 1 ${HEALTH_CHECK_RETRIES}); do
  if wget --no-verbose --tries=1 --spider "${FRONTEND_URL}" 2>/dev/null; then
    echo ""
    echo "══════════════════════════════════════════════"
    echo "  ✅ Deployment successful!"
    echo "  Frontend: ${FRONTEND_URL}"
    echo "  Image:    ${IMAGE_TAG}"
    echo "══════════════════════════════════════════════"

    # Show running containers
    echo ""
    echo "Running containers:"
    docker compose ${COMPOSE_FILES} ps
    exit 0
  fi

  echo "  Attempt ${i}/${HEALTH_CHECK_RETRIES} — waiting ${HEALTH_CHECK_INTERVAL}s..."
  sleep ${HEALTH_CHECK_INTERVAL}
done

# Health check failed
echo ""
echo "══════════════════════════════════════════════"
echo "  ❌ Deployment FAILED — health check did not pass"
echo "══════════════════════════════════════════════"
echo ""
echo "Container logs (last 50 lines):"
docker compose ${COMPOSE_FILES} logs --tail=50
exit 1
