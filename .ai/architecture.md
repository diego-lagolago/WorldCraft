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

1. Sieht Claude `owner_only`-Inhalte des angemeldeten Owners (über dieselbe Rechteschicht wie die App), oder sollen `owner_only`-Inhalte über MCP wie Tagebuch ausgeschlossen werden? **✅ Beantwortet 2026-09-25 (Plan 002 D5):** wie in der App, keine Zusatzsperre; fremde `owner_only`-Inhalte bleiben unsichtbar.
2. Werden Quest-Kapitel bei `inhalt_lesen` / `suchen` / Relationen mit ausgeliefert (nur sichtbare Kapitel), oder bleiben sie außerhalb von MCP?
3. Ist der Quest-Notizblock über MCP ausgeschlossen (Analogie Tagebuch), oder lesbar für alle, die die Quest sehen?

### nach Plan 005 (2026-09-23)

Plan `.ai/feature-tasks/002-mcp-server.md` gegen den Stand nach Plan `005` (Monster/Bestiarium) gelesen. **Plan 002 wurde nicht geändert** (PR3 / wie `004` T-012).

| # | Fundstelle in Plan 002 | Abweichung / Ist nach Plan 005 | Bezug |
|---|---|---|---|
| P5-1 | Inhaltsarten in Suche / `inhalt_lesen` / Relationen (Artikel, Quest, Charakter, Pin, Universum) | Neu: Inhaltsart **`monster`** (Bestiarium). Volles Charakterblatt + Art/Seltenheit/Gefahr/Größe/Lebensraum; dreistufige Sichtbarkeit wie Artikel; Bio mit Erwähnungen. | Plan `005` M1–M5; `monsters`; `content_kind` |
| P5-2 | Werkzeug `suchen` / Filter `art` | Offene Frage: Liefern Such- und Lese-Werkzeuge Monster? Optional Filter nach Art (`monster_kind`)? | Plan 005 T-011 |
| P5-3 | `inhalt_lesen` | Offene Frage: Wird das Charakterblatt (Attribute, Fertigkeiten, …) mit ausgeliefert? | Plan 005 T-011 |
| P5-4 | Sichtbarkeit / Rechteschicht | Offene Frage: Gilt die dreistufige Sichtbarkeit für Monster wie bei Artikeln (inkl. Owner / `owner_only`)? | Plan 005 M4; `APP-VIS-OWNER` |

**Offene Fragen für das spätere Review von Plan `002` (Antwort vor Umsetzung nötig):**

1. Liefern Such- und Lese-Werkzeuge Monster?
2. Filter nach Art (`monster_kind`)?
3. Wird das Charakterblatt mit ausgeliefert?
4. Gilt die dreistufige Sichtbarkeit wie bei Artikeln?


### nach Plan 006 (2026-09-24)

Plan `.ai/feature-tasks/002-mcp-server.md` gegen den Stand nach Plan `006` (Monster-Marker, Stecknadel-Darstellung, Kartenfilter, Hotkeys, Kopieren) und gegen den tatsächlichen Code gelesen. **Plan 002 wurde nicht geändert** (wie `004` T-012 und `005` T-011).

| # | Fundstelle in Plan 002 | Abweichung / Ist nach Plan 006 | Bezug |
|---|---|---|---|
| P6-1 | `karte_lesen` mit `karte_id`: „alle Pins … sowie alle Charakter-Marker“ | Neu: **Monster-Marker** (`monster_markers`) als dritte Art auf einer Karte. Beliebig viele pro Monster, auch mehrere auf derselben Karte (K1). Der Kartenzustand liefert sie bereits als `MonsterMarkerDto` (Monster-ID, Name, Bild-URL, Seltenheit, Boss, eigene Sichtbarkeit, Owner, `pos_x`/`pos_y` 0–1). Plan 002 nennt sie nicht (Frage 1). | Plan 006 K1/K2; `src/lib/map/types.ts`, `src/lib/map/repository.ts` |
| P6-2 | Sichtbarkeit in `karte_lesen` („Kennzeichnung, ob … `nur Spielleitung`“) | Monster-Marker haben eine **eigene dreistufige Sichtbarkeit** (neu immer `owner_only`, K6; Kopien übernehmen die Sichtbarkeit des Originals, K11) und sind nur sichtbar, wenn zusätzlich Monster und Karte sichtbar sind (`APP-VIS-INHERIT`). Die Filterung steckt heute in `getMapState` (`src/lib/map/repository.ts`); ein MCP-Werkzeug muss dieselbe Funktion nutzen statt direkt auf `monster_markers` zuzugreifen. Charakter-Marker bleiben ohne eigene Sichtbarkeit (unverändert). | Plan 006 K2/K6/K11; `APP-VIS-INHERIT`; M3 |
| P6-3 | Filter `art` bei `suchen`, `inhalt_lesen`, `relationen_abrufen` (Werte artikel / quest / charakter / pin / universum) | **Monster als eigene Art** ist im Produkt vollständig vorhanden: `content_kind` und `SEARCH_KINDS` enthalten `monster`, die Hub-Suche findet Monster über Name und Bio (`searchMonsters`, mit `visibleContentWhere`). Die Wertelisten von `art` in Plan 002 müssen um `monster` ergänzt werden, sofern Frage 1 nach Plan 005 mit „ja“ beantwortet wird. Der deutsche MCP-Wert wäre ebenfalls `monster`; die Abbildung hängt an der offenen Frage zu deutschen oder englischen Parametern (Abgleich #4 / M2). | Plan 005 T-011 (P5-1/P5-2); `src/lib/search.ts`, `src/lib/domain/search.ts` |
| P6-4 | `karte_lesen`: „verknüpfte Inhalte (aus Erwähnungen und manuellen Relationen: Art, ID, Titel)“ bei Pins | Pins können über Erwähnungen und manuelle Relationen jetzt auch auf **Monster** verweisen (`content_kind` `monster`). Die Art-Liste der verknüpften Inhalte muss Monster abdecken. Monster-Marker selbst sind **kein** `content_kind`: Sie haben weder Relationen noch Erwähnungen und tauchen in der Hub-Suche nicht auf. | datenmodell.md `relations`; Plan 006 *Begriffe* |
| P6-5 | T-002 Testwelt (Karte des ersten Universums: 4 Pins + ein Charakter-Marker); T-007 Abnahme (4); T-008 Rechte-Suite | Die Testwelt enthält weder Monster noch Monster-Marker. Damit Rechte-Tests die Vererbung prüfen können, braucht die Testwelt mindestens einen veröffentlichten Marker eines veröffentlichten Monsters, einen `gm_only`-Marker und einen veröffentlichten Marker eines `gm_only`-Monsters (analog zu den Abnahmekriterien von Plan 006 T-004). Das hängt von Frage 1 ab. | Plan 006 T-004; Plan 002 T-002/T-007/T-008 |
| P6-6 | – | **Ohne MCP-Wirkung:** Kartenfilter (rein clientseitig, `localStorage`), Stecknadel-Darstellung und Anker-Korrektur (K8, gespeichert wird weiter die relative Position), Hotkeys `P`/`M`, Platziermodi (K9/K10/K12). Kopieren (K11) erzeugt gewöhnliche `monster_markers`-Zeilen und braucht keine eigene Behandlung. Die SSE-Ereignisse `map.monsterMarker*` betreffen MCP nicht, da die Werkzeuge nur lesend und ohne Echtzeit arbeiten. | Plan 006 K3/K8–K12; ADR-003 |

**Offene Fragen für das Review von Plan `002` (Antwort vor Umsetzung nötig):**

1. Liefert `karte_lesen` mit `karte_id` Monster-Marker, und wenn ja, mit welchen Feldern? Vorschlag: Monster-ID, Monster-Name, Seltenheit, Boss-Kennzeichen, relative Position und Sichtbarkeitskennzeichnung wie bei Pins. Ohne Bild-URL, analog zum Ausschluss von Bildanhängen bei Charakteren.
2. Werden mehrere Marker desselben Monsters auf einer Karte einzeln ausgegeben (je Marker eine Zeile mit Position) oder gruppiert (Monster mit Anzahl und Positionsliste)?
3. Bleiben Monster-Marker ausschließlich Teil von `karte_lesen`, oder sollen sie zusätzlich lesbar sein, z. B. als Liste „Vorkommen auf Karten“ bei `inhalt_lesen` für ein Monster? Plan 006 schließt eine solche Liste in der App bewusst aus.
4. Wird die Testwelt aus T-002 um Monster und Monster-Marker in den drei Sichtbarkeitsfällen aus P6-5 erweitert, und wird T-007 Abnahme (4) entsprechend ergänzt?

Die Frage nach Monster in `suchen` und `inhalt_lesen` (P6-3) ist Frage 1 aus dem Abgleich nach Plan 005 und wird hier nicht doppelt gezählt.

### nach Plan 009 (2026-09-24)

Plan `.ai/feature-tasks/002-mcp-server.md` gegen den Stand nach Plan `009` (neue Vorlagenfelder und Vorlage „Rasse“) gelesen. Plan `002` wird nicht geändert; dieser Abgleich hält die offenen Entscheidungen für sein späteres Plan-Review fest.

| # | Änderung aus Plan 009 | Betroffene MCP-Werkzeuge / Abgleich |
|---|---|---|
| P9-1 | Neuer Vorlagentyp `race` („Rasse“, keine Felder) | `suchen` gibt den Vorlagentyp im Treffer aus und darf `race` nicht aus einer festen Liste ausschließen. `inhalt_lesen` muss Rasse-Artikel wie Artikel ohne Felder ausgeben (Titel, Vorlagentyp, Text). `welten_auflisten`, `quests_auflisten` und `karte_lesen` sind nicht betroffen. Die Vorlagentypen werden im Produkt aus der Registry gelesen; der MCP-Plan nennt sie bisher nicht einzeln. |
| P9-2 | Neues Verweisfeld `person.race` | Es erzeugt eine Relation Person → Rasse mit Herkunft `template_field` und Feldname `race`. `relationen_abrufen` muss diesen Feldnamen wie jedes andere Vorlagenfeld ausgeben; keine neue Relation-Art ist nötig. Die anderen Werkzeuge sind nur indirekt betroffen, wenn sie den vollständigen Artikelinhalt darstellen. |
| P9-3 | Neue Auswahlwerte in bestehenden Feldern: `person.status` (`incapacitated`, `sealed`), `place.kind` (`continent`), `item.kind` (`fish`, `plant`) | `inhalt_lesen` muss Werte aus `template_fields` vollständig ausgeben. `suchen` ist nicht betroffen: Es liefert den Vorlagentyp, aber keine Feldwerte; die übrigen Werkzeuge brauchen keine Anpassung. Die Werte werden in der Registry definiert, nicht in DB-Enums. |
| P9-4 | Neue Auswahlfelder: `place.danger`, `place.reputation`, `organization.size`, `organization.danger`, `item.rarity` | `inhalt_lesen` muss die neuen Felder bei Artikeln ausgeben. `suchen`, `relationen_abrufen`, `welten_auflisten`, `quests_auflisten` und `karte_lesen` brauchen keine Felderweiterung. `item.rarity` ist eine reine UI-Pill; als MCP-Inhalt genügt ein textueller Feldwert. |

**Testwelt (Plan 002 T-002):** Die dort geforderten fünf Artikel mit verschiedenen Vorlagentypen müssen den neuen Typ `race` berücksichtigen. Für die Relation Person → Rasse braucht die Testwelt außerdem eine Person mit `race`-Verweis, damit `relationen_abrufen` die Herkunft `template_field` und den Feldnamen `race` abnimmt.

**Offene Fragen für das Plan-Review von Plan 002:**

1. Gibt `inhalt_lesen` Auswahlwerte als deutsche Labels (empfohlen, analog zur UI) oder als gespeicherte englische Schlüssel aus? Diese Entscheidung gilt für alle bestehenden und neuen Vorlagenfelder.
2. Soll die Testwelt in T-002 mit weiterhin genau fünf Artikeln arbeiten und `race` einen bisherigen Vorlagentyp ersetzen, oder soll sie auf sechs Artikel erweitert werden, damit alle fünf Vorlagentypen plus ein Artikel ohne Vorlage vorkommen?

### nach Plan 010 (2026-09-24)

Plan `.ai/feature-tasks/002-mcp-server.md` gegen den Stand nach Plan `010` (Status an Quest-Kapiteln) gelesen. Plan `002` wird nicht geändert; dieser Abgleich ergänzt die weiterhin offene Kapitel-Entscheidung aus Plan `004`.

| # | Änderung aus Plan 010 | Betroffene MCP-Werkzeuge / Abgleich |
|---|---|---|
| P10-1 | `quest_chapters.status` nutzt wie Quests `open` / `active` / `completed` / `failed`; Standard ist `open`. Kapitel- und Quest-Status bleiben unabhängig. | Die offene Frage aus P4-2 bleibt maßgeblich: **Falls** `inhalt_lesen` Quest-Kapitel ausliefert, muss jedes sichtbare Kapitel seinen Status mit diesen vier Werten enthalten. Werden Kapitel nicht ausgeliefert, ist keine Erweiterung des Werkzeugergebnisses nötig. |
| P10-2 | Kapitel-Status ist nur eine Eigenschaft des Kapitels; Statusänderungen beeinflussen Sichtbarkeit, Suche und Relationen nicht. | `quests_auflisten` bleibt unverändert: Sein optionaler Statusfilter und der ausgegebene Status beziehen sich ausschließlich auf den **Quest-Status**, nicht auf Kapitel. `suchen` und `relationen_abrufen` brauchen keine Statusanpassung. |
| P10-3 | Kapitel können in der Testwelt unterschiedliche Status haben. | T-002 der Testwelt braucht nur dann Kapitel mit unterschiedlichen Status, wenn P4-2 mit Kapitel-Auslieferung beantwortet wird. Dann muss die Testwelt mindestens sichtbare Kapitel mit unterschiedlichen Status enthalten und der `inhalt_lesen`-Test sie samt Status abnehmen. |

**Offene Frage für das Plan-Review von Plan 002:** Ergänzend zu P4-2: Falls Kapitel über `inhalt_lesen` ausgeliefert werden, sind sie nur verschachtelter Quest-Inhalt oder sollen sie auch als eigene Treffer/Objekte in `suchen` bzw. `relationen_abrufen` erscheinen? Der Kapitel-Status selbst erweitert keinen dieser Scopes.
