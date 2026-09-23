# Conventions (verbindlich)

**Status:** Festgehalten durch Plan `001` T-013 (2026-09-22).  
**Ergänzt:** [tech-stack.md](tech-stack.md), [architecture/README.md](architecture/README.md), Standards unter `.ai/standards/`.

## Sprache

| Bereich | Sprache | Regel |
|---|---|---|
| **Oberfläche (UI)** | **Deutsch** | Labels, Fehlermeldungen, Hilfetexte, Consent, MCP-Werkzeugbeschreibungen für Claude |
| **Code** | **Englisch** | Dateien, Identifier, Commits-Technikbegriffe, HTTP-Pfade soweit technisch, DB-Tabellen/Spalten |
| **Fachdokumente in `.ai/`** | **Deutsch** | Pläne, ADRs, Normen; Code-Beispiele und Identifier darin englisch belassen |
| **Enum-Schlüssel (DB)** | Englisch | z. B. `gm_only`, `game_master`; UI zeigt deutsche Labels |
| **Git-Commit-Nachrichten** | Deutsch oder Englisch | kurz, „why“; Team-Stil der letzten Commits folgen |

## Ordnerstruktur

```
.ai/                    Normen, ADRs, Pläne, Infrastruktur-Doku
spikes/editor/          isolierter Editor-Spike (Vite), nicht Teil der Next-App
src/
  app/                  Next.js App Router (Seiten, Route Handlers)
    api/                HTTP-APIs (auth, test-login, worlds/…, spike/*)
    w/[worldId]/        Produktseiten im Weltkontext (Shell aus components/shell)
    spike/              Spike-Routen /spike/karte, /spike/chat
  components/           wiederverwendbare UI (shell/, editor/, auth/ …)
  db/                   Drizzle-Schema, Migrationen
  lib/                  Auth, Env, Hilfen
    authz/              Rechteschicht (eine Schicht für HTTP, Loader, später MCP)
    domain/             Anwendungslogik je Fachbereich (DB-Zugriffe, Transaktionen)
    editor/             reine Editor-Logik (Sanitizing, Klartext, Erwähnungen)
    client/             reine Browser-Hilfen (z. B. localStorage)
  test/                 gemeinsame Test-Hilfen (API-Harness)
  spike/<name>/         Spike-UI und Spike-Logik (klar als Spike gekennzeichnet)
scripts/                Migrations-/Hilfsskripte
data/uploads/           lokale Uploads (nicht committen)
```

- Produktcode wächst unter `src/` (nicht neue Top-Level-Apps ohne ADR).
- Spike-Seiten unter `/spike/…` dürfen im MVP-Folgeplan ausgebaut oder entfernt werden; Discord-Login bleibt.
- Neue automatisierte Spike-/Rechte-Tests: neben dem Spike oder unter `src/lib/*.test.ts` / `src/spike/**/*.test.ts` (siehe `npm test`).

## Namenskonventionen

| Gegenstand | Konvention |
|---|---|
| React-Komponenten / Dateien | `PascalCase.tsx` für Komponenten; Hooks `useX.ts` |
| Module / Utilities | `kebab-case.ts` oder bestehende `camelCase`-Dateien im Ordner nicht brechen |
| DB-Tabellen / Spalten | `snake_case`, englisch ([datenmodell.md](architecture/datenmodell.md)) |
| Env-Variablen | `SCREAMING_SNAKE_CASE` (Vorlage `.env.example`) |
| Feature-Pläne | `.ai/feature-tasks/NNN-kurzname.md`, Tasks `T-NNN` |
| ADRs | `.ai/decisions/NNN-kurzname.md` |

## Secrets & Konfiguration

- **Niemals** Secrets committen (Client-Secret, `BETTER_AUTH_SECRET`, DB-Passwort, Tokens).
- Vorlage: `.env.example` (ohne echte Werte). Lokal: `.env` (gitignored).
- Produktion: Werte nur in Coolify. Secrets nicht in den Chat.
- `git grep` / Review: keine Klartext-Secrets im Repo.

## Test-Login (hart)

| Umgebung | `ENABLE_TEST_LOGIN` | Erlaubt? |
|---|---|---|
| Lokal (`APP_ENV=development`) | `true` | Ja — Seeds und Rechte-Skript |
| Produktion (`APP_ENV=production`, `worldcraft.lagolago.at`) | **nicht setzen** | Test-Login muss 404 sein; App **startet nicht**, wenn beide true |

Es gibt **kein** separates Staging. Formulierungen „Staging“ in älteren Docs meinen: lokal oder die frühere Planannahme — maßgeblich ist deployment.md.

## Teststrategie

1. **Unit-Tests:** `npm test` = Vitest (`vitest run`, `environment: "node"`, Alias `@` → `src`). Führt alle `src/**/*.test.ts` aus (außer `*.integration.test.ts` und `*.api.test.ts`). DOM-Tests setzen `// @vitest-environment happy-dom` in der Datei. Importe ohne `.ts`-Endung.
2. **Rechte-Matrix und Produkt-API-Tests:** `npm run test:rechte` — Vitest mit eigener Config (`vitest.rechte.config.ts`), getrennt von `npm test`, weil ein laufender Dev-Server und Test-Login nötig sind (nur lokal). Produkt-API-Tests heißen `*.api.test.ts`, liegen neben der Route und nutzen `src/test/api-harness.ts` (Test-Login, Requests, SQL nur für Testdaten und Aufräumen).
3. **Trigger:** `npm run test:triggers` — Vitest gegen die lokale PostgreSQL (`vitest.triggers.config.ts`), ebenfalls getrennt von `npm test`.
4. **Editor-Spike:** `cd spikes/editor && npm test` (eigenes Vitest).
5. **Manuell / Smoketest:** Prod per Discord; Protokoll [infrastructure/smoketest.md](infrastructure/smoketest.md).
6. **CI:** Job `verify` (Node 22: `npm test`, `tsc --noEmit`, `eslint`, Editor-Spike-Tests) **vor** dem Image-Build (GHCR). Ein fehlschlagender Test bricht den Workflow vor dem Image ab. Rechte-Skript und Trigger-Tests laufen nicht gegen Prod.

Neue Rechtefälle: zuerst in `src/lib/authz` plus Test, nicht nur in der UI und nicht in einem zweiten Pfad unter `src/spike/`. Ungültige UUIDs und ungültiges JSON in Produkt-APIs über `parseUuid` / `parseJsonBody` (`src/lib/http.ts`) als 400 oder 404, nie als 500. Patches an Entitäten als `ColumnPatch<T>`, nicht als `Record<string, unknown>`.

## UI-Normen (Querverweise)

- [standards/mobile-first.md](standards/mobile-first.md)
- [standards/mobile-navigation.md](standards/mobile-navigation.md) — Bottom-Bar später
- [standards/erwaehnungen.md](standards/erwaehnungen.md)

## Deployment-Kurzregel

- Build: GitHub Actions → GHCR. Coolify: Image pull, kein Dockerfile-Build auf dem VPS.
- Persistenz: Postgres-Volume + Upload-Volume `/app/data/uploads`.
- Details: [infrastructure/deployment.md](infrastructure/deployment.md).

## Backlog vs. Normen

Kurze Restpunkte ohne Plan: [backlog.md](backlog.md). Normen hier und unter `.ai/standards/` haben Vorrang vor Spike-WIP.
