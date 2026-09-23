# Code Review – Plan 003 (MVP-Funktionen)

**Baseline:** Commit `fa7e34797d2ae708a421ae974f4557e2a82a6ff0` (`main`). Uncommittete Änderungen im Working Tree zum Review-Zeitpunkt nur in `.ai/backlog.md` (geändert) und `.ai/feature-tasks/004-quest-kapitel-und-owner-sichtbarkeit.md` (neu). Beide sind Dokumente, kein Code.
**Geprüfte Task-Datei:** `.ai/feature-tasks/003-mvp-funktionen.md`
**Geprüfte Aufgaben (`[x]`):** T-001 bis T-016, T-018, T-019 (T-017 ist offen und nicht Teil des Reviews).
**Hinweis zum Stand:** Die Baseline enthält auch Commits nach Plan 003 (u. a. `1068ad6` Mehrere Karten pro Universum). Geprüft wurde der Code, der die Aufgaben aus Plan 003 heute umsetzt, also in diesem Stand.
**Zusätzlich ausgeführt:** `npm test` (27 Dateien, 134 Tests grün), `npm run lint` (0 Fehler, 5 Warnungen `no-img-element`), `npm run typecheck` (grün). `npm run test:rechte` / `test:triggers` wurden nicht ausgeführt, weil sie eine laufende DB brauchen.

## Umsetzungsrahmen (Entscheidung Projektinhaber, Plan-Review 2026-09-23)

- **Kein eigener Plan.** `/plan-run` arbeitet dieses Dokument direkt ab. Die IDs `CR-XXX` sind zugleich die Task-IDs; es gibt keine `T-XXX`-IDs. Eine Aufgabe ist erledigt, wenn ihr **Abnahmekriterium** erfüllt ist; dann setzt `/plan-run` in der Tracking-Tabelle den Status auf `behoben` (im selben Commit).
- **Reihenfolge:** siehe *Prioritätenliste* am Ende und die Zeile *Abhängigkeiten* je Finding.
- **Commit & Push:** Es gilt `.ai/conventions.md` *Commit & Push*: ein Commit pro Finding mit der CR-ID in der Nachricht (z. B. `CR-001: SSE-Events nach Sichtbarkeit filtern`). Vorher laufen `npm test`, `npm run lint` und `npm run typecheck` und, wenn betroffen, `npm run test:rechte`. **Nie automatisch pushen.**
- **Keine Push-Sperre:** Plan 003 T-017 (Prod-Push und Smoketest) wartet **nicht** auf diese Findings, auch nicht auf CR-001. Das Risiko ist bewusst akzeptiert: Bis CR-001 ausgerollt ist, können Player in Produktion `gm_only`-Pins und Marker verborgener Karten über den SSE-Stream sehen.

## Begriffe & Normen

Maßgeblich sind `.ai/architecture/datenmodell-fachlich.md` (fachliche Regeln, Vorrang), `.ai/architecture/datenmodell.md` (technisches Schema, `APP-*`-Regeln in Abschnitt 12, Löschregeln), `.ai/conventions.md` (Sprache, Commit & Push, Rechtefälle zuerst in `src/lib/authz` + Test) und `.ai/architecture/README.md` (genau eine App-Replica, In-Process-Realtime). Begriffe aus Plan 003 (*Begriffe & Systeme*) gelten weiter. Kurz zu den Begriffen in diesem Dokument:

- **Spielleitung / Staff:** Rollen `game_master` und `master` (`isStaff`). **Player:** Rolle `player`.
- **`gm_only` / `published`:** Sichtbarkeitsstatus („nur Spielleitung“ / „veröffentlicht“). Player sehen `gm_only` nie.
- **APP-VIS-INHERIT:** Sichtbarkeit vererbt sich nach unten: Universum → Karte → Pin/Marker. Sichtbar ist etwas nur, wenn jede Ebene sichtbar ist (`canSeePublishedLayer`).
- **APP-AUTHZ:** gemeinsame Rechteschicht `src/lib/authz`. Archivierte Mitgliedschaft zählt als Nicht-Mitglied.
- **APP-QUEST-PART:** Quest-Beteiligte müssen in die Welt mitgebracht sein (`datenmodell.md`: „ggf. später archivierte“ Teilnahme bleibt zulässig).
- **APP-PART-REACTIVATE:** Wird ein Charakter erneut in eine Welt mitgebracht, wird die archivierte Teilnahme reaktiviert (`archived_at` geleert), nicht neu angelegt.
- **APP-REL-RECALC:** Beim Speichern einer Quelle werden deren automatische Relationen (`mention`, `template_field`, `participation`) neu berechnet; `manual` bleibt.
- **APP-FILE-GC:** Dateien ohne verbleibende Referenz werden aus `files` und vom Volume entfernt (`src/lib/files/gc.ts`).
- **SSE / Live-Leitung:** *Server-Sent Events*. Der Browser öffnet einmal `GET /api/worlds/[id]/events` und hält die Verbindung offen; der Server schickt darüber Ereignisse (Chat, Karte). Serverseitig verteilt der **Bus** (`src/lib/realtime/bus.ts`, `worldEvents`) jedes Ereignis an alle offenen Leitungen der Welt. **Resync:** Nach einem Neuverbinden (zweites `hello`) lädt der Client seinen Zustand neu (`nextHello`).
- **Rechte-Matrix:** `src/app/api/rechte-matrix.api.test.ts`, läuft mit `npm run test:rechte` gegen einen lokalen Dev-Server mit `ENABLE_TEST_LOGIN=true` (Helfer `src/test/api-harness.ts`).
- **Review 001:** `.ai/code-review-001-mvp-infrastruktur-2026-09-22.md`; dessen IDs werden hier immer mit „aus Review 001“ gekennzeichnet.

## Tracking

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Sicherheit | kritisch | behoben | SSE-Events der Karte gehen ungefiltert an alle Mitglieder: Player erhalten `gm_only`-Pins (Titel, Beschreibung), Marker und Karten-Events verborgener Karten |
| CR-002 | Sicherheit | mittel | behoben | Offene SSE-Verbindung bleibt nach Austritt/Entfernen aktiv und liefert weiter Chat- und Karten-Events |
| CR-003 | Sicherheit | mittel | offen | `GET /api/files/[id]` prüft nur die Anmeldung, nicht Welt-Mitgliedschaft oder Sichtbarkeit |
| CR-004 | Fehlerbehandlung & Validierung | mittel | offen | Vorlagen-Verweis mit Nicht-UUID-`id` führt zu HTTP 500 (Verstoß gegen CR-005 aus Review 001) |
| CR-005 | Aufgaben-Abgleich | mittel | offen | Quest mit Beteiligtem, dessen Teilnahme archiviert oder dessen Charakter gelöscht ist, lässt sich nicht mehr speichern bzw. verliert den Namens-Snapshot |
| CR-006 | Runtime-Risiken | mittel | offen | Mehrstufige Schreibvorgänge (Artikel, Quest, Pin, Universum + Relationen/Beteiligte) ohne Transaktion |
| CR-007 | Testabdeckung | mittel | offen | Keine Tests für Inhalt und Filterung der SSE-Events und für die Autorisierung der Dateiauslieferung |
| CR-008 | Runtime-Risiken | niedrig | offen | `placeMarker` publiziert `map.marker.deleted` innerhalb der Transaktion (vor dem Commit) und löscht in einer Schleife |
| CR-009 | Sicherheit | niedrig | offen | `POST /api/files` liest den ganzen Body in den Speicher, bevor die Größe geprüft wird |
| CR-010 | Duplizierung & Modularisierung | niedrig | offen | Chat-Limits: lokale Funktion `CHANNEL_NAME_MAX()` überschattet die Konstante, Literal `80` dreifach; Karten-Route dupliziert `MAP_NAME_MAX` und „20 MB“ |
| CR-011 | Toter Code | niedrig | offen | `createMapWithImage` ist als `@deprecated … kept for API tests` markiert, wird aber von der Produkt-Route genutzt |
| CR-012 | Performance | niedrig | offen | Sichtbarkeitsfilter in JS statt SQL (Artikel-, Quest-, Tagebuchliste, Suche ohne SQL-`LIMIT`) |
| CR-013 | Runtime-Risiken | niedrig | offen | „Letzter aktiver Kanal“ wird nicht atomar geprüft: parallele Archivierungen können alle Kanäle archivieren |
| CR-014 | Bad Practices | niedrig | offen | `GET …/chat` schreibt (`ensureDefaultChannel` bei jedem Laden) |
| CR-015 | Lesbarkeit & Wartbarkeit | niedrig | offen | Datei-GC kennt die referenzierenden Tabellen nur als hartkodierte SQL-Liste |
| CR-016 | Aufgaben-Abgleich | niedrig | offen | Review 001 führt CR-004, CR-021, CR-023 noch als `offen`, obwohl der Plan „kein Finding `offen`“ und Nachführen im Task-Commit verlangt |
| CR-017 | Sicherheit | mittel | behoben | Rollenwechsel wirkt nicht live: Karte und SSE-Leitung behalten die alte Rolle (z. B. SL-Karte bleibt nach Herabstufung sichtbar). Nachgetragen im Plan-Review 2026-09-23 |

---

## Findings im Detail

### CR-001 – SSE verteilt verborgene Karteninhalte an Player
- **Fundstelle:** `src/app/api/worlds/[worldId]/events/route.ts:12-21`; Publisher in `src/lib/map/repository.ts` (`createPin` :567, `updatePin` :641, `placeMarker` :736/:761, `moveMarker` :801, `deleteMarker` :818, `createMap`/`updateMap`/`deleteMap`); `src/lib/files/attach.ts:186`; Client `src/components/map/use-map-realtime.ts:28-32`
- **Kategorie:** Sicherheit
- **Schweregrad:** kritisch
- **Bezug (Task-ID):** T-012, T-013
- **Beschreibung:** Die SSE-Route leitet jedes Event der Welt an jedes aktive Mitglied weiter, gefiltert nur nach `worldId`. `map.pin` enthält das vollständige `PinDto` (Titel, `descriptionJson`, `descriptionPlain`, Position, Sichtbarkeit). Legt die Spielleitung einen Pin mit Default `gm_only` an oder verschiebt/bearbeitet einen `gm_only`-Pin, bekommt jeder Player den Inhalt über den Stream. `applyMapEvent` prüft keine Sichtbarkeit und fügt den Pin sogar live in die Karte des Players ein, wenn er dieselbe Karte offen hat. Dasselbe gilt für Pins und Marker auf `gm_only`-Karten bzw. in `gm_only`-Universen. Wird ein Pin von `published` auf `gm_only` gestellt, entfernt ihn der Client des Players nicht. Das bricht T-013 Abnahmekriterium (8) und APP-VIS-INHERIT und ist nur im Netzwerk-Tab sichtbar, deshalb fallen es Browser-Abnahmen nicht auf.
- **Empfehlung:** Filterung serverseitig pro Abonnent in der SSE-Route: Rolle aus `req.context.membership` mitnehmen und für `map.*`-Events die Sichtbarkeit prüfen (Pin: Universum + Karte + Pin über `canSeePublishedLayer`; Marker/Karte: Universum + Karte). Dazu die Sichtbarkeitsschichten ins Event aufnehmen (z. B. `layers: VisibilityStatus[]`), damit die Route nicht pro Event die DB fragt. Für Player bei Wechsel auf unsichtbar ein `map.pin.deleted` senden statt `map.pin`. Die Prüfung gehört in `src/lib/authz` (eine Funktion `canReceiveWorldEvent(role, event)`), nicht in die Route.
- **Abhängigkeiten:** keine, CR-001 kommt zuerst. CR-017 folgt direkt danach und hält die Rolle der Leitung aktuell; bis dahin behält ein herabgestufter Master bis zum Neuladen den Master-Filter. Die Filtertests aus CR-007 gehören in denselben Commit.
- **Abnahmekriterium:** Ein automatisierter Test abonniert als Player und als Master denselben Welt-Stream. Anlegen, Verschieben und Bearbeiten eines `gm_only`-Pins sowie eines `published`-Pins auf einer `gm_only`-Karte erzeugen beim Master je ein `map.pin`-Event, beim Player keines. Umstellen eines Pins von `published` auf `gm_only` erzeugt beim Player `map.pin.deleted`. Marker-Events auf einer `gm_only`-Karte erreichen den Player nicht.

### CR-002 – SSE-Verbindung überlebt Austritt und Entfernen
- **Fundstelle:** `src/app/api/worlds/[worldId]/events/route.ts:12-21`, `src/lib/realtime/sse.ts`, `src/lib/domain/members.ts` (`removeMember`, `leaveWorld`)
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-007, T-012
- **Beschreibung:** Die Mitgliedschaft wird nur beim Verbindungsaufbau geprüft. Ein vom Game Master entferntes Mitglied (oder eine abgelaufene Sitzung) empfängt über den offenen Stream weiter alle Chat-Nachrichten und Karten-Events der Welt, bis der Tab geschlossen wird. Der Heartbeat prüft nichts.
- **Empfehlung (festgelegt, Plan-Review 2026-09-23: nur Signal):** Beim Archivieren einer Mitgliedschaft (`removeMember`, `leaveWorld`) ein internes Event `membership.changed` mit `worldId` und `userId` auf den Bus legen. Dasselbe Event nutzt CR-017 für Rollenwechsel. Die SSE-Route merkt sich die `userId` des Abonnenten, leitet dieses Event nie an den Client weiter und schließt bei Übereinstimmung den Stream (`stop`). **Keine** periodische Prüfung im Heartbeat. Bewusst akzeptiert: Läuft eine Anmeldung im Hintergrund ab, liest ein schon offener Tab weiter, bis die Leitung einmal abreißt. Beim Neuverbinden antwortet der Server mit 401, und der Browser gibt auf.
- **Abhängigkeiten:** keine. Gleicher Mechanismus wie CR-017, am besten im selben Zug umsetzen.
- **Abnahmekriterium:** Test: Player verbindet sich mit `/api/worlds/[id]/events`, der Game Master entfernt ihn; danach gesendete Chat-Nachrichten erreichen den Stream nicht mehr, und der Stream wird geschlossen. Gleiches nach `POST …/leave`.

### CR-003 – Dateiauslieferung ohne Weltbezug
- **Fundstelle:** `src/app/api/files/[id]/route.ts:12-36`
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-004
- **Beschreibung:** Jede angemeldete Person liefert jede Datei aus, deren UUID sie kennt: Kartenbilder verborgener Karten, Titelbilder von `gm_only`-Artikeln, Bildanhänge fremder Charaktere. Ehemalige Mitglieder behalten Zugriff auf alle Bild-IDs, die sie gesehen haben (Browser-Cache, Verlauf, kopierte Links). T-004 verlangt „authentifiziert ausliefern“, die Rechteschicht (APP-VIS-INHERIT) greift hier aber gar nicht. Die UUIDs sind zufällig, deshalb ist das Risiko auf bekannte IDs begrenzt; `Cache-Control: immutable` verlängert es.
- **Empfehlung (festgelegt, Plan-Review 2026-09-23):** In `src/lib/files/` eine Funktion `authorizeFileRead(userId, fileId)`. Sie bestimmt über die referenzierende Zeile, wem das Bild gehört, und wendet dieselben Regeln wie die UI an (Entscheidung in `src/lib/authz`, Datenzugriff in `src/lib/files`):
  - **Welt-Titelbild** (`worlds.title_image_id`): aktives Mitglied der Welt.
  - **Kartenbild** (`maps.image_id`): aktives Mitglied, und `canSeePublishedLayer(role, [Universum, Karte])`.
  - **Artikel-Titelbild** (`articles.title_image_id`): aktives Mitglied, und `canSeeVisibility(role, Artikel)`.
  - **Charakter-Profilbild und -Bildanhang** (`characters.portrait_id`, `character_images.file_id`): wie der Charakterbogen (T-008). Der Besitzer darf immer; andere nur als aktives Mitglied einer Welt, in die der Charakter mit **nicht archivierter** Teilnahme mitgebracht ist.
  - **Nicht referenzierte Datei:** nur der Hochlader (`files.created_by`).
  Nicht erlaubt → 404 (wie bei unbekannter ID, damit IDs nichts verraten). Die Route nutzt nur diese Funktion.
- **Cache (festgelegt):** `Cache-Control: private, max-age=31536000, immutable` bleibt. Bewusst akzeptiert: Ein ausgetretenes Mitglied behält bereits geladene Bilder im Browser-Cache. Die Prüfung greift nur bei neuen Abrufen.
- **Abhängigkeiten:** keine.
- **Abnahmekriterium:** API-Test: Ein Player erhält für das Bild einer `gm_only`-Karte und das Titelbild eines `gm_only`-Artikels 404, der Master 200. Ein Benutzer ohne Mitgliedschaft in der Welt erhält für das Welt-Titelbild 404. Ein ausgetretenes Mitglied erhält für ein Kartenbild derselben Welt 404. Das Profilbild eines Charakters liefert dem Besitzer 200, einem Mitglied einer Welt, in die der Charakter mitgebracht ist, 200, und einem Benutzer ohne solche gemeinsame Welt 404. Der Cache-Header ist unverändert.

### CR-004 – Vorlagen-Verweis mit ungültiger ID ergibt 500
- **Fundstelle:** `src/lib/domain/articles.ts:103-150` (`assertRefTargets`), `:199-238` (`toPatch`), `:251-270` (`createArticle`, `toPatch` vor `try`); `src/lib/templates/fields.ts:19-29` (`parseRefValue`)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-009 (CR-005 aus Review 001 „anwenden“)
- **Beschreibung:** `parseRefValue` akzeptiert jede nichtleere Zeichenkette als `id`. `assertRefTargets` fragt die DB mit `inArray(articles.id, articleIds)` ab, bevor es `parseUuid` prüft. PostgreSQL wirft `22P02` (ungültige UUID). Weil `toPatch` außerhalb des `try` mit `mapDbError` läuft, wird daraus ein unbehandelter Fehler → HTTP 500. Beispiel: `POST /api/worlds/<id>/articles` mit `{"title":"X","templateType":"person","templateFields":{"location":{"kind":"article","id":"abc"}}}`.
- **Empfehlung:** Die UUID bereits in `parseRefValue` prüfen (`parseUuid`, sonst `null` → 400 „akzeptiert dieses Ziel nicht“) und in `assertRefTargets` die Prüfung vor die Queries ziehen.
- **Abhängigkeiten:** keine.
- **Abnahmekriterium:** Der oben genannte Request liefert 400 mit deutscher Meldung, nicht 500. Ein Test in `articles.api.test.ts` deckt Anlegen und Bearbeiten mit Nicht-UUID-Verweis ab.

### CR-005 – Quest-Beteiligte nach Austritt oder Löschen
- **Fundstelle:** `src/components/quests/QuestForm.tsx:45-47`, `src/lib/domain/quests.ts:118-165` (`resolveParticipants`, `replaceParticipants`), `updateQuest`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-011 (Abnahmekriterium 3), T-007 (Austritt)
- **Beschreibung:** Das Formular übernimmt alle Beteiligten mit `characterId` als angehakt. (a) Ist die Teilnahme eines Beteiligten archiviert (Player ausgetreten), lehnt `resolveParticipants` jedes Speichern der Quest mit 400 „Nur mitgebrachte Charaktere …“ ab, auch wenn nur der Titel geändert wird. Die Spielleitung muss den Charakter abwählen und verliert damit den Snapshot. (b) Ist der Charakter gelöscht (`characterId` null), filtert das Formular ihn heraus; `replaceParticipants` löscht alle Zeilen und fügt nur die übergebenen neu ein. Nach dem nächsten Speichern ist der festgehaltene Name weg. T-011 (3) gilt damit nur, bis die Quest das nächste Mal bearbeitet wird.
- **Festgelegtes Verhalten (Plan-Review 2026-09-23):**
  - **Ausgetreten** (Teilnahme archiviert): Der Beteiligte bleibt als Snapshot (Name ohne Link). Wird der Charakter wieder in die Welt mitgebracht (`APP-PART-REACTIVATE`), ist er automatisch wieder normaler Beteiligter mit Link. Die Anzeige leitet den Link heute schon aus der aktiven Teilnahme ab (`loadParticipants`, `href`).
  - **Gelöscht** (`character_id` null): Der Beteiligte bleibt dauerhaft als Snapshot.
  - **Name:** Solange die Teilnahme aktiv ist, zeigen Quest und Formular den **aktuellen** Charakternamen (Join auf `characters.name`). Der gespeicherte `character_name` gilt nur als Anzeige, solange der Charakter ausgetreten oder gelöscht ist. Beim Speichern wird der Snapshot für aktive Beteiligte auf den aktuellen Namen gesetzt.
  - **Entfernen:** Snapshot-Beteiligte stehen im Formular als eigene Zeile mit dem Hinweis „nicht mehr in der Welt“ und einem ✕. Nur über dieses ✕ werden sie entfernt, nie durch bloßes Speichern.
- **Empfehlung:** Die API bekommt statt der vollständigen Liste Änderungen: `addParticipantIds` (werden gegen APP-QUEST-PART geprüft, nur aktiv mitgebrachte Charaktere) und `removeParticipantIds` (dürfen jeden bestehenden Beteiligten dieser Quest nennen, auch Snapshots; Snapshots gelöschter Charaktere über die ID der `quest_participants`-Zeile). `replaceParticipants` wird durch Einfügen/Löschen genau dieser Einträge ersetzt; alle anderen Zeilen bleiben unberührt. Das Formular schickt nur die Änderungen. Wird `participantIds` (vollständige Liste) weiter angenommen, gilt dieselbe Regel: Nicht genannte Snapshot-Beteiligte bleiben erhalten.
- **Abhängigkeiten:** keine.
- **Abnahmekriterium:** API-Tests: (1) Quest mit Beteiligtem A; As Player tritt aus; `PATCH` nur mit neuem Titel → 200, A bleibt als Snapshot ohne Link. (2) A wird wieder mitgebracht → A erscheint ohne weiteres Speichern mit Link; nach Umbenennen von A zeigt die Quest den neuen Namen. (3) Charakter B wird gelöscht; `PATCH` mit geänderten anderen Beteiligten → Bs Name steht weiterhin ohne Link in der Quest. (4) `PATCH` mit Entfernen des Snapshots von B → B ist weg. (5) Hinzufügen eines nicht mitgebrachten Charakters wird weiterhin mit 400 abgelehnt.

### CR-006 – Mehrstufige Schreibvorgänge ohne Transaktion
- **Fundstelle:** `src/lib/domain/articles.ts` (`createArticle`, `updateArticle`: Insert/Update, danach `recalcArticleRelations`); `src/lib/domain/quests.ts` (`createQuest`, `updateQuest`: Update, `replaceParticipants` = Delete + Insert, `recalcQuestRelations`); `src/lib/map/repository.ts` (`createPin`, `updatePin`: Schreiben, danach `recalcOutgoingMentions` in eigener Transaktion); vergleichbar in `src/lib/domain/universes.ts`
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-009, T-010, T-011, T-013 (Muster aus CR-008 in Review 001)
- **Beschreibung:** Scheitert der zweite oder dritte Schritt (DB-Fehler, Trigger, Abbruch), bleibt ein halber Stand: Artikel gespeichert, Relationen alt; Quest-Beteiligte gelöscht, aber nicht neu eingefügt (Datenverlust); Pin angelegt, Erwähnungen fehlen. Beim Anlegen läuft der Fehler zudem in `mapDbError` und liefert z. B. 400, obwohl der Datensatz schon existiert.
- **Empfehlung:** Die Recalc-Funktionen (`recalcOutgoingMentions`, `recalcArticleRelations`, `recalcQuestRelations`, `replaceParticipants`) einen `tx`-Parameter annehmen lassen und je Domänenaufruf alles in einer `db.transaction` ausführen. Realtime-Events erst nach dem Commit publizieren.
- **Abhängigkeiten:** keine. CR-008 baut darauf auf (Events nach dem Commit).
- **Abnahmekriterium:** In `articles.ts`, `quests.ts`, `universes.ts` und bei Pins laufen Hauptschreibvorgang und Relations-/Beteiligten-Neuberechnung in derselben Transaktion (Code-Review prüfbar: keine `db.`-Schreibaufrufe außerhalb des `tx` in diesen Funktionen). Ein Integrationstest erzwingt einen Fehler in der Neuberechnung und zeigt, dass der Hauptdatensatz unverändert bleibt.

### CR-007 – Fehlende Tests für Realtime-Filter und Dateiauslieferung
- **Fundstelle:** `src/app/api/worlds/[worldId]/events/route.ts`, `src/app/api/files/[id]/route.ts`; Testdateien `*.api.test.ts`
- **Kategorie:** Testabdeckung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-004, T-012, T-013, T-015
- **Beschreibung:** Kein Test liest den SSE-Stream oder prüft, welche Events welche Rolle bekommt; `bus.test.ts` prüft nur die Fehlerisolation. Die Rechte-Matrix (`rechte-matrix.api.test.ts`) deckt die Dateiauslieferung und Realtime nicht ab. Genau dort liegen CR-001 bis CR-003. Die Route ist schwer testbar, weil Filterlogik und Stream-Aufbau zusammenhängen.
- **Empfehlung:** Die Filterentscheidung als reine Funktion in `src/lib/authz` (siehe CR-001) mit Unit-Tests; zusätzlich ein API-Test, der den Stream per `fetch` liest (erste Events nach Aktion, dann `abort`). Die Rechte-Matrix um Zeilen für `GET /api/files/[id]` erweitern.
- **Abhängigkeiten:** CR-001, CR-002, CR-003, CR-017. Die Tests entstehen jeweils mit dem Fix; CR-007 ist erledigt, wenn alle genannten Tests vorhanden sind.
- **Abnahmekriterium:** `npm test` enthält Unit-Tests für die Event-Filterfunktion (alle `map.*`-Typen × Rollen × Sichtbarkeiten). `npm run test:rechte` enthält mindestens einen Stream-Test und die Dateifälle aus CR-003.

### CR-008 – Marker-Events vor dem Commit
- **Fundstelle:** `src/lib/map/repository.ts:728-760` (`placeMarker`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-013
- **Beschreibung:** In der Transaktion wird für jeden früheren Marker einzeln gelöscht und sofort `map.marker.deleted` publiziert. Scheitert danach das Insert (z. B. Unique-Verletzung), rollt die DB zurück, die Clients haben den Marker aber schon entfernt. Die Schleife ist zudem eine Query pro Zeile (CR-011 aus Review 001), auch wenn es praktisch nur eine ist.
- **Empfehlung:** Frühere Marker mit einem `DELETE … WHERE character_id = $1 RETURNING id, map_id` entfernen, die gelöschten IDs aus der Transaktion zurückgeben und alle Events nach dem Commit publizieren.
- **Abhängigkeiten:** CR-006 (gleiches Muster „publizieren nach Commit“), vorher oder im selben Zug.
- **Abnahmekriterium:** `placeMarker` enthält kein `worldEvents.publish` innerhalb von `db.transaction` und keine Query in einer Schleife.

### CR-009 – Upload liest vor der Größenprüfung alles ein
- **Fundstelle:** `src/app/api/files/route.ts:40-46`
- **Kategorie:** Sicherheit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004
- **Beschreibung:** `Buffer.from(await file.arrayBuffer())` lädt die ganze Datei, erst `inspectImage` prüft das Limit. Die Karten-Route prüft `file.size` vorher, diese Route nicht. `proxyClientMaxBodySize` in `next.config.ts` greift nur, wenn eine Proxy-/Middleware-Datei existiert (im Repo gibt es keine). Ein angemeldetes Konto kann damit große Bodies in den Speicher des einzigen App-Replicas schicken.
- **Empfehlung:** Vor `arrayBuffer()` `file.size` gegen das Limit der Bildart prüfen (Limit-Auswahl aus `attach.ts` in eine gemeinsame Funktion `maxBytesFor(kind)` ziehen). Optional `Content-Length` vorab prüfen.
- **Abhängigkeiten:** keine.
- **Abnahmekriterium:** Ein Upload mit `kind=article_title` und 11 MB wird mit 400 abgelehnt, ohne dass `arrayBuffer()` aufgerufen wird (Code prüfbar; Test mit großem `File`).

### CR-010 – Doppelte Limits im Chat und in der Karten-Route
- **Fundstelle:** `src/lib/chat/repository.ts:375, 468, 494-496, 514`; `src/lib/chat/types.ts:5-6`; `src/app/api/worlds/[worldId]/map/route.ts:122-131`
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-012, T-013 (Fortsetzung von CR-023 aus Review 001)
- **Beschreibung:** `types.ts` exportiert `CHANNEL_NAME_MAX` und `THREAD_TITLE_MAX`, das Repository nutzt sie nicht, sondern eine lokale Funktion `CHANNEL_NAME_MAX()` (Name wie eine Konstante, überschattet den Export) und zweimal das Literal `80`. Die Fehlermeldungen enthalten „80“ fest. In der Karten-Route stehen `"höchstens 20 MB"` und `.slice(0, 120)` statt `MAP_IMAGE_MAX_BYTES` bzw. `MAP_NAME_MAX`.
- **Empfehlung:** Die Konstanten aus `types.ts` bzw. `repository.ts`/`inspect.ts` importieren und Meldungen daraus bilden; die Funktion `CHANNEL_NAME_MAX()` entfernen.
- **Abhängigkeiten:** keine.
- **Abnahmekriterium:** `grep -n "80" src/lib/chat/repository.ts` findet kein Längenlimit mehr; `CHANNEL_NAME_MAX()` existiert nicht; die Karten-Route enthält weder `20 MB` noch `120` als Literal.

### CR-011 – `createMapWithImage` falsch als veraltet markiert
- **Fundstelle:** `src/lib/map/repository.ts:411` (`@deprecated Prefer createMap + file attach; kept for API tests`), genutzt in `src/app/api/worlds/[worldId]/map/route.ts:133`
- **Kategorie:** Toter Code
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-013
- **Beschreibung:** Die Funktion ist laut Kommentar nur für Tests da, ist aber der Multipart-Pfad der Produkt-Route. Entweder ist der Kommentar falsch, oder der Multipart-Pfad ist toter Produktcode, den nur Tests brauchen. Die Funktion dupliziert zudem die Universum-Prüfung aus `createMap` und prüft `saved.image.width` erneut, obwohl `inspectImage` das schon garantiert.
- **Geklärt (Plan-Review 2026-09-23):** Die UI nutzt den Multipart-Pfad nicht. Sie legt Karten per JSON an (`createMap`) und lädt das Bild über `POST /api/files` hoch (`use-map-state.ts`, `replaceImage`). Plan 002 soll später auch schreiben können, z. B. von ChatGPT erzeugte Bilder per MCP hochladen. MCP ruft dafür die Domänenfunktionen auf, nicht die HTTP-Formular-Route.
- **Empfehlung (festgelegt: Route weg, Domäne sauber):** Den Multipart-Zweig in `POST /api/worlds/[worldId]/map` entfernen; die Route nimmt nur noch JSON an (anderer `Content-Type` → 415 mit deutscher Meldung). `createMapWithImage` bleibt als **Domänenfunktion** erhalten, wird aber aus `createMap` + `attachImage` (bzw. einer aus `attachImage` gezogenen Funktion für das Kartenbild) zusammengesetzt. Damit gibt es genau eine Prüfstelle für Format, Größe und Rechte. `@deprecated` entfällt; der Kommentar nennt den Zweck „Karte mit Bild in einem Schritt für Clients ohne Browser, z. B. MCP (Plan 002)“. API-Tests nutzen `createMap` + `POST /api/files`; die Domänenfunktion bekommt einen eigenen Test.
- **Abhängigkeiten:** keine.
- **Abnahmekriterium:** `POST /api/worlds/[id]/map` mit `multipart/form-data` liefert 415. `createMapWithImage` ruft `createMap` und die gemeinsame Bildanbindung auf, statt Universum-Prüfung, `persistImage` und Insert selbst zu duplizieren. Kein `@deprecated` mehr in `repository.ts`. Ein Test legt über `createMapWithImage` eine Karte mit Bild an und prüft, dass ein GIF abgelehnt wird.

### CR-012 – Sichtbarkeit in JS gefiltert
- **Fundstelle:** `src/lib/domain/articles.ts:167-181` (`listArticles`), `src/lib/domain/quests.ts` (`listQuests`), `src/lib/domain/journal.ts:71-104` (`listJournal`), `src/lib/domain/search.ts` (je Art ohne SQL-`LIMIT`, `slice` erst nach dem Zusammenführen)
- **Kategorie:** Performance
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-008, T-009, T-011, T-014
- **Beschreibung:** Es werden alle Zeilen geladen und danach nach Sichtbarkeit bzw. Vorlagentyp gefiltert. Bei `listJournal` landen dadurch auch private Tagebuchtexte anderer im Speicher des Servers, bevor sie verworfen werden. Die Suche lädt je Art alle Treffer, obwohl höchstens 50 ausgegeben werden. Für MVP-Datenmengen unkritisch, skaliert aber linear mit der Welt.
- **Empfehlung:** Sichtbarkeit und Vorlagenfilter als `WHERE` (für Player `visibility = 'published'`, beim Tagebuch `owner = viewer OR visibility = 'shared_with_gm' AND staff`), in der Suche je Art `LIMIT limit` setzen. Die JS-Prüfung mit `canSeeVisibility` kann als zweite Absicherung bleiben.
- **Abhängigkeiten:** keine.
- **Abnahmekriterium:** Die genannten Queries enthalten die Sichtbarkeitsbedingung im SQL; `listJournal` lädt für einen Player keine fremden `private`-Zeilen; jede Such-Teilquery hat ein `LIMIT`.

### CR-013 – Letzter Kanal: Prüfung nicht atomar
- **Fundstelle:** `src/lib/chat/repository.ts:531-545` (`updateChannel`, Aktion `archive`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-012 (Abnahmekriterium 10)
- **Beschreibung:** Erst `count(*)` der aktiven Kanäle, dann `UPDATE`. Zwei gleichzeitige Archivierungen der letzten beiden Kanäle sehen beide `2` und archivieren beide. Danach hat die Welt keinen aktiven Kanal; `ensureDefaultChannel` legt beim nächsten Laden still einen neuen „Allgemein“ an.
- **Empfehlung:** Bedingtes Update in einer Anweisung (`UPDATE … WHERE id = $1 AND (SELECT count(*) FROM chat_channels WHERE world_id = $2 AND archived_at IS NULL) > 1`) oder Transaktion mit `SELECT … FOR UPDATE` auf die aktiven Kanäle der Welt.
- **Abhängigkeiten:** keine. CR-014 setzt auf diesem Fix auf.
- **Abnahmekriterium:** Die Prüfung „letzter aktiver Kanal“ und das Archivieren erfolgen in einer Anweisung bzw. unter Sperre; ein Test mit zwei parallelen Archivierungen lässt genau einen Kanal aktiv.

### CR-014 – Schreibzugriff im GET des Chats
- **Fundstelle:** `src/lib/chat/repository.ts:175` (`loadChatState` → `ensureDefaultChannel`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-012
- **Beschreibung:** Jeder Chat-Aufruf prüft und legt ggf. einen Kanal an, auch für Player. Seit T-007 entsteht „Allgemein“ beim Anlegen der Welt in derselben Transaktion; der Fallback verdeckt Fehler (z. B. CR-013) und macht ein GET zu einem Schreibvorgang mit eigenem Race-Handling.
- **Klarstellung (Plan-Review 2026-09-23):** Der Fallback greift nur, wenn eine Welt **keinen einzigen aktiven Kanal** hat. Der Name spielt keine Rolle; ein umbenannter Standardkanal („Allgemein“ → „Chat“) löst nichts aus.
- **Empfehlung (festgelegt: Fallback raus, ohne Migration):** `ensureDefaultChannel` aus `loadChatState` entfernen (und die Funktion, falls danach ungenutzt). Hat eine Welt keinen aktiven Kanal, liefert `GET …/chat` einen leeren Zustand (`channel: null`, keine Nachrichten, Staff sieht weiterhin archivierte Kanäle), nicht 404. Die Chat-Oberfläche zeigt dann: für die Spielleitung „Noch kein aktiver Kanal. Lege einen an oder stelle einen archivierten wieder her.“ mit der vorhandenen Kanalverwaltung; für Player „Noch kein aktiver Kanal. Die Spielleitung kann einen anlegen.“ Der Composer ist ausgeblendet. Keine Datenmigration. Der Randfall aus CR-013 wird dort verhindert.
- **Abhängigkeiten:** CR-013 sollte vorher oder im selben Zug umgesetzt werden.
- **Abnahmekriterium:** `loadChatState` führt keine Insert-Anweisung aus. API-Test: Eine Welt, deren Kanäle alle per DB archiviert wurden, liefert auf `GET …/chat` 200 mit `channel: null`, und danach existiert weiterhin kein aktiver Kanal. Browser-Prüfung: Hinweistexte wie oben für Spielleitung und Player, kein Composer.

### CR-015 – Datei-GC mit hartkodierter Referenzliste
- **Fundstelle:** `src/lib/files/gc.ts:11-37`
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004, T-007
- **Beschreibung:** Welche Tabellen auf `files` verweisen, steht nur als fünf `NOT EXISTS`-Fragmente im Roh-SQL. Kommt ein neuer Bildverweis hinzu (z. B. Quest-Bild), löscht der GC die Datei trotzdem; bei FKs mit `ON DELETE SET NULL` (Welt, Artikel, Charakter) verschwindet das Bild dann still.
- **Empfehlung:** Die Liste als benannte Konstante neben dem Schema führen (Tabelle + Spalte über Drizzle-Spaltenobjekte statt Strings) und einen Test ergänzen, der alle FKs auf `files.id` aus dem Schema mit dieser Liste vergleicht.
- **Abhängigkeiten:** keine.
- **Abnahmekriterium:** Ein Test schlägt fehl, sobald eine Spalte mit FK auf `files.id` existiert, die der GC nicht prüft.

### CR-016 – Status von Review 001 nicht nachgeführt
- **Fundstelle:** `.ai/code-review-001-mvp-infrastruktur-2026-09-22.md` (Tracking: CR-004, CR-021, CR-023 `offen`)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-002, T-007, T-010, T-012 (Regel aus *Code-Review zu Plan 001*)
- **Beschreibung:** Der Plan verlangt, die Status-Spalte im Task-Commit nachzuführen, und dass bei Abschluss kein Finding `offen` ist. CR-004 ist umgesetzt (`createManualRelation` prüft beide Enden über `loadEnd`, T-010), CR-021 laut Code ebenfalls (`dice-format.ts`, Vorzeichen, `dicePostToChat` im Roll-Pfad), steht aber noch auf `offen`. CR-023 hat noch offene Reste (siehe CR-010 dieses Reviews). Außerdem wartet laut T-016 das Produktions-Cleanup (CR-001 Teil 3) noch auf Freigabe, während CR-001 bereits `behoben` ist.
- **Empfehlung:** `/review-check` für Review 001 laufen lassen; CR-004 und CR-021 nach Prüfung auf `behoben`, CR-023 erst nach CR-010 dieses Reviews. CR-001 bis zum Produktions-Cleanup mit Vermerk führen.
- **Abhängigkeiten:** CR-010 (Rest von CR-023 aus Review 001). Als letztes Finding umsetzen.
- **Abnahmekriterium:** Review 001 hat kein Finding mit Status `offen`, dessen Abnahmekriterium im Code erfüllt ist; CR-001 trägt einen Vermerk zum ausstehenden Produktions-Cleanup oder dieser ist erledigt.

### CR-017 – Rollenwechsel wirkt nicht live
- **Fundstelle:** `src/lib/domain/members.ts` (`changeMemberRole`, publiziert kein Event), `src/app/api/worlds/[worldId]/events/route.ts`, `src/components/map/MapView.tsx:50-52` (`onResync`), `src/lib/realtime/use-realtime.ts`
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-007, T-012, T-013
- **Herkunft:** Nachgetragen im Plan-Review am 2026-09-23 nach einer Beobachtung des Projektinhabers: Nach der Herabstufung von Master zu Player blieb die offene SL-Karte sichtbar.
- **Beschreibung:** Karte und Chat laden ihren Zustand mit der Rolle zum Ladezeitpunkt und aktualisieren sich live nur bei Welt-Ereignissen (z. B. `map.updated`). Ein Rollenwechsel publiziert nichts. Deshalb sieht ein herabgestufter Master verborgene Karten, Pins und Staff-Aktionen, bis er selbst neu lädt. Laut Git-Historie hat ein Rollenwechsel nie ein Live-Ereignis ausgelöst. Nach dem Fix von CR-001 bekäme eine offene Leitung, die sich die Rolle beim Öffnen merkt, außerdem weiter Master-Ereignisse. CR-001 wäre ohne diesen Punkt also lückenhaft.
- **Empfehlung (festgelegt, Plan-Review 2026-09-23: Leitung neu aufbauen):** `changeMemberRole` legt nach dem Update dasselbe Event `membership.changed` (`worldId`, `userId`) auf den Bus wie CR-002. Die SSE-Route schließt bei Übereinstimmung die Leitung dieser Person. Der Browser (`EventSource`) verbindet sich automatisch neu. Die Route liest dabei Mitgliedschaft und Rolle frisch (`openWorldRequest`), und das zweite `hello` löst über den vorhandenen Resync (`nextHello`, CR-006 aus Review 001) ein Neuladen von Karte bzw. Chat aus. Ist die Person entfernt, lehnt die Route das Neuverbinden mit 403 ab (CR-002). Die Rolle darf in der SSE-Route beim Öffnen gemerkt werden, weil jede Änderung die Leitung neu aufbaut. Mehrere Tabs derselben Person werden alle geschlossen.
- **Abhängigkeiten:** gemeinsamer Mechanismus mit CR-002; Voraussetzung dafür, dass der Rollenfilter aus CR-001 aktuell bleibt.
- **Abnahmekriterium:** (1) API-Test: Ein Master hat den Welt-Stream offen. Der Game Master stuft ihn zum Player herab. Der Stream wird geschlossen. Ein neu geöffneter Stream erhält für einen danach angelegten `gm_only`-Pin kein `map.pin`. (2) Browser-Prüfung: Master hat eine `gm_only`-Karte offen. Nach der Herabstufung durch den Game Master verschwindet die Karte ohne manuelles Neuladen innerhalb weniger Sekunden. Umgekehrt erscheint sie nach Hochstufung zum Master.

---

## Prioritätenliste

1. **CR-001** (kritisch) — Pins und Marker verborgener Inhalte gehen live an Player. Zuerst beheben, zusammen mit **CR-007** (Tests für den Filter). Kein Blocker für den Push aus Plan 003 T-017 (siehe *Umsetzungsrahmen*).
2. **CR-017**, **CR-002** — ein gemeinsamer Mechanismus (`membership.changed` schließt die Live-Leitung), damit der Filter aus CR-001 die aktuelle Rolle nutzt und Ausgetretene nichts mehr empfangen. Danach **CR-003** (Dateiauslieferung).
3. **CR-004**, **CR-005** — sichtbare Fehler im Normalbetrieb (500 bei Vorlagen-Verweis, Quest nach Austritt nicht speicherbar bzw. Snapshot-Verlust).
4. **CR-006** — Transaktionen für Domänen-Schreibvorgänge; danach **CR-008** (Events nach dem Commit) im selben Zug.
5. **CR-009**, **CR-013**, **CR-014** — kleinere Robustheitsthemen.
6. **CR-010**, **CR-011**, **CR-012**, **CR-015** — Aufräumen und Performance.
7. **CR-016** — Review 001 per `/review-check` nachführen.
