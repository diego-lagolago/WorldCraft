# Deployment (T-007) — manuelle Schritte

Die KI kann Git-Hosting und Coolify nicht anlegen. Bitte die folgenden Schritte selbst ausführen und im Chat bestätigen. **Secrets niemals in den Chat kopieren.**

**Abweichung (Projektinhaber, 2026-09-22):** Staging als eigene Coolify-Umgebung entfällt. Deploy direkt auf **`worldcraft.lagolago.at`**. Diese Domain ist **Produktion** (Option 1): `APP_ENV=production` in Coolify, `ENABLE_TEST_LOGIN` bleibt dort aus. Test-Login nur lokal. Auf der Domain echter Discord-Login. T-014 prüft HTTPS, Discord, Pins und Chat gegen `worldcraft.lagolago.at`. T-008 / T-011 Test-Login-Abnahme bleibt **lokal**. Produktion muss `ENABLE_TEST_LOGIN=true` verweigern. Git-Hosting: **GitHub** — [https://github.com/diego-lagolago/WorldCraft](https://github.com/diego-lagolago/WorldCraft).

## 1. Repository auf GitHub

Remote: `https://github.com/diego-lagolago/WorldCraft.git` (privat). Branch `main`. Automatisches Deployment hängt am Hauptzweig `main`.

## 2. Coolify: Postgres

1. Neue Datenbank-Ressource **PostgreSQL** anlegen.
2. Persistentes Volume für die Datenbank behalten (Coolify-Default).
3. Connection-String merken — der kommt als `DATABASE_URL` in die App. Nicht in den Chat schreiben.

## 3. Coolify: Anwendung

1. Neue Application, Quelle = **GitHub-Repository**, Branch `main`.
2. Build Pack: **Dockerfile** aus diesem Repo (Repo-Wurzel). Port **3000**.
3. Automatisches Deployment bei Push auf `main` einschalten.
4. Domain **`worldcraft.lagolago.at`** zuweisen und HTTPS (Let’s Encrypt) aktivieren. Keine Staging-Subdomain.
5. Persistentes Volume anlegen und nach `/app/data/uploads` mounten.

## 4. Umgebungsvariablen in Coolify

Namen aus `.env.example` — Werte selbst eintragen. Diese Domain ist Produktion: **kein** `ENABLE_TEST_LOGIN`.

| Variable | Hinweis |
|---|---|
| `NODE_ENV` | `production` |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Connection-String der Coolify-Postgres-Ressource |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`, nur in Coolify |
| `BETTER_AUTH_URL` | `https://worldcraft.lagolago.at` ohne Slash am Ende |
| `DISCORD_CLIENT_ID` | Discord Developer Portal (T-008) |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal (T-008) |
| `ENABLE_TEST_LOGIN` | **nicht setzen** (Test-Login nur lokal). Bei `APP_ENV=production` und `ENABLE_TEST_LOGIN=true` darf die App nicht starten. |
| `FILE_STORAGE_PATH` | `/app/data/uploads` |

`POSTGRES_*` braucht Coolify nur, wenn ihr Postgres selbst per Compose betreibt. Bei der Coolify-Postgres-Ressource reicht `DATABASE_URL`.

## 5. Discord Developer Portal (T-008, Projektinhaber)

Anwendung anlegen, Scopes `identify` und **`email`** (Pflicht). Redirects eintragen:

- `http://localhost:3000/api/auth/callback/discord`
- `https://worldcraft.lagolago.at/api/auth/callback/discord`

Client-ID und Client-Secret selbst in die lokale `.env` und in Coolify eintragen. **Secrets nicht in den Chat legen.**

## 6. Abnahme auf der Domain (nach dem ersten Deploy)

- `https://worldcraft.lagolago.at` zeigt die Startseite mit dem Wert aus der Datenbank.
- Ein Push auf `main` löst ohne Klick ein neues Deployment aus.
- Nach Neustart des App-Containers sind Datenbankinhalt und Dateien unter `/app/data/uploads` noch da.
