# Code Review – 006 Monster-Marker, Stecknadel-Marker und Kartenfilter (2026-09-24)

**Baseline:** Commit `485e30eb7728e085ed2d75209ed745f702e5a862` (HEAD = T-010 aus Plan 005). **Der gesamte Code aus Plan 006 ist uncommittet** im Working Tree (geänderte und neue Dateien, vermischt mit Review-Fixes aus Plan 005). Geprüfter Stand = Working Tree am 2026-09-24.
**Task-Datei:** `.ai/feature-tasks/006-karten-marker-und-filter.md` (alle Aufgaben T-001 bis T-011 als erledigt markiert).

**Geprüfte Dateien (Kern):** `src/app/api/worlds/[worldId]/map/monster-markers/**`, `src/lib/map/{repository,types,character-marker,pin-icon,map-filter,monster-marker-events}.ts`, `src/components/map/{MapView,MapSheets,use-leaflet-map,use-map-state,use-map-realtime,use-map-filter,use-map-hotkeys,map-hotkeys}.ts(x)`, `src/lib/authz/authz.ts` (`eventForViewer`), `src/lib/realtime/events.ts`, `src/lib/domain/monsters.ts` (`publishMapsForMonster`-Aufrufe), `src/db/schema.ts`, `src/db/migrations/0022_monster_markers.sql`, Tests (`map.api.test.ts`, `rechte-matrix.api.test.ts`, `monster-markers.integration.test.ts`, Unit-Tests), `src/app/globals.css`.

**Ausgeführt beim Review:** `npm test` → 1 Test / 2 Dateien rot (`src/lib/files/*`, fehlende `DATABASE_URL`, nicht Plan 006); `npm run lint` → 3 Fehler in `src/components/files/ImageUploadField.tsx` (nicht Plan 006), Kartendateien nur `<img>`-Warnungen; `tsc --noEmit` sauber. Zusätzlich ein temporärer happy-dom-Test für `useMapFilter` (danach gelöscht) → reproduziert CR-001.

**Parallele Arbeit (Nachtrag 2026-09-24, Plan-Review):** Während dieses Reviews wurden im selben Working Tree die Findings aus `.ai/code-review-005-monster-bestiarium-2026-09-24.md` umgesetzt, und das geht weiter. Die roten Tests unter `src/lib/files/*` und die Lint-Fehler in `ImageUploadField.tsx` stammen aus dieser 005-Arbeit (005-CR-015) und sind **nicht** Teil dieses Reviews. `src/components/map/MapView.tsx` und `src/lib/domain/monsters.ts` ändern beide Pläne; Zeilenangaben können sich deshalb verschieben. Maßgeblich sind Funktions- und Symbolnamen.

## Entscheidungen aus dem Plan-Review (2026-09-24)

| # | Frage | Entscheidung |
|---|---|---|
| E1 | Koordination mit der parallelen 005-Arbeit | **Erst 005 abschließen.** Mit den Findings dieses Reviews wird erst begonnen, wenn die Fixes aus `.ai/code-review-005-monster-bestiarium-2026-09-24.md` committet sind. Danach werden die 006-Änderungen in eigenen Commits mit Präfix `(006)` festgehalten (Plan-Code zuerst, dann die Review-Fixes). Voraussetzung prüfen: `git status` zeigt keine uncommitteten 005-Dateien mehr, und `git log` enthält den 005-Review-Commit. Zeilenangaben dieses Dokuments vorher per `/review-check` gegen den dann aktuellen Code abgleichen. |
| E2 | CR-014: Was steht unter der Stecknadel? | **Erstes Wort des Namens**, wie im freigegebenen Prototyp. Der Code bleibt; CR-014 beschränkt sich auf Norm (`003-karten.md`) und Unit-Test. |
| E3 | CR-002: Position beim Antippen eines Pins/Markers im Modus | **Position des angetippten Elements + fester relativer Versatz** `MAP_TAP_STACK_OFFSET = 0.005` auf `posX` (bei Überlauf über 1 nach links). Reine Funktion `tapOnItemPosition` in `src/lib/map/map-mode.ts`. |

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Runtime-Risiken | kritisch | behoben | `useMapFilter`: ungecachter `getSnapshot` → Endlosschleife, Kartenseite stürzt ab |
| CR-002 | Aufgaben-Abgleich | mittel | behoben | K12 „Antippen eines Pins/Markers im Modus = Platzieren“ nur für Monster-Marker im Kopiermodus umgesetzt |
| CR-003 | Sicherheit | mittel | behoben | PATCH/DELETE Monster-Marker prüfen nur die Marker-Ebene, nicht Monster-Sichtbarkeit; Antwort verrät Monster-Daten |
| CR-004 | Runtime-Risiken | mittel | behoben | `deleteMonster` sendet `map.updated` vor dem Löschen → Clients laden veralteten Stand |
| CR-005 | Performance | mittel | behoben | Gefilterte Arrays pro Render neu → alle Leaflet-Icons werden bei jedem Render ersetzt |
| CR-006 | Duplizierung & Modularisierung | mittel | behoben | Monster-Marker-Repository: Serialisierung, Event-Publish, Sichtprüfung und Insert mehrfach kopiert |
| CR-007 | Aufgaben-Abgleich | mittel | behoben | T-008 abgehakt, aber Smoketest M6.1–M6.6 „offen“ und kein Commit zu 006 |
| CR-008 | Testabdeckung | mittel | behoben | Keine Tests für Filter-Hook, Moduslogik (K12), Realtime-Refetch/GET-Sichtbarkeit von Monster-Markern |
| CR-009 | Duplizierung & Modularisierung | niedrig | behoben | Client: Place/Copy, Refetch-Outcome und Leaflet-Layer-Effekt für Monster-Marker dupliziert |
| CR-010 | Toter Code | niedrig | behoben | `characterMarkerHtml`, `placeMode`-Option, Re-Export `publishMapsForMonster`, `--marker-monster`, `?? []` |
| CR-011 | Bad Practices | niedrig | behoben | Marker-Farben als Hex im TS dupliziert statt CSS-Variablen |
| CR-012 | Lesbarkeit & Wartbarkeit | niedrig | behoben | Dateiname `character-marker.ts`, doppelter `PlaceMode`-Typ, `shouldFetchPinForMap` für Monster-Marker |
| CR-013 | Bad Practices | niedrig | behoben | `setMode` führt Seiteneffekt im State-Updater aus; `onCopy` umgeht `setMode` |
| CR-014 | Aufgaben-Abgleich | niedrig | behoben | Kurzname (erstes Wort) unter der Nadel in Norm und Test festhalten (E2) |
| CR-015 | Runtime-Risiken | niedrig | behoben | Hotkeys feuern hinter dem offenen „Bild ersetzen“-Dialog |
| CR-016 | Lesbarkeit & Wartbarkeit | niedrig | behoben | `MapFilterSheet` mit `string`-Keys + Cast; Chips ohne `aria-pressed` |

---

## Findings im Detail

### CR-001 – `useMapFilter` erzeugt eine Render-Endlosschleife
- **Fundstelle:** `src/components/map/use-map-filter.ts:17-32` (`loadHidden`), `:55-60` (`useSyncExternalStore`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** kritisch
- **Bezug (Task-ID):** T-007 (mittelbar T-006, T-010, T-011: `MapView` ruft den Hook immer auf)
- **Beschreibung:** `getSnapshot` (`() => loadHidden(worldId)`) liefert bei jedem Aufruf ein **neues Array** (auch `return []`), ebenso `getServerSnapshot` (`() => [] as MapFilterCategory[]`). React vergleicht Snapshots per `Object.is`, sieht jedes Mal eine Änderung und rendert erneut. Beim Review mit happy-dom reproduziert: 55 Renders, dann `Error: Maximum update depth exceeded` plus Warnung „The result of getSnapshot should be cached to avoid an infinite loop“. Da `MapView` den Hook ohne Bedingung aufruft, betrifft das die ganze Kartenseite für alle Rollen, mit und ohne `localStorage`.
- **Empfehlung:** Snapshot pro `worldId` cachen: modulweiter `Map<worldId, { raw: string | null; value: MapFilterCategory[] }>`. `getSnapshot` liest den Rohstring und liefert das gecachte Array, solange sich der Rohstring nicht ändert. `saveHidden` aktualisiert Cache und Speicher. Für Server-Snapshot und Fehlerfall eine modulweite Konstante `const NONE: MapFilterCategory[] = []` verwenden. Optional auf das `storage`-Event hören, damit andere Tabs synchron bleiben.
- **Abnahmekriterium:** Ein Unit-Test (happy-dom, `// @vitest-environment happy-dom`, Datei `*.test.ts`) rendert eine Komponente mit `useMapFilter` und stellt fest: höchstens 2 Renders beim Mount, kein `console.error`, kein Throw. `toggle` löst genau einen weiteren Render aus. Zwei aufeinanderfolgende `getSnapshot`-Aufrufe ohne Änderung liefern dasselbe Objekt (`toBe`). Die Kartenseite lädt im Browser ohne Konsolenfehler, auch im privaten Fenster.
- **Status:** behoben — `getMapFilterSnapshot` cached den localStorage-Rohwert pro Welt und verwendet `NONE` als stabilen leeren Snapshot. Der happy-dom-Test prüft Mount, Toggle, `console.error` und Snapshot-Identität.

### CR-002 – K12 „Antippen im Modus = Platzieren“ unvollständig
- **Fundstelle:** `src/components/map/use-leaflet-map.ts:164` (Pin-Klick im Modus wird verworfen), `:226-229` (Charakter-Marker-Klick ohne Modus-Prüfung öffnet Sheet), `src/components/map/MapView.tsx:135-141` (`onMonsterMarkerClick`: im Pin-/Monster-Modus `if (placing) return;`)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, T-010, T-011 (K12 als Normregel aus T-009)
- **Beschreibung:** K12 schreibt vor: „solange ein Modus aktiv ist, öffnet Antippen eines bestehenden Pins/Markers kein Sheet, sondern zählt als Platzieren an dieser Stelle“. Umgesetzt ist das nur für Monster-Marker im Kopiermodus. Im Pin- oder Monster-Modus bewirkt ein Klick auf einen Pin oder Monster-Marker nichts (Leaflet-Marker lassen Klicks nicht zur Karte durch). Ein Klick auf einen Charakter-Marker öffnet in jedem Modus das Marker-Sheet. Im Kopiermodus öffnet ein Klick auf einen Charakter-Marker sein Sheet, obwohl der Modus aktiv bleibt, und ein Klick auf einen Pin tut nichts.
- **Empfehlung:** In `MapView` einen Handler `placeAt(x, y)` einführen, der die Logik von `onMapClick` enthält (Kopie / Monster-Picker / Pin-Anlege-Sheet). `onPinClick`, `onMarkerClick` und `onMonsterMarkerClick` rufen im aktiven Modus `placeAt(...tapOnItemPosition(item.posX, item.posY))` auf und öffnen sonst das Sheet. In `use-leaflet-map.ts` das `if (placing) return` beim Pin entfernen und die Modus-Entscheidung vollständig `MapView` überlassen.
  **Position (Entscheidung E3, Plan-Review 2026-09-24):** Es zählt die Position des angetippten Elements mit festem relativem Versatz, damit die Nadeln nicht deckungsgleich liegen. Neue reine Funktion `tapOnItemPosition(posX, posY)` in `src/lib/map/map-mode.ts` mit der Konstante `MAP_TAP_STACK_OFFSET = 0.005`. Sie liefert `{ x: posX + 0.005, y: posY }`; würde `x` größer als 1, dann stattdessen `x = posX - 0.005`. `y` bleibt unverändert. Ein Tipp auf die freie Karte nutzt weiterhin die exakte Tipp-Position.
- **Abnahmekriterium:** Im Pin-Modus öffnet ein Klick auf einen Pin, einen Charakter- oder einen Monster-Marker das Pin-Anlege-Sheet. Im Monster-Modus öffnet er den Monster-Picker. Im Kopiermodus setzt er eine Kopie. Die jeweilige Position ist `tapOnItemPosition(item.posX, item.posY)`. In keinem Modus öffnet sich ein Pin-, Marker- oder Monster-Marker-Sheet. Ohne Modus verhalten sich alle Klicks wie bisher. Ein Unit-Test für `tapOnItemPosition` deckt ab: `(0.5, 0.3)` → `(0.505, 0.3)`, `(0.998, 0.3)` → `(0.993, 0.3)`.
- **Status:** behoben — alle Klick-Handler delegieren im aktiven Modus nach `placeAt(tapOnItemPosition(...))`. Die reine Modus-Tabelle und beide Randpositionen sind getestet.

### CR-003 – PATCH/DELETE eines Monster-Markers ohne Prüfung der Monster-Sichtbarkeit
- **Fundstelle:** `src/lib/map/repository.ts:1320-1376` (`updateMonsterMarker`), `:1378-1409` (`deleteMonsterMarker`)
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-004
- **Beschreibung:** Beide Funktionen autorisieren nur über `authorizeOwnedContentWrite` mit der **Marker**-Ebene (`ownerId`/`visibility` des Markers). `getMonsterMarkerDetails` und `copyMonsterMarker` prüfen dagegen alle Ebenen (Universum, Karte, Monster, Marker; `APP-VIS-INHERIT`). Es gibt zwei Staff-Rollen (`game_master`, `master`, `isStaff`). Szenario: Game Master A hat ein Monster `owner_only` und einen Marker davon mit `gm_only`. Master B kennt die Marker-ID nicht aus dem Kartenzustand (dort wird der Marker ausgefiltert), kann den Marker aber per PATCH/DELETE ändern oder löschen. Die PATCH-Antwort enthält dann Name, Bild-URL, Seltenheit und Boss-Flag des für B unsichtbaren Monsters. Einzige Hürde ist, dass B die UUID kennen muss.
- **Empfehlung:** Nach dem Laden in beiden Funktionen dieselbe Sichtprüfung wie in `getMonsterMarkerDetails` ausführen (`canSeePublishedLayer` mit `monsterMarkerEventLayers(...)`) und sonst 404 liefern. Die Prüfung in einen gemeinsamen Helper legen (siehe CR-006), damit alle vier Pfade dieselbe Regel verwenden.
- **Abnahmekriterium:** `rechte-matrix.api.test.ts` enthält einen Fall: Game Master legt ein `owner_only`-Monster an und setzt einen Marker davon auf `gm_only`. Master bekommt für PATCH (Position) und DELETE dieses Markers **404**, und der Marker bleibt unverändert. Für den Owner funktionieren beide Aufrufe weiterhin.
- **Status:** behoben — PATCH und DELETE prüfen nun vor der Mutation die vollständige Ebenenkette. Die Rechte-Matrix deckt das `owner_only`-Monster mit `gm_only`-Marker gegen einen fremden Master ab.

### CR-004 – `map.updated` wird vor dem Löschen des Monsters gesendet
- **Fundstelle:** `src/lib/domain/monsters.ts:519-520` (`deleteMonster`: `publishMapsForMonster` vor `db.delete`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-004 (K5)
- **Beschreibung:** Die Reihenfolge ist Absicht: Nach dem CASCADE-Delete fände `publishMapsForMonster` keine Marker mehr. Dadurch geht das Event aber raus, **bevor** die Löschung committed ist. Clients laden bei `map.updated` sofort neu (`reload()`). Kommt ihr GET vor dem Commit an, bekommen sie die Marker noch einmal und behalten sie bis zum nächsten Reload. Das ist eine klassische Race Condition, und der API-Test prüft nur, dass das Event überhaupt kommt.
- **Empfehlung:** `publishMapsForMonster` aufteilen in `mapsForMonster(worldId, monsterId)` (liefert die betroffenen Karten samt Layern) und `publishMapUpdates(worldId, rows)`. In `deleteMonster`: Karten laden → löschen → Events senden. Die übrigen Aufrufer (`updateMonster`, `attach.ts`) verwenden weiter die kombinierte Funktion.
- **Abnahmekriterium:** In `deleteMonster` steht der `worldEvents.publish`-Aufruf für `map.updated` im Code nach `db.delete(monsters)`. Der bestehende SSE-Test in `map.api.test.ts` („Monster löschen erzeugt `map.updated`“) ist weiter grün. Ein direkt nach dem Event abgerufener Kartenzustand enthält keine Marker des gelöschten Monsters (Test: im Event-Handler den Kartenzustand abrufen und `monsterMarkers` prüfen).
- **Status:** behoben — `mapsForMonster` ermittelt die betroffenen Karten vor dem CASCADE-Delete; `publishMapUpdates` sendet erst danach. Der SSE-Test lädt nach dem Event den Kartenstand und sieht keine gelöschten Monster-Marker.

### CR-005 – Leaflet-Icons werden bei jedem Render neu gesetzt
- **Fundstelle:** `src/components/map/MapView.tsx:88-103` (`visiblePins`, `visibleMarkers`, `visibleMonsterMarkers`); Effekte in `src/components/map/use-leaflet-map.ts` (Pins, Charakter-Marker, Monster-Marker) mit dem jeweiligen Array als Dependency
- **Kategorie:** Performance
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-007
- **Beschreibung:** Vor Plan 006 bekam `useLeafletMap` `state.pins`/`state.markers` mit stabiler Identität. Jetzt entstehen die Arrays per `.filter()` bei **jedem** Render von `MapView` neu, etwa beim Öffnen eines Sheets, beim Moduswechsel oder bei Fehlertexten. Jeder Render führt deshalb alle drei Layer-Effekte aus, und für jeden Pin und Marker wird `setIcon` aufgerufen. Leaflet ersetzt dabei das DOM-Element, Porträt-Bilder werden neu gesetzt (Flackern) und Hover-/Fokus-Zustände gehen verloren. Bei vielen Pins wird das spürbar. Mit CR-001 wäre das eine Endlosschleife gewesen; nach dessen Fix bleibt es unnötige Arbeit.
- **Empfehlung:** Die drei Arrays mit `useMemo` bilden, Dependencies: jeweiliges State-Array, `filter.hidden` (nach CR-001 stabil) und bei Pins `state.highlightPinId`. Für `visibleMarkers`/`visibleMonsterMarkers` reicht es, das ganze Array oder ein leeres Konstanten-Array zu liefern, statt pro Element zu filtern.
- **Abnahmekriterium:** Öffnen und Schließen eines Sheets oder ein Moduswechsel ruft `setIcon` für keinen Pin und Marker auf (per Spy auf `L.Marker.prototype.setIcon` oder Log im Effekt prüfbar). Die drei Arrays in `MapView` entstehen per `useMemo`.
- **Status:** behoben — die drei sichtbaren Arrays sind per `useMemo` an ihr State-Array, den stabilen Filter-Snapshot und beim Pin an die Hervorhebung gebunden.

### CR-006 – Duplizierung im Monster-Marker-Repository
- **Fundstelle:** `src/lib/map/repository.ts:1123-1409` (`getMonsterMarkerDetails`, `placeMonsterMarker`, `copyMonsterMarker`, `updateMonsterMarker`, `deleteMonsterMarker`); `src/lib/map/monster-marker-events.ts:7-12` (`mapEventLayers`) vs. `repository.ts:193`
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-004, T-011
- **Beschreibung:** Mehrfach kopiert sind:
  - `serializeMonsterMarker({ ...row, name, portraitId, rarity, isBoss })` (5×),
  - `worldEvents.publish({ type: "map.monsterMarker…", …, layers: monsterMarkerEventLayers(6 Argumente) })` (4×),
  - die Sichtprüfung `canSeePublishedLayer(…, monsterMarkerEventLayers(…))` (2×; fehlt in 2 weiteren Pfaden → CR-003),
  - Insert, `serialize` und `publish` in `placeMonsterMarker`/`copyMonsterMarker` fast identisch, samt `try/catch` und `mapDbError`,
  - `mapEventLayers` zweimal definiert (`repository.ts` und `monster-marker-events.ts`).

  Eine Regeländerung (z. B. eine neue Ebene) muss dadurch an 4–6 Stellen nachgezogen werden, wie CR-003 zeigt.
- **Empfehlung:** Helper in `repository.ts` bzw. einem neuen `src/lib/map/monster-markers.ts`:
  - `monsterMarkerLayers(ctx, marker)`: liefert die Layer aus dem geladenen Kontext,
  - `canSeeMonsterMarker(viewer, ctx)`,
  - `toMonsterMarkerDto(row, monster)`,
  - `publishMonsterMarker(type, worldId, ctx, marker)`,
  - `insertMonsterMarker({ monsterId, mapId, pos, visibility, actorId })`: gemeinsam für Anlegen und Kopieren.

  `mapEventLayers` nur einmal exportieren (z. B. aus `monster-marker-events.ts` oder einem kleinen `layers.ts`) und in beiden Dateien verwenden.
- **Abnahmekriterium:** In `repository.ts` kommt `monsterMarkerEventLayers(` höchstens einmal außerhalb der eigenen Definition vor (im Helper). `worldEvents.publish` für `map.monsterMarker*` steht nur im Publish-Helper. `db.insert(monsterMarkers)` kommt genau einmal vor. `function mapEventLayers` ist im Repo genau einmal definiert. `map.api.test.ts` und `rechte-matrix.api.test.ts` sind unverändert grün.
- **Status:** behoben — gemeinsame Event-Layer liegen in `event-layers.ts`; Repository-Helfer zentralisieren Sichtbarkeit, DTO, Publish und Insert. Beide API-Testdateien sind grün.

### CR-007 – T-008 abgehakt, Abnahmekriterien nicht erfüllt
- **Fundstelle:** `.ai/infrastructure/smoketest.md` (Abschnitt „Plan 006“, M6.1–M6.6 alle `offen`); `.ai/feature-tasks/006-karten-marker-und-filter.md` (T-008); Git-Historie (kein Commit zu 006)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-008 (formal auch T-003 bis T-011 wegen „Commit pro Task“)
- **Beschreibung:** Laut Abnahmekriterium von T-008 sind die neuen Smoketest-Punkte „lokal durchlaufen und abgehakt“. Tatsächlich stehen M6.1–M6.6 auf „offen“, und wegen CR-001 kann die Kartenseite gar nicht geladen worden sein. Damit sind auch die manuellen Abnahmen von T-005, T-006, T-007, T-010 und T-011 nicht belegt. `.ai/roadmap.md` verlangt einen Commit pro Task; zu 006 gibt es keinen Commit.
  *Nicht Teil dieses Findings* (Plan-Review 2026-09-24): Rote Tests unter `src/lib/files/*`, Lint-Fehler in `ImageUploadField.tsx` und die Vermischung mit 005-Änderungen im Working Tree kommen aus der parallel laufenden Umsetzung des 005-Reviews und werden dort behandelt.
- **Empfehlung:** Nach CR-001 und CR-002 die Smoketest-Punkte M6.1–M6.6 tatsächlich durchlaufen und mit Datum abhaken. Die 006-Änderungen committen, Reihenfolge und Aufteilung nach E1.
- **Abnahmekriterium:** M6.1–M6.6 in `smoketest.md` stehen auf `ok` mit Datum. `npx eslint src/components/map src/lib/map "src/app/api/worlds/[worldId]/map"` meldet 0 Fehler. Die 006-bezogenen Tests (`src/lib/map/*.test.ts`, `src/components/map/*.test.ts`, `map.api.test.ts`, `rechte-matrix.api.test.ts`, `monster-markers.integration.test.ts`) sind grün. Die 006-Änderungen liegen in eigenen Commits mit Präfix `(006)`.
- **Status:** behoben — M6.1–M6.6 wurden am 2026-09-24 durch den Projektinhaber lokal abgenommen. Die vollständigen Prüfungen und der 006-Commit folgen in diesem Abschlussdurchlauf.

### CR-008 – Testlücken bei Client-Logik und Realtime-Pfad
- **Fundstelle:** `src/components/map/use-map-filter.ts` (kein Test), `src/components/map/MapView.tsx:62-69, 111-141` (Moduslogik inline), `src/components/map/use-map-realtime.ts:40-45` (`applyMapEvent` für `map.monsterMarker.deleted`), `src/app/api/worlds/[worldId]/map/monster-markers/[markerId]/route.ts:37-48` (GET)
- **Kategorie:** Testabdeckung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, T-007, T-010, T-011
- **Beschreibung:** Getestet sind die reinen Funktionen `mapHotkeyAction`, `isMapFilterVisible` und `markerPinHtml` sowie die API. Ungetestet sind:
  1. der Hook `useMapFilter` (hätte CR-001 sofort gezeigt),
  2. die Moduslogik nach K12: Übergänge, Klick auf Karte/Pin/Marker je Modus, Moduswechsel per Hotkey. Sie steckt inline in `MapView` und ist nicht isoliert testbar,
  3. `applyMapEvent` für `map.monsterMarker.deleted`,
  4. `GET /map/monster-markers/[id]` für Player bei `gm_only`-Marker oder `gm_only`-Monster. Diesen Pfad nutzt der Realtime-Refetch, und er entscheidet, ob ein Player den Marker per SSE zu sehen bekommt.
- **Empfehlung:** (1) Hook-Test mit happy-dom (siehe CR-001). (2) Die Moduslogik als reine Funktionen in `src/lib/map/map-mode.ts` ablegen (dort auch der Modus-Typ und `tapOnItemPosition` aus E3), z. B. `resolveMapTap(mode, target) → "create-pin" | "pick-monster" | "copy" | "open-sheet"` und `nextMode(current, action)`, und per Unit-Test absichern (deckt auch CR-002 ab). (3) Einen Fall in `map-refetch.test.ts` oder einem neuen `use-map-realtime.test.ts`. (4) Einen API-Fall in `map.api.test.ts`: Player-GET auf `gm_only`-Marker → 404, auf veröffentlichten Marker eines `gm_only`-Monsters → 404, auf veröffentlichten Marker eines veröffentlichten Monsters → 200.
- **Abnahmekriterium:** Es gibt Tests zu (1) bis (4) wie beschrieben, und `npm test` sowie `npm run test:rechte` sind grün. Die K12-Entscheidungen aus CR-002 (Pin-/Monster-/Kopiermodus × Karte/Pin/Charakter-Marker/Monster-Marker) sind als Tabelle im Unit-Test abgedeckt.
- **Status:** behoben — happy-dom-Hook-Test, K12-Modusmatrix, Realtime-Delete-Test und die drei GET-Sichtbarkeitsfälle sind ergänzt. Die fokussierten Unit- und Karten-API-Tests sind grün.

### CR-009 – Client-Duplizierung für Monster-Marker
- **Fundstelle:** `src/components/map/use-map-state.ts:291-331` (`placeMonsterMarker` / `copyMonsterMarker` bis auf den Body identisch), `:502-549` (`applyMonsterMarkerRefetchOutcome` ≈ `applyMarkerRefetchOutcome` ab `:434`); `src/components/map/use-leaflet-map.ts:261-320` (Monster-Layer-Effekt ≈ Charakter-Marker-Effekt `:200-259`)
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-006, T-011
- **Beschreibung:** Drei Blöcke sind jeweils fast wörtlich kopiert: Anlegen und Kopieren, die Refetch-Auswertung und der Leaflet-Layer-Sync. Eine Korrektur am Drag- oder Refetch-Verhalten muss dadurch an zwei Stellen erfolgen.
- **Empfehlung:** `postMonsterMarker(body)` als gemeinsamen Kern für Anlegen und Kopieren. Die Refetch-Auswertung generisch halten (`applyRefetchOutcome({ seqRef, deletedRef, key: "markers" | "monsterMarkers", … })`). Für Leaflet einen Helper `syncPinLayer({ map, rows, layerRef, iconFor, draggable, onClick, onDrop })` verwenden, den Charakter- und Monster-Marker gemeinsam nutzen.
- **Abnahmekriterium:** In `use-map-state.ts` gibt es genau einen `fetch`/`apiFetch` mit `POST` auf `/map/monster-markers`. `applyMonsterMarkerRefetchOutcome` existiert nicht mehr als eigene Kopie. In `use-leaflet-map.ts` teilen sich Charakter- und Monster-Marker eine Sync-Funktion. Drag, Klick und Realtime verhalten sich unverändert (Smoketest M6.2, M6.6).
- **Status:** behoben — Anlegen und Kopieren teilen `postMonsterMarker`; Refetch-Auswertung liegt in `applyRefetchOutcome`; Charakter- und Monster-Nadeln verwenden `syncMarkerPinLayer`. Die bestätigten Smoketests M6.2 und M6.6 sichern das Verhalten ab.

### CR-010 – Toter Code
- **Fundstelle:**
  - `src/lib/map/character-marker.ts:40-43` (`characterMarkerHtml`, `@deprecated`, nur noch im eigenen Test verwendet),
  - `src/components/map/use-map-hotkeys.ts:12` (Option `placeMode` wird übergeben, aber nie gelesen),
  - `src/lib/map/repository.ts:1093-1094` (Re-Export `publishMapsForMonster`, alle Aufrufer importieren aus `monster-marker-events`),
  - `src/app/globals.css:23` (`--marker-monster` wird nirgends verwendet),
  - `?? []` auf das nicht-optionale `MapState.monsterMarkers` (8× in `use-map-state.ts`/`use-map-realtime.ts`, 1× in `MapView.tsx:101`).
- **Kategorie:** Toter Code
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004, T-005, T-010
- **Beschreibung:** Diese Reste stammen aus Umbauten und suggerieren Varianten oder Zustände, die es nicht gibt (z. B. ein fehlendes `monsterMarkers`-Feld).
- **Empfehlung:** `characterMarkerHtml` samt Test entfernen, die Option `placeMode` aus Signatur und Aufruf streichen, den Re-Export löschen. `--marker-monster` wird durch CR-011 verwendet (nicht entfernen). `?? []` durch direkten Zugriff ersetzen.
- **Abnahmekriterium:** `grep -rn "characterMarkerHtml\|monsterMarkers ?? \[\]" src` liefert nichts. `useMapHotkeys` hat keine `placeMode`-Option. `repository.ts` enthält kein `export { publishMapsForMonster }`. Jede in `globals.css` definierte `--marker-*`-Variable wird mindestens einmal verwendet.
- **Status:** behoben — Legacy-Renderer, ungenutzte Hotkey-Option, Re-Export und nicht-optionale Fallbacks sind entfernt; `--marker-monster` wird für die SVG-Nadel verwendet.

### CR-011 – Marker-Farben doppelt gepflegt
- **Fundstelle:** `src/lib/map/character-marker.ts:5-12` (`VARIANT_COLORS` mit `#c9a227`, `#141414`, `#e8e4dc`, `#3d2e08`), `:23` (`#fff7ed`); `src/app/globals.css:22-25`, `:1590` (`#fff7ed`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005
- **Beschreibung:** Laut Plan werden die Farben als CSS-Variablen `--marker-character`/`--marker-monster` geführt. Der Renderer schreibt dieselben Werte aber als Hex in das SVG. Der Kommentar „Matches … globals.css“ ist die einzige Kopplung. Eine Farbänderung in CSS wirkt nur auf den Kopfring, nicht auf die Nadel.
- **Empfehlung:** Die festen `fill`/`stroke`-Attribute aus dem SVG entfernen und die Farben per CSS in `globals.css` setzen. Variablen (in `:root`, Werte unverändert): bestehend `--marker-character: #c9a227`, `--marker-monster: #141414`, `--marker-monster-outline: #e8e4dc`; neu `--marker-character-outline: #3d2e08` und `--marker-head-bg: #fff7ed`. Regeln: `.map-marker-pin.character .pin-body path { fill: var(--marker-character); stroke: var(--marker-character-outline); }`, `.map-marker-pin.monster .pin-body path { fill: var(--marker-monster); stroke: var(--marker-monster-outline); }`, `.map-marker-pin .pin-body circle { fill: var(--marker-head-bg); }`; `.map-marker-pin .head { background: var(--marker-head-bg); }` statt `#fff7ed`. `stroke-width="2"` darf im SVG bleiben. `VARIANT_COLORS` entfällt; die Klasse ist der Variantenname.
- **Abnahmekriterium:** `character-marker.ts` (bzw. `marker-pin.ts`) enthält keine Hex-Farbwerte mehr. Wenn nur `--marker-character` in `globals.css` geändert wird, ändern sich Nadel und Ring des Charakter-Markers im Browser.
- **Status:** behoben — SVG nutzt nur Klassen; Füllung, Kontur und Kopf-Hintergrund liegen in CSS-Variablen.

### CR-012 – Benennung und doppelte Typen
- **Fundstelle:** `src/lib/map/character-marker.ts` (enthält den generischen `markerPinHtml`); `type PlaceMode` doppelt in `src/components/map/MapView.tsx:26` und `src/components/map/use-map-hotkeys.ts:6`; `src/components/map/use-map-state.ts:598` (`shouldFetchPinForMap` für Monster-Marker)
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005, T-010
- **Beschreibung:** Der Dateiname passt nicht mehr zum Inhalt (Stecknadel für Charakter und Monster). `PlaceMode` ist zweimal unabhängig definiert und kann auseinanderlaufen. `shouldFetchPinForMap` wird für Charakter- und Monster-Marker verwendet, der Name suggeriert aber, dass es nur um Pins geht.
- **Empfehlung:** Datei in `src/lib/map/marker-pin.ts` umbenennen (Test ebenso). Den Modus-Typ einmal in `src/lib/map/map-mode.ts` exportieren (siehe E3, CR-008, CR-013); `MapView.tsx` und `use-map-hotkeys.ts` importieren ihn von dort. `shouldFetchPinForMap` in `isEventForCurrentMap` umbenennen.
- **Abnahmekriterium:** `markerPinHtml` liegt in `marker-pin.ts`. `type PlaceMode =` kommt in `src/` genau einmal vor. Kein Aufruf von `shouldFetchPinForMap` bezieht sich auf Marker.
- **Status:** behoben — der Renderer liegt in `marker-pin.ts`, der Modus-Typ zentral in `map-mode.ts`, und `isEventForCurrentMap` beschreibt die gemeinsame Verwendung korrekt.

### CR-013 – Seiteneffekt im State-Updater von `setMode`
- **Fundstelle:** `src/components/map/MapView.tsx:62-70` (`queueMicrotask(() => setCopySource(null))` innerhalb von `setPlaceMode(updater)`), `:486` (`onCopy` ruft `setPlaceMode("copy")` direkt auf)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-010, T-011
- **Beschreibung:** State-Updater müssen rein sein; im StrictMode ruft React sie doppelt auf. Modus und Kopierquelle sind zwei getrennte States, die per Microtask synchron gehalten werden, und `onCopy` umgeht den Wrapper. Das ist schwer nachvollziehbar und lässt Zwischenzustände zu, etwa `mode === "copy"` mit `copySource === null`. In diesem Fall fällt `onMapClick` in den Pin-Zweig und öffnet das Pin-Anlege-Sheet.
- **Empfehlung:** Einen einzigen State als diskriminierte Union verwenden: `type MapMode = { kind: "none" } | { kind: "pin" } | { kind: "monster" } | { kind: "copy"; source: MonsterMarkerDto }`. Der Hotkey-Hook arbeitet mit `kind`. Kein `queueMicrotask`.
- **Abnahmekriterium:** `MapView.tsx` enthält kein `queueMicrotask` und keinen separaten `copySource`-State. Der Kopiermodus ist ohne Quelle per Typ nicht darstellbar. Hotkeys und FAB funktionieren wie in T-010/T-011 beschrieben.
- **Status:** behoben — `MapMode` ist eine diskriminierte Union; nur die `copy`-Variante trägt eine Quelle. Der State-Updater ist rein.

### CR-014 – Kurzname unter der Nadel nicht als Regel dokumentiert
- **Fundstelle:** `src/lib/map/character-marker.ts:33` (`const short = … split(/\s+/)[0]`); `.ai/decisions/003-karten.md` (Abschnitt zur Stecknadel-Darstellung aus Plan 006, T-001)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-001, T-005
- **Beschreibung:** K4 legt fest: „Der Name bleibt unter der Nadel“. Die Umsetzung zeigt nur das erste Wort, wie im freigegebenen Prototyp (`spikes/ui-prototype/index.html`, `markerPinHtml`: `name.split(" ")[0]`). **Entscheidung E2 (Plan-Review 2026-09-24): Das erste Wort bleibt**; der Code wird nicht geändert. Offen ist nur, dass die Norm die Kürzung nicht nennt und der Unit-Test sie nicht absichert.
- **Empfehlung:** In `.ai/decisions/003-karten.md`, Abschnitt Stecknadel-Darstellung, ergänzen: „Beschriftung = erstes Wort des Namens (Leerzeichen-getrennt), gilt für Charakter- und Monster-Marker; Entscheidung Projektinhaber 2026-09-24“. In `character-marker.test.ts` (bzw. `marker-pin.test.ts` nach CR-012) einen Fall ergänzen.
- **Abnahmekriterium:** `003-karten.md` enthält die Regel „erstes Wort“ mit Datum 2026-09-24. Ein Unit-Test prüft, dass `markerPinHtml({ name: "Alter Schattenwolf", imageUrl: null, variant: "monster" })` `>Alter</span>` enthält und nicht `Schattenwolf</span>`. Der Code in `markerPinHtml` bleibt beim ersten Wort.
- **Status:** behoben — ADR-003 dokumentiert die Regel mit Datum, und der Renderer-Test deckt „Alter Schattenwolf“ ab.

### CR-015 – Hotkeys aktiv hinter dem „Bild ersetzen“-Dialog
- **Fundstelle:** `src/components/map/MapView.tsx:154` (`sheetOpen: sheet.kind !== "none"`), `:56` (`replaceConfirm` als eigener State)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-010
- **Beschreibung:** K10 verbietet Hotkeys bei offenem Sheet. Der `ReplaceImageDialog` hängt aber an `replaceConfirm` und nicht an `sheet`. Ist er offen, starten `P`/`M` hinter dem Dialog einen Platziermodus.
- **Empfehlung:** `sheetOpen: sheet.kind !== "none" || replaceConfirm` übergeben.
  **Abhängigkeit zu 005:** Die 005-Fixes (005-CR-015, `ImageUploadField`) bauen den Bild-Upload in `MapView` um. Gibt es nach dem 005-Commit (E1) keinen `ReplaceImageDialog` bzw. `replaceConfirm` mehr, entfällt dieses Finding. `/review-check` setzt es dann auf `verworfen`. Hat 005 einen anderen Dialog eingeführt, gilt die Regel sinngemäß für dessen Offen-Zustand.
- **Abnahmekriterium:** Bei offenem „Bild ersetzen“-Dialog ändern `P`, `M` und `Esc` den Platziermodus nicht. Das ist manuell oder über den Aufrufparameter geprüft.
- **Status:** behoben — `replaceConfirm` zählt beim Hotkey-Hook als offener Dialog.

### CR-016 – Typverlust und Barrierefreiheit im Filter-Sheet
- **Fundstelle:** `src/components/map/MapSheets.tsx` (`MapFilterSheet`: `cats`/`hidden`/`onToggle` als `string`), `src/components/map/MapView.tsx:532` (`key as MapFilterCategory`)
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-007
- **Beschreibung:** Das Sheet ist mit `string` typisiert, deshalb braucht `MapView` einen Cast. Ein Tippfehler bei den Keys fällt dem Compiler nicht auf. Die Chips zeigen ihren Zustand nur optisch (Durchstreichen, Opazität) und nicht für Screenreader.
- **Empfehlung:** Props mit `MapFilterCategory` typisieren (oder generisch `<K extends string>`). Den Cast entfernen. An jedem Chip `aria-pressed={on}` setzen.
- **Abnahmekriterium:** In `MapView.tsx` gibt es kein `as MapFilterCategory`. Jeder Filter-Chip hat `aria-pressed`. `tsc --noEmit` ist grün.
- **Status:** behoben — Filter-Props verwenden `MapFilterCategory`, der Cast entfällt und die Chips erhalten `aria-pressed`.

---

## Prioritätenliste

**Voraussetzung (E1):** Beginn erst nach dem Commit der 005-Review-Fixes; vorher `/review-check` für dieses Dokument ausführen.

1. **CR-001**: Die Kartenseite ist ohne diesen Fix nicht benutzbar; alle anderen UI-Abnahmen hängen daran.
2. **CR-003**: Rechte-Lücke bei PATCH/DELETE, am besten zusammen mit **CR-006** (gemeinsame Helper stellen die einheitliche Prüfung sicher).
3. **CR-002**: K12-Normregel vollständig umsetzen, zusammen mit **CR-013** (Modus als Union) und dem K12-Teil von **CR-008**.
4. **CR-004**: Race beim Löschen eines Monsters.
5. **CR-005**: `useMemo` für gefilterte Arrays (nach CR-001).
6. **CR-008**: Übrige Testlücken schließen (Hook, Realtime, GET-Sichtbarkeit).
7. **CR-007**: Smoketest durchlaufen, 006 committen.
8. Aufräumen: **CR-009**, **CR-010**, **CR-011**, **CR-012**, **CR-014**, **CR-015**, **CR-016**.
