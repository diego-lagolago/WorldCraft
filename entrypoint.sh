#!/bin/sh
set -e

echo "[entrypoint] Datenbank-Migrationen…"
node /app/migrate.mjs

echo "[entrypoint] Starte Anwendung…"
exec node /app/server.js
