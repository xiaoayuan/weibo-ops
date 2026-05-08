#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/root/weibo-ops"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

cd "$ROOT_DIR"

git pull origin main

if [[ "${1:-}" == "--build" ]]; then
  docker compose -f "$COMPOSE_FILE" build app api web
fi

docker compose -f "$COMPOSE_FILE" up -d app api web
docker compose -f "$COMPOSE_FILE" ps app api web
