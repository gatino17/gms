#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
TARGET="${1:-all}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "No se encontro el archivo de compose: $COMPOSE_FILE"
  exit 1
fi

echo "Usando compose: $COMPOSE_FILE"

case "$TARGET" in
  frontend)
    echo "Reconstruyendo solo frontend..."
    docker compose -f "$COMPOSE_FILE" build --no-cache frontend
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate frontend
    ;;
  backend)
    echo "Reconstruyendo solo backend..."
    docker compose -f "$COMPOSE_FILE" build --no-cache backend
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate backend
    ;;
  all)
    echo "Reconstruyendo frontend y backend..."
    docker compose -f "$COMPOSE_FILE" down
    docker compose -f "$COMPOSE_FILE" build --no-cache
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans
    ;;
  *)
    echo "Uso: ./deploy/update-gms.sh [frontend|backend|all]"
    exit 1
    ;;
esac

echo
docker compose -f "$COMPOSE_FILE" ps
