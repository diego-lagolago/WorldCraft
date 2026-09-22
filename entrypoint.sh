#!/bin/sh
set -e

if [ "$ENABLE_TEST_LOGIN" = "true" ] && [ "$APP_ENV" = "production" ]; then
  echo "[entrypoint] ENABLE_TEST_LOGIN=true ist in der Produktivumgebung nicht erlaubt (APP_ENV=production)."
  exit 1
fi

echo "[entrypoint] Datenbank-Migrationen…"
node /app/migrate.mjs

echo "[entrypoint] Starte Anwendung…"
exec node /app/server.js
