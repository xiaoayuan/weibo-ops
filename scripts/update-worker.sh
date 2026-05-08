#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/opt/weibo-ops"
COMPOSE_FILE="$ROOT_DIR/docker-compose.worker.yml"

cd "$ROOT_DIR"

git pull origin main

if [[ "${1:-}" == "--build" ]]; then
  docker compose -f "$COMPOSE_FILE" build app
fi

docker compose -f "$COMPOSE_FILE" up -d app
docker compose -f "$COMPOSE_FILE" ps
