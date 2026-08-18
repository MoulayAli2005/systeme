#!/bin/sh
set -eu

echo "Waiting for Postgres…"
i=0
until npx prisma migrate deploy; do
  i=$((i + 1))
  if [ "$i" -gt 40 ]; then
    echo "Database not ready after retries."
    exit 1
  fi
  echo "migrate deploy failed (attempt $i), retrying in 3s…"
  sleep 3
done

echo "Starting Nexora on ${HOSTNAME:-0.0.0.0}:${PORT:-8080}"
exec npm run start
