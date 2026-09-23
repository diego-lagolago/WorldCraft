# Conventions (verbindlich)

**Status:** Festgehalten durch Plan `001` T-013 (2026-09-22).  
**Ergänzt:** [architecture.md](architecture.md), [features.md](features.md), [architecture/README.md](architecture/README.md), Standards unter `.ai/standards/`.

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
spikes/ui-prototype/    Design-Referenz (HTML), nicht Teil der Next-App
src/
  app/                  Next.js App Router (Seiten, Route Handlers)
    api/                HTTP-APIs (auth, test-login, worlds/…, characters, files)
    characters/         eigene Charaktere (weltunabhängig, Shell ohne Welt)
    w/[worldId]/        Produktseiten im Weltkontext (Shell aus components/shell)
    invite/[code]/      Einladung annehmen (außerhalb der Welt-Shell)
  components/           wiederverwendbare UI (shell/, editor/, auth/, world/, characters/, articles/, linked/, map/, quests/ …)
  db/                   Drizzle-Schema, Migrationen
  lib/                  Auth, Env, Hilfen
    authz/              Rechteschicht (eine Schicht für HTTP, Loader, später MCP)
    characters/         reine Bogenregeln (Attribute, Fertigkeiten, Fähigkeiten)
    domain/             Anwendungslogik je Fachbereich (DB-Zugriffe, Transaktionen)
    editor/             reine Editor-Logik (Sanitizing, Klartext, Erwähnungen)
    client/             reine Browser-Hilfen (localStorage, fetch-Helfer `apiRequest`)
    templates/          Vorlagen-Registry und Feldvalidierung
    map/                Karten-Logik (Koordinaten, Pin-Typen, Repository)
    chat/               Chat-Würfel und Query-Hilfen
    realtime/           gemeinsamer SSE-Bus
  test/                 gemeinsame Test-Hilfen (API-Harness)
scripts/                Migrations-/Hilfsskripte
data/uploads/           lokale Uploads (nicht committen)
```

- Produktcode lebt unter `src/` (nicht neue Top-Level-Apps ohne ADR).
- Neue Unit-Tests: `src/**/*.test.ts` (`npm test`). Produkt-API-Tests: `src/**/*.api.test.ts` (`npm run test:rechte`, Dev-Server nötig).

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
3. **Trigger und Domänen-Integration:** `npm run test:triggers` — Vitest gegen die lokale PostgreSQL (`vitest.triggers.config.ts`, alle `src/**/*.integration.test.ts`), ebenfalls getrennt von `npm test`. Die Config setzt `DATABASE_POOL_MAX=12`, damit Nebenläufigkeitstests (z. B. parallele Beitritte) wirklich parallel laufen; ohne die Variable nutzt der Dev-Pool eine Verbindung.
4. **Editor:** TipTap-Tests unter `src/components/editor/` und `src/lib/editor/` (Teil von `npm test`). Der frühere Vite-Spike `spikes/editor/` ist entfernt (Plan 003 T-016).
5. **Manuell / Smoketest:** Prod per Discord; Protokoll [infrastructure/smoketest.md](infrastructure/smoketest.md).
6. **CI:** Job `verify` (Node 22: `npm test`, `tsc --noEmit`, `eslint`) **vor** dem Image-Build (GHCR). Ein fehlschlagender Test bricht den Workflow vor dem Image ab. Rechte-Skript und Trigger-Tests laufen nicht gegen Prod.

Neue Rechtefälle: zuerst in `src/lib/authz` plus Test, nicht nur in der UI und nicht in einem zweiten Pfad unter `src/spike/`. Ungültige UUIDs und ungültiges JSON in Produkt-APIs über `parseUuid` / `parseJsonBody` (`src/lib/http.ts`) als 400 oder 404, nie als 500. Patches an Entitäten als `ColumnPatch<T>`, nicht als `Record<string, unknown>`.

## UI-Normen (Querverweise)

- [standards/mobile-first.md](standards/mobile-first.md)
- [standards/mobile-navigation.md](standards/mobile-navigation.md) — Bottom-Bar später
- [standards/erwaehnungen.md](standards/erwaehnungen.md)

## Deployment-Kurzregel

- Build: GitHub Actions → GHCR. Coolify: Image pull, kein Dockerfile-Build auf dem VPS.
- Persistenz: Postgres-Volume + Upload-Volume `/app/data/uploads`.
- **App-Version:** `package.json` (Versionsbadge) soll **automatisch mit Releases/Deploys mitlaufen**. **Git-Tags** setzen wir nicht — taggen müssen wir nicht.
- Details: [infrastructure/deployment.md](infrastructure/deployment.md).

## Features-Katalog (verbindlich)

**Jede Aufgabe**, die die Produktoberfläche oder das nutzbare Verhalten ändert, **muss** [features.md](features.md) ergänzen oder anpassen:

| Fall | Pflicht |
|---|---|
| Neues Feature | Eintrag anlegen (Kurzname, 1-Zeilen-Beschreibung, Status) |
| Geändertes Verhalten | bestehenden Eintrag anpassen |
| Entferntes Feature | Eintrag entfernen oder als entfernt kennzeichnen |
| Keine Feature-Wirkung | kurz **N/A** in der Task-Umsetzung vermerken — oder mit Urteil weglassen |

Gilt für Plan-Aufgaben (`T-…`), Bugfixes mit Feature-Wirkung und `/plan-run`. Default: bei Oberflächen-/Verhaltensänderung **nachziehen**, nicht erst am Planende. Katalog: [features.md](features.md).

## Backlog vs. Normen

Kurze Restpunkte ohne Plan: [backlog.md](backlog.md). Normen hier und unter `.ai/standards/` haben Vorrang vor Spike-WIP.
