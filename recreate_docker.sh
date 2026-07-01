#!/bin/bash

# Usage example:
# bash recreate-docker.sh hmg

if [ -z "$1" ]; then
  echo "Usage: $0 <environment>"
  exit 1
fi

ENV="$1"

echo
echo "### Recreating Docker container for environment ------ $ENV"
docker compose -f docker-compose.$ENV.yaml up -d --no-deps --force-recreate graphql_server_$ENV
echo
echo "### Done."
