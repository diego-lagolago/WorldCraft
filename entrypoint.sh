#!/bin/sh
set -e

if [ "$ENABLE_TEST_LOGIN" = "true" ] && [ "$APP_ENV" = "production" ]; then
  echo "[entrypoint] ENABLE_TEST_LOGIN=true ist in der Produktivumgebung nicht erlaubt (APP_ENV=production)."
  exit 1
fi

if [ "$APP_ENV" = "production" ]; then
  # Fail closed: whitespace and commas alone do not count as an allowlist.
  ALLOWED_IDS=$(printf '%s' "$ALLOWED_DISCORD_IDS" | tr -d '[:space:],')
  if [ -z "$ALLOWED_IDS" ]; then
    echo "[entrypoint] ALLOWED_DISCORD_IDS fehlt oder ist leer. In der Produktivumgebung startet die Anwendung nur mit einer Discord-Allowlist."
    exit 1
  fi
fi

echo "[entrypoint] Datenbank-Migrationen…"
node /app/migrate.mjs

echo "[entrypoint] Starte Anwendung…"
exec node /app/server.js
