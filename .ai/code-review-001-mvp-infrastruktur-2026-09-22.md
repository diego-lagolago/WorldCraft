# Code Review – Plan 001 (MVP-Infrastruktur)

**Baseline:** Commit `146e64608211e977c2aa41b4f9fd62a0f1350ac3` (`main`). Uncommittete Änderungen im Working Tree zum Review-Zeitpunkt nur in `.ai/architecture.md` (geändert) und `.ai/feature-tasks/003-mvp-funktionen.md` (neu). Beide sind Dokumente, kein Code.
**Geprüfte Task-Datei:** `.ai/feature-tasks/001-mvp-infrastruktur.md`
**Geprüfte Aufgaben (`[x]`):** T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010, T-011, T-013, T-014 (T-001 und T-012 sind entfallen).
**Zusätzlich ausgeführt:** `npm test` (2 Testdateien schlagen fehl), `npx tsc --noEmit` (1 Fehler), `npx eslint .` (1 Fehler).

## Umsetzungsrahmen (Entscheidung Projektinhaber, Plan-Review 2026-09-22)

- **Keine Behebung im aktuellen Spike-Code.** Alle Findings dieses Reviews werden im Rahmen von Plan `003` (`.ai/feature-tasks/003-mvp-funktionen.md`) umgesetzt, beim Ausbau bzw. beim Ersetzen der Spikes durch MVP-Code. Dieses Dokument ist dafür die Eingabe. Welche Aufgabe in Plan 003 welches Finding umsetzt, steht dort im Abschnitt *Code-Review zu Plan 001* und in der Zeile *Code-Review* jeder Aufgabe.
- **Ausnahme:** CR-009 und der ESLint-Fehler aus CR-015 werden in Plan 003 T-001 direkt im Spike-Code behoben, weil der CI-Job aus CR-010 sonst ab T-001 rot wäre.
- **Bewusst akzeptiertes Risiko:** Bis Plan 003 T-001 umgesetzt und gepusht ist, bleiben die Spike-Endpunkte in Produktion für jedes Discord-Konto erreichbar (CR-001), und `npm test` bleibt rot (CR-002).
- **Findings in entfernten Spikes:** Wird ein Spike in Plan 003 entfernt statt ausgebaut, gilt ein Finding als erledigt, wenn (a) die Fundstelle nicht mehr existiert **und** (b) der MVP-Ersatzcode das Abnahmekriterium sinngemäß erfüllt. `/review-check` setzt dann `behoben`, bei nicht mehr zuordenbarer Fundstelle `drift` mit Verweis auf den Nachfolgecode.
- **Abnahmekriterien** mit Spike-Pfaden (`/api/spike/...`, `src/spike/...`) gelten sinngemäß für die entsprechenden MVP-Pfade.

## Tracking

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Sicherheit | kritisch | behoben | Spike-APIs in Produktion für jedes Discord-Konto offen (Upload, Chat, Rechte-API auf echten Tabellen). Teil 1+2 erledigt; Teil 3 Prod-APPLY wartet auf Freigabe (siehe Review-Check 2026-09-23) |
| CR-002 | Testabdeckung | kritisch | behoben | `npm test` ist rot: `dice.test.ts` und `authz.test.ts` scheitern an `ERR_MODULE_NOT_FOUND` |
| CR-003 | Sicherheit | mittel | behoben | `discordId` ist als `input: true` über `/api/auth/update-user` vom Benutzer änderbar |
| CR-004 | Sicherheit | mittel | behoben | Manuelle Relationen prüfen nicht, ob Quelle und Ziel zur Welt gehören (weltübergreifend, 500 bei fremder ID) |
| CR-005 | Runtime-Risiken | mittel | behoben | Ungültige UUID bzw. ungültiges JSON führen in Karten- und Chat-Routen zu HTTP 500. Helfer in T-003; Anwendung in T-007–T-014; Spike-Routen in T-016 entfernt |
| CR-006 | Runtime-Risiken | mittel | behoben | SSE-Reconnect lädt den Stand nicht neu; Produkt-Chat/Karte mit `nextHello`; Spike-SSE in T-016 entfernt |
| CR-007 | Runtime-Risiken | mittel | behoben | Realtime-Bus ohne Fehlerisolation pro Listener: Fehler landet nach dem DB-Write im POST-Handler |
| CR-008 | Runtime-Risiken | mittel | behoben | Mehrstufige Schreibvorgänge ohne Transaktion, Lost Update bei `use_count`, Get-or-create-Races |
| CR-009 | Runtime-Risiken | mittel | behoben | `composer-dom.ts:67` addiert einen String auf einen Zähler (`tsc`-Fehler, falsche Caret-Position) |
| CR-010 | Testabdeckung | mittel | behoben | CI baut nur das Image, ohne `npm test`, `tsc` oder `eslint` |
| CR-011 | Performance | mittel | behoben | N+1-Queries in Relationen/Karten/Teilnahmen — Produktcode ohne Schleifen-Queries |
| CR-012 | Duplizierung & Modularisierung | mittel | behoben | Realtime-Bus, SSE, Pin-Typen konsolidiert; Spike-Duplikate in T-016 entfernt |
| CR-013 | Duplizierung & Modularisierung | mittel | behoben | Authz-Helfer und `ColumnPatch` in Produktcode; Spike entfernt |
| CR-014 | Fehlerbehandlung & Validierung | niedrig | behoben | Frontend-`fetch` mit try/catch in Produkt-Client |
| CR-015 | Bad Practices | niedrig | behoben | ESLint grün; Spike-Struktur entfernt |
| CR-016 | Sicherheit | niedrig | behoben | Produkt-`/api/files`; Spike-Upload in T-016 entfernt |
| CR-017 | Fehlerbehandlung & Validierung | niedrig | behoben | Keine Startvalidierung für `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`, localhost-Origins auch in Produktion vertraut |
| CR-018 | Aufgaben-Abgleich | niedrig | behoben | 8 dokumentierte `TRIG-*`-Regeln fehlen in den Migrationen: alle bauen (Plan-Review) |
| CR-019 | Sicherheit | niedrig | behoben | Persistenz-Snapshot liefert `privat`-Tagebuchtexte an die Spielleitung, Journal auf archivierter Teilnahme möglich |
| CR-020 | Aufgaben-Abgleich | niedrig | behoben | Pin-Sperre (`locked`) nicht dokumentiert: übernehmen, nur Spielleitung (Plan-Review). Spalte in T-002; Rechte und UI folgen in T-013 |
| CR-021 | Lesbarkeit & Wartbarkeit | niedrig | behoben | Würfelausgabe: negative Würfelterme ohne Vorzeichen, versteckter `/roll`-Pfad ignoriert `dicePostToChat`. Schema `dice_terms` in T-002; Formatierer folgt in T-012 |
| CR-022 | Bad Practices | niedrig | behoben | Editor-Spike: Link/Underline doppelt registriert (StarterKit v3), deutsche Identifier entgegen Konvention |
| CR-023 | Bad Practices | niedrig | behoben | Magic Numbers (`Date.now() % 1_000_000`, `15000`, `toFixed(7)` verstreut) |

---

## Findings im Detail

### CR-001 – Spike-APIs in Produktion für jedes Discord-Konto offen
- **Fundstelle:** `src/spike/karte/session.ts` (`requireSpikeSession`), `src/app/api/spike/**`, `src/spike/rechte/http.ts:86` (`handleRechteRequest`), `src/lib/auth.ts:73-91`
- **Kategorie:** Sicherheit
- **Schweregrad:** kritisch
- **Bezug:** T-007, T-008, T-009, T-010, T-011, T-014
- **Beschreibung:** `worldcraft.lagolago.at` ist öffentlich erreichbar. Anmelden kann sich jedes beliebige Discord-Konto, es gibt keine Allowlist. Alle Spike-Endpunkte prüfen nur „angemeldet ja/nein“. Ein fremder Benutzer kann damit in Produktion das gemeinsame Kartenbild ersetzen (`/api/spike/karte/upload`, 20 MB pro Request, ohne Rate-Limit), Pins und Marker verschieben, unbegrenzt Chat-Nachrichten und Threads anlegen und über `/api/spike/rechte/*` Welten, Artikel, Universen, Karten und `files`-Platzhalter in den **echten MVP-Tabellen** anlegen. Die Daten landen im selben Schema, auf dem Plan 003 aufbaut.
- **Empfehlung (festgelegt im Plan-Review 2026-09-22):**
  1. **Discord-Allowlist:** Neue Umgebungsvariable `ALLOWED_DISCORD_IDS` (kommagetrennte Discord-User-IDs, in `.env.example` dokumentiert, Wert nur in Coolify bzw. der lokalen `.env`). Sie wird in `validateUserInfo` bzw. `databaseHooks.user.create.before` in `src/lib/auth.ts` geprüft. Discord-Konten außerhalb der Liste werden mit einer deutschen Fehlermeldung abgelehnt. Test-Login-Benutzer (`test-*`) sind ausgenommen, weil der Test-Login in Produktion ohnehin nicht startet. Ist die Variable in Produktion leer oder nicht gesetzt, bricht der Start ab (fail closed, analog zu `assertTestLoginNotInProduction`).
  2. **Spike-Routen entfernen:** `src/app/api/spike/**`, `src/app/spike/**` und `src/spike/**` werden entfernt, sobald ihr MVP-Ersatz in Plan 003 steht. Kein Feature-Flag.
  3. **Spike-Daten bereinigen:** Ein einmaliges SQL-Skript (`scripts/cleanup-spike-data.sql`) entfernt die `spike_*`-Tabellen per Migration sowie alle Welten, die über die Rechte-Spike-API angelegt wurden (Name beginnt mit `Rechte-Spike`), samt Kaskade, und die Platzhalter-Dateien mit `storage_key LIKE 'spike/rechte/%'`. Vor der Ausführung auf Produktion listet ein Dry-Run-Abschnitt die betroffenen Zeilen auf, und der Projektinhaber bestätigt sie.
- **Abnahmekriterium:** (1) Ein Discord-Konto, dessen ID nicht in `ALLOWED_DISCORD_IDS` steht, erhält beim Login eine Fehlermeldung, und es entsteht kein `users`-Datensatz. Ein gelistetes Konto meldet sich normal an. Ein Start mit `APP_ENV=production` ohne `ALLOWED_DISCORD_IDS` bricht mit einer verständlichen Meldung ab. (2) `git ls-files src | grep -i spike` liefert keine Treffer, und `/api/spike/*` antwortet mit 404. (3) Nach dem Cleanup existieren in Produktion keine `spike_*`-Tabellen, keine Welten mit Namen `Rechte-Spike*` und keine `files`-Zeilen mit `storage_key LIKE 'spike/%'`.
- **Teilfortschritt T-001 (2026-09-23):** Teil 1 umgesetzt (`ALLOWED_DISCORD_IDS`, fail closed in Produktion, Test-Login ausgenommen). Teile 2 und 3 bleiben offen bis T-016. Status bleibt `offen`.
- **Abhängigkeit:** Die Entfernung (Punkt 2) setzt voraus, dass Karte, Chat und Rechte-API in Plan 003 als MVP-Code stehen. Die Allowlist (Punkt 1) hat keine Abhängigkeit und sollte in Plan 003 zuerst umgesetzt werden.

### CR-002 – `npm test` ist rot (Module werden nicht gefunden)
- **Fundstelle:** `package.json:10` (`test`-Skript), `src/spike/chat/dice.ts:4-18`, `src/spike/rechte/authz.ts:3-14` (Importe ohne Dateiendung seit Commit `74a4eff`)
- **Kategorie:** Testabdeckung
- **Schweregrad:** kritisch
- **Bezug:** T-010, T-011, T-013
- **Beschreibung:** `node --experimental-strip-types --test` löst ESM-Importe ohne `.ts`-Endung nicht auf. Nachdem Commit `74a4eff` die Endungen für den Next-Build entfernt hat, scheitern `src/spike/chat/dice.test.ts` („Cannot find module …/dice-sides“) und `src/spike/rechte/authz.test.ts` („Cannot find module …/types“) mit `ERR_MODULE_NOT_FOUND`. Die Würfel- und Autorisierungsregeln, also die Kernnachweise für T-010 (AC 2 bis 4) und T-011, laufen damit nicht mehr als Unit-Tests. Die Go-Einschätzung in `.ai/architecture.md` stützt sich auf diese Tests.
- **Empfehlung (festgelegt im Plan-Review 2026-09-22): Vitest.** `vitest` als devDependency ergänzen (wie in `spikes/editor/`), dazu `vitest.config.ts` mit dem Pfad-Alias `@` → `src` und `environment: "node"` (DOM-Tests per `// @vitest-environment happy-dom` pro Datei). Das Skript wird `"test": "vitest run"`. Bestehende `node:test`-Dateien auf `import { describe, it, expect } from "vitest"` umstellen (`assert.equal` → `expect(...).toBe(...)`). Das Rechte-Integrationsskript (`test:rechte`) läuft ebenfalls über Vitest mit eigener Config bzw. eigenem Include, getrennt von `npm test`, weil es einen laufenden Dev-Server braucht. Importe bleiben ohne `.ts`-Endung (Next-kompatibel). `conventions.md` → Teststrategie auf Vitest aktualisieren.
- **Abnahmekriterium:** `npm test` (= `vitest run`) endet mit Exit-Code 0 und führt alle `*.test.ts`-Dateien unter `src/` aus. In `src/` wird `node:test` nicht mehr importiert. `npm run build` ist weiterhin erfolgreich. `conventions.md` nennt Vitest als Test-Runner.
- **Umsetzung T-001 (2026-09-23):** Vitest ist der Test-Runner, `node:test` kommt in `src/` nicht mehr vor, `conventions.md` beschreibt Vitest. Status `behoben`.

### CR-003 – `discordId` ist vom Benutzer änderbar
- **Fundstelle:** `src/lib/auth.ts:46-50` (`additionalFields.discordId`, `input: true`)
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug:** T-008
- **Beschreibung:** Better Auth übernimmt Zusatzfelder mit `input: true` sowohl beim Anlegen als auch in `POST /api/auth/update-user`. Ein angemeldeter Benutzer kann damit seine eigene `discord_id` auf einen beliebigen freien Wert setzen. Folgen: (a) Er kann die Discord-ID einer Person belegen, die sich noch nicht registriert hat. Deren erster Login scheitert dann am Unique-Constraint. (b) Lokal kann er `test-gm` usw. belegen, und der Test-Login meldet danach auf seinem Konto an. (c) Später (Plan 002/003) wird `discord_id` womöglich als Identitätsmerkmal genutzt.
- **Empfehlung:** `input: false` setzen. Die ID kommt ausschließlich aus `mapProfileToUser` bzw. dem Test-Login-Plugin, das über `internalAdapter.createUser` schreibt und nicht auf `input` angewiesen ist.
- **Abnahmekriterium:** `POST /api/auth/update-user` mit `{ "discordId": "x" }` ändert `users.discord_id` nicht (Antwort 400 oder Feld ignoriert, per Datenbankabfrage geprüft). Discord- und Test-Login legen weiterhin Benutzer mit korrekter `discord_id` an.
- **Umsetzung (Plan 003 T-006, 2026-09-23):** `discordId` hat `input: false`. Better Auth antwortet auf `update-user` mit `discordId` mit 400; OAuth (`mapProfileToUser`) und das Test-Login-Plugin (`internalAdapter.createUser`) nutzen `parseUserInput` nicht und setzen die ID weiter. Nachweis: `src/app/api/auth/auth.api.test.ts` (400, `discord_id` per SQL unverändert, Test-Login liefert denselben Benutzer).

### CR-004 – Manuelle Relationen ohne Weltzugehörigkeitsprüfung
- **Fundstelle:** `src/spike/rechte/repository.ts:1338-1385` (`createManualRelation`)
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug:** T-006, T-011
- **Beschreibung:** Geprüft wird nur, ob der Aufrufer zur Spielleitung von `worldId` gehört. Ob `sourceId`/`targetId` existieren und in derselben Welt liegen, wird nicht geprüft (`APP-`/`TRIG-REL-SAME-WORLD` laut `datenmodell.md`). Eine Spielleitung kann so Relationen auf Inhalte **fremder Welten** anlegen. Eine nicht existierende ID löst eine FK-Verletzung aus, die als HTTP 500 durchschlägt. Der Unterschied zwischen 201 und 500 verrät außerdem, ob eine fremde UUID existiert. Diese Schicht ist als gemeinsame `APP-AUTHZ` für Plan 002/003 vorgesehen, der Fehler würde sich also fortpflanzen.
- **Empfehlung:** Vor dem Insert beide Enden laden und `worldId` vergleichen (für Pins über Karte → Universum). Bei Abweichung oder fehlendem Ende 404 bzw. 400 zurückgeben. Zusätzlich den dokumentierten Trigger `TRIG-REL-SAME-WORLD` in einer Migration umsetzen (siehe CR-018).
- **Abnahmekriterium:** Eine Relation, deren Ziel ein Artikel einer anderen Welt ist, wird mit 4xx abgelehnt und nicht gespeichert. Eine Relation auf eine nicht existierende UUID liefert 404 statt 500. Beide Fälle stehen als Assertion in `run-rechte-tests.ts`.
- **Umsetzung (Plan 003 T-010, 2026-09-23):** `createManualRelation` lädt beide Enden in derselben Welt (`loadEnd`; Pins über Karte → Universum). Fehlendes oder fremdes Ende ist 404, nicht 500 und nicht unterscheidbar. Nachweis in `src/app/api/worlds/[worldId]/relations/relations.api.test.ts` (Produkt-Nachfolger von `run-rechte-tests.ts`). Trigger `TRIG-REL-SAME-WORLD` bleibt zweite Schicht (CR-018). Status bleibt `offen` bis der Trigger-Nachweis dort vollständig ist.

### CR-005 – HTTP 500 bei ungültiger UUID oder ungültigem JSON
- **Fundstelle:** `src/app/api/spike/karte/pins/[id]/route.ts:37-44`, `src/app/api/spike/karte/markers/[id]/route.ts:23-24`, `src/app/api/spike/karte/pins/route.ts:24`, `src/app/api/spike/chat/route.ts:101-123`, `src/app/api/spike/chat/threads/route.ts:28-29`, `src/app/spike/chat/page.tsx` (`?channel=`/`?thread=`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-009, T-010
- **Beschreibung:** Pfad- und Query-Parameter (`id`, `channelId`, `threadId`, `before`) gehen ungeprüft in `eq(uuid-Spalte, …)`. PostgreSQL wirft dann `22P02 invalid input syntax for type uuid`, und die Antwort ist HTTP 500. Beispiel: `/spike/chat?channel=abc` lässt die ganze Seite abstürzen. Die Karten-Routen rufen `await request.json()` ohne `try/catch` auf, ein leerer oder kaputter Body ergibt ebenfalls 500. Die Chat-Routen machen das richtig (`try/catch` → 400), die Karten-Routen nicht. Die Behandlung ist also uneinheitlich.
- **Empfehlung:** Einen gemeinsamen Helfer einführen (z. B. `parseJsonBody(request, schema)` und `parseUuid(value)`), der 400 bzw. 404 liefert, und ihn in allen Route-Handlern verwenden. Seiten-Parameter vor dem DB-Zugriff mit `z.string().uuid().safeParse` prüfen und bei Fehler auf den Default-Kanal zurückfallen.
- **Abnahmekriterium:** `PATCH /api/spike/karte/pins/not-a-uuid`, `PATCH …/pins/<uuid>` mit Body `{` und `GET /api/spike/chat?channelId=abc&before=xyz` liefern 400 oder 404, nie 500. `/spike/chat?channel=abc` rendert den Default-Kanal.
- **Teilfortschritt T-003 (2026-09-23):** `parseUuid` und `parseJsonBody` liegen in `src/lib/http.ts`. Die Produkt-APIs ab T-007 wenden sie an. Status bleibt `offen`.
- **Teilfortschritt T-012 (2026-09-23):** Produkt-Chat nutzt `parseUuid`/`parseJsonBody`/`optionalUuid`. Ungültige Query-UUIDs sind 400; `/w/…/chat?channel=abc` fällt auf den Standardkanal zurück. Kartenrouten folgen in T-013. Status bleibt `offen`.
- **Teilfortschritt T-013 (2026-09-23):** Kartenrouten nutzen `parseUuid`/`parseJsonBody`/`optionalUuid`. `PATCH …/pins/not-a-uuid` ist 404, kaputter JSON-Body 400. Status bleibt `offen`.
- **Umsetzung (Plan 003 T-007, 2026-09-23):** Alle Produkt-Routen für Welten, Universen, Mitglieder und Einladungen laufen über `openWorldRequest` (`src/lib/route.ts`: Sitzung → `parseUuid` → Weltkontext) und `parseJsonBody`; Unter-IDs (`universeId`, `membershipId`, `inviteId`) werden vor dem DB-Zugriff geprüft, Einladungscodes per Regex (`inviteCodeSchema`). Seiten nutzen `requireWorldPage` bzw. `parseUuid` → `notFound()`. Nachweis: `src/app/api/worlds/worlds.api.test.ts` („CR-005: bad ids and bodies“). Status bleibt `offen`, bis T-008 bis T-014 ihre Routen ebenso gebaut haben und die Spike-Routen mit T-016 entfallen.
- **Umsetzung (Plan 003 T-008, 2026-09-23):** Charakter- und Tagebuch-Routen nutzen `parseUuid`/`parseJsonBody`/`openWorldRequest`; `POST /api/files` mit kaputtem Body ist 400 statt 500. Nachweis: `src/app/api/characters/characters.api.test.ts` („CR-005: bad ids and bodies“). Status bleibt `offen`.
- **Umsetzung (Plan 003 T-009, 2026-09-23):** Artikel-Routen nutzen `openWorldRequest`/`parseUuid`/`parseJsonBody`; ungültige `articleId` und kaputte Bodies sind 404/400. Nachweis: `src/app/api/worlds/[worldId]/articles/articles.api.test.ts` („CR-005: bad ids and bodies“). Status bleibt `offen`.
- **Umsetzung (Plan 003 T-010, 2026-09-23):** Relationen-Routen nutzen `openWorldRequest`/`parseUuid`/`parseJsonBody`; ungültige `kind`/`id` und kaputte Bodies sind 404/400. Nachweis: `relations.api.test.ts` („CR-005 on relation routes“). Status bleibt `offen`.
- **Umsetzung (Plan 003 T-011, 2026-09-23):** Quest-Routen nutzen `openWorldRequest`/`parseUuid`/`parseJsonBody`; ungültige `questId` und kaputte Bodies sind 404/400. Nachweis: `quests.api.test.ts` („CR-005: bad ids and bodies“). Status bleibt `offen`, bis T-014 und T-016.
- **Umsetzung (Plan 003 T-014, 2026-09-23):** Suche nutzt `openWorldRequest`; ungültige Welt-IDs sind 404. Nachweis: `search.api.test.ts` („CR-005“). Status bleibt `offen`, bis T-016 die Spike-Routen entfernt.
### CR-006 – SSE-Reconnect ohne Neusynchronisierung
- **Fundstelle:** `src/spike/karte/KarteBoard.tsx:167-196`, `src/spike/chat/ChatSpikePage.tsx:159-179`, Server: `src/app/api/spike/*/events/route.ts` (`send({ type: "hello" })`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-009 (AC 3), T-010 (AC 1)
- **Beschreibung:** `EventSource` verbindet sich nach einem Abbruch automatisch neu. Der Bus hält aber keine Historie, und der Client ignoriert `hello` (Karte) bzw. reagiert gar nicht darauf (Chat). Pin-Verschiebungen und Nachrichten, die während der Trennung passieren, fehlen deshalb dauerhaft, bis die Seite neu geladen wird. Das Projekt ist Mobile-First: Handys trennen SSE beim Sperren des Displays oder beim Netzwechsel regelmäßig, und auch jedes Coolify-Deployment trennt alle Verbindungen.
- **Empfehlung:** Bei jedem `hello` außer dem ersten (bzw. bei `source.onopen` nach `onerror`) `loadState()` bzw. `loadStream()` für den aktuellen Kanal/Thread aufrufen. Alternativ `Last-Event-ID` mit einer Sequenznummer umsetzen.
- **Abnahmekriterium:** Browser A trennt die SSE-Verbindung (DevTools offline, 5 s). Browser B verschiebt in dieser Zeit einen Pin und sendet eine Nachricht. Nach dem Reconnect zeigt A beide Änderungen ohne manuelles Neuladen an.
- **Teilfortschritt T-012 (2026-09-23):** `nextHello` plus `useWorldRealtime` laden den Chat nach jedem `hello` außer dem ersten neu. Die Karte weist dasselbe in T-013 nach. Status bleibt `offen`.
- **Teilfortschritt T-013 (2026-09-23):** Die Karte hängt an demselben `useWorldRealtime`/`nextHello` und ruft nach jedem späteren `hello` `reload` auf. Status bleibt `offen` bis T-016 die Spike-SSE entfernt.

### CR-007 – Realtime-Bus ohne Fehlerisolation
- **Fundstelle:** `src/spike/chat/realtime-bus.ts:18-22`, `src/spike/karte/realtime-bus.ts:18-22`, `src/app/api/spike/*/events/route.ts:20-27`
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-009, T-010
- **Beschreibung:** `publish*Event` ruft die Listener synchron und ohne `try/catch` auf. Wirft `controller.enqueue` bei einem bereits geschlossenen Stream (etwa wenn Proxy oder Browser trennen, bevor `abort`/`cancel` durchgelaufen ist), bricht die Schleife ab. Die übrigen Clients bekommen das Ereignis dann nicht, und die Exception erreicht den POST-Handler **nach** dem Datenbank-Insert. Der Absender sieht 500 und schickt die Nachricht womöglich erneut (Duplikat). Der `setInterval`-Heartbeat kann genauso werfen, dann als unbehandelte Exception. Der Bus funktioniert außerdem nur mit genau einem Node-Prozess. Das steht im Kommentar, fehlt aber als Norm in `architecture.md`/`architecture/README.md`.
- **Empfehlung (festgelegt im Plan-Review 2026-09-22): In-Process-Bus beibehalten, genau ein App-Container.** Jeden Listener-Aufruf mit `try/catch` absichern und fehlerhafte Listener entfernen. Im Heartbeat und in `send` vor dem `enqueue` auf `closed` prüfen. Als Norm festschreiben: Die App läuft in Coolify mit **genau einer Replica** (kein horizontales Skalieren). Mehr als eine Replica erfordert vorher ein ADR für einen prozessübergreifenden Bus (Kandidaten: PostgreSQL `LISTEN/NOTIFY`, Redis Pub/Sub).
- **Abnahmekriterium:** Ein Unit-Test registriert einen werfenden und einen normalen Listener. `publish` wirft nicht, und der normale Listener erhält das Ereignis. `.ai/architecture/README.md` und `.ai/infrastructure/deployment.md` enthalten die Regel „genau eine App-Replica, Realtime In-Process; Skalierung nur nach neuem ADR“.
- **Umsetzung T-012 (2026-09-23):** `createRealtimeBus` isoliert Listener (`src/lib/realtime/bus.test.ts`). Die Replica-Regel steht in `architecture/README.md` und `deployment.md`. Status `behoben`.

### CR-008 – Fehlende Transaktionen, Lost Updates, Get-or-create-Races
- **Fundstelle:** `src/spike/rechte/repository.ts:386-419` (`archiveMembershipAndParticipations`), `:507-567` (`joinByInvite`, `useCount + 1`), `src/spike/chat/repository.ts:229-256` (`createThreadWithParentPost`), `:61-79` (`ensureDefaultChannel`), `src/spike/karte/repository.ts:85-128` (`upsertSpikeMap` + Marker), `src/app/api/spike/karte/upload/route.ts:59-75`
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-009, T-010, T-011
- **Beschreibung:**
  - Austritt/Entfernen archiviert Mitgliedschaft und Teilnahmen in mehreren einzelnen Statements. Bricht der Vorgang mittendrin ab, bleibt ein inkonsistenter Zustand zurück (z. B. Mitgliedschaft archiviert, Teilnahmen aktiv).
  - `joinByInvite` liest `use_count` und schreibt `use_count + 1` aus dem gelesenen Wert zurück. Parallele Beitritte verlieren Zählungen. Ein doppelter Beitritt desselben Benutzers läuft auf `uq_membership` und endet in 500.
  - Thread plus Eröffnungsnachricht plus Rückverweis entstehen in drei Statements. Scheitert eines, bleibt ein Thread ohne Nachricht zurück.
  - `ensureDefaultChannel` und der erste Karten-Upload sind „select, dann insert“ ohne Unique-Constraint. Zwei gleichzeitige Erstaufrufe erzeugen zwei Kanäle bzw. zwei Karten, und `getSpikeMap()` (`limit(1)` ohne `ORDER BY`) wählt danach nicht deterministisch.
- **Empfehlung:** Mehrstufige Writes in `db.transaction` bündeln. Den Zähler atomar erhöhen (`set({ useCount: sql\`${inviteLinks.useCount} + 1\` })`). Beitritt per `insert … on conflict (world_id, user_id) do update`. Für die Default-Instanzen einen Unique-Index (`world_key` + Default-Flag) plus `on conflict do nothing` und anschließendes Select.
- **Abnahmekriterium:** Die genannten Funktionen laufen in einer Transaktion bzw. atomar. Ein Test mit 10 parallelen `joinByInvite`-Aufrufen verschiedener Benutzer ergibt `use_count = 10`. Zwei parallele Beitritte desselben Benutzers liefern beide 2xx. Zwei parallele erste `GET /api/spike/chat` erzeugen genau einen Kanal.
- **Umsetzung (Plan 003 T-007, 2026-09-23):** Teil Austritt, Einladung, Welt anlegen erledigt. `createWorld` legt Welt, Game-Master-Mitgliedschaft, „Hauptuniversum“ und Kanal „Allgemein“ in einer Transaktion an (`src/lib/domain/worlds.ts`); damit gibt es kein „get or create“ für den Standardkanal mehr. Austritt und Entfernen archivieren Mitgliedschaft und Teilnahmen in einer Transaktion (`archiveMembership`, `src/lib/domain/members.ts`). `joinByInvite` (`src/lib/domain/invites.ts`) läuft in einer Transaktion: `insert … on conflict (world_id, user_id) do update … where archived_at is not null` reaktiviert als Player, eine aktive Mitgliedschaft bleibt unverändert (2xx, `joined: false`), `use_count` steigt atomar nur bei echtem Beitritt. Nachweis: `src/lib/domain/invites.integration.test.ts` (10 parallele Beitritte → `use_count = 10`; zwei parallele Beitritte desselben Benutzers → beide ok, genau einer zählt), `npm run test:triggers`.
- **Teilfortschritt T-012 (2026-09-23):** Thread, Eröffnungsnachricht und `opens_thread_id` entstehen in einer Transaktion (`createThreadWithOpening`).
- **Umsetzung T-013 (2026-09-23):** `createMapWithImage` sperrt das Universum (`FOR UPDATE`) und legt Datei plus Kartenzeile in einer Transaktion an; ein zweites Insert ist 409 (`APP-MAP-MVP-ONE`). Bild ersetzen ändert nur `maps.image_id` und räumt die alte Datei per `collectUnreferencedFiles` auf. Status `behoben`.

### CR-009 – Typfehler in `composer-dom.ts` (Caret-Offset)
- **Fundstelle:** `src/spike/chat/composer-dom.ts:67`
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-010
- **Beschreibung:** `total += textFromNode(children[i]!)` addiert einen **String** auf einen `number`-Zähler. `tsc --noEmit` meldet TS2322. Zur Laufzeit wird `total` zu einer Zeichenkette (z. B. `"0abc"`), und der Caret-Offset stimmt nicht mehr, sobald der Caret auf Elementebene (zwischen Kindknoten) steht, etwa nach dem Reparse bei `**fett**`. Das deckt sich mit den offenen Composer-Bugs in `smoketest.md`.
- **Empfehlung:** `total += textFromNode(children[i]!).length`. Einen Unit-Test für `getCaretMarkdownOffset` mit Caret auf Elementebene ergänzen (happy-dom/jsdom).
- **Abnahmekriterium:** `npx tsc --noEmit` meldet keinen Fehler. Ein Test prüft, dass der Offset bei Caret zwischen `<strong>`-Kindknoten der Markdown-Länge davor entspricht.
- **Umsetzung T-001 (2026-09-23):** `textFromNode(…).length`, Test in `composer-dom.test.ts`. Status `behoben`.

### CR-010 – CI ohne Tests, Typecheck und Lint
- **Fundstelle:** `.github/workflows/build-image.yml`
- **Kategorie:** Testabdeckung
- **Schweregrad:** mittel
- **Bezug:** T-007, T-013
- **Beschreibung:** Der einzige Workflow baut das Docker-Image und pusht es. `npm test`, `tsc --noEmit` und `eslint` laufen nie automatisch. Deshalb sind CR-002, CR-009 und CR-015 unbemerkt auf `main` gelandet und nach Produktion deployt worden. `conventions.md` nennt als CI-Stufe nur den Image-Build.
- **Empfehlung:** Einen Job `verify` (Node 22, `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, optional `cd spikes/editor && npm ci && npm test`) vor `docker` schalten (`needs: verify`). `conventions.md` → Teststrategie entsprechend ergänzen.
- **Abnahmekriterium:** Ein Push mit einem absichtlich fehlschlagenden Test bricht den Workflow vor dem Image-Build ab. `conventions.md` beschreibt den `verify`-Schritt.
- **Umsetzung T-001 (2026-09-23):** Job `verify` steht vor `docker` (`needs: verify`). Status `behoben`.

### CR-011 – N+1-Queries im Rechte-Repository
- **Fundstelle:** `src/spike/rechte/repository.ts:1396-1425` (`listRelations` → `isContentVisibleFor` :217), `:402-418` (Schleife pro Charakter), `:1271-1285` (`listWorldGeography`, Marker-Query ohne Kartenfilter)
- **Kategorie:** Performance
- **Schweregrad:** mittel
- **Bezug:** T-011
- **Beschreibung:** `listRelations` ruft pro Relation zweimal `isContentVisibleFor` auf. Jeder Aufruf lädt die Mitgliedschaft neu und dann den Inhalt (bei Pins mit Join, bei Charakteren zwei Queries). Das sind 4 bis 6 Queries pro Relation. Bei einigen hundert Relationen, wie sie der MCP-Server aus Plan 002 regelmäßig abfragen würde, wird das spürbar. Der Austritt aktualisiert Teilnahmen in einer Schleife pro Charakter statt mit `inArray`. `listWorldGeography` lädt alle Marker aller Charaktere mit Teilnahme in der Welt, auch auf Karten anderer Welten, und filtert erst im Speicher.
- **Empfehlung:** Sichtbarkeit gesammelt ermitteln: Mitgliedschaft einmal laden, IDs pro Art sammeln und je Art eine `inArray`-Query (bzw. ein Join) ausführen, danach in einer Map nachschlagen. Teilnahmen mit einem Update per `inArray` archivieren. Die Marker-Query mit `inArray(characterMarkers.mapId, mapIds)` einschränken.
- **Abnahmekriterium:** In `listRelations`, beim Archivieren von Teilnahmen und in `listWorldGeography` (bzw. ihren MVP-Nachfolgern) wird keine DB-Query innerhalb einer Schleife über Datensätze ausgeführt (kein `await db…` in `for`/`map`/`filter`). Die Marker-Query ist auf die Karten-IDs der Welt eingeschränkt. Der Rechte-Integrationstest bleibt grün.
- **Umsetzung (Plan 003 T-007, 2026-09-23):** Teil Teilnahmen archivieren erledigt: `archiveMembership` (`src/lib/domain/members.ts`) setzt alle eigenen Teilnahmen der Welt mit einem Update (`inArray` auf eine Unterabfrage der eigenen Charaktere), keine Schleife. Die Erwähnungsauflösung für Leseansichten (`resolveMentions`, `src/lib/domain/mention-resolve.ts`) lädt je Art eine `inArray`-Query. Nachweis: `worlds.api.test.ts` („(4) leaving and rejoining“), `npm run test:rechte` grün. Status bleibt `offen`: Relationen folgen in T-010, Karten/Pins/Marker in T-013.
- **Umsetzung (Plan 003 T-010, 2026-09-23):** `listLinked` / `loadVisibleTargets` und `listRelationTargets` laden je Inhaltsart eine `inArray`- bzw. Join-Query, keine Query in der Relationsschleife. Status bleibt `offen` bis T-013 den Kartenteil vollständig abdeckt.
- **Teilfortschritt T-013 (2026-09-23):** Marker werden mit `eq(characterMarkers.mapId, dto.id)` geladen, `listLinked` macht eine Query je Inhaltsart. Artikel-Relationen in T-010. Status bleibt `offen`.

### CR-012 – Duplizierte Spike-Infrastruktur und Konstanten
- **Fundstelle:**
  - Realtime-Bus: `src/spike/chat/realtime-bus.ts` ≙ `src/spike/karte/realtime-bus.ts`
  - SSE-Route: `src/app/api/spike/chat/events/route.ts` ≙ `src/app/api/spike/karte/events/route.ts`
  - Sitzungsprüfung: `src/spike/karte/session.ts`, von Chat-Routen importiert (Kopplung Chat → Karte); zusätzlich eigene Variante in `src/spike/rechte/http.ts:73`
  - `escapeHtml`: `src/spike/chat/markdown.ts:110`, `src/spike/karte/character-marker.ts:18`, `spikes/editor/src/editor/mention-suggestion.ts:35`
  - Pin-Typen: `src/spike/karte/pin-types.ts:3` (`SPIKE_PIN_TYPES`), `src/spike/rechte/types.ts:29` (`PIN_TYPES`), plus Enums in `schema.ts`
  - Positionsrundung: `src/spike/karte/coords.ts` (`roundPosition`/`positionSql`), `src/spike/rechte/repository.ts:49` (`pos`) und `toFixed(7)` an 8 Stellen
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** mittel
- **Bezug:** T-009, T-010, T-011
- **Beschreibung:** Dieselbe Logik liegt mehrfach vor. Fehlerbehebungen wie CR-007 müssten an zwei oder drei Stellen gleich nachgezogen werden. Plan 003 baut die Spikes aus, die Duplikate gehen also ohne Konsolidierung direkt ins MVP über.
- **Empfehlung:** Einen generischen `createRealtimeBus<T>(key)` und `createSseResponse(request, subscribe)` unter `src/lib/realtime/` anlegen, `requireSession` nach `src/lib/session.ts` verschieben, `escapeHtml` nach `src/lib/html.ts`. Pin-Typen und Positionsformat (`POSITION_DECIMALS`, `toDbPosition`, `fromDbPosition`) jeweils an einer Stelle definieren (z. B. `src/lib/map/`), abgeleitet vom Drizzle-Enum.
- **Abnahmekriterium:** (Bis Plan 003 T-016 gilt es für `src/` ohne `src/spike/`, danach für ganz `src/`.) Es gibt genau eine Implementierung von Realtime-Bus, SSE-Response, Sitzungsprüfung und `escapeHtml` in `src/`. `grep -rn "toFixed(7)" src` findet höchstens die zentrale Hilfsfunktion. Die Pin-Typ-Liste existiert einmal und wird überall importiert.
- **Teilfortschritt T-012 (2026-09-23):** Produktcode hat einen Bus (`src/lib/realtime/bus.ts`), eine SSE-Hilfe (`sse.ts`) und Route (`/api/worlds/[worldId]/events`), `requireProductSession` und `escapeHtml` (`src/lib/html.ts`). Pin-Typen und Positionsformat folgen in T-013, die Spike-Kopien in T-016. Status bleibt `offen`.
- **Teilfortschritt T-013 (2026-09-23):** Pin-Typen (`src/lib/map/pin-types.ts`, Test gegen Drizzle-Enum) und Positionsrundung (`src/lib/map/coords.ts`, einziges `toFixed(7)` im Produktcode) liegen zentral. Spike-Kopien bleiben bis T-016. Status bleibt `offen`.

### CR-013 – Wiederholte Autorisierungsblöcke im Rechte-Repository
- **Fundstelle:** `src/spike/rechte/repository.ts:1072-1251` (`placeMarker`, `moveMarker`, `deleteMarker`), sinngemäß auch `update*/delete*` für Artikel, Universum, Karte und Pin; `patch: Record<string, unknown>` bei :801, :879, :966, :1041
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** mittel
- **Bezug:** T-011
- **Beschreibung:** Die Folge „Marker laden → Kartenkontext laden → Mitgliedschaft laden → Charakter laden → `canSeePublishedLayer` → `canEditMarker` → Positionsprüfung“ ist dreimal fast wörtlich kopiert. Dasselbe gilt für „Entität laden → Welt ermitteln → `requireStaff`“. Die 1485 Zeilen lange Datei ist die Vorlage für die MVP-`APP-AUTHZ`-Schicht (Norm: „Neue Rechtefälle zuerst in der gemeinsamen Authz-Schicht“). Kopierte Prüfungen laufen erfahrungsgemäß auseinander. Die `Record<string, unknown>`-Patches umgehen außerdem die Drizzle-Typprüfung: Tippfehler in Spaltennamen fallen erst zur Laufzeit auf.
- **Empfehlung:** Helfer wie `loadMarkerForEdit(actor, markerId)` bzw. `withStaffOnWorldOf(entity)` extrahieren, die Kontext und Gate liefern. Positionsprüfung ins Zod-Schema verschieben (`z.number().min(0).max(1)`). Patches als `Partial<typeof articles.$inferInsert>` typisieren. Die Datei nach Aggregaten aufteilen (`membership.ts`, `content.ts`, `geography.ts`, `relations.ts`).
- **Abnahmekriterium:** (Bis Plan 003 T-016 gilt es für den Produktcode ohne `src/spike/`, danach für ganz `src/`.) Die Marker-Autorisierung steht in genau einer Funktion, die die drei Marker-Operationen nutzen. Kein `Record<string, unknown>` mehr in `repository.ts` bzw. im Nachfolgemodul. `npm run test:rechte` bleibt 15/15 grün.
- **Teilfortschritt T-003 (2026-09-23):** Authz liegt in `src/lib/authz`, Patches als `ColumnPatch<T>`. Die eine Marker-Funktion folgt in T-013. Status bleibt `offen`.
- **Teilfortschritt T-013 (2026-09-23):** `authorizeMarkerAction` und `authorizePinWrite` in `src/lib/authz`; place/move/delete nutzen dieselbe Marker-Funktion. Positionen per Zod `min(0).max(1)`. Spike-Repository bleibt bis T-016. Status bleibt `offen`.

### CR-014 – Fehlerbehandlung im Frontend
- **Fundstelle:** `src/spike/karte/KarteBoard.tsx:198-216` (`persistPinMove`, `persistMarkerMove`), `:224-253` (`createPin`), `:168-170` und `ChatSpikePage.tsx:161-162` (`JSON.parse` im `onmessage`)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug:** T-009, T-010
- **Beschreibung:** `persistMarkerMove` prüft weder `response.ok` noch Netzwerkfehler. Scheitert das Speichern, steht der Marker lokal an der neuen Position, auf dem Server an der alten, und niemand erfährt davon. `persistPinMove` und `createPin` haben kein `try/catch`: Offline führt das zu einer unbehandelten Promise-Rejection statt zu einer Fehlermeldung. `JSON.parse` im SSE-Handler ist ungeschützt.
- **Empfehlung:** Einen gemeinsamen `apiFetch`-Helfer mit `try/catch` und einheitlicher Fehlermeldung (Deutsch) bauen. Bei Fehlschlag den Zustand per `loadState()` zurückholen. `JSON.parse` absichern.
- **Abnahmekriterium:** Marker bei „offline“ in den DevTools verschieben → sichtbare Fehlermeldung, Marker springt nach Reconnect auf die Serverposition zurück. Keine „Uncaught (in promise)“-Meldung in der Konsole.
- **Teilfortschritt T-012 (2026-09-23):** Chat nutzt `apiFetch` (Fehlertext, Reload) und fängt `JSON.parse` im SSE-Handler. Die Karte folgt in T-013. Status bleibt `offen`.
- **Teilfortschritt T-013 (2026-09-23):** Karte nutzt `apiFetch` inkl. FormData; fehlgeschlagene Moves rufen `reload` auf. Status bleibt `offen` bis T-016 den Spike entfernt.

### CR-015 – ESLint-Fehler und sehr große Komponenten
- **Fundstelle:** `src/spike/karte/KarteBoard.tsx:151` (`openPinSheetRef.current = openPinSheet` beim Rendern, Regel `react-hooks/refs`); `KarteBoard.tsx` (1013 Zeilen), `ChatSpikePage.tsx` (705 Zeilen); sinngemäß `RichComposer.tsx:49` (`valueRef.current = value`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-009, T-010
- **Beschreibung:** `npm run lint` schlägt mit einem Fehler fehl. Ref-Zuweisungen beim Rendern sind unter React 19 bzw. im Concurrent Rendering nicht garantiert konsistent. Die beiden Hauptkomponenten vermischen Datenladen, SSE, Leaflet-Imperativcode, Sheets und Formulare. Das erschwert Tests und den geplanten Ausbau in Plan 003.
- **Empfehlung:** Ref-Updates in `useEffect`/`useLayoutEffect` verschieben oder `useEffectEvent` nutzen. Hooks extrahieren (`useKarteRealtime`, `useLeafletMap`, `usePinSheet`, `useChatStream`) und Sheets als eigene Komponenten auslagern.
- **Abnahmekriterium:** `npx eslint .` meldet 0 Fehler. In Karten- und Chat-Komponenten (bzw. ihren MVP-Nachfolgern) liegen Realtime-Anbindung (SSE), Datenladen und Leaflet-Initialisierung jeweils in eigenen Hooks. Sheets und Formulare sind eigene Komponenten. Die Hauptkomponente enthält keinen `fetch`- und keinen `EventSource`-Aufruf direkt.
- **Teilfortschritt T-001 (2026-09-23):** Die Ref-Zuweisung in `KarteBoard.tsx` liegt in `useEffect`; `npx eslint .` meldet 0 Fehler. Die Struktur (Hooks, Sheets) folgt in T-012/T-013. Status bleibt `offen`.
- **Teilfortschritt T-012 (2026-09-23):** Chat: `useChatStream` (Laden), `useChatRealtime` (SSE), Sheets und Composer sind eigene Komponenten. Die Chat-Hauptkomponente ruft weder `fetch` noch `EventSource` auf. Die Karte folgt in T-013. Status bleibt `offen`.
- **Teilfortschritt T-013 (2026-09-23):** Karte: `useMapState`, `useMapRealtime`, `useLeafletMap`; Sheets in `MapSheets.tsx`. `MapView` ruft weder `fetch` noch `EventSource` auf. Status bleibt `offen` bis T-016.

### CR-016 – Upload und Auslieferung des Kartenbilds
- **Fundstelle:** `src/app/api/spike/karte/upload/route.ts:29-57`, `src/app/api/spike/karte/image/route.ts:26-34`
- **Kategorie:** Sicherheit
- **Schweregrad:** niedrig
- **Bezug:** T-009
- **Beschreibung:** Die Dateiendung und damit der später ausgelieferte `Content-Type` stammen aus dem **vom Client gemeldeten** `file.type`, nicht aus dem tatsächlich erkannten Format. `image-size` erkennt auch SVG, GIF, BMP usw. Eine als `image/png` deklarierte andere Datei wird als `.png` gespeichert und ausgeliefert. `X-Content-Type-Options: nosniff` fehlt. Zur Performance: Jeder Abruf liest bis zu 20 MB komplett mit `readFile` in den Speicher, obwohl die URL versioniert ist (`?v=`), und cacht nur 60 s.
- **Empfehlung:** `imageSize(bytes).type` gegen die Allowlist `jpg|png|webp` prüfen und die Endung daraus ableiten. `nosniff` setzen. Die Datei per Stream (`createReadStream` → `ReadableStream`) ausliefern, mit `Cache-Control: private, max-age=31536000, immutable` für versionierte URLs.
- **Abnahmekriterium:** Ein Upload einer GIF- oder SVG-Datei mit `Content-Type: image/png` wird mit 400 abgelehnt. Die Bildantwort enthält `X-Content-Type-Options: nosniff` und einen `immutable`-Cache-Header. Die Bildroute verwendet kein `readFile`, sondern liefert die Datei per Stream (`createReadStream`) aus.
- **Teilfortschritt T-004 (2026-09-23):** `POST /api/files` erkennt das Format an den Bytes, `GET /api/files/[id]` streamt mit `nosniff` und `immutable`. Die Spike-Bildroute bleibt bis T-016. Status bleibt `offen`.

### CR-017 – Keine Startvalidierung der Umgebung, localhost-Origins in Produktion
- **Fundstelle:** `src/lib/env.ts`, `src/lib/auth.ts:24-40`, `src/db/client.ts:5-7`
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug:** T-007, T-008
- **Beschreibung:** Beim Start wird nur `DATABASE_URL` geprüft. Fehlen `BETTER_AUTH_SECRET` oder `BETTER_AUTH_URL` in Coolify, merkt man das erst beim ersten Login (Fallback `http://localhost:3000` → falsche Redirects bzw. Better-Auth-Fehler). `trustedOrigins` enthält `http://localhost:3000` und `http://127.0.0.1:3000` auch bei `APP_ENV=production`.
- **Empfehlung:** Ein Zod-Schema für die Umgebung in `src/lib/env.ts` (Pflichtfelder abhängig von `APP_ENV`, Mindestlänge des Secrets, URL-Format), aufgerufen in `instrumentation.ts`. localhost-Origins nur bei `APP_ENV !== "production"` aufnehmen.
- **Abnahmekriterium:** Ein Start mit `APP_ENV=production` ohne `BETTER_AUTH_SECRET` bricht mit einer verständlichen deutschen Meldung ab. In Produktion enthält `trustedOrigins` nur die `BETTER_AUTH_URL`. Ein Unit-Test in `env.test.ts` deckt beides ab.
- **Umsetzung (Plan 003 T-006, 2026-09-23):** `findEnvIssues`/`assertServerEnv` in `src/lib/env.ts` (Zod): `DATABASE_URL` immer Pflicht (postgres-URL); in Produktion zusätzlich `BETTER_AUTH_SECRET` (mind. 32 Zeichen) und `BETTER_AUTH_URL` (http/https). Aufruf in `src/instrumentation.ts`; die Meldung nennt nur Variablennamen, keine Werte. `getTrustedOrigins()` nimmt localhost nur außerhalb von Produktion auf; `auth.ts` nutzt sie. Der Docker-Build setzt kein `APP_ENV=production`, die Prüfung greift erst beim Start. Nachweis: `src/lib/env.test.ts`.

### CR-018 – Dokumentierte Trigger fehlen in den Migrationen
- **Fundstelle:** `.ai/architecture/datenmodell.md` (u. a. Zeilen 143, 604, 656) vs. `src/db/migrations/*.sql`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug:** T-006, T-011
- **Beschreibung:** Das technische Datenmodell nennt als Umsetzung von Regeln `TRIG-GM-IS-CREATOR`, `TRIG-WORLD-CREATOR-IMMUTABLE`, `TRIG-REL-SAME-WORLD`, `TRIG-UNIVERSE-LAST`, `TRIG-JOURNAL-PART`, `TRIG-PART-OWNER-MEMBER`, `TRIG-CHAR-OWNER-IMMUTABLE` und `TRIG-CHAR-IMAGES-MAX`. Keine Migration enthält einen Trigger. Die T-006-Regel „genau ein Game Master = Ersteller“ ist auf Datenebene nur zur Hälfte abgesichert (`uq_one_gm` stellt höchstens einen GM sicher, aber nicht „= Ersteller“). Plan 003 greift das auf, das Datenmodell sagt aber nirgends, dass diese Regeln noch fehlen. Wer nur das Datenmodell liest, hält sie für umgesetzt.
- **Empfehlung (festgelegt im Plan-Review 2026-09-22): Alle 8 Trigger bauen.** Pro Trigger eine PL/pgSQL-Funktion plus `CREATE TRIGGER`, die Semantik genau wie in `datenmodell.md` beschrieben. Fehler per `RAISE EXCEPTION` mit eigenem SQLSTATE, den die Authz-Schicht auf 4xx abbildet, analog zu `isUniqueViolation`. Die Migration erzeugt Drizzle per `drizzle-kit generate --custom`, damit das Journal konsistent bleibt. Für jeden Trigger gibt es einen Integrationstest gegen die lokale Docker-PostgreSQL (Vitest, eigenes Include wie `test:rechte`), der den Verstoß provoziert und die Ablehnung prüft.
- **Abnahmekriterium:** Für jedes der 8 Kürzel (`TRIG-GM-IS-CREATOR`, `TRIG-WORLD-CREATOR-IMMUTABLE`, `TRIG-REL-SAME-WORLD`, `TRIG-UNIVERSE-LAST`, `TRIG-JOURNAL-PART`, `TRIG-PART-OWNER-MEMBER`, `TRIG-CHAR-OWNER-IMMUTABLE`, `TRIG-CHAR-IMAGES-MAX`) gibt es einen Trigger in einer Migration, und ein grüner Integrationstest belegt die Ablehnung eines Verstoßes. Ein direkter SQL-Versuch, eine Relation zwischen zwei Welten anzulegen, schlägt fehl.
- **Umsetzung T-002 (2026-09-23):** Migration `0009_triggers.sql`, Test `npm run test:triggers` (8/8). Status `behoben`.
- **Abhängigkeit:** CR-002 (Vitest). CR-004 nutzt `TRIG-REL-SAME-WORLD` als zweite Absicherungsschicht.

### CR-019 – Kleinere Lücken in der Rechteschicht
- **Fundstelle:** `src/spike/rechte/repository.ts:1427-1485` (`persistenceSnapshot`), `:685-695` (`createJournal`), `src/spike/rechte/authz.ts:63-71` (`canSeeCharacterInWorld`)
- **Kategorie:** Sicherheit
- **Schweregrad:** niedrig
- **Bezug:** T-011
- **Beschreibung:** (a) Der Persistenz-Snapshot (nur mit Test-Login aktiv) liefert `bodyPlain` aller Tagebucheinträge an GM und Master, auch der `privat`-Einträge. Das verstößt gegen die Rechtematrix, selbst wenn es nur ein Diagnose-Endpunkt ist. (b) `createJournal` prüft nur, ob eine Teilnahme existiert, nicht ob sie aktiv ist (`archivedAt`). Nach Austritt, Wiederbeitritt und ohne erneutes Mitbringen lassen sich Einträge auf eine archivierte Teilnahme schreiben (`placeMarker` prüft das richtig). (c) `canSeeCharacterInWorld` bekommt immer `isMember: true`, der erste Zweig ist redundant.
- **Empfehlung:** (a) Im Snapshot nur IDs, Sichtbarkeit und einen Hash oder die Länge des Texts ausgeben. (b) `isNull(worldParticipations.archivedAt)` in die Abfrage aufnehmen. (c) Parameter und Zweig entfernen oder wirklich prüfen.
- **Abnahmekriterium:** Die Snapshot-Antwort enthält keinen Klartext von `privat`-Einträgen. `POST …/journals` für einen Charakter mit archivierter Teilnahme liefert 400. `authz.test.ts` deckt beides ab.
- **Umsetzung (Plan 003 T-008, 2026-09-23):** (b) `authorizeJournalWrite` verlangt den Besitzer und eine aktive (nicht archivierte) Teilnahme; Produkt-`POST …/journal` und Spike-`createJournal` nutzen dieselbe Funktion. Nachweis: `authz.test.ts`, `characters.api.test.ts` (Austritt → Wiederbeitritt ohne Mitbringen → 400). (c) `canSeeCharacterInWorld` prüft nur die Teilnahme (`null` oder `archivedAt`). (a) Snapshot bleibt bei T-015/Spike. Status bleibt `offen`.
- **Umsetzung (Plan 003 T-015, 2026-09-23):** (a) Produkt-`GET /api/worlds/[worldId]/persistence` liefert für `privat` nur `bodyFingerprint: len:N`, nie Klartext; Shared nur Hash-Länge-Kennung. Spike-Snapshot angepasst. Nachweis: `rechte-matrix.api.test.ts`. Status `behoben`.

### CR-020 – Pin-Sperre als undokumentierter Zusatzumfang
- **Fundstelle:** `src/spike/karte/pin-lock.ts`, `src/app/api/spike/karte/pins/[id]/route.ts:24,49-51`, Spalte `spike_pins.locked`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug:** T-009
- **Beschreibung:** T-009 verlangt verschiebbare Pins. Die Funktion „Pin sperren/entsperren“ (inkl. 409-Logik und UI) steht weder im Plan noch im fachlichen Datenmodell noch im Backlog. Anders als Kanäle/Threads im Chat (Owner-Änderung dokumentiert) fehlt hier eine Festlegung. Dazu kommt: Jeder angemeldete Benutzer kann jeden Pin sperren und entsperren, ein Rechtemodell dafür gibt es nicht.
- **Empfehlung (Entscheidung Projektinhaber, Plan-Review 2026-09-22): Übernehmen, nur die Spielleitung darf sperren.** Fachlich: Ein Pin hat die Eigenschaft **gesperrt** (ja/nein, Default nein). Nur Game Master und Master dürfen sperren und entsperren. Ein gesperrter Pin lässt sich weder verschieben noch bearbeiten noch löschen. Erlaubt ist nur das Entsperren durch die Spielleitung. Player sehen gesperrte Pins normal (optional mit Schloss-Symbol). Technisch: Spalte `pins.locked boolean NOT NULL DEFAULT false`, Prüfung in der Authz-Schicht (`requireStaff` für jede Änderung an `locked`; Änderungen an gesperrten Pins → 409). In `datenmodell-fachlich.md` (3.7 Pin und Rechte je Entität) und `datenmodell.md` (3.7 `pins.locked`, Zuordnungstabelle, `APP-PIN-LOCK`) am 2026-09-22 eingetragen. Umsetzung in Plan 003 T-002 (Spalte) und T-013 (Rechte, UI).
- **Abnahmekriterium:** `datenmodell-fachlich.md` und `datenmodell.md` beschreiben `gesperrt`/`locked` samt Rechteregel. Im MVP-Code: Ein Player erhält beim Sperren oder Entsperren 403. Ein Master kann sperren. Verschieben, Bearbeiten oder Löschen eines gesperrten Pins liefert 409, auch für die Spielleitung, bis entsperrt wird. Die Fälle stehen im Rechte-Integrationstest.
- **Teilfortschritt T-002 (2026-09-23):** Spalte `pins.locked boolean NOT NULL DEFAULT false` ist im Schema. Rechte und UI folgen in T-013. Status bleibt `offen`.
- **Umsetzung T-013 (2026-09-23):** `authorizePinWrite` (nur Spielleitung, 409 solange gesperrt). Schloss-Symbol in der Pin-UI. Nachweis: `authz.test.ts`, `map.api.test.ts`. Status `behoben`.

### CR-021 – Uneinheitliche Würfelausgabe und versteckter `/roll`-Pfad
- **Fundstelle:** `src/spike/chat/dice.ts:204-212` (`formatCompactRoll`), `src/spike/chat/dice-sides.ts:23-34` (`formatCompactFromDto`), `src/app/api/spike/chat/route.ts:170-183`, `:69-80`
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug:** T-010
- **Beschreibung:** Bei `1d20-1d4` werden alle Einzelwerte ohne Vorzeichen aufgelistet (`1d20-1d4 → 15, 3 = 12`). Das ist missverständlich, und `formatCompactFromDto` rechnet den Modifikator dann falsch zurück (Differenz enthält den negativen Würfel). Es gibt zwei Formatierer mit leicht unterschiedlicher Logik. Der versteckte `/roll`-Pfad postet immer (`postToChat` fest `true`), der strukturierte Wurf beachtet `dicePostToChat`. `rejectForgedDice` ist wegen der `.strict()`-Schemas praktisch redundant, liefert aber eine bessere Meldung. Das sollte kommentiert sein.
- **Empfehlung (festgelegt im Plan-Review 2026-09-22): Darstellung pro Term gruppiert.** Format: `<Ausdruck> → <Term1> <op> <Term2> … = <Summe>`. Würfelterme stehen in eckigen Klammern mit kommagetrennten Einzelwerten, Modifikatoren ohne Klammern. Operatoren sind ` + ` bzw. ` − ` (U+2212). Beispiele: `1d20-1d4 → [15] − [3] = 12`, `2d6+3 → [4, 2] + 3 = 9`, `1d20+1d4+2 → [11] + [2] + 2 = 15`. Dafür speichert das DTO bzw. die Nachricht die Würfe **pro Term** (z. B. `dice_terms jsonb`: `[{ sides, sign, values[] }, { modifier }]`) statt einer flachen `dice_values`-Liste. Es gibt genau einen Formatierer in einem Modul, das Server und Client teilen. Er rechnet aus den Termen, nicht aus der Summendifferenz. `/roll` wird ebenfalls über `dicePostToChat` gesteuert.
- **Abnahmekriterium:** Server und Client erzeugen für die drei Beispiele exakt die oben genannten Texte (Unit-Test mit festen Würfen). `formatCompactFromDto` bzw. eine zweite Formatierlogik gibt es nicht mehr. Ein `/roll` bei `dicePostToChat = false` wird nicht in den Chat gepostet.
- **Teilfortschritt T-002 (2026-09-23):** `chat_messages.dice_terms jsonb` ersetzt die flache Werteliste. Der gemeinsame Formatierer folgt in T-012. Status bleibt `offen`.
- **Teilfortschritt T-012 (2026-09-23):** Ein Formatierer `formatDiceRoll` in `src/lib/chat/dice-format.ts`, von Server und Client genutzt. `/roll` folgt `dicePostToChat`. Die Spike-Kopie `formatCompactFromDto` bleibt bis T-016. Status bleibt `offen`.

### CR-022 – Editor-Spike: doppelte Extensions und deutsche Identifier
- **Fundstelle:** `spikes/editor/src/editor/extensions.ts:22-37`, `spikes/editor/src/editor/types.ts`, `extract-mentions.ts:3`
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-005
- **Beschreibung:** In TipTap v3 bringt `StarterKit` bereits `Link` und `Underline` mit (siehe `@tiptap/starter-kit/package.json`). Beide werden zusätzlich separat registriert, ohne sie im StarterKit abzuschalten. TipTap warnt dann vor doppelten Extension-Namen, und welche `Link`-Konfiguration (`protocols`, `openOnClick`, `rel`) tatsächlich gilt, ist nicht eindeutig. Die ADR-004-Anforderung „nur http/https“ ist damit nicht sicher erfüllt. Außerdem nutzt der Spike deutsche Identifier und Enum-Werte (`artikel`, `charakter`, `InhaltArt`, `TEST_INHALTE`), während `conventions.md` englischen Code und `CONTENT_KINDS = article|quest|character|pin|universe` festlegt. Beim Übernehmen ins MVP müssten gespeicherte Mention-Attribute (`data-art`) migriert werden.
- **Empfehlung:** `StarterKit.configure({ link: false, underline: false, … })` oder die Konfiguration direkt über `StarterKit.configure({ link: { … } })` setzen. Identifier und `art`-Werte auf die englischen `CONTENT_KINDS` umstellen, bevor der Editor ins MVP übernommen wird.
- **Abnahmekriterium:** Beim Initialisieren des Editors erscheint keine „Duplicate extension names“-Warnung in der Konsole. Ein Test prüft, dass `javascript:`-Links nicht übernommen werden. Die Mention-`art`-Werte entsprechen `CONTENT_KINDS`.
- **Umsetzung (Plan 003 T-005, 2026-09-23):** Produkt-Editor in `src/components/editor/extensions.ts` konfiguriert Link und Underline nur über `StarterKit.configure({ link: {…} })`; Links nur http/https über `normalizeLinkHref` (`src/lib/editor/links.ts`), serverseitig zusätzlich in `sanitizeRichDoc`. Mention-Attribut heißt `kind` mit Werten aus `CONTENT_KINDS` (ADR-004 angepasst). Tests: `src/components/editor/extensions.test.ts` (keine doppelten Namen, keine Duplicate-Warnung, `javascript:` abgelehnt, `kind="article"`), `src/lib/editor/links.test.ts`, `src/lib/editor/rich-text.test.ts`. Der Spike unter `spikes/editor/` bleibt bis T-016 unverändert.

### CR-023 – Magic Numbers
- **Fundstelle:** `src/spike/rechte/repository.ts:856` (`sortOrder: Date.now() % 1_000_000`), `src/app/api/spike/*/events/route.ts:27` (`15000`), `toFixed(7)` verstreut (siehe CR-012), `src/app/api/spike/karte/upload/route.ts:79` (`8000`/`6000`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-009, T-010, T-011
- **Beschreibung:** `Date.now() % 1_000_000` läuft etwa alle 16,7 Minuten über. Neue Universen können dadurch **vor** älteren einsortiert werden, die Reihenfolge ist also faktisch zufällig. Heartbeat-Intervall und Großbild-Schwellen sind unbenannte Literale.
- **Empfehlung:** `sortOrder` als `max(sort_order) + 1` innerhalb der Welt berechnen (in derselben Transaktion). Benannte Konstanten `SSE_HEARTBEAT_MS`, `LARGE_MAP_WIDTH_PX`/`LARGE_MAP_HEIGHT_PX` einführen.
- **Abnahmekriterium:** Nacheinander angelegte Universen haben streng steigende `sort_order`. Im Spike-Code gibt es keine unbenannten numerischen Literale für Intervalle und Schwellen mehr.
- **Umsetzung (Plan 003 T-007, 2026-09-23):** Teil `sort_order` erledigt: `createUniverse` (`src/lib/domain/universes.ts`) sperrt die Weltzeile (`FOR UPDATE`) und vergibt `max(sort_order) + 1` in derselben Transaktion; Verschieben tauscht mit dem Nachbarn ebenfalls unter der Sperre. Nachweis: `worlds.api.test.ts` („(5) universes“: neues Universum erhält `sortOrder` 1, „nach oben“ ändert die Reihenfolge). Status bleibt `offen`: SSE-Heartbeat und Großbild-Schwellen folgen mit T-012/T-013.

---

## Abhängigkeiten & Reihenfolge (festgelegt im Plan-Review 2026-09-22)

Alle Findings werden in Plan 003 umgesetzt (siehe *Umsetzungsrahmen*). Plan 003 referenziert die CR-IDs selbst. Dieses Dokument ändert Plan 003 nicht. „A → B“ heißt: A muss erledigt sein, bevor B abgenommen werden kann.

| Finding | hängt ab von | Grund |
|---|---|---|
| CR-001 (1) Allowlist | – | Zuerst umsetzen, unabhängig vom Rest |
| CR-001 (2) Spikes entfernen | MVP-Ersatz für Karte, Chat, Rechte in Plan 003 | Ohne Ersatz fehlt die Funktion |
| CR-001 (3) Daten-Cleanup | CR-001 (2) | Tabellen erst löschen, wenn kein Code sie mehr nutzt |
| CR-010 CI-Verify | CR-002, CR-009, ESLint-Fehler aus CR-015 | CI soll von Beginn an grün sein (Tests, `tsc`, Lint); alles in Plan 003 T-001 |
| CR-018 Trigger | CR-002 | Integrationstests laufen mit Vitest |
| CR-004 Relationen | CR-018 (`TRIG-REL-SAME-WORLD`) | App-Prüfung plus Trigger als zweite Schicht, gemeinsamer Test |
| CR-020 Pin-Sperre | CR-013 | Sperrprüfung gehört in die konsolidierte Authz-Schicht |
| CR-011 N+1 | CR-013 | Umbau im konsolidierten Repository statt im Spike-Monolithen |
| CR-014 | CR-012 | `apiFetch`-Helfer im selben Zug wie das gemeinsame Realtime-Modul (Plan 003 T-012/T-013) |
| CR-006, CR-007 | CR-012 | Resync und Fehlerisolation im gemeinsamen Realtime-Modul umsetzen |
| CR-021 Würfelformat | CR-002 | Formatierer-Tests mit Vitest |
| CR-022 Editor | – | Beim Übernehmen des Editors ins MVP |
| CR-003, CR-005, CR-008, CR-016, CR-017, CR-019, CR-023 | – | Unabhängig, beim Bau der jeweiligen MVP-Stelle (CR-005 bringt seine Helfer `parseJsonBody`/`parseUuid` selbst mit) |

## Prioritätenliste

Die verbindliche Umsetzungsreihenfolge ergibt sich aus Plan `003`: Abschnitt *Code-Review zu Plan 001* (Zuordnung Finding → Aufgabe) und *Reihenfolge (Abhängigkeitsgraph)*. Eine eigene Prioritätenliste führt dieses Dokument nicht mehr, damit keine zweite, abweichende Reihenfolge entsteht. Inhaltlich gilt: Zuerst kommen die kritischen Findings CR-001 (Teil 1) und CR-002 sowie das CI-Gate CR-010 in Plan 003 T-001. Das Entfernen der Spikes und das Bereinigen der Daten (CR-001 Teile 2 und 3) kommen zuletzt in T-016.

## Review-Check 2026-09-23

**Geprüft gegen:** HEAD nach Plan-Run Review 003 (u. a. Commits zu CR-010 dieses Reviews). Ausgelöst durch CR-016 in `.ai/code-review-003-mvp-funktionen-2026-09-23.md`.

| ID | Vorher | Nachher | Kurz |
|----|--------|---------|------|
| CR-004 | offen | behoben | `createManualRelation` prüft beide Enden über `loadEnd` (Weltzugehörigkeit) |
| CR-021 | offen | behoben | `dice-format.ts` mit Vorzeichen; `/roll` respektiert `dicePostToChat` |
| CR-023 | offen | behoben | Chat-/Karten-Limits und Positionsformat zentral (Rest aus Review 003 CR-010) |
| CR-001 | behoben | behoben | Vermerk: Code-Entfernung (Teil 2) mit T-016 erledigt; **Prod-APPLY** von `scripts/cleanup-spike-data.sql` (Teil 3) wartet weiter auf Freigabe laut T-016-Umsetzungsnotiz |

**Offen mit erfülltem Abnahmekriterium im Code:** keines.
**Nicht abgedeckt / Hinweis:** Parallele Plan-004/008-WIP (Kapitel, Würfel-Sheet) liegt außerhalb der Review-001-Fundstellen.
**Empfehlung:** Kein erneuter `/code-review` für Plan 001 nötig; Prod-Cleanup bei Push-Freigabe (T-017) mitnehmen.
