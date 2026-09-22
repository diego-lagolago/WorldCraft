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

Rechte-Spike (T-011), während der Dev-Server läuft:

```bash
npm run test:rechte
```

Details: `src/spike/rechte/README.md`.

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

**Image-Build läuft auf GitHub, nicht auf dem Server.** Ein Push auf `main` (Workflow `.github/workflows/build-image.yml`) baut das Dockerfile auf einem GitHub-hosted Runner (`linux/amd64`) und pusht nach GHCR:

- `ghcr.io/diego-lagolago/worldcraft:main` — Tag für Coolify
- `ghcr.io/diego-lagolago/worldcraft:<git-sha>` — unveränderlicher Snapshot

In Coolify **kein** Build Pack **Dockerfile** (das `next build` auf dem VPS hat den Host gekillt). Quelle auf **Docker Image** stellen, Image `ghcr.io/diego-lagolago/worldcraft:main`, Port **3000**, Volume **`/app/data/uploads`**. Für das private Package einen GitHub-PAT mit `read:packages` in den Coolify-Registry-Feldern hinterlegen (Wert nicht in den Chat). Env-Variablen unverändert (siehe `.env.example`); **kein** `ENABLE_TEST_LOGIN` in Produktion.

Lokal bleiben `docker compose` (nur Postgres) und `npm run dev` wie oben.

Schritte: [`.ai/infrastructure/deployment.md`](.ai/infrastructure/deployment.md).

**T-007 ist erst erledigt**, wenn das Repository auf GitHub liegt, Actions das Image nach GHCR schiebt, Coolify dieses Image mit Postgres und Volumes **zieht** (nicht selbst baut) und `https://worldcraft.lagolago.at` per HTTPS die Startseite mit dem Datenbankwert zeigt.

Secrets (Discord-Secret, `BETTER_AUTH_SECRET`, Datenbankpasswort, GHCR-Pull-Token) nie im Chat und nie ins Repository legen — nur in `.env` und in Coolify.
