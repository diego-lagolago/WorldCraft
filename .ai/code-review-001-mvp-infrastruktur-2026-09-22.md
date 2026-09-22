# Code Review – Plan 001 (MVP-Infrastruktur)

**Baseline:** Commit `146e64608211e977c2aa41b4f9fd62a0f1350ac3` (`main`). Uncommittete Änderungen im Working Tree zum Review-Zeitpunkt nur in `.ai/tech-stack.md` (geändert) und `.ai/feature-tasks/003-mvp-funktionen.md` (neu). Beide sind Dokumente, kein Code.
**Geprüfte Task-Datei:** `.ai/feature-tasks/001-mvp-infrastruktur.md`
**Geprüfte Aufgaben (`[x]`):** T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010, T-011, T-013, T-014 (T-001 und T-012 sind entfallen).
**Zusätzlich ausgeführt:** `npm test` (2 Testdateien schlagen fehl), `npx tsc --noEmit` (1 Fehler), `npx eslint .` (1 Fehler).

## Tracking

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Sicherheit | kritisch | offen | Spike-APIs in Produktion für jedes Discord-Konto offen (Upload, Chat, Rechte-API auf echten Tabellen) |
| CR-002 | Testabdeckung | kritisch | offen | `npm test` ist rot: `dice.test.ts` und `authz.test.ts` scheitern an `ERR_MODULE_NOT_FOUND` |
| CR-003 | Sicherheit | mittel | offen | `discordId` ist als `input: true` über `/api/auth/update-user` vom Benutzer änderbar |
| CR-004 | Sicherheit | mittel | offen | Manuelle Relationen prüfen nicht, ob Quelle und Ziel zur Welt gehören (weltübergreifend, 500 bei fremder ID) |
| CR-005 | Runtime-Risiken | mittel | offen | Ungültige UUID bzw. ungültiges JSON führen in Karten- und Chat-Routen zu HTTP 500 |
| CR-006 | Runtime-Risiken | mittel | offen | SSE-Reconnect lädt den Stand nicht neu, Ereignisse während der Trennung gehen verloren |
| CR-007 | Runtime-Risiken | mittel | offen | Realtime-Bus ohne Fehlerisolation pro Listener: Fehler landet nach dem DB-Write im POST-Handler |
| CR-008 | Runtime-Risiken | mittel | offen | Mehrstufige Schreibvorgänge ohne Transaktion, Lost Update bei `use_count`, Get-or-create-Races |
| CR-009 | Runtime-Risiken | mittel | offen | `composer-dom.ts:67` addiert einen String auf einen Zähler (`tsc`-Fehler, falsche Caret-Position) |
| CR-010 | Testabdeckung | mittel | offen | CI baut nur das Image, ohne `npm test`, `tsc` oder `eslint` |
| CR-011 | Performance | mittel | offen | N+1-Queries in `listRelations`, `archiveMembershipAndParticipations` und `listWorldGeography` |
| CR-012 | Duplizierung & Modularisierung | mittel | offen | Realtime-Bus, SSE-Route, `escapeHtml`, Pin-Typen und Positionsrundung sind mehrfach implementiert |
| CR-013 | Duplizierung & Modularisierung | mittel | offen | Rechte-Repository: Marker-Autorisierung dreimal kopiert, Patches als `Record<string, unknown>` |
| CR-014 | Fehlerbehandlung & Validierung | niedrig | offen | Frontend-`fetch` ohne `try/catch`, `persistMarkerMove` ignoriert die Antwort, `JSON.parse` ungeschützt |
| CR-015 | Bad Practices | niedrig | offen | ESLint-Fehler (Ref-Zuweisung beim Rendern), Komponenten mit 700 bis 1000 Zeilen |
| CR-016 | Sicherheit | niedrig | offen | Endung beim Upload kommt aus dem Client-MIME, `nosniff` fehlt, Kartenbild wird pro Abruf komplett gelesen |
| CR-017 | Fehlerbehandlung & Validierung | niedrig | offen | Keine Startvalidierung für `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`, localhost-Origins auch in Produktion vertraut |
| CR-018 | Aufgaben-Abgleich | niedrig | offen | 8 dokumentierte `TRIG-*`-Regeln fehlen in den Migrationen, ohne Vermerk im Datenmodell |
| CR-019 | Sicherheit | niedrig | offen | Persistenz-Snapshot liefert `privat`-Tagebuchtexte an die Spielleitung, Journal auf archivierter Teilnahme möglich |
| CR-020 | Aufgaben-Abgleich | niedrig | offen | Pin-Sperre (`locked`) ist nicht im Plan und nicht dokumentiert (Scope Creep) |
| CR-021 | Lesbarkeit & Wartbarkeit | niedrig | offen | Würfelausgabe: negative Würfelterme ohne Vorzeichen, versteckter `/roll`-Pfad ignoriert `dicePostToChat` |
| CR-022 | Bad Practices | niedrig | offen | Editor-Spike: Link/Underline doppelt registriert (StarterKit v3), deutsche Identifier entgegen Konvention |
| CR-023 | Bad Practices | niedrig | offen | Magic Numbers (`Date.now() % 1_000_000`, `15000`, `toFixed(7)` verstreut) |

---

## Findings im Detail

### CR-001 – Spike-APIs in Produktion für jedes Discord-Konto offen
- **Fundstelle:** `src/spike/karte/session.ts` (`requireSpikeSession`), `src/app/api/spike/**`, `src/spike/rechte/http.ts:86` (`handleRechteRequest`), `src/lib/auth.ts:73-91`
- **Kategorie:** Sicherheit
- **Schweregrad:** kritisch
- **Bezug:** T-007, T-008, T-009, T-010, T-011, T-014
- **Beschreibung:** `worldcraft.lagolago.at` ist öffentlich erreichbar. Anmelden kann sich jedes beliebige Discord-Konto, es gibt keine Allowlist. Alle Spike-Endpunkte prüfen nur „angemeldet ja/nein“. Ein fremder Benutzer kann damit in Produktion das gemeinsame Kartenbild ersetzen (`/api/spike/karte/upload`, 20 MB pro Request, ohne Rate-Limit), Pins und Marker verschieben, unbegrenzt Chat-Nachrichten und Threads anlegen und über `/api/spike/rechte/*` Welten, Artikel, Universen, Karten und `files`-Platzhalter in den **echten MVP-Tabellen** anlegen. Die Daten landen im selben Schema, auf dem Plan 003 aufbaut.
- **Empfehlung:** Kurzfristig: Spike-Routen in Produktion hinter ein Feature-Flag legen (z. B. `ENABLE_SPIKES`, Default aus bei `APP_ENV=production`, Antwort 404) oder eine Discord-ID-Allowlist (`ALLOWED_DISCORD_IDS`) im `databaseHooks.user.create.before` bzw. `validateUserInfo` erzwingen. Die Rechte-Spike-API gehört grundsätzlich hinter `isTestLoginEnabled()`, da sie laut README nur lokal gedacht ist. In Produktion angelegte Spike-Datensätze in den MVP-Tabellen vor Beginn von Plan 003 bereinigen.
- **Abnahmekriterium:** Mit `APP_ENV=production` und ohne Freischaltung liefern `/api/spike/rechte/worlds` (POST), `/api/spike/karte/upload` und `/api/spike/chat` (POST) für einen angemeldeten Benutzer HTTP 404 bzw. 403. Ein Discord-Konto außerhalb der Allowlist (falls umgesetzt) erhält beim Login einen Fehler, und es entsteht kein `users`-Datensatz.

### CR-002 – `npm test` ist rot (Module werden nicht gefunden)
- **Fundstelle:** `package.json:10` (`test`-Skript), `src/spike/chat/dice.ts:4-18`, `src/spike/rechte/authz.ts:3-14` (Importe ohne Dateiendung seit Commit `74a4eff`)
- **Kategorie:** Testabdeckung
- **Schweregrad:** kritisch
- **Bezug:** T-010, T-011, T-013
- **Beschreibung:** `node --experimental-strip-types --test` löst ESM-Importe ohne `.ts`-Endung nicht auf. Nachdem Commit `74a4eff` die Endungen für den Next-Build entfernt hat, scheitern `src/spike/chat/dice.test.ts` („Cannot find module …/dice-sides“) und `src/spike/rechte/authz.test.ts` („Cannot find module …/types“) mit `ERR_MODULE_NOT_FOUND`. Die Würfel- und Autorisierungsregeln, also die Kernnachweise für T-010 (AC 2 bis 4) und T-011, laufen damit nicht mehr als Unit-Tests. Die Go-Einschätzung in `.ai/tech-stack.md` stützt sich auf diese Tests.
- **Empfehlung:** Den Test-Runner auf einen TS-fähigen Resolver umstellen, z. B. `tsx --test` oder `vitest` (im Editor-Spike schon im Einsatz), statt nacktem `--experimental-strip-types`. Alternativ `allowImportingTsExtensions` mit `.ts`-Endungen und `rewriteRelativeImportExtensions` nutzen, dann aber zusammen mit dem Next-Build prüfen. Zusätzlich `"type": "module"` setzen, damit die `MODULE_TYPELESS_PACKAGE_JSON`-Warnungen verschwinden.
- **Abnahmekriterium:** `npm test` endet mit Exit-Code 0, alle Testdateien unter `src/lib/*.test.ts` und `src/spike/**/*.test.ts` werden ausgeführt, und keine meldet `ERR_MODULE_NOT_FOUND`. `npm run build` ist weiterhin erfolgreich.

### CR-003 – `discordId` ist vom Benutzer änderbar
- **Fundstelle:** `src/lib/auth.ts:46-50` (`additionalFields.discordId`, `input: true`)
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug:** T-008
- **Beschreibung:** Better Auth übernimmt Zusatzfelder mit `input: true` sowohl beim Anlegen als auch in `POST /api/auth/update-user`. Ein angemeldeter Benutzer kann damit seine eigene `discord_id` auf einen beliebigen freien Wert setzen. Folgen: (a) Er kann die Discord-ID einer Person belegen, die sich noch nicht registriert hat. Deren erster Login scheitert dann am Unique-Constraint. (b) Lokal kann er `test-gm` usw. belegen, und der Test-Login meldet danach auf seinem Konto an. (c) Später (Plan 002/003) wird `discord_id` womöglich als Identitätsmerkmal genutzt.
- **Empfehlung:** `input: false` setzen. Die ID kommt ausschließlich aus `mapProfileToUser` bzw. dem Test-Login-Plugin, das über `internalAdapter.createUser` schreibt und nicht auf `input` angewiesen ist.
- **Abnahmekriterium:** `POST /api/auth/update-user` mit `{ "discordId": "x" }` ändert `users.discord_id` nicht (Antwort 400 oder Feld ignoriert, per Datenbankabfrage geprüft). Discord- und Test-Login legen weiterhin Benutzer mit korrekter `discord_id` an.

### CR-004 – Manuelle Relationen ohne Weltzugehörigkeitsprüfung
- **Fundstelle:** `src/spike/rechte/repository.ts:1338-1385` (`createManualRelation`)
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug:** T-006, T-011
- **Beschreibung:** Geprüft wird nur, ob der Aufrufer zur Spielleitung von `worldId` gehört. Ob `sourceId`/`targetId` existieren und in derselben Welt liegen, wird nicht geprüft (`APP-`/`TRIG-REL-SAME-WORLD` laut `datenmodell.md`). Eine Spielleitung kann so Relationen auf Inhalte **fremder Welten** anlegen. Eine nicht existierende ID löst eine FK-Verletzung aus, die als HTTP 500 durchschlägt. Der Unterschied zwischen 201 und 500 verrät außerdem, ob eine fremde UUID existiert. Diese Schicht ist als gemeinsame `APP-AUTHZ` für Plan 002/003 vorgesehen, der Fehler würde sich also fortpflanzen.
- **Empfehlung:** Vor dem Insert beide Enden laden und `worldId` vergleichen (für Pins über Karte → Universum). Bei Abweichung oder fehlendem Ende 404 bzw. 400 zurückgeben. Zusätzlich den dokumentierten Trigger `TRIG-REL-SAME-WORLD` in einer Migration umsetzen (siehe CR-018).
- **Abnahmekriterium:** Eine Relation, deren Ziel ein Artikel einer anderen Welt ist, wird mit 4xx abgelehnt und nicht gespeichert. Eine Relation auf eine nicht existierende UUID liefert 404 statt 500. Beide Fälle stehen als Assertion in `run-rechte-tests.ts`.

### CR-005 – HTTP 500 bei ungültiger UUID oder ungültigem JSON
- **Fundstelle:** `src/app/api/spike/karte/pins/[id]/route.ts:37-44`, `src/app/api/spike/karte/markers/[id]/route.ts:23-24`, `src/app/api/spike/karte/pins/route.ts:24`, `src/app/api/spike/chat/route.ts:101-123`, `src/app/api/spike/chat/threads/route.ts:28-29`, `src/app/spike/chat/page.tsx` (`?channel=`/`?thread=`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-009, T-010
- **Beschreibung:** Pfad- und Query-Parameter (`id`, `channelId`, `threadId`, `before`) gehen ungeprüft in `eq(uuid-Spalte, …)`. PostgreSQL wirft dann `22P02 invalid input syntax for type uuid`, und die Antwort ist HTTP 500. Beispiel: `/spike/chat?channel=abc` lässt die ganze Seite abstürzen. Die Karten-Routen rufen `await request.json()` ohne `try/catch` auf, ein leerer oder kaputter Body ergibt ebenfalls 500. Die Chat-Routen machen das richtig (`try/catch` → 400), die Karten-Routen nicht. Die Behandlung ist also uneinheitlich.
- **Empfehlung:** Einen gemeinsamen Helfer einführen (z. B. `parseJsonBody(request, schema)` und `parseUuid(value)`), der 400 bzw. 404 liefert, und ihn in allen Route-Handlern verwenden. Seiten-Parameter vor dem DB-Zugriff mit `z.string().uuid().safeParse` prüfen und bei Fehler auf den Default-Kanal zurückfallen.
- **Abnahmekriterium:** `PATCH /api/spike/karte/pins/not-a-uuid`, `PATCH …/pins/<uuid>` mit Body `{` und `GET /api/spike/chat?channelId=abc&before=xyz` liefern 400 oder 404, nie 500. `/spike/chat?channel=abc` rendert den Default-Kanal.

### CR-006 – SSE-Reconnect ohne Neusynchronisierung
- **Fundstelle:** `src/spike/karte/KarteBoard.tsx:167-196`, `src/spike/chat/ChatSpikePage.tsx:159-179`, Server: `src/app/api/spike/*/events/route.ts` (`send({ type: "hello" })`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-009 (AC 3), T-010 (AC 1)
- **Beschreibung:** `EventSource` verbindet sich nach einem Abbruch automatisch neu. Der Bus hält aber keine Historie, und der Client ignoriert `hello` (Karte) bzw. reagiert gar nicht darauf (Chat). Pin-Verschiebungen und Nachrichten, die während der Trennung passieren, fehlen deshalb dauerhaft, bis die Seite neu geladen wird. Das Projekt ist Mobile-First: Handys trennen SSE beim Sperren des Displays oder beim Netzwechsel regelmäßig, und auch jedes Coolify-Deployment trennt alle Verbindungen.
- **Empfehlung:** Bei jedem `hello` außer dem ersten (bzw. bei `source.onopen` nach `onerror`) `loadState()` bzw. `loadStream()` für den aktuellen Kanal/Thread aufrufen. Alternativ `Last-Event-ID` mit einer Sequenznummer umsetzen.
- **Abnahmekriterium:** Browser A trennt die SSE-Verbindung (DevTools offline, 5 s). Browser B verschiebt in dieser Zeit einen Pin und sendet eine Nachricht. Nach dem Reconnect zeigt A beide Änderungen ohne manuelles Neuladen an.

### CR-007 – Realtime-Bus ohne Fehlerisolation
- **Fundstelle:** `src/spike/chat/realtime-bus.ts:18-22`, `src/spike/karte/realtime-bus.ts:18-22`, `src/app/api/spike/*/events/route.ts:20-27`
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-009, T-010
- **Beschreibung:** `publish*Event` ruft die Listener synchron und ohne `try/catch` auf. Wirft `controller.enqueue` bei einem bereits geschlossenen Stream (etwa wenn Proxy oder Browser trennen, bevor `abort`/`cancel` durchgelaufen ist), bricht die Schleife ab. Die übrigen Clients bekommen das Ereignis dann nicht, und die Exception erreicht den POST-Handler **nach** dem Datenbank-Insert. Der Absender sieht 500 und schickt die Nachricht womöglich erneut (Duplikat). Der `setInterval`-Heartbeat kann genauso werfen, dann als unbehandelte Exception. Der Bus funktioniert außerdem nur mit genau einem Node-Prozess. Das steht im Kommentar, fehlt aber als Norm in `tech-stack.md`/`architecture/README.md`.
- **Empfehlung:** Jeden Listener-Aufruf mit `try/catch` absichern und fehlerhafte Listener entfernen. Im Heartbeat und in `send` vor dem `enqueue` auf `closed` prüfen. Die Einschränkung auf einen Prozess als Architekturgrenze dokumentieren. Für das MVP einen Bus (z. B. PostgreSQL `LISTEN/NOTIFY`) oder einen Replica-Count von 1 festschreiben.
- **Abnahmekriterium:** Ein Unit-Test registriert einen werfenden und einen normalen Listener. `publish` wirft nicht, und der normale Listener erhält das Ereignis. Die Ein-Prozess-Annahme steht in `.ai/architecture/README.md`.

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

### CR-009 – Typfehler in `composer-dom.ts` (Caret-Offset)
- **Fundstelle:** `src/spike/chat/composer-dom.ts:67`
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-010
- **Beschreibung:** `total += textFromNode(children[i]!)` addiert einen **String** auf einen `number`-Zähler. `tsc --noEmit` meldet TS2322. Zur Laufzeit wird `total` zu einer Zeichenkette (z. B. `"0abc"`), und der Caret-Offset stimmt nicht mehr, sobald der Caret auf Elementebene (zwischen Kindknoten) steht, etwa nach dem Reparse bei `**fett**`. Das deckt sich mit den offenen Composer-Bugs in `smoketest.md`.
- **Empfehlung:** `total += textFromNode(children[i]!).length`. Einen Unit-Test für `getCaretMarkdownOffset` mit Caret auf Elementebene ergänzen (happy-dom/jsdom).
- **Abnahmekriterium:** `npx tsc --noEmit` meldet keinen Fehler. Ein Test prüft, dass der Offset bei Caret zwischen `<strong>`-Kindknoten der Markdown-Länge davor entspricht.

### CR-010 – CI ohne Tests, Typecheck und Lint
- **Fundstelle:** `.github/workflows/build-image.yml`
- **Kategorie:** Testabdeckung
- **Schweregrad:** mittel
- **Bezug:** T-007, T-013
- **Beschreibung:** Der einzige Workflow baut das Docker-Image und pusht es. `npm test`, `tsc --noEmit` und `eslint` laufen nie automatisch. Deshalb sind CR-002, CR-009 und CR-015 unbemerkt auf `main` gelandet und nach Produktion deployt worden. `conventions.md` nennt als CI-Stufe nur den Image-Build.
- **Empfehlung:** Einen Job `verify` (Node 22, `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, optional `cd spikes/editor && npm ci && npm test`) vor `docker` schalten (`needs: verify`). `conventions.md` → Teststrategie entsprechend ergänzen.
- **Abnahmekriterium:** Ein Push mit einem absichtlich fehlschlagenden Test bricht den Workflow vor dem Image-Build ab. `conventions.md` beschreibt den `verify`-Schritt.

### CR-011 – N+1-Queries im Rechte-Repository
- **Fundstelle:** `src/spike/rechte/repository.ts:1396-1425` (`listRelations` → `isContentVisibleFor` :217), `:402-418` (Schleife pro Charakter), `:1271-1285` (`listWorldGeography`, Marker-Query ohne Kartenfilter)
- **Kategorie:** Performance
- **Schweregrad:** mittel
- **Bezug:** T-011
- **Beschreibung:** `listRelations` ruft pro Relation zweimal `isContentVisibleFor` auf. Jeder Aufruf lädt die Mitgliedschaft neu und dann den Inhalt (bei Pins mit Join, bei Charakteren zwei Queries). Das sind 4 bis 6 Queries pro Relation. Bei einigen hundert Relationen, wie sie der MCP-Server aus Plan 002 regelmäßig abfragen würde, wird das spürbar. Der Austritt aktualisiert Teilnahmen in einer Schleife pro Charakter statt mit `inArray`. `listWorldGeography` lädt alle Marker aller Charaktere mit Teilnahme in der Welt, auch auf Karten anderer Welten, und filtert erst im Speicher.
- **Empfehlung:** Sichtbarkeit gesammelt ermitteln: Mitgliedschaft einmal laden, IDs pro Art sammeln und je Art eine `inArray`-Query (bzw. ein Join) ausführen, danach in einer Map nachschlagen. Teilnahmen mit einem Update per `inArray` archivieren. Die Marker-Query mit `inArray(characterMarkers.mapId, mapIds)` einschränken.
- **Abnahmekriterium:** Die Zahl der SQL-Statements in `listRelations` ist unabhängig von der Anzahl der Relationen (höchstens ca. 6, geprüft per Drizzle-Logger). `npm run test:rechte` bleibt grün.

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
- **Abnahmekriterium:** Es gibt genau eine Implementierung von Realtime-Bus, SSE-Response, Sitzungsprüfung und `escapeHtml` in `src/`. `grep -rn "toFixed(7)" src` findet höchstens die zentrale Hilfsfunktion. Die Pin-Typ-Liste existiert einmal und wird überall importiert.

### CR-013 – Wiederholte Autorisierungsblöcke im Rechte-Repository
- **Fundstelle:** `src/spike/rechte/repository.ts:1072-1251` (`placeMarker`, `moveMarker`, `deleteMarker`), sinngemäß auch `update*/delete*` für Artikel, Universum, Karte und Pin; `patch: Record<string, unknown>` bei :801, :879, :966, :1041
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** mittel
- **Bezug:** T-011
- **Beschreibung:** Die Folge „Marker laden → Kartenkontext laden → Mitgliedschaft laden → Charakter laden → `canSeePublishedLayer` → `canEditMarker` → Positionsprüfung“ ist dreimal fast wörtlich kopiert. Dasselbe gilt für „Entität laden → Welt ermitteln → `requireStaff`“. Die 1485 Zeilen lange Datei ist die Vorlage für die MVP-`APP-AUTHZ`-Schicht (Norm: „Neue Rechtefälle zuerst in der gemeinsamen Authz-Schicht“). Kopierte Prüfungen laufen erfahrungsgemäß auseinander. Die `Record<string, unknown>`-Patches umgehen außerdem die Drizzle-Typprüfung: Tippfehler in Spaltennamen fallen erst zur Laufzeit auf.
- **Empfehlung:** Helfer wie `loadMarkerForEdit(actor, markerId)` bzw. `withStaffOnWorldOf(entity)` extrahieren, die Kontext und Gate liefern. Positionsprüfung ins Zod-Schema verschieben (`z.number().min(0).max(1)`). Patches als `Partial<typeof articles.$inferInsert>` typisieren. Die Datei nach Aggregaten aufteilen (`membership.ts`, `content.ts`, `geography.ts`, `relations.ts`).
- **Abnahmekriterium:** Die Marker-Autorisierung steht in genau einer Funktion, die die drei Marker-Operationen nutzen. Kein `Record<string, unknown>` mehr in `repository.ts`. `npm run test:rechte` bleibt 15/15 grün.

### CR-014 – Fehlerbehandlung im Frontend
- **Fundstelle:** `src/spike/karte/KarteBoard.tsx:198-216` (`persistPinMove`, `persistMarkerMove`), `:224-253` (`createPin`), `:168-170` und `ChatSpikePage.tsx:161-162` (`JSON.parse` im `onmessage`)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug:** T-009, T-010
- **Beschreibung:** `persistMarkerMove` prüft weder `response.ok` noch Netzwerkfehler. Scheitert das Speichern, steht der Marker lokal an der neuen Position, auf dem Server an der alten, und niemand erfährt davon. `persistPinMove` und `createPin` haben kein `try/catch`: Offline führt das zu einer unbehandelten Promise-Rejection statt zu einer Fehlermeldung. `JSON.parse` im SSE-Handler ist ungeschützt.
- **Empfehlung:** Einen gemeinsamen `apiFetch`-Helfer mit `try/catch` und einheitlicher Fehlermeldung (Deutsch) bauen. Bei Fehlschlag den Zustand per `loadState()` zurückholen. `JSON.parse` absichern.
- **Abnahmekriterium:** Marker bei „offline“ in den DevTools verschieben → sichtbare Fehlermeldung, Marker springt nach Reconnect auf die Serverposition zurück. Keine „Uncaught (in promise)“-Meldung in der Konsole.

### CR-015 – ESLint-Fehler und sehr große Komponenten
- **Fundstelle:** `src/spike/karte/KarteBoard.tsx:151` (`openPinSheetRef.current = openPinSheet` beim Rendern, Regel `react-hooks/refs`); `KarteBoard.tsx` (1013 Zeilen), `ChatSpikePage.tsx` (705 Zeilen); sinngemäß `RichComposer.tsx:49` (`valueRef.current = value`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-009, T-010
- **Beschreibung:** `npm run lint` schlägt mit einem Fehler fehl. Ref-Zuweisungen beim Rendern sind unter React 19 bzw. im Concurrent Rendering nicht garantiert konsistent. Die beiden Hauptkomponenten vermischen Datenladen, SSE, Leaflet-Imperativcode, Sheets und Formulare. Das erschwert Tests und den geplanten Ausbau in Plan 003.
- **Empfehlung:** Ref-Updates in `useEffect`/`useLayoutEffect` verschieben oder `useEffectEvent` nutzen. Hooks extrahieren (`useKarteRealtime`, `useLeafletMap`, `usePinSheet`, `useChatStream`) und Sheets als eigene Komponenten auslagern.
- **Abnahmekriterium:** `npx eslint .` meldet 0 Fehler. Keine Spike-Komponente ist länger als ca. 400 Zeilen, Realtime- und Datenlogik liegen in eigenen Hooks.

### CR-016 – Upload und Auslieferung des Kartenbilds
- **Fundstelle:** `src/app/api/spike/karte/upload/route.ts:29-57`, `src/app/api/spike/karte/image/route.ts:26-34`
- **Kategorie:** Sicherheit
- **Schweregrad:** niedrig
- **Bezug:** T-009
- **Beschreibung:** Die Dateiendung und damit der später ausgelieferte `Content-Type` stammen aus dem **vom Client gemeldeten** `file.type`, nicht aus dem tatsächlich erkannten Format. `image-size` erkennt auch SVG, GIF, BMP usw. Eine als `image/png` deklarierte andere Datei wird als `.png` gespeichert und ausgeliefert. `X-Content-Type-Options: nosniff` fehlt. Zur Performance: Jeder Abruf liest bis zu 20 MB komplett mit `readFile` in den Speicher, obwohl die URL versioniert ist (`?v=`), und cacht nur 60 s.
- **Empfehlung:** `imageSize(bytes).type` gegen die Allowlist `jpg|png|webp` prüfen und die Endung daraus ableiten. `nosniff` setzen. Die Datei per Stream (`createReadStream` → `ReadableStream`) ausliefern, mit `Cache-Control: private, max-age=31536000, immutable` für versionierte URLs.
- **Abnahmekriterium:** Ein Upload einer GIF- oder SVG-Datei mit `Content-Type: image/png` wird mit 400 abgelehnt. Die Bildantwort enthält `X-Content-Type-Options: nosniff` und einen `immutable`-Cache-Header. Der Heap wächst beim Abruf des 8000 × 6000-Testbilds nicht um die Dateigröße.

### CR-017 – Keine Startvalidierung der Umgebung, localhost-Origins in Produktion
- **Fundstelle:** `src/lib/env.ts`, `src/lib/auth.ts:24-40`, `src/db/client.ts:5-7`
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug:** T-007, T-008
- **Beschreibung:** Beim Start wird nur `DATABASE_URL` geprüft. Fehlen `BETTER_AUTH_SECRET` oder `BETTER_AUTH_URL` in Coolify, merkt man das erst beim ersten Login (Fallback `http://localhost:3000` → falsche Redirects bzw. Better-Auth-Fehler). `trustedOrigins` enthält `http://localhost:3000` und `http://127.0.0.1:3000` auch bei `APP_ENV=production`.
- **Empfehlung:** Ein Zod-Schema für die Umgebung in `src/lib/env.ts` (Pflichtfelder abhängig von `APP_ENV`, Mindestlänge des Secrets, URL-Format), aufgerufen in `instrumentation.ts`. localhost-Origins nur bei `APP_ENV !== "production"` aufnehmen.
- **Abnahmekriterium:** Ein Start mit `APP_ENV=production` ohne `BETTER_AUTH_SECRET` bricht mit einer verständlichen deutschen Meldung ab. In Produktion enthält `trustedOrigins` nur die `BETTER_AUTH_URL`. Ein Unit-Test in `env.test.ts` deckt beides ab.

### CR-018 – Dokumentierte Trigger fehlen in den Migrationen
- **Fundstelle:** `.ai/architecture/datenmodell.md` (u. a. Zeilen 143, 604, 656) vs. `src/db/migrations/*.sql`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug:** T-006, T-011
- **Beschreibung:** Das technische Datenmodell nennt als Umsetzung von Regeln `TRIG-GM-IS-CREATOR`, `TRIG-WORLD-CREATOR-IMMUTABLE`, `TRIG-REL-SAME-WORLD`, `TRIG-UNIVERSE-LAST`, `TRIG-JOURNAL-PART`, `TRIG-PART-OWNER-MEMBER`, `TRIG-CHAR-OWNER-IMMUTABLE` und `TRIG-CHAR-IMAGES-MAX`. Keine Migration enthält einen Trigger. Die T-006-Regel „genau ein Game Master = Ersteller“ ist auf Datenebene nur zur Hälfte abgesichert (`uq_one_gm` stellt höchstens einen GM sicher, aber nicht „= Ersteller“). Plan 003 greift das auf, das Datenmodell sagt aber nirgends, dass diese Regeln noch fehlen. Wer nur das Datenmodell liest, hält sie für umgesetzt.
- **Empfehlung:** Im Datenmodell (Abschnitt Regelumsetzung) den Status je `TRIG-*` vermerken („offen, Plan 003 T-…“) oder die Trigger jetzt als Migration nachziehen.
- **Abnahmekriterium:** Für jedes `TRIG-*`-Kürzel gilt entweder: es existiert eine Migration mit dem Trigger, oder `datenmodell.md` markiert es ausdrücklich als offen mit Verweis auf die Plan-003-Task-ID.

### CR-019 – Kleinere Lücken in der Rechteschicht
- **Fundstelle:** `src/spike/rechte/repository.ts:1427-1485` (`persistenceSnapshot`), `:685-695` (`createJournal`), `src/spike/rechte/authz.ts:63-71` (`canSeeCharacterInWorld`)
- **Kategorie:** Sicherheit
- **Schweregrad:** niedrig
- **Bezug:** T-011
- **Beschreibung:** (a) Der Persistenz-Snapshot (nur mit Test-Login aktiv) liefert `bodyPlain` aller Tagebucheinträge an GM und Master, auch der `privat`-Einträge. Das verstößt gegen die Rechtematrix, selbst wenn es nur ein Diagnose-Endpunkt ist. (b) `createJournal` prüft nur, ob eine Teilnahme existiert, nicht ob sie aktiv ist (`archivedAt`). Nach Austritt, Wiederbeitritt und ohne erneutes Mitbringen lassen sich Einträge auf eine archivierte Teilnahme schreiben (`placeMarker` prüft das richtig). (c) `canSeeCharacterInWorld` bekommt immer `isMember: true`, der erste Zweig ist redundant.
- **Empfehlung:** (a) Im Snapshot nur IDs, Sichtbarkeit und einen Hash oder die Länge des Texts ausgeben. (b) `isNull(worldParticipations.archivedAt)` in die Abfrage aufnehmen. (c) Parameter und Zweig entfernen oder wirklich prüfen.
- **Abnahmekriterium:** Die Snapshot-Antwort enthält keinen Klartext von `privat`-Einträgen. `POST …/journals` für einen Charakter mit archivierter Teilnahme liefert 400. `authz.test.ts` deckt beides ab.

### CR-020 – Pin-Sperre als undokumentierter Zusatzumfang
- **Fundstelle:** `src/spike/karte/pin-lock.ts`, `src/app/api/spike/karte/pins/[id]/route.ts:24,49-51`, Spalte `spike_pins.locked`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug:** T-009
- **Beschreibung:** T-009 verlangt verschiebbare Pins. Die Funktion „Pin sperren/entsperren“ (inkl. 409-Logik und UI) steht weder im Plan noch im fachlichen Datenmodell noch im Backlog. Anders als Kanäle/Threads im Chat (Owner-Änderung dokumentiert) fehlt hier eine Festlegung. Dazu kommt: Jeder angemeldete Benutzer kann jeden Pin sperren und entsperren, ein Rechtemodell dafür gibt es nicht.
- **Empfehlung:** Die Entscheidung beim Projektinhaber einholen: entweder im fachlichen Datenmodell (Pin-Eigenschaft plus Rechte: nur Spielleitung) aufnehmen oder aus dem Spike entfernen bzw. als Backlog-Idee vermerken.
- **Abnahmekriterium:** `locked` ist im fachlichen Datenmodell oder in `backlog.md` mit Rechteregel beschrieben, oder Spalte und Logik sind entfernt.

### CR-021 – Uneinheitliche Würfelausgabe und versteckter `/roll`-Pfad
- **Fundstelle:** `src/spike/chat/dice.ts:204-212` (`formatCompactRoll`), `src/spike/chat/dice-sides.ts:23-34` (`formatCompactFromDto`), `src/app/api/spike/chat/route.ts:170-183`, `:69-80`
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug:** T-010
- **Beschreibung:** Bei `1d20-1d4` werden alle Einzelwerte ohne Vorzeichen aufgelistet (`1d20-1d4 → 15, 3 = 12`). Das ist missverständlich, und `formatCompactFromDto` rechnet den Modifikator dann falsch zurück (Differenz enthält den negativen Würfel). Es gibt zwei Formatierer mit leicht unterschiedlicher Logik. Der versteckte `/roll`-Pfad postet immer (`postToChat` fest `true`), der strukturierte Wurf beachtet `dicePostToChat`. `rejectForgedDice` ist wegen der `.strict()`-Schemas praktisch redundant, liefert aber eine bessere Meldung. Das sollte kommentiert sein.
- **Empfehlung:** Einzelwerte pro Term mit Vorzeichen gruppieren (z. B. `[15] − [3]`) und einen einzigen Formatierer (shared) nutzen, der Terme statt Summendifferenz auswertet. `/roll` ebenfalls über `getDicePostToChat` steuern oder die Abweichung kommentieren.
- **Abnahmekriterium:** `formatCompactRoll` und die Client-Darstellung zeigen für `1d20-1d4` mit Würfen 15 und 3 übereinstimmend einen Text, aus dem das Minus beim d4 erkennbar ist. Dafür gibt es einen Test in `dice.test.ts`.

### CR-022 – Editor-Spike: doppelte Extensions und deutsche Identifier
- **Fundstelle:** `spikes/editor/src/editor/extensions.ts:22-37`, `spikes/editor/src/editor/types.ts`, `extract-mentions.ts:3`
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-005
- **Beschreibung:** In TipTap v3 bringt `StarterKit` bereits `Link` und `Underline` mit (siehe `@tiptap/starter-kit/package.json`). Beide werden zusätzlich separat registriert, ohne sie im StarterKit abzuschalten. TipTap warnt dann vor doppelten Extension-Namen, und welche `Link`-Konfiguration (`protocols`, `openOnClick`, `rel`) tatsächlich gilt, ist nicht eindeutig. Die ADR-004-Anforderung „nur http/https“ ist damit nicht sicher erfüllt. Außerdem nutzt der Spike deutsche Identifier und Enum-Werte (`artikel`, `charakter`, `InhaltArt`, `TEST_INHALTE`), während `conventions.md` englischen Code und `CONTENT_KINDS = article|quest|character|pin|universe` festlegt. Beim Übernehmen ins MVP müssten gespeicherte Mention-Attribute (`data-art`) migriert werden.
- **Empfehlung:** `StarterKit.configure({ link: false, underline: false, … })` oder die Konfiguration direkt über `StarterKit.configure({ link: { … } })` setzen. Identifier und `art`-Werte auf die englischen `CONTENT_KINDS` umstellen, bevor der Editor ins MVP übernommen wird.
- **Abnahmekriterium:** Beim Initialisieren des Editors erscheint keine „Duplicate extension names“-Warnung in der Konsole. Ein Test prüft, dass `javascript:`-Links nicht übernommen werden. Die Mention-`art`-Werte entsprechen `CONTENT_KINDS`.

### CR-023 – Magic Numbers
- **Fundstelle:** `src/spike/rechte/repository.ts:856` (`sortOrder: Date.now() % 1_000_000`), `src/app/api/spike/*/events/route.ts:27` (`15000`), `toFixed(7)` verstreut (siehe CR-012), `src/app/api/spike/karte/upload/route.ts:79` (`8000`/`6000`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-009, T-010, T-011
- **Beschreibung:** `Date.now() % 1_000_000` läuft etwa alle 16,7 Minuten über. Neue Universen können dadurch **vor** älteren einsortiert werden, die Reihenfolge ist also faktisch zufällig. Heartbeat-Intervall und Großbild-Schwellen sind unbenannte Literale.
- **Empfehlung:** `sortOrder` als `max(sort_order) + 1` innerhalb der Welt berechnen (in derselben Transaktion). Benannte Konstanten `SSE_HEARTBEAT_MS`, `LARGE_MAP_WIDTH_PX`/`LARGE_MAP_HEIGHT_PX` einführen.
- **Abnahmekriterium:** Nacheinander angelegte Universen haben streng steigende `sort_order`. Im Spike-Code gibt es keine unbenannten numerischen Literale für Intervalle und Schwellen mehr.

---

## Prioritätenliste

1. **CR-001:** Spike-Endpunkte in Produktion schließen bzw. Allowlist einführen, Spike-Daten in den MVP-Tabellen bereinigen.
2. **CR-002, CR-010:** Test-Runner reparieren und `verify`-Job in CI, damit die folgenden Fixes abgesichert sind.
3. **CR-003, CR-004:** Identitätsfeld sperren, Weltzugehörigkeit bei Relationen prüfen (Grundlage für Plan 002/003).
4. **CR-009, CR-005, CR-008:** Laufzeitfehler: Caret-Bug, 500er bei Eingaben, Transaktionen/Races.
5. **CR-006, CR-007:** Realtime robust machen (Resync nach Reconnect, Fehlerisolation, Ein-Prozess-Grenze dokumentieren).
6. **CR-012, CR-013, CR-011:** Vor dem Ausbau in Plan 003 konsolidieren und N+1 beseitigen.
7. **CR-015, CR-014, CR-017, CR-016:** Lint grün, Frontend-Fehlerbehandlung, Env-Validierung, Upload-Härtung.
8. **CR-018 bis CR-023:** Dokumentations-Abgleich, Rechte-Kleinigkeiten, Scope-Entscheidung Pin-Sperre, Würfelformat, Editor-Extensions, Magic Numbers.
