# Architecture (verbindlich)

**Status:** Festgehalten durch Plan `001` T-013 (2026-09-22).  
**Grundlage:** ADRs unter `.ai/decisions/`, Spikes T-005 / T-008–T-011 (historisch), Smoketest, `package.json`. TipTap lebt in der Next-App (`src/components/editor/`, `src/lib/editor/`).

Versionen = installierte Stände. Patch-Updates innerhalb derselben Major/Minor-Linie sind erlaubt; Major-Sprünge brauchen ein neues oder aktualisiertes ADR.

## Kernstack

| Bereich | Technologie | Version (Stand) | ADR / Norm |
|---|---|---|---|
| App-Framework | Next.js (App Router) + React | Next `16.3.5`, React `19.2.8` | [ADR-002](decisions/002-frontend.md) |
| Sprache | TypeScript | `^5` | ADR-002 |
| Backend (same process) | Next.js Route Handlers + Node | wie Next | [ADR-001](decisions/001-backend.md) |
| Datenbank | PostgreSQL | `16` (Docker-Image `postgres:16-alpine`) | ADR-001 |
| ORM / Schema | Drizzle ORM + Drizzle Kit | `drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.10` | ADR-001 · [datenmodell.md](architecture/datenmodell.md) |
| Auth | Better Auth (Discord + Session) | `^1.7.5` | ADR-001 · ADR-002 |
| Validierung | Zod | `^4.6.5` | [ADR-001](decisions/001-backend.md) (Typsicherheit im TypeScript-Backend; kein eigenes ADR) |
| Dateien | lokales Volume (`FILE_STORAGE_PATH`) | — | [ADR-001](decisions/001-backend.md) · [deployment.md](infrastructure/deployment.md) |
| Realtime | **SSE** (Server-Sent Events) nach Drop / nach Speichern | Browser `EventSource` | [ADR-002](decisions/002-frontend.md) (Präzisierung); Spike-Beweis T-009/T-010. Kein Socket.IO-Custom-Server. |
| Karten | Leaflet `CRS.Simple` | `leaflet ^1.9.4` | [ADR-003](decisions/003-karten.md) |
| Artikel-Editor | TipTap (nur OSS-Extensions) | `@tiptap/*` in der Next-App | [ADR-004](decisions/004-editor.md) |
| UI-Styling | Tailwind CSS | `^4` | [ADR-002](decisions/002-frontend.md) (Frontend-Stack; kein eigenes ADR) |
| Betrieb | Coolify + GHCR-Image (`linux/amd64`) | Domain `worldcraft.lagolago.at` | [ADR-001](decisions/001-backend.md) / [ADR-002](decisions/002-frontend.md) (ein Container) · [deployment.md](infrastructure/deployment.md) |
| CI-Build | GitHub Actions → GHCR | Tags `:main` und `:<sha>` | [ADR-001](decisions/001-backend.md) (Coolify-Betrieb) · deployment.md |
| Lokale DB | Docker Compose | `docker-compose.yml` | [ADR-001](decisions/001-backend.md) · README |

**Nicht gewählt (bewusst):** PocketBase, Supabase Self-Host, SvelteKit, React+Vite-SPA, Konva, tldraw, TipTap Pro, Socket.IO als Pflicht.

## Authentifizierung & Rechte

- **Discord-Login** über Better Auth; Scopes `identify` **und** `email` (E-Mail technisch Pflicht — siehe Datenmodell Abschnitt 13 A).
- **Test-Login** nur bei `ENABLE_TEST_LOGIN=true` und **nie** mit `APP_ENV=production` (App startet sonst nicht). Seeds: `test-gm`, `test-master`, `test-player-a`, `test-player-b`.
- **Rechteschicht:** TypeScript-Anwendungslogik (+ Postgres-Constraints). Dieselbe Schicht später für MCP (Plan `002`).

## Produkt-UI-Normen (Querverweise)

- [Mobile-First](standards/mobile-first.md) — Handy ~390 px zuerst
- [Mobile-Navigation](standards/mobile-navigation.md) — Bottom-Bar (Shell später)
- [Erwähnungen](standards/erwaehnungen.md) — `@`, Stub-Artikel, Query bis Caret

## Datenmodell

- Fachlich: [architecture/datenmodell-fachlich.md](architecture/datenmodell-fachlich.md)
- Technisch (PostgreSQL/Drizzle-Vorlage): [architecture/datenmodell.md](architecture/datenmodell.md)
- Überblick Komponenten: [architecture/README.md](architecture/README.md)

## Go / No-Go (Plan 001)

| Spike / Prüfung | Ergebnis | Begründung |
|---|---|---|
| T-005 Editor (TipTap) | **bestanden** | ADR-004 + Spike `spikes/editor/` mit Abnahmekriterien |
| T-008 Discord + Test-Login | **bestanden** | Lokal inkl. Test-Login; Prod Discord Owner-verifiziert; Test-Login auf Prod N/A (404) |
| T-009 Karte + Pins + SSE | **bestanden** | Lokal abgenommen; Prod-Smoketest Owner 2026-09-22 OK; Zoom-UX Backlog |
| T-010 Chat + Würfel + SSE | **bestanden** | Lokal abgenommen; Prod-Smoketest Owner 2026-09-22 OK; Channel/Composer-UX Backlog |
| T-011 Rechte auf Datenebene | **bestanden** | `npm run test:rechte` lokal 15/15; Prod N/A ohne Test-Login |
| T-014 Smoketest | **bestanden** | Owner 2026-09-22: Smoketest insgesamt erfolgreich; offene UX iterativ |

**Einschätzung: Go.**

Die Infrastruktur trägt den MVP-Folgeplan. Kein ADR muss wegen Spike-Scheiterns neu bewertet werden. Verbleibende UX-Bugs sind kein No-Go.

---

## Abgleich Plan 002 (MCP-Server)

Plan `.ai/feature-tasks/002-mcp-server.md` wurde gegen ADRs, technisches/fachliches Datenmodell und diese Normen gelesen. **Plan 002 wurde nicht geändert.** Abweichungen / Anpassungsbedarf für den Owner:

| # | Fundstelle in Plan 002 | Abweichung / Klärungsbedarf | Bezug |
|---|---|---|---|
| 1 | Globale Abhängigkeiten: „Produktiv- **und Staging**-Umgebung“; Remote-MCP „Produktiv- bzw. Staging-Domain“; T-002/T-003/T-005/T-010: Tests „auf Staging“ | **Kein separates Staging.** Nur Produktion `worldcraft.lagolago.at` + lokal. MCP-E2E / Inspector / `whoami` müssen auf **lokal** (und ggf. Prod mit echten Discord-Usern) umformuliert werden. | deployment.md, T-007-Abweichung |
| 2 | T-002: Testbenutzer-Sitzung „nur in Staging und lokal“; Abnahme „Staging“ | Test-Login und Seed-Welten nur **lokal** (`ENABLE_TEST_LOGIN`). Produktion bleibt geschlossen. | conventions.md, env-Guard |
| 3 | T-005: `whoami` „nur in Staging registriert“ | Entspricht künftig „nur wenn nicht `APP_ENV=production`“ (lokal / ggf. spätere Non-Prod), nicht eine Staging-Domain. | ADR-001 / APP_ENV |
| 4 | MCP-Werkzeug-Parameter `welt_id`, `karte_id`, `art` mit Werten `artikel` / `quest` / … (deutsch) | Technisches Schema nutzt Englisch/`snake_case` und Enum-Schlüssel (`article`, `gm_only`, …). **Abbildung nötig** (API/MCP-Fassade vs. DB). Kein Widerspruch zum Fachmodell, aber vor Umsetzung festlegen: deutsche MCP-Namen beibehalten oder an DB-Schlüssel anpassen? | datenmodell.md §2.1 |
| 5 | Globale Abhängigkeit: „MVP-Funktionsplan abgeschlossen“ vor Plan 002 | Unverändert gültig und **bewusst**: Plan 002 nach MVP-Features. Kein ADR-Konflikt — nur Reihenfolge. | Plan 002 selbst |
| 6 | T-001 ADR-005 erwartet Better-Auth-`mcp()` / same-process `/mcp` | **Passt** zu ADR-001/002. Keine Abweichung; ADR-005 kann das festschreiben. | ADR-001 Konsequenzen |
| 7 | Relationen-Herkunft Erwähnung / Vorlagenfeld / Beteiligung / manuell | **Passt** zu `relation_origin` im technischen Modell. | datenmodell.md |
| 8 | Tagebuch & Chat über MCP ausgeschlossen | **Passt** zur Rechtematrix / Abgrenzung Plan 001. | Plan 001 Abgrenzung |

**Keine Abweichungen** bei Backend-Wahl (TypeScript/Better Auth), Frontend (Next same-origin `/mcp`), TipTap→Markdown-Annahme, Scope `worlds:read`, oder der gemeinsamen Rechteschicht.

### Rückfragen an den Projektinhaber (Plan 002, vor `/plan-run` dort)

1. Staging-Referenzen in Plan 002 auf **lokal + Prod** umschreiben lassen (ja/nein / eigener Mini-Patch)?
2. MCP-Parameter: deutsche Namen (`welt_id`, `art: artikel`) beibehalten oder an englische DB-Schlüssel angleichen?

---

## Abgleich Plan 002 nach MVP

Stand nach Plan `003` T-016 (2026-09-23). Plan `.ai/feature-tasks/002-mcp-server.md` erneut gegen den **tatsächlichen** Code gelesen. **Plan 002 wurde nicht geändert.**

| # | Fundstelle in Plan 002 | Abweichung / Ist nach MVP | Bezug |
|---|---|---|---|
| M1 | Staging / „Produktiv- bzw. Staging-Domain“ (u. a. Globale Abhängigkeiten, T-002/T-003/T-005/T-010) | Unverändert: **kein Staging**. Nur `worldcraft.lagolago.at` + lokal. | Abgleich #1–#3 oben; deployment.md |
| M2 | MCP-Parameter `welt_id`, `art: artikel` / `quest` / … (deutsch) | Produkt-HTTP nutzt Englisch: Pfad `/api/worlds/[worldId]/…`, Query `kind=article\|quest\|character\|pin\|universe`, Enums `content_kind` / `quest_status` (`open`/`active`/`completed`/`failed`). MCP-Fassade braucht Abbildung oder Angleichung. | Abgleich #4; `src/lib/search.ts`, `src/db/schema.ts` |
| M3 | „Rechteschicht“ für Werkzeuge | Pfad bestätigt: `src/lib/authz/` (+ Domäne `src/lib/domain/*`). MCP darf nicht an Tabellen vorbei. | conventions.md, architecture/README.md |
| M4 | Werkzeug `suchen` (limit 20/50, kein Tagebuch) | Entspricht `searchWorld` / `GET …/search?q=&kind=&limit=` (Snippet ≤300, kein Journal). Wiederverwendbar. | Plan 003 T-014 |
| M5 | TipTap-JSON → Markdown für `inhalt_lesen` | **Noch nicht implementiert** (kein `toMarkdown` o. ä. in `src/`). Für Plan 002 neu zu bauen. | Plan 002 T-001 Punkt 6 |
| M6 | Chat-/Tagebuch-Ausschluss über MCP | Tabellen `chat_*` und `journal_entries` existieren produktiv; Ausschlussregel unverändert gültig. Hub-Suche schließt Journal bereits aus. | Plan 002 Abgrenzung; T-014 |
| M7 | Globale Abhängigkeit „MVP-Funktionsplan abgeschlossen“ | Mit T-016 Spike-Cutover (Code/Migration lokal) erfüllt für den Start von Plan 002; Prod-Daten-Cleanup und Smoketest T-017 ggf. noch offen. | Plan 003 T-016/T-017 |

**Keine neuen Abweichungen** gegenüber dem Abgleich aus Plan 001 T-013 bei Backend (Better Auth / Next same-origin `/mcp`), Scope `worlds:read`, Relationen-Herkunft (`mention` / `template_field` / `participation` / `manual`) oder der gemeinsamen Rechteschicht.

**Offene Rückfragen (wiederholt, noch unbeantwortet):**

1. Staging-Texte in Plan 002 auf **lokal + Prod** umschreiben?
2. MCP-Parameter deutsch belassen oder an englische Produkt-/DB-Schlüssel angleichen?

### nach Plan 004 (2026-09-23)

Plan `.ai/feature-tasks/002-mcp-server.md` gegen den Stand nach Plan `004` (dreistufige Sichtbarkeit, Owner, Quest-Kapitel, Quest-Notizblock) gelesen. **Plan 002 wurde nicht geändert.** Start von Plan 002 erst nach Abschluss von `004` (R4).

| # | Fundstelle in Plan 002 | Abweichung / Ist nach Plan 004 | Bezug |
|---|---|---|---|
| P4-1 | Abgrenzung / Rechteschicht „Rechtematrix aus Plan `001`“; Werkzeuge „Kennzeichnung, ob … `nur Spielleitung`“ (`inhalt_lesen`); T-002/T-008 nur `nur Spielleitung` vs. veröffentlicht | Inhalt ist **dreistufig** (`owner_only` / `gm_only` / `published`) für Artikel, Quests, Kapitel, Pins; Owner-Rechte ruhen bei herabgestuftem Master (R1); nur der Owner setzt `owner_only` (R2). Universen/Karten bleiben zweistufig. MCP-Texte und Rechte-Tests müssen die dritte Stufe und den Owner abbilden. | Plan 004 Fachliche Regeln; `APP-VIS-OWNER`; datenmodell.md |
| P4-2 | `inhalt_lesen` Quest: „Titel, Status, beteiligte Charaktere, Beschreibung“ | Quests haben zusätzlich **Kapitel** (`quest_chapters`) mit eigener Sichtbarkeit und Vererbung Quest→Kapitel. Plan 002 nennt Kapitel nicht. | Plan 004 E1/E2; `src/lib/domain/quest-chapters.ts` |
| P4-3 | Abgrenzung schließt Tagebuch/Chat aus; Notizblock nicht erwähnt | Pro Quest existiert ein gemeinsamer **Notizblock** (`quest_notes`). Hub-Suche schließt ihn aus (wie Tagebuch); Relationen entstehen nicht (`APP-NOTE-NO-REL`). Ob MCP ihn ebenfalls ausschließt, ist offen (Frage 3). | Plan 004 E4/E6/E7; `src/lib/domain/quest-notes.ts` |
| P4-4 | `suchen` (Treffer auf Inhalte) | Hub-Suche findet Quests auch über **sichtbare Kapiteltexte** (Treffer auf die Quest, Snippet aus Kapitel). Plan 002 erwähnt nur Quest-Titel/Beschreibung implizit über die Rechteschicht. | Plan 004 E7; `searchQuestChapters` |
| P4-5 | T-002 Testwelt: Artikel/Pins nur `nur Spielleitung` / veröffentlicht; kein Owner | Seed muss `owner_only`-Fälle und ggf. Kapitel/Notizblock vorsehen, sobald die offenen Fragen entschieden sind. Default neuer Datensätze: `owner_only`. | Plan 004 E8; T-002 in Plan 002 |
| P4-6 | Globale Abhängigkeit „MVP-Funktionsplan“ | Ergänzt: **Plan `004` vor `002`** (Roadmap R4). Abgleich dieses Unterabschnitts ist Voraussetzung vor `/plan-run` für `002`. | roadmap.md; Plan 004 R4 |

**Offene Fragen (Antwort vor Umsetzung Plan 002 nötig):**

1. Sieht Claude `owner_only`-Inhalte des angemeldeten Owners (über dieselbe Rechteschicht wie die App), oder sollen `owner_only`-Inhalte über MCP wie Tagebuch ausgeschlossen werden?
2. Werden Quest-Kapitel bei `inhalt_lesen` / `suchen` / Relationen mit ausgeliefert (nur sichtbare Kapitel), oder bleiben sie außerhalb von MCP?
3. Ist der Quest-Notizblock über MCP ausgeschlossen (Analogie Tagebuch), oder lesbar für alle, die die Quest sehen?
