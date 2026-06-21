#!/usr/bin/env bash
set -e

ENV="$1"
if [ -z "$ENV" ]; then
  echo "Usage: $0 <environment>  (e.g. ./rebuild_docker.sh hmg)"
  exit 1
fi

if [ "$ENV" = "prod" ]; then
  echo
  echo "### [prod] Tagging current image as rollback point: graphql_server_prod:rollback"
  docker tag graphql_server_prod graphql_server_prod:rollback || true
fi

COMPOSE_FILE="docker-compose.${ENV}.yaml"
echo "Using compose file: ${COMPOSE_FILE}"
echo "Stopping containers..."
docker compose -f "${COMPOSE_FILE}" down

echo "Starting containers with ${COMPOSE_FILE}..."
COMPOSE_BAKE=true docker compose -f "${COMPOSE_FILE}" up -d --build

echo
echo "### Restarting Nginx for environment ------ $ENV"
docker exec nginx_$ENV nginx -s reload

echo
echo "@@@ Rebuild and restart process completed for environment ------ $ENV @@@"

if [ "$ENV" = "prod" ]; then
  echo
  echo "### To roll back prod to the previous image, run:"
  echo "  docker tag graphql_server_prod:rollback graphql_server_prod"
  echo "  docker compose -f docker-compose.prod.yaml up -d --no-deps --force-recreate graphql_server_prod"
fi