# WorldCraft

Selbst gehostete Webapp für D&D-Gruppen. Dieser Ordner enthält die Next.js-App, die Projektnormen unter `.ai/` und die Spikes unter `spikes/`.

Paketmanager: **npm** (wie im Referenzprojekt).

## Lokal starten

Voraussetzung: Docker Desktop (oder vergleichbar) und Node 22.

1. Umgebung anlegen:

   ```bash
   cp .env.example .env
   ```

   In `.env` mindestens `POSTGRES_PASSWORD`, die dazu passende `DATABASE_URL` und `BETTER_AUTH_SECRET` setzen (`openssl rand -base64 32`). Discord-Werte trägt der Projektinhaber selbst ein (nicht in den Chat).

2. PostgreSQL starten:

   ```bash
   docker compose up -d
   ```

3. Schema anlegen und Startseite-Wert einspielen:

   ```bash
   npm install
   npm run db:migrate
   ```

4. Dev-Server:

   ```bash
   npm run dev
   ```

5. Im Browser: [http://localhost:3000](http://localhost:3000) — die Startseite zeigt einen Satz aus der Tabelle `app_info`.

### Discord-Login (T-008)

Im Discord Developer Portal eine Anwendung anlegen (Scopes `identify` und `email`) und diese Redirects eintragen:

- `http://localhost:3000/api/auth/callback/discord`
- `https://worldcraft.lagolago.at/api/auth/callback/discord`

Client-ID und Secret nur in `.env` bzw. Coolify. Test-Login (`ENABLE_TEST_LOGIN=true`) nur lokal:

```bash
curl -c /tmp/wc-cookies -X POST http://localhost:3000/api/test-login \
  -H 'Content-Type: application/json' \
  -d '{"discordId":"test-gm"}'
curl -b /tmp/wc-cookies http://localhost:3000/api/auth/get-session
```

Hochgeladene Dateien liegen lokal unter `FILE_STORAGE_PATH` (Standard `./data/uploads`, nicht im Git).

Der Editor-Spike bleibt unabhängig:

```bash
cd spikes/editor
npm install
npm run dev
```

## Persistente Volumes

| Inhalt | Lokal | Coolify |
|---|---|---|
| PostgreSQL-Daten | Docker-Volume `worldcraft_pgdata` | Volume der Coolify-Postgres-Ressource |
| Hochgeladene Dateien (Karten, Titelbilder, Avatare) | Ordner `./data/uploads` | Volume am App-Container, Mount `/app/data/uploads`, Variable `FILE_STORAGE_PATH=/app/data/uploads` |

Nach einem Container-Neustart müssen beide erhalten bleiben.

## Betrieb auf Coolify

Git-Hosting: **GitHub**. Domain: **`worldcraft.lagolago.at`** (Produktion, kein separates Staging). Test-Login nur lokal — in Coolify `ENABLE_TEST_LOGIN` nicht setzen, `APP_ENV=production`.

Schritte: [`.ai/infrastructure/deployment.md`](.ai/infrastructure/deployment.md). Coolify: Quelle = GitHub-Repo, Build Pack = Dockerfile, Port 3000, Volume `/app/data/uploads`.

**T-007 ist erst erledigt**, wenn das Repository auf GitHub liegt, Coolify die App mit Postgres und Volumes baut und `https://worldcraft.lagolago.at` per HTTPS die Startseite mit dem Datenbankwert zeigt.

Secrets (Discord-Secret, `BETTER_AUTH_SECRET`, Datenbankpasswort) nie im Chat und nie ins Repository legen — nur in `.env` und in Coolify.
