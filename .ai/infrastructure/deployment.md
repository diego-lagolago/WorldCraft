# Deployment (T-007) — manuelle Schritte

Die KI kann Git-Hosting und Coolify nicht anlegen. Bitte die folgenden Schritte selbst ausführen und im Chat bestätigen. **Secrets niemals in den Chat kopieren.**

**Abweichung (Projektinhaber, 2026-09-22):** Staging als eigene Coolify-Umgebung entfällt. Deploy direkt auf **`worldcraft.lagolago.at`**. Diese Domain ist **Produktion** (Option 1): `APP_ENV=production` in Coolify, `ENABLE_TEST_LOGIN` bleibt dort aus. Test-Login nur lokal. Auf der Domain echter Discord-Login. T-014 prüft HTTPS, Discord, Pins und Chat gegen `worldcraft.lagolago.at`. T-008 / T-011 Test-Login-Abnahme bleibt **lokal**. Produktion muss `ENABLE_TEST_LOGIN=true` verweigern. Git-Hosting: **GitHub** — [https://github.com/diego-lagolago/WorldCraft](https://github.com/diego-lagolago/WorldCraft).

**Abweichung (Projektinhaber, 2026-09-22):** Coolify darf das Dockerfile **nicht** auf dem Server bauen. `next build` hat den Host per RAM/CPU gekillt. Muster wie Vitura: **GitHub Actions** baut das Image (`linux/amd64`) und pusht nach **GHCR**. Coolify macht nur `docker pull` und startet den Container. Lokal bleiben `docker compose` (Postgres) und `npm run dev` unverändert.

## Realtime

Die App läuft in Coolify mit **genau einer App-Replica**. Realtime ist In-Process; horizontales Skalieren ist nicht vorgesehen. Mehr als eine Replica nur nach einem neuen ADR (Kandidaten: PostgreSQL `LISTEN/NOTIFY`, Redis Pub/Sub).

## 1. Repository auf GitHub

Remote: `https://github.com/diego-lagolago/WorldCraft.git` (privat). Branch `main`.

Ein Push auf `main` (oder **Actions → Build image → Run workflow**) startet `.github/workflows/build-image.yml`. Der Runner loggt sich mit `GITHUB_TOKEN` bei `ghcr.io` ein (`permissions: packages: write`, `contents: read`) und pusht:

| Tag | Zweck |
|---|---|
| `ghcr.io/diego-lagolago/worldcraft:main` | Bewegliches Tag — das trägt Coolify ein |
| `ghcr.io/diego-lagolago/worldcraft:<git-sha>` | Unveränderlicher Snapshot (Rollback) |

Kein Secret ins Repository. `GITHUB_TOKEN` kommt von GitHub. Falls der erste Push nach GHCR mit 403 scheitert: Repo → **Settings → Actions → General → Workflow permissions** auf Schreibzugriff stellen.

## 2. Coolify: Postgres

1. Neue Datenbank-Ressource **PostgreSQL** anlegen.
2. Persistentes Volume für die Datenbank behalten (Coolify-Default).
3. Connection-String merken — der kommt als `DATABASE_URL` in die App. Nicht in den Chat schreiben.

## 3. Coolify: Anwendung — fertiges Image, kein Dockerfile-Build

**Nicht** mehr: Quelle = Git-Repository, Build Pack = **Dockerfile**. Das kompiliert Next auf dem VPS und killt den Host.

**Stattdessen:** Quelle = **Docker Image** (prebuilt), Coolify zieht nur.

Neue Resource: **Application → Docker Image**. Bestehende App, die noch per Dockerfile baut: Build Pack / Quelle auf **Docker Image** umstellen und den Git-Build abschalten.

| Feld | Wert |
|---|---|
| Image | `ghcr.io/diego-lagolago/worldcraft:main` |
| Registry | GitHub Container Registry (`ghcr.io`) |
| Username | GitHub-Benutzername (Package-Inhaber) |
| Token | GitHub-PAT mit Scope **`read:packages`** — selbst in Coolify eintragen, **nicht in den Chat** |
| Port | **3000** |
| Domain | `worldcraft.lagolago.at` plus HTTPS (Let’s Encrypt) |
| Volume | Persistentes Volume nach **`/app/data/uploads`** |

Das Package ist privat (privates Repo). Ohne Pull-Token kommt Coolify nicht an das Image. Klassisches PAT: Scope `read:packages`. Fine-grained PAT: Read auf Packages für `worldcraft`. Token-Namen in Coolify frei wählbar; der Wert gehört nur in die Coolify-Registry-Felder.

Nach dem ersten erfolgreichen Actions-Lauf: GitHub → **Packages** → `worldcraft` prüfen. Package optional an dieses Repository koppeln (Package Settings → Connect repository), damit `GITHUB_TOKEN` weiter pushen darf.

Optional automatisch nach Image-Push: In Coolify den Deploy-Webhook der App kopieren und im GitHub-Repo als Actions-Secrets anlegen (Werte nicht in den Chat):

| GitHub Actions Secret | Inhalt |
|---|---|
| `COOLIFY_WEBHOOK_URL` | Deploy-Webhook-URL aus Coolify |
| `COOLIFY_WEBHOOK_TOKEN` | zugehöriges Token, falls Coolify eines zeigt |

Ohne diese Secrets bleibt das Image in GHCR; in Coolify einmal **Redeploy** / Force Deploy, damit der erste Pull läuft.

## 4. Umgebungsvariablen in Coolify

Namen aus `.env.example` — Werte selbst eintragen. Unverändert zur bisherigen Liste. Diese Domain ist Produktion: **kein** `ENABLE_TEST_LOGIN`.

| Variable | Hinweis |
|---|---|
| `NODE_ENV` | `production` |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Connection-String der Coolify-Postgres-Ressource |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`, nur in Coolify |
| `BETTER_AUTH_URL` | `https://worldcraft.lagolago.at` ohne Slash am Ende |
| `MCP_ENABLED` | Standard `false`. Erst nach dem Ende-zu-Ende-Test von Plan `002` dauerhaft auf `true` setzen; bei `false` sind `/mcp`, OAuth und Discovery absichtlich 404. |
| `DISCORD_CLIENT_ID` | Discord Developer Portal (T-008) |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal (T-008) |
| `ENABLE_TEST_LOGIN` | **nicht setzen** (Test-Login nur lokal). Bei `APP_ENV=production` und `ENABLE_TEST_LOGIN=true` darf die App nicht starten. |
| `ALLOWED_DISCORD_IDS` | Kommagetrennte Discord-User-IDs. In Produktion **Pflicht**: fehlt der Wert oder ist er leer, startet die App nicht (fail closed). Nicht gelistete Discord-Konten werden beim Login abgelehnt. Test-Login (`test-*`) ist ausgenommen. |
| `FILE_STORAGE_PATH` | `/app/data/uploads` |

Der Coolify-/Traefik-Proxy muss den ursprünglichen Client als **einen** gültigen `x-forwarded-for`-Wert an die Anwendung weitergeben. Der App-Container darf nicht direkt von außen erreichbar sein; sonst könnte ein Angreifer die OAuth-/DCR-Rate-Limits mit einem selbst gesetzten Header umgehen.

`POSTGRES_*` braucht Coolify nur, wenn ihr Postgres selbst per Compose betreibt. Bei der Coolify-Postgres-Ressource reicht `DATABASE_URL`.

Lokal: `docker compose up -d` und `npm run dev` — unabhängig von GHCR/Coolify.

## 5. Discord Developer Portal (T-008, Projektinhaber)

Anwendung anlegen, Scopes `identify` und **`email`** (Pflicht). Redirects eintragen:

- `http://localhost:3000/api/auth/callback/discord`
- `https://worldcraft.lagolago.at/api/auth/callback/discord`

Client-ID und Client-Secret selbst in die lokale `.env` und in Coolify eintragen. **Secrets nicht in den Chat legen.**

## 6. Abnahme auf der Domain (nach dem ersten Deploy)

- `https://worldcraft.lagolago.at` zeigt die Startseite mit dem Wert aus der Datenbank.
- Ein Push auf `main` baut das Image auf GitHub und aktualisiert `ghcr.io/diego-lagolago/worldcraft:main`. Coolify pullt (Webhook oder manuelles Redeploy) — **kein** `next build` auf dem Server.
- Nach Neustart des App-Containers sind Datenbankinhalt und Dateien unter `/app/data/uploads` noch da.
- Einstieg bleibt `entrypoint.sh` (Migration, dann `server.js`). `ENABLE_TEST_LOGIN=true` bei `APP_ENV=production` beendet den Container.
