#!/bin/bash
# deploy.sh - Deployment script for Hetzner VPS

set -e

echo "🚀 Deploying BoulotAndAppartFinder..."

# Pull latest code
git pull origin main

# Build and restart containers
docker compose build
docker compose up -d

# Clean up old images
docker image prune -f

# Show logs
echo "📋 Container status:"
docker compose ps

echo "✅ Deployment complete!"
echo "📊 View logs: docker compose logs -f"
