# WorldCraft

Selbst gehostete Webapp für Pen-&-Paper-Gruppen (D&D und Verwandte): Weltenbau, Kampagnenführung und Spieltisch in einer Anwendung. Spielleitung und Spieler teilen sich Karte, Glossar, Bestiarium, Quests, Charaktere und Chat. Über einen eingebauten MCP-Server kann zusätzlich eine KI (z. B. Claude) die Welt lesen und nach Bestätigung mitschreiben.

WorldCraft ist für private Gruppen gedacht: ein Container, eine PostgreSQL-Datenbank, Anmeldung per Discord. Die Oberfläche ist deutschsprachig und Mobile-First.

> **Lizenz:** [PolyForm Noncommercial 1.0.0](LICENSE). Der Quellcode ist offen, die kommerzielle Nutzung ist nicht erlaubt. Details unter [Lizenz](#lizenz).

## Inhalt

- [Features](#features)
- [Technik](#technik)
- [Schnellstart (lokal)](#schnellstart-lokal)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Discord-Login einrichten](#discord-login-einrichten)
- [Betrieb auf einem Server](#betrieb-auf-einem-server)
- [MCP: KI anbinden](#mcp-ki-anbinden)
- [Entwicklung](#entwicklung)
- [Lizenz](#lizenz)

## Features

### Welten, Universen und Mitglieder

- Beliebig viele **Welten** mit Name, Beschreibung und Titelbild; pro Welt mehrere **Universen** mit je beliebig vielen Karten.
- Drei **Rollen**: Game Master, Master und Player. Rollen ändern und Mitglieder entfernen darf nur der Game Master.
- **Einladungslinks** (1 Tag, 7 Tage oder unbegrenzt), jederzeit widerrufbar.
- Austritt und Entfernen **archivieren** statt zu löschen.

### Interaktive Karte

- Eigenes Kartenbild als Hintergrund (Leaflet, `CRS.Simple`) mit Zoom und Pan.
- **Pins** in 12 Typen mit Titel, Rich-Text-Beschreibung und eigener Sichtbarkeit; per Drag verschiebbar, von der Spielleitung sperrbar.
- **Charakter-Marker** (Profilbild und Name) und **Monster-Marker** mit Link ins Bestiarium.
- **Kartenfilter** nach Pin-Typ und Marker-Art, Platziermodi mit Hotkeys, Kopieren von Markern.
- **Echtzeit**: Änderungen erscheinen nach dem Ablegen bei allen Mitgliedern der Welt (Server-Sent Events), serverseitig nach Sichtbarkeit gefiltert.
- Deep-Links auf Karten und einzelne Pins.

### Glossar (Artikel)

- Artikel mit Titelbild und Rich-Text-Editor (TipTap).
- **Vorlagen** mit strukturierten Feldern: Person, Ort, Organisation, Gegenstand, Rasse oder ohne Vorlage.
- **Erwähnungen mit `@`** auf Artikel, Quests, Charaktere, Universen und Monster. Noch nicht vorhandene Artikel lassen sich direkt als Stub anlegen.
- **Relationen**: automatisch aus Erwähnungen, Vorlagenfeldern, Quest-Beteiligung und Monster-Lebensraum; zusätzlich manuelle Relationen mit Bezeichnung und Gegenbezeichnung. Jede Detailseite zeigt unter „Verknüpft“ die ein- und ausgehenden Verbindungen.

### Bestiarium

- Monster mit Profilbild, Art, Seltenheit, Boss-Kennzeichen, Gefahrenstufe, Größe und Lebensraum (Verweis auf einen Ort-Artikel).
- Volles **Charakterblatt** (Attribute, Fertigkeiten, Fähigkeiten) und Rich-Text-Bio mit Erwähnungen.
- Filter nach Monster-Art; Monster lassen sich als Marker auf Karten platzieren.

### Quests

- Quests mit Beschreibung, Status (offen, aktiv, abgeschlossen, gescheitert) und beteiligten Charakteren.
- **Kapitel** mit eigenem Status und eigener Sichtbarkeit, so lässt sich eine Quest Stück für Stück freigeben.
- Gemeinsamer **Notizblock** pro Quest für alle, die die Quest sehen, mit Konflikterkennung bei gleichzeitigem Bearbeiten.

### Charaktere und Tagebuch

- Weltunabhängiger **Charakterbogen**: Attribute, Fertigkeiten, Fähigkeiten, Persönlichkeit, Bio, Bilder.
- Charaktere können in eine oder mehrere Welten mitgebracht werden.
- **Tagebuch** pro Welt, privat oder mit der Spielleitung geteilt.

### Chat und Würfel

- Gruppenchat mit Kanälen und Threads in Echtzeit; Nachrichten bearbeiten, löschen und kopieren.
- **Würfel** werden serverseitig ausgewertet: Würfel-Sheet mit mehreren Termen und Bonus oder Befehl `/roll` bzw. `/r`.

### Suche

- Weltweite Live-Suche über Artikel, Quests, Charaktere, Pins, Universen und Monster. Tagebücher sind ausgenommen.

### Rechte und Sichtbarkeit

- Dreistufige Sichtbarkeit für Artikel, Quests, Kapitel, Pins und Monster: **nur ich**, **nur Spielleitung**, **veröffentlicht**. Neue Inhalte starten mit „nur ich“.
- Vererbung Universum → Karte → Pin/Marker; Relationen sind nur sichtbar, wenn Quelle und Ziel sichtbar sind.
- Eine gemeinsame Rechteschicht für Weboberfläche, API, Echtzeit und MCP. Rechte werden nie nur in der Oberfläche geprüft.

### MCP-Server

- Streamable-HTTP-MCP-Server unter `/mcp` mit OAuth 2.1 (PKCE, Dynamic Client Registration und Client ID Metadata Documents).
- Die KI sieht genau das, was der angemeldete Benutzer in der App sieht, und nur in Welten, die der Game Master freigegeben hat.
- Schreiben nur nach **Vorschau und Bestätigung**; gelöscht wird nie. Mehr unter [MCP: KI anbinden](#mcp-ki-anbinden).

## Technik

| Bereich | Technologie |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Backend | Next.js Route Handlers im selben Prozess |
| Datenbank | PostgreSQL 16, Drizzle ORM |
| Anmeldung | Better Auth mit Discord-OAuth |
| Echtzeit | Server-Sent Events, In-Process-Bus |
| Karte | Leaflet |
| Editor | TipTap (nur Open-Source-Erweiterungen) |
| Styling | Tailwind CSS 4 |
| MCP | `@modelcontextprotocol/server`, `@better-auth/mcp` |
| Dateien | lokales Volume, Bildverarbeitung mit sharp |

Die gesamte Anwendung läuft in **einem Container** auf Port 3000. Daneben braucht sie nur PostgreSQL und ein persistentes Verzeichnis für Uploads.

```text
Browser ──HTTPS / SSE──▶ Next.js-App (UI, API, Auth, Rechte, MCP) ──▶ PostgreSQL
KI-Client ──/mcp──────▶                                           └─▶ Upload-Volume
```

Architektur, Entscheidungen (ADRs) und Datenmodell sind unter [`.ai/`](.ai/) dokumentiert, Einstieg: [`.ai/architecture.md`](.ai/architecture.md) und [`.ai/features.md`](.ai/features.md).

## Schnellstart (lokal)

Voraussetzungen: Node.js 22, npm und Docker (für PostgreSQL).

1. Repository klonen und Umgebung anlegen:

   ```bash
   git clone https://github.com/diego-lagolago/WorldCraft.git
   cd WorldCraft
   cp .env.example .env
   ```

2. In `.env` mindestens setzen:

   - `POSTGRES_PASSWORD` und die dazu passende `DATABASE_URL`
   - `BETTER_AUTH_SECRET` (mindestens 32 Zeichen), z. B. erzeugt mit `openssl rand -base64 32`

3. PostgreSQL starten:

   ```bash
   docker compose up -d
   ```

4. Abhängigkeiten installieren und Schema anlegen:

   ```bash
   npm install
   npm run db:migrate
   ```

5. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

6. [http://localhost:3000](http://localhost:3000) öffnen.

Ohne Discord-Anwendung genügt lokal der **Test-Login** (`ENABLE_TEST_LOGIN=true`, Standard in `.env.example`). Er stellt die Benutzer `test-gm`, `test-master`, `test-player-a` und `test-player-b` bereit.

## Umgebungsvariablen

Vorlage: [`.env.example`](.env.example). Secrets gehören nur in `.env` bzw. in die Konfiguration des Servers, nie ins Repository.

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `NODE_ENV` | ja | `development` oder `production`. |
| `APP_ENV` | ja | `development` oder `production`. Steuert die Schutzregeln unten. |
| `DATABASE_URL` | ja | PostgreSQL-Verbindung, z. B. `postgresql://worldcraft:…@localhost:5432/worldcraft`. |
| `BETTER_AUTH_SECRET` | ja | Geheimnis für Sitzungen und Tokens, mindestens 32 Zeichen. |
| `BETTER_AUTH_URL` | ja | Kanonische URL der App ohne Slash am Ende, z. B. `https://worldcraft.example.com`. |
| `DISCORD_CLIENT_ID` | für Discord-Login | Client-ID der Discord-Anwendung. |
| `DISCORD_CLIENT_SECRET` | für Discord-Login | Client-Secret der Discord-Anwendung. |
| `ALLOWED_DISCORD_IDS` | in Produktion | Kommagetrennte Discord-Benutzer-IDs, die sich anmelden dürfen. Lokal optional (leer = jedes Discord-Konto). |
| `FILE_STORAGE_PATH` | nein | Verzeichnis für Uploads. Standard lokal `./data/uploads`, im Container `/app/data/uploads`. |
| `MCP_ENABLED` | nein | `true` aktiviert `/mcp`, OAuth und Discovery. Standard `false`; dann antworten diese Pfade mit 404. |
| `ENABLE_TEST_LOGIN` | nein | `true` aktiviert den Test-Login. Nur lokal. |
| `DATABASE_POOL_MAX` | nein | Größe des Datenbank-Verbindungspools. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | nur lokal | Werte für den PostgreSQL-Container aus `docker-compose.yml`. |

**Schutzregeln in Produktion (`APP_ENV=production`):** Die Anwendung startet nicht, wenn

- `ENABLE_TEST_LOGIN=true` gesetzt ist, oder
- `ALLOWED_DISCORD_IDS` fehlt oder leer ist (fail closed).

## Discord-Login einrichten

1. Im [Discord Developer Portal](https://discord.com/developers/applications) eine Anwendung anlegen.
2. Unter OAuth2 die Redirect-URLs eintragen:
   - `http://localhost:3000/api/auth/callback/discord` (lokal)
   - `https://<deine-domain>/api/auth/callback/discord` (Server)
3. Scopes: `identify` und `email` (beide Pflicht).
4. Client-ID und Client-Secret als `DISCORD_CLIENT_ID` und `DISCORD_CLIENT_SECRET` eintragen.
5. Die Discord-Benutzer-IDs der Gruppe in `ALLOWED_DISCORD_IDS` eintragen. Nicht gelistete Konten werden beim Login mit einer klaren Meldung abgelehnt.

## Betrieb auf einem Server

WorldCraft braucht drei Dinge: den App-Container, PostgreSQL 16 und einen Reverse Proxy mit HTTPS.

### Image bauen

```bash
docker build -t worldcraft .
```

`next build` braucht mehrere GB RAM. Auf kleinen Servern empfiehlt es sich, das Image woanders zu bauen (z. B. in CI) und auf dem Server nur zu ziehen. Der mitgelieferte Workflow [`.github/workflows/build-image.yml`](.github/workflows/build-image.yml) testet, baut für `linux/amd64` und veröffentlicht das Image in der GitHub Container Registry (`ghcr.io/<owner>/<repo>:main` und `:<git-sha>`).

### Container starten

```bash
docker run -d --name worldcraft \
  -p 3000:3000 \
  -v worldcraft_uploads:/app/data/uploads \
  -e NODE_ENV=production \
  -e APP_ENV=production \
  -e DATABASE_URL='postgresql://…' \
  -e BETTER_AUTH_SECRET='…' \
  -e BETTER_AUTH_URL='https://worldcraft.example.com' \
  -e DISCORD_CLIENT_ID='…' \
  -e DISCORD_CLIENT_SECRET='…' \
  -e ALLOWED_DISCORD_IDS='…' \
  worldcraft
```

Beim Start führt der Container zuerst die Datenbank-Migrationen aus und startet danach die Anwendung ([`entrypoint.sh`](entrypoint.sh)).

### Worauf zu achten ist

- **Persistenz:** Zwei Dinge müssen einen Neustart überleben: die PostgreSQL-Daten und das Upload-Volume unter `/app/data/uploads` (Karten, Titelbilder, Avatare).
- **Genau eine Instanz:** Echtzeit läuft über einen In-Process-Bus. Mehrere Replicas der App werden nicht unterstützt.
- **Reverse Proxy:** Der Container darf nicht direkt aus dem Internet erreichbar sein. Der Proxy muss HTTPS terminieren und die Client-Adresse als einen einzelnen `X-Forwarded-For`-Wert weiterreichen; darauf stützen sich die Rate-Limits für OAuth.
- **Uploads:** Kartenbilder dürfen bis 20 MB groß sein, andere Bilder bis 10 MB. Das Body-Limit des Proxys muss das zulassen.
- **SSE:** Der Proxy darf Antworten der Route `/api/worlds/<id>/events` nicht puffern.

### Coolify

Die Referenzinstallation läuft auf [Coolify](https://coolify.io): PostgreSQL als Datenbank-Ressource, die App als Ressource vom Typ **Docker Image** (vorgebautes Image aus GHCR, Port 3000, Volume auf `/app/data/uploads`). Nach einem Push kann der Workflow über die optionalen Actions-Secrets `COOLIFY_WEBHOOK_URL` und `COOLIFY_WEBHOOK_TOKEN` ein Deployment auslösen. Schritt-für-Schritt-Anleitung: [`.ai/infrastructure/deployment.md`](.ai/infrastructure/deployment.md).

## MCP: KI anbinden

Der MCP-Server ist standardmäßig aus. Es braucht zwei Schalter:

1. **Server:** `MCP_ENABLED=true` setzen.
2. **Welt:** Der Game Master aktiviert in den Welt-Einstellungen „KI-Zugriff (MCP) erlauben“.

Danach im KI-Client die Adresse `https://<deine-domain>/mcp` als eigenen MCP-Server bzw. Custom Connector eintragen und die Anmeldung mit dem WorldCraft-Konto abschließen. In Claude Code:

```bash
claude mcp add --transport http worldcraft https://<deine-domain>/mcp
```

Für ChatGPT und Codex liegen Plugin-Manifeste unter [`plugins/worldcraft/`](plugins/worldcraft/); die dort eingetragene URL muss auf die eigene Domain zeigen. Eine Anleitung für Benutzer liefert die App selbst unter `/hilfe/mcp`.

### Werkzeuge

| Lesen (Scope `worlds:read`) | Schreiben (Scope `worlds:write`) |
|---|---|
| `welten_auflisten` | `inhalt_anlegen` |
| `universen_auflisten` | `inhalt_aendern` |
| `inhalte_auflisten` | `relation_anlegen` |
| `quests_auflisten` | `sichtbarkeit_setzen` |
| `suchen` | `bild_hochladen` |
| `inhalt_lesen` | `aenderung_bestaetigen` |
| `relationen_abrufen` | |
| `bild_lesen` | |

### Sicherheitsmodell

- **Gleiche Rechte wie in der App:** Jedes Werkzeug läuft über dieselbe Rechteschicht wie die Weboberfläche.
- **Bestätigung vor dem Schreiben:** Änderungen an bestehenden Inhalten, Sichtbarkeitswechsel und das Ersetzen von Bildern liefern zuerst eine Vorschau (vorher → nachher) und ein Bestätigungs-Token (10 Minuten gültig, einmal einlösbar). Nach dem Speichern folgt eine Quittung.
- **Kein Löschen:** Die KI kann weder Inhalte noch Relationen, Kapitel oder Bilder löschen.
- **Neue Inhalte starten privat:** Sichtbarkeit „nur ich“ (Universen: „nur Spielleitung“).
- **Ausgeschlossen:** Chat, Tagebuch, Einladungen, Mitglieder, Marker, Koordinaten und Kartenbilder. Pins und Charaktere sind nicht schreibbar.
- **Begrenzung und Audit:** 60 Werkzeugaufrufe pro Benutzer und Minute; jeder Aufruf wird ohne Inhalte protokolliert und nach 30 Tagen gelöscht.
- **Widerruf:** Jeder Benutzer kann verbundene Anwendungen im Weltmenü widerrufen.

Details: [`.ai/architecture/mcp.md`](.ai/architecture/mcp.md).

## Entwicklung

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm start` | Produktions-Build und Start |
| `npm test` | Unit-Tests (Vitest) |
| `npm run typecheck` | Typprüfung |
| `npm run lint` | ESLint |
| `npm run db:generate` | Migration aus dem Drizzle-Schema erzeugen |
| `npm run db:migrate` | Ausstehende Migrationen anwenden |
| `npm run db:studio` | Drizzle Studio |
| `npm run test:rechte` | Rechte-Matrix gegen den laufenden Dev-Server |
| `npm run test:mcp` | MCP-Suite gegen den laufenden Dev-Server |
| `npm run test:triggers` | Datenbank-Trigger und Integrationstests |

Die drei letzten Suiten brauchen die lokale Datenbank und den Test-Login. Die Testwelt für die MCP-Suite legt `node --env-file=.env scripts/seed-mcp-test-world.mjs` an (nur gegen die lokale Datenbank ausführen).

Projektstruktur:

```text
src/app/          Seiten und Route Handlers (API, /mcp, OAuth)
src/components/   UI nach Bereich (map, quests, monsters, chat, editor, …)
src/lib/authz/    Rechteschicht
src/lib/domain/   Fachlogik
src/lib/mcp/      MCP-Werkzeuge, Bestätigungen, Audit
src/lib/realtime/ SSE-Bus
src/db/           Drizzle-Schema und SQL-Migrationen
.ai/              Architektur, ADRs, Konventionen, Pläne
```

Konventionen für Beiträge: [`.ai/conventions.md`](.ai/conventions.md).

## Lizenz

WorldCraft steht unter der [PolyForm Noncommercial License 1.0.0](LICENSE).

- **Erlaubt:** Nutzen, Selbsthosten, Verändern und Weitergeben für nichtkommerzielle Zwecke, etwa für die eigene Spielrunde, als Hobbyprojekt, in Bildung und Forschung oder in gemeinnützigen Organisationen.
- **Nicht erlaubt:** Jede kommerzielle Nutzung, zum Beispiel WorldCraft als kostenpflichtigen Dienst anbieten oder in ein kommerzielles Produkt einbauen.
- **Pflicht bei Weitergabe:** Lizenztext bzw. Lizenz-URL und den Copyright-Hinweis (`Required Notice`) mitgeben.

Der Quellcode ist damit öffentlich einsehbar und veränderbar („source-available“), die Lizenz ist wegen der Einschränkung auf nichtkommerzielle Nutzung aber keine Open-Source-Lizenz im Sinne der OSI. Für eine kommerzielle Lizenz bitte den Rechteinhaber kontaktieren.

Copyright © 2026 Diego Lago Lago
