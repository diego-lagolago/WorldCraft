# Code Review – 012 v1.0 Release (zweites Review)

**Baseline:** Commit `4af38f68ced6e366dd9c1222af5b0c0e40b2e02d` (`main`, Working Tree sauber)
**Geprüfte Task-Datei:** `.ai/feature-tasks/012-v1-release.md`
**Geprüfte Aufgaben (erledigt `[x]`):** T-001–T-011. T-012 (Release/Push) und T-013 (E2E-Lauf 2) sind offen und nicht Teil dieses Reviews; der nach dem ersten Review entstandene Code (E10 `relation_anlegen` mit Bestätigung, `e0e794e`; Hash-Fix `4af38f6`; `d170ab6`, `db7f415`) wurde mitgeprüft, weil er die Aufgaben T-004–T-008 berührt.
**Review-Datum:** 2026-09-30
**Vorgänger:** `.ai/code-review-012-v1-release-2026-09-29.md` (Baseline `bc10f1f`, CR-001–CR-008, alle „behoben“). Die IDs dieses Dokuments beginnen wieder bei CR-001 und sind unabhängig vom Vorgänger; Verweise auf den Vorgänger sind als „Review 1 CR-00x“ geschrieben.
**Methode:** Statische Prüfung des Codes unter `src/lib/mcp/`, `src/app/upload/[ticket]/route.ts` und der berührten Domänenfunktionen. Es wurden in diesem Review **keine Tests ausgeführt**; Aussagen über Laufzeitverhalten sind aus dem Code abgeleitet. Die reinen Dokumentationsaufgaben (T-001, T-002, T-010) wurden nur auf Widersprüche zum Code geprüft.

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Runtime-Risiken | mittel | behoben | Erneutes Lesen nach dem Schreiben liegt in allen Update-Handlern weiter innerhalb der Stub-Kompensation (Rest von Review 1 CR-001) |
| CR-002 | Aufgaben-Abgleich | mittel | offen | `@[Name](teilnahme:id)` wird als Charakter-ID an die Domäne gereicht und dort abgelehnt; E8 / D18 für Quests mit gelöschten Beteiligten nicht erfüllt |
| CR-003 | Runtime-Risiken | mittel | offen | Kürzung auf 20 000 Zeichen schneidet bei langen Texten Bestätigungs-Token, Quittungsende und Schreibschlüssel-Block ab; Ausschnitte zeigen nicht verlässlich die geänderte Stelle |
| CR-004 | Aufgaben-Abgleich | mittel | offen | Charakterblatt-Unterfelder sind im Schema `z.unknown()` ohne Form und erlaubte Werte; Verweisziele fehlen in den Feldbeschreibungen (E1/E5) |
| CR-005 | Fehlerbehandlung & Validierung | niedrig | offen | Lebensraum ohne Ort-Vorlage und doppelte Relation werden erst nach der Bestätigung abgelehnt |
| CR-006 | Aufgaben-Abgleich | niedrig | offen | Bei Vorlagentyp-Wechsel entfallende Vorlagenfelder fehlen in Vorschau (ohne `vorlagenfelder`) und in der Quittung |
| CR-007 | Aufgaben-Abgleich | niedrig | offen | Vorschau von `inhalt_anlegen` mit Stubs zeigt kein Delta der anzulegenden Felder |
| CR-008 | Lesbarkeit & Wartbarkeit | niedrig | behoben | Delta entsteht durch Zurückparsen gerenderter „Label: Wert“-Texte; mehrzeilige Werte und Leerzeilen erzeugen falsche Einträge |
| CR-009 | Testabdeckung | niedrig | offen | Vollständigkeitstest des Feldkatalogs ist für die echte Registry tautologisch; `FIELD_CATALOG_COMPLETE` und `allowedValuesFor` ungenutzt |
| CR-010 | Duplizierung & Modularisierung | niedrig | offen | Quittungen von `relation_anlegen` und Upload-Link sind von Hand gebaut statt über `formatReceipt` |
| CR-011 | Runtime-Risiken | niedrig | offen | `unionError` ruft `reduce` ohne Startwert auf einer möglicherweise leeren Liste auf |
| CR-012 | Fehlerbehandlung & Validierung | niedrig | offen | `beteiligte` in anderer Reihenfolge gilt als Änderung statt „Keine Änderung“ |
| CR-013 | Performance | niedrig | behoben | Jeder bestätigte Schreibvorgang liest das Ziel vier- bis fünfmal, inklusive doppelt gerenderter Vorlagen-Verweise |

---

### CR-001
- **Fundstelle:** `src/lib/mcp/tools/update/article.ts:99`, `update/monster.ts:131`, `update/quest.ts:53`, `update/chapter.ts:36`, `update/universe.ts:30`, `update/world.ts:39–44` (jeweils in `execute`), aufgerufen aus `src/lib/mcp/tools/content-update.ts:63–77` (`write`-Callback von `withMcpStubCompensation`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-008, T-011 (Review 1 CR-001)
- **Beschreibung:** Review 1 CR-001 hat den Quittungs-Snapshot aus der Stub-Kompensation herausgezogen. Jeder Update-Handler liest aber nach dem erfolgreichen Domänen-Schreibvorgang das Ziel selbst noch einmal (`visibleArticle`, `visibleMonster`, `visibleQuest`, `findVisibleChapter`, `visibleUniverse`, `getWorldDetails` + `worldStand`), um `title`, `stand` und `visibility` zurückzugeben. Dieses Lesen liegt weiterhin im `write`-Callback. Wirft es (Datenbankfehler, „Inhalt nicht gefunden“), löscht `withMcpStubCompensation` die bereits referenzierten Stub-Artikel, und der Client erhält einen Fehler, obwohl die Änderung gespeichert ist – genau das Fehlerbild von Review 1 CR-001.
- **Empfehlung (Plan-Review F5: Handler liefern nur die ID):** `UpdateResult` wird `{ id: string; stand?: string }`. Jedes `execute` unter `src/lib/mcp/tools/update/` gibt nach dem Domänenaufruf nur `{ id }` zurück, ohne erneutes Lesen; nur der Notizblock setzt `stand` aus `saved.data.version`. `executeUpdate` übergibt an `receiptAfterWrite` als `result` den Titel und die Sichtbarkeit aus dem `before`-Snapshot sowie das optionale `stand` des Handlers. Titel, Stand und Sichtbarkeit der Quittung kommen im Normalfall aus dem Nachher-Snapshot (`receiptAfterWrite` muss dafür `title` und `visibility` aus `after` statt aus `result` verwenden, wie heute schon). Scheitert der Snapshot, nennt die Fallback-Quittung den Titel von vorher, „Stand: –“ und den bestehenden Hinweis, dass die Änderungsübersicht nicht geladen werden konnte, ergänzt um „Bitte vor der nächsten Änderung neu lesen.“ Die Create-Handler sind nicht betroffen (sie lesen nicht nach).
- **Abnahmekriterium:** In keinem `execute` unter `src/lib/mcp/tools/update/` steht nach dem Domänenaufruf ein weiterer Loader-Aufruf (`visible*`, `findVisibleChapter`, `getWorldDetails`, `worldStand`). Unit-Test: Ein nach erfolgreichem `updateArticle` werfender `visibleArticle` führt nicht zu `compensateMcpStubArticles` und liefert eine Quittung mit „Gespeichert.“, dem Titel von vorher und „Stand: –“. `npm run test:mcp` bleibt grün (Quittungen nennen weiter den neuen Stand).
- **Umsetzung (2026-09-30):** Alle Update-Handler geben nach dem Domänenaufruf nur noch die ID zurück (der Notizblock zusätzlich seine gespeicherte Version). Der Quittungs-Snapshot wird außerhalb der Stub-Kompensation geladen; bei dessen Fehler nutzt die Quittung Titel und Sichtbarkeit aus dem Vorher-Snapshot, `Stand: –` sowie den Hinweis zum erneuten Lesen. Unit-, Lint- und Typprüfung sind grün.

### CR-002
- **Fundstelle:** `src/lib/mcp/write-shared.ts:32–43` (`resolveParticipantIds`), Aufrufer `src/lib/mcp/tools/update/quest.ts:32,49` und `create/quest.ts:22`; Domäne `src/lib/domain/quests.ts:138–167` (`resolveParticipants`)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, T-009 (E8)
- **Beschreibung:** `inhalt_lesen` gibt Beteiligte gelöschter Charaktere als `@[Name](teilnahme:<id>)` aus (ID der Zeile in `quest_participants`). `resolveParticipantIds` gibt diese ID unverändert in die Liste zurück, die als `participantIds` an `updateQuest`/`createQuest` geht. Die Domäne behandelt `participantIds` ausschließlich als Charakter-IDs mit aktiver Teilnahme und antwortet bei jeder anderen ID mit „Nur mitgebrachte Charaktere dieser Welt können beteiligt werden.“ Folge: Das unveränderte Zurückschreiben einer Quest mit einem gelöschten Beteiligten (E8, `002` D18) scheitert – und zwar erst nach der Bestätigung, weil die Vorschau die ID nicht gegen die Domäne prüft. Zusätzlich wird eine beliebige UUID hinter `teilnahme:` ohne jede Prüfung angenommen. Für diesen Pfad gibt es keinen Test (`teilnahme` kommt in keiner Testdatei vor).
- **Empfehlung (Plan-Review F2: „Snapshots bleiben immer“):** `resolveParticipantIds` liefert getrennt `{ characterIds, snapshotIds }`. Nur `characterIds` gehen als `participantIds` an die Domäne. `snapshotIds` werden bei `inhalt_aendern` gegen die Teilnahme-Zeilen der Quest geprüft (`row.participants`, Einträge ohne aktiven Charakter); eine unbekannte ID ist ein Werkzeugfehler mit `felder.beteiligte`. Snapshots werden per MCP **nie entfernt**, auch wenn sie in der Liste fehlen (`removeParticipantIds` wird nicht verwendet); Entfernen geht nur in der App. Vorschau und „Keine Änderung“ vergleichen deshalb nur die aktiven Charaktere. Bei `inhalt_anlegen` ist `teilnahme:` ein Werkzeugfehler. Die Katalogbeschreibung von `beteiligte` (`field-catalog.ts`) ersetzt „bleiben beteiligt, solange sie mitgeschickt werden“ durch „bleiben immer beteiligt und können per MCP nicht entfernt werden“; E8 im Plan `012` erhält denselben Nachsatz.
- **Abnahmekriterium:** Integrationstest in `npm run test:mcp`: Quest mit einem Beteiligten, dessen Charakter gelöscht wurde → `inhalt_lesen` → `beteiligte` unverändert zurückschreiben ergibt „Keine Änderung“; zusammen mit einer Titeländerung wird die Änderung nach Bestätigung gespeichert und der Snapshot bleibt; `beteiligte` **ohne** den `teilnahme:`-Eintrag lässt den Snapshot ebenfalls bestehen (allein geschickt: „Keine Änderung“); eine fremde UUID hinter `teilnahme:` ergibt schon in der Vorschau einen Fehler mit `felder.beteiligte`; `inhalt_anlegen` Quest mit `teilnahme:` ergibt einen Fehler. Die Feldbeschreibung von `beteiligte` und E8 enthalten den neuen Wortlaut.

### CR-003
- **Fundstelle:** `src/lib/mcp/tools/shared.ts:56–59` (`text`), betroffen `src/lib/mcp/write-rich.ts:130–152` (`formatConfirmationPreview`), `src/lib/mcp/receipt.ts:221–246` (`formatReceipt`), `src/lib/mcp/tools/content-read.ts` (Block „Schreibschlüssel“ am Ende)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, T-007, T-008
- **Beschreibung:** Jede Werkzeugantwort wird auf 20 000 Zeichen gekürzt (vorne behalten, hinten „_(gekürzt)_“). Seit T-007 enthält die Vorschau den **vollständigen** neuen bzw. anzuhängenden Text, und Token sowie Ablaufzeit stehen am Ende. Bei einem Text ab etwa 19 000 Zeichen wird das Bestätigungs-Token abgeschnitten: Die Änderung ist vorgemerkt, kann aber nicht bestätigt werden, und der Client erfährt nicht warum. Ebenso verliert die Quittung bei langem „jetzt“-Text die Stub-Liste und Hinweise, und `inhalt_lesen` verliert bei langen Artikeln den Block „Schreibschlüssel“ (E6). Die Markdown-Felder haben im Schema keine Längengrenze.
- **Empfehlung (Plan-Review F3: Inhalt gezielt kürzen, Ausschnitt zeigt verlässlich die geänderte Stelle):** Die pauschale Kürzung in `text()` bleibt nur als letztes Sicherheitsnetz; die Formatierer sorgen selbst dafür, dass die Antwort unter der Grenze bleibt und Token, „Gültig bis“, Stub-Liste, Hinweise und der Block „Schreibschlüssel“ immer enthalten sind. Gekürzt wird ausschließlich Rich-Text, nach diesen Regeln (eine gemeinsame Funktion in `change-format.ts`, genutzt von Vorschau und Quittung; Budget je Rich-Text-Wert als benannte Konstante, z. B. `RICH_CHANGE_BUDGET = 6000`):
  1. **Der Ausschnitt richtet sich nach der Änderung, nie nach dem Textanfang.** Es wird nie „die ersten N Zeichen“ des Gesamttexts gezeigt, wenn die Änderung woanders liegt.
  2. **`anhaengen`:** „bisher“ = die letzten 500 Zeichen des bestehenden Texts (wie heute); „wird angehängt“ bzw. in der Quittung „angehängt“ = der angehängte Text vollständig, solange er ins Budget passt. Ist er länger, erscheinen sein Anfang und sein Ende (je die Hälfte des Budgets) mit der Zeile „… (<n> Zeichen nicht dargestellt; gespeichert wird der vollständige Text) …“ dazwischen.
  3. **`ersetzen`:** Alter und neuer Text werden in gerenderter Form verglichen; gemeinsamer Anfang und gemeinsames Ende werden abgeschnitten, gezeigt wird der **geänderte Bereich** alt („bisher“) und neu („neu“) mit je bis zu 200 Zeichen unverändertem Kontext davor und danach, eingeleitet durch „… (<n> Zeichen davor unverändert)“ bzw. abgeschlossen durch „(<n> Zeichen danach unverändert) …“. Überschreitet der geänderte Bereich selbst das Budget, gilt für ihn Regel 2 (Anfang und Ende, Auslassung mit Zeichenzahl). Die heutige Darstellung „erste 500 Zeichen“ (`headExcerpt`) entfällt.
  4. **Quittung:** `richDelta` nutzt dieselbe Funktion (angehängter Teil bzw. geänderter Bereich), nicht den vollständigen „jetzt“-Text.
  5. **`inhalt_lesen`:** Der Block „Schreibschlüssel“ steht vor dem Fließtext (nach den Kopfzeilen und Feldern); wird gekürzt, dann der Fließtext am Ende mit dem Hinweis „(gekürzt; <n> Zeichen nicht dargestellt)“.
  6. Jede Kürzung ist im Text als solche gekennzeichnet und nennt die Zahl der ausgelassenen Zeichen. T-007 („vollständiger anzuhängender/neuer Text“) gilt damit bis zum Budget; das wird in `.ai/architecture/mcp.md` und in Plan `012` bei T-007 als Nachtrag vermerkt.
- **Abnahmekriterium:** Unit-Tests: (1) Bestehender Text mit 30 000 Zeichen, `anhaengen` einer Notiz von 100 Zeichen → die Vorschau enthält die Notiz vollständig, die letzten 500 Zeichen des bisherigen Texts, „Bestätigungs-Token: …“ und „Gültig bis: …“, und bleibt unter 20 000 Zeichen; die Quittung nach dem Schreiben enthält die Notiz vollständig. (2) Bestehender Text mit 30 000 Zeichen, `ersetzen` mit einem Text, der sich nur in einem Satz ab Zeichen 25 000 unterscheidet → Vorschau und Quittung enthalten den alten und den neuen Satz, die Angabe der unveränderten Zeichen davor, und nicht die ersten 500 Zeichen des Texts. (3) `anhaengen` von 30 000 Zeichen → Vorschau enthält Anfang und Ende des angehängten Texts, die Auslassungszeile mit Zeichenzahl, das Token und bleibt unter 20 000 Zeichen. (4) Eine Quittung zu (3) enthält weiterhin die Stub-Liste. (5) `inhalt_lesen` eines Artikels mit 30 000 Zeichen Text enthält den Block „Schreibschlüssel“ vollständig.

### CR-004
- **Fundstelle:** `src/lib/mcp/tools/write-schemas.ts:110–117` (`monsterSheetSchema`), `:38–41` (`describe`), `src/lib/mcp/field-catalog.ts:85–86,116–127` (`lebensraum`, `charakterblatt`, `templateField`)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-003, T-004 (E1, E5)
- **Beschreibung:** Ziel (1) des Plans ist, dass jeder Client alle schreibbaren Felder mit Namen **und erlaubten Werten** aus der Schnittstelle erfährt; E5 nennt ausdrücklich „Charakterblatt-Stufen und -Attribute“, deren erlaubte Werte in der Beschreibung stehen sollen. Im Schema ist jedes Charakterblatt-Unterfeld `z.unknown()` mit der Beschreibung „Anzeige: <Label>.“. Der Client erfährt weder, dass `attribute` ein Objekt mit den Schlüsseln STR/DEX/… ist, noch die Form von `fertigkeiten` (`name`, `stufe`, `attribut`) und `faehigkeiten` (`text`, `attribut`), noch die erlaubten Stufen. Das ist dieselbe Lücke wie Befund B1, nur eine Ebene tiefer. Außerdem führt der Katalog `referenceTargets`, `describe` gibt sie aber nicht aus: „Anzeige: Besitzer.“ bzw. „Anzeige: Lebensraum.“ nennt weder die Erwähnungssyntax noch die zulässigen Ziele (Ort-Artikel, Person-Artikel, Charakter).
- **Empfehlung (Plan-Review F4: echte Unterschemas, Aliase bleiben):** `MCP_SHEET_FIELDS` bekommt je Unterfeld Typ und Beschreibung; `monsterSheetSchema` baut daraus echte Schemas: `klasse`, `persoenlichkeit`, `ideale`, `bindungen`, `schwaechen` als Text; `uebungsbonus` als Zahl; `attribute` als striktes Objekt mit den sechs Attributkürzeln (`STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA`, je optionale Zahl); `fertigkeiten` als Liste strikter Objekte `{ name, stufe, attribut }`; `faehigkeiten` als Liste strikter Objekte `{ text, attribut }`. Erlaubte Werte für `stufe` (Labels aus `SKILL_LEVEL_LABEL`) und `attribut` (Kürzel aus `ATTRIBUTE_SHORT`) stehen in der Beschreibung; nach E5 kein `z.enum`, die Prüfung bleibt in `normalizeMonsterSheet`. Die heute akzeptierten Alternativschreibweisen (`level`, `attr`, `titel`, lange Attributnamen, englische Blattschlüssel) werden wie bei `vorlagenfelder` per `withAliases` vor dem strikten Objekt auf die beworbenen Schlüssel abgebildet, sodass bestehende Aufrufe weiter funktionieren und das veröffentlichte Schema nur die deutschen Schlüssel nennt. Alle Unterschemas tragen `germanError(path)`. Zusätzlich hängt `describe` bei `type === "reference"` an: „Verweis in Erwähnungssyntax, z. B. @[Titel](artikel:id); erlaubte Ziele: <aus referenceTargets, deutsch: Ort-Artikel, Person-Artikel, Charakter …>; null oder „–“ leert den Verweis.“
- **Abnahmekriterium:** Test in `tool-schemas.test.ts`: Das JSON-Schema von `inhalt_aendern` für `art = monster` nennt unter `charakterblatt.fertigkeiten` die Schlüssel `name`, `stufe`, `attribut` und in der Beschreibung alle Stufen-Labels; unter `charakterblatt.attribute` alle sechs Attributkürzel; die Beschreibung von `lebensraum` enthält „Ort“ und die Erwähnungssyntax; die von `vorlagenfelder.Besitzer` die Ziele Person-Artikel und Charakter. Ein Aufruf mit `fertigkeiten: [{ name, level, attr }]` (englische Aliase) wird weiter angenommen; `fertigkeiten: [{ name, stufe, attribut, extra }]` ergibt einen Fehler mit dem Pfad `felder.charakterblatt.fertigkeiten`. Die Rundreise-Suite (T-009) bleibt grün.

### CR-005
- **Fundstelle:** `src/lib/mcp/write-shared.ts:133–146` (`resolveHabitat`), `src/lib/mcp/tools/update/monster.ts:82–86`, `src/lib/mcp/tools/relation-create.ts:30–41` (`checkRelation`)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005, T-007 (E10)
- **Beschreibung:** (a) `resolveHabitat` prüft nur, dass die Erwähnung ein Artikel ist; die Fehlermeldung nennt zwar „Ort-Artikel“, der Vorlagentyp wird aber nicht geprüft. Für einen Person-Artikel entsteht eine Vorschau mit Token; erst nach der Bestätigung lehnt die Domäne mit „Lebensraum muss ein sichtbarer Ort-Artikel dieser Welt sein.“ ab – nachdem ggf. Stubs angelegt und wieder entfernt wurden und das Token verbraucht ist. (b) `relation_anlegen` erkennt eine bereits bestehende Verknüpfung erst beim Ausführen („Diese Verknüpfung gibt es schon.“). In beiden Fällen bestätigt der Benutzer eine Vorschau, die nie ausgeführt werden kann.
- **Empfehlung:** (a) In `resolveHabitat` den aufgelösten Artikel laden und `templateType === "place"` prüfen; Fehler mit Pfad `felder.lebensraum`. (b) In `checkRelation` eine vorhandene manuelle Relation gleicher Richtung abfragen (kleine Domänenfunktion `manualRelationExists`) und vor dem Token ablehnen.
- **Abnahmekriterium:** Integrationstests: `inhalt_aendern` Monster mit `lebensraum` auf einen Person-Artikel liefert sofort einen Werkzeugfehler mit `felder.lebensraum` und kein Token; `relation_anlegen` für eine bestehende Verknüpfung liefert sofort „Diese Verknüpfung gibt es schon.“ und kein Token.

### CR-006
- **Fundstelle:** `src/lib/mcp/tools/update/article.ts:28–51` (`previewTemplate`, früher Rücksprung in Zeile 38), `src/lib/mcp/receipt.ts:178–192` (`snapshotDelta`)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-007, T-008 (E7)
- **Beschreibung:** Wird nur `vorlagentyp` geändert (ohne `vorlagenfelder`), behält die Domäne nur kompatible Felder (`keepCompatibleFields`); alle anderen Vorlagenfelder gehen verloren. Die Vorschau zeigt in diesem Fall nur „Vorlagentyp: alt → neu“, weil `previewTemplate` ohne `vorlagenfelder` vorzeitig zurückkehrt. Die Quittung zeigt den Verlust ebenfalls nicht: `snapshotDelta` iteriert nur über die Einträge des neuen Zustands; Labels, die es nur vorher gab, fallen weg. Der Benutzer bestätigt damit einen Datenverlust, den er weder vorher noch nachher sieht.
- **Empfehlung:** `previewTemplate` rendert bei jedem Typwechsel alten und neuen Feldsatz (neu = kompatibel behaltene bzw. übergebene Felder, dieselbe Regel wie die Domäne) und lässt `pushEntryChanges` die entfallenden Felder als „Wert → –“ ausgeben. `snapshotDelta` iteriert über die Vereinigung der Labels von vorher und nachher.
- **Abnahmekriterium:** Tests: Gegenstand mit „Seltenheit: Selten“ auf `vorlagentyp: person` ändern → Vorschau enthält „Seltenheit: Selten → –“; die Quittung nach Bestätigung ebenfalls. Unit-Test für `snapshotDelta` mit einem nur im `before` vorhandenen Eintrag.

### CR-007
- **Fundstelle:** `src/lib/mcp/tools/content-create.ts:82–94` (`previewOrCreate`)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-007
- **Beschreibung:** T-007 verlangt für alle bestätigungspflichtigen Wege, auch `inhalt_anlegen` mit Stubs, „Art, Titel, Sichtbarkeit und das Delta“. Die Vorschau enthält nur Titel, Sichtbarkeit, die Zeile „Folge: …“ und die Stub-Liste; die anzulegenden Felder (Vorlagentyp, Vorlagenfelder, Text, Status, Beteiligte, Monsterwerte) erscheinen nicht. Der Benutzer stimmt einem Inhalt zu, den er im Chat nicht sieht.
- **Empfehlung:** Die Create-Handler liefern in `collect` zusätzlich die geplanten Felder als `FieldChange[]` („– → Wert“, Labels aus dem Katalog, Verweise mit Titel, Rich-Text vollständig); `previewOrCreate` übergibt sie als `changes`.
- **Abnahmekriterium:** Integrationstest: `inhalt_anlegen` Gegenstand mit Seltenheit „Selten“ und einer unbekannten Erwähnung im Text → die Vorschau enthält „Seltenheit: – → Selten“, den Text und die Stub-Liste.

### CR-008
- **Fundstelle:** `src/lib/mcp/change-format.ts:40–47` (`parseEntries`), Nutzer `src/lib/mcp/receipt.ts:56–58,121` und `src/lib/mcp/tools/update/common.ts:89–104`, `update/article.ts:45–50`, `update/monster.ts:89–94`
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-007, T-008
- **Beschreibung:** Das Delta für Vorlagenfelder und Charakterblatt entsteht, indem der für `inhalt_lesen` gerenderte Text wieder an Zeilenumbrüchen und dem ersten Doppelpunkt zerlegt wird. Das koppelt Vorschau und Quittung an das Textformat der Leseausgabe: Ein Vorlagen-Textfeld mit Zeilenumbruch erzeugt eine abgeschnittene bzw. eine Zeile ohne Doppelpunkt, die stillschweigend entfällt; ein Charakterblatt-Text (Persönlichkeit, Ideale …) mit Leerzeile wird am Trenner `\n\n` zerteilt, der zweite Absatz entfällt oder erscheint bei enthaltenem Doppelpunkt als eigenes Pseudofeld. In der Artikel-Quittung wird zudem die erste Zeile per `split("\n").slice(1)` verworfen, im Update über `skip: ["Vorlagentyp"]` – zwei verschiedene Mittel für dasselbe.
- **Empfehlung:** `renderTemplateFields` und `renderSheet` auf eine strukturierte Zwischenform umstellen (`templateFieldEntries(...)`/`sheetEntries(...)`: `[label, value][]`), aus der sowohl der Lesetext als auch Vorschau und Quittung gebildet werden; `parseEntries` entfällt.
- **Abnahmekriterium:** `parseEntries` existiert nicht mehr; Unit-Test: Eine Änderung von „Persönlichkeitsmerkmale“ auf einen zweiabsätzigen Text mit Doppelpunkt im zweiten Absatz ergibt genau einen Delta-Eintrag mit dem vollständigen Text.
- **Umsetzung (2026-09-30):** Vorlagenfelder und Charakterblatt liefern strukturierte Label/Wert-Einträge. Leseausgabe, Vorschau und Quittung verwenden diese gemeinsame Zwischenform; `parseEntries` wurde entfernt. Der Unit-Test deckt einen zweizeiligen Persönlichkeitswert mit Doppelpunkt ab.

### CR-009
- **Fundstelle:** `src/lib/mcp/field-catalog.ts:43–45,141–143,187–203` (`catalogTemplateFieldLabels`, `allowedValuesFor`, `assertFieldCatalogComplete`, `FIELD_CATALOG_COMPLETE`), `src/lib/mcp/field-catalog.test.ts:38–42`
- **Kategorie:** Testabdeckung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-003
- **Beschreibung:** Die Vorlagenfelder des Katalogs werden zur Laufzeit aus der Registry abgeleitet (`templateFieldsFor`); eine zweite Liste gibt es nicht. `assertFieldCatalogComplete` vergleicht deshalb die Registry mit einer beim Modulstart aus derselben Registry gebildeten Kopie und kann für die echte Registry nie fehlschlagen; der Test mit der simulierten Registry prüft nur diesen Vergleich. Die zweite Hälfte der Funktion prüft lediglich, dass Listen nicht leer sind – nicht, dass jeder Monster-Enum-Wert, Quest-Status und Charakterblatt-Schlüssel abgebildet ist (T-003 Abnahme). `FIELD_CATALOG_COMPLETE` hat den Wert `undefined` und wird nirgends gelesen; `allowedValuesFor` wird weder im Code noch in Tests verwendet. Was tatsächlich auseinanderlaufen kann, sind die von Hand gepflegten Teile: `MCP_SHEET_FIELDS` gegen `SHEET_KEY_MAP`/`NormalizedMonsterSheet`, die Reihenfolge-Kopplung `catalog[index]` in `renderTemplateFields` und `MCP_QUEST_STATUS` gegen die Domänen-Status.
- **Empfehlung:** `assertFieldCatalogComplete`, `catalogTemplateFieldLabels` und `FIELD_CATALOG_COMPLETE` entfernen. Stattdessen Tests auf die echten Drift-Stellen: jeder Wert von `SHEET_KEY_MAP` hat genau einen Eintrag in `MCP_SHEET_FIELDS` und umgekehrt; jeder Domänen-Quest-Status hat ein Label in `MCP_QUEST_STATUS`; `templateFieldsFor(type)` hat für jeden Typ dieselbe Länge und Reihenfolge wie `definition.fields`. `allowedValuesFor` entfernen (Plan-Review F6; `012` T-003 nannte die Funktion als Hilfsfunktion, sie wurde nie gebraucht – die Abweichung wird in Plan `012` bei T-003 als Nachtrag vermerkt).
- **Abnahmekriterium:** `assertFieldCatalogComplete`, `catalogTemplateFieldLabels`, `FIELD_CATALOG_COMPLETE` und `allowedValuesFor` existieren nicht mehr; die drei genannten Drift-Tests existieren und sind grün; ein im Test zu `SHEET_KEY_MAP` hinzugefügter Zielschlüssel ohne Eintrag in `MCP_SHEET_FIELDS` lässt einen Test fehlschlagen.

### CR-010
- **Fundstelle:** `src/lib/mcp/tools/relation-create.ts:59–70,110–119`, `src/app/upload/[ticket]/route.ts:54–72` (`uploadReceipt`)
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-008 (E10)
- **Beschreibung:** T-008 verlangt eine gemeinsame Quittungsfunktion. `relation_anlegen` und der Upload-Link setzen ihre Quittung von Hand zusammen („Gespeichert.“/„Relation angelegt.“, `Art`/`ID`/`Titel`/`Stand`-Zeilen, Überschrift „Gespeicherte Änderungen (vorher → nachher):“ als zweite Kopie des Literals aus `formatReceipt`). Die Relations-Vorschau schreibt „- Bezeichnung: – → …“ als freie `lines` statt als `changes`, umgeht also `formatDelta`. Formatänderungen an der Quittung müssen an drei Stellen nachgezogen werden.
- **Empfehlung (Plan-Review F6: vereinheitlichen):** `formatReceipt` bekommt `stand?` (Zeile entfällt, wenn nicht gesetzt), `extraLines?: string[]` (nach den Kopfzeilen, vor dem Delta) und akzeptiert `art` als freien Text. Beide Stellen rufen `formatReceipt` auf: `relation_anlegen` mit `art: "relation"`, `id` der Relation, `title: "<Quelle> → <Ziel>"`, `extraLines` für „Quelle: …“ und „Ziel: …“ und `changes` für Bezeichnung und Gegenbezeichnung („– → Wert“, aus dem gespeicherten Datensatz); die Upload-Route mit `extraLines` für „Ziel“, „Bildart“, „Ersetzt vorhandenes Bild“ und `changes` für das Bild. Die Relations-Quittung beginnt damit wie alle anderen mit „Gespeichert.“ statt „Relation angelegt.“. Die Relations-Vorschau übergibt Bezeichnung und Gegenbezeichnung als `changes` an `formatConfirmationPreview`; „Quelle“ und „Ziel“ bleiben `lines`.
- **Abnahmekriterium:** Das Literal „Gespeicherte Änderungen (vorher → nachher):“ steht nur noch in `receipt.ts`; `relation-create.ts` und `src/app/upload/[ticket]/route.ts` bauen ihre Quittung ausschließlich über `formatReceipt`. Die Quittungstests für Relation (beide Titel, gespeicherte Bezeichnung) und Upload (`quittung` mit Ziel, Bildart, „Ersetzt vorhandenes Bild: ja/nein“) sind an die gemeinsame Form angepasst und grün.

### CR-011
- **Fundstelle:** `src/lib/mcp/validation.ts:133–134` (`unionError`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005
- **Beschreibung:** `options.map(rootUnknown).reduce(...)` hat keinen Startwert. Ist `errors` am Roh-Issue leer oder nicht vorhanden (`options = []`), ist `fitting` leer und `reduce` wirft `TypeError: Reduce of empty array with no initial value` – innerhalb der Zod-Fehlerfunktion, also als nicht abgefangener Fehler in der SDK-Validierung statt als verständlicher Werkzeugfehler. Ob Zod 4 für `z.union` jemals ein leeres `errors` liefert, wurde in diesem Review nicht per Test geklärt; der Code verlässt sich darauf ohne Absicherung und ohne Test.
- **Empfehlung:** Bei `options.length === 0` direkt den Fallback-Text zurückgeben.
- **Abnahmekriterium:** Unit-Test: `unionError("felder", [], "X")({})` und `({ errors: [] })` liefern einen Text, der mit „Die Schlüssel in „felder““ beginnt, und werfen nicht.

### CR-012
- **Fundstelle:** `src/lib/mcp/tools/update/quest.ts:32–36`
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004 (4), T-009
- **Beschreibung:** Die Beteiligten werden als zusammengesetzte Zeichenkette in Eingabereihenfolge verglichen. Dieselben Beteiligten in anderer Reihenfolge (oder mit einer doppelten ID) gelten als Änderung: Es entsteht eine Vorschau mit Token statt „Keine Änderung“, und die Vorschau zeigt „A, B → B, A“, obwohl die Domäne eine Menge speichert.
- **Empfehlung:** IDs vor dem Vergleich deduplizieren und als Menge vergleichen; die Anzeige in der gespeicherten Reihenfolge ausgeben.
- **Abnahmekriterium:** Integrationstest: `inhalt_aendern` Quest nur mit `beteiligte` in umgekehrter Reihenfolge → „Keine Änderung: …“, kein Token.

### CR-013
- **Fundstelle:** `src/lib/mcp/tools/content-update.ts:53–84` (`executeUpdate`), `src/lib/mcp/receipt.ts:49–60` (`articleSnapshot`), `src/lib/mcp/tools/renderers.ts:69–89`
- **Kategorie:** Performance
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-008
- **Beschreibung:** Ein bestätigtes `inhalt_aendern` liest das Ziel in `handler.load`, erneut in `snapshotContent` (vorher), in der Domäne, im Handler nach dem Schreiben (CR-001) und in `snapshotContent` (nachher). Bei Artikeln löst jeder Snapshot zusätzlich jeden Vorlagen-Verweis einzeln und nacheinander auf (`await` in der Schleife von `renderTemplateFields`); in der Vorschau geschieht dasselbe zweimal (alt und neu). Bei der aktuellen Feldanzahl unkritisch, aber unnötig und mit jeder Verweis-Vorlage linear wachsend.
- **Empfehlung:** Zusammen mit CR-001 den Nach-Lese-Schritt der Handler streichen; `snapshotContent` kann die in `load` bereits geladene Zeile übernehmen (Snapshot-Funktionen nehmen optional die Zeile entgegen); Verweise in `renderTemplateFields` mit `Promise.all` auflösen.
- **Abnahmekriterium:** `executeUpdate` lädt das Ziel vor dem Schreiben genau einmal und danach genau einmal (im Quittungs-Snapshot); `renderTemplateFields` enthält kein `await` in einer Schleife.
- **Umsetzung (2026-09-30):** Der Vorher-Snapshot verwendet jetzt die bereits sichtbar und standgeprüft geladene Handler-Zeile; nur die Quittung lädt nach dem Speichern erneut. Verweisauflösungen der Vorlagenfelder laufen parallel über `Promise.all`.

---

## Ohne Finding geprüft

- Berechtigungen: Jeder Schreibweg prüft `worlds:write`, löst die Welt beim Bestätigen neu auf (`resolveMcpWorld`) und überlässt Rollen- und Sichtbarkeitsprüfung der Domäne; Bestätigungen sind an Benutzer und OAuth-Client gebunden, einmalig und zeitlich begrenzt. `relation_anlegen` (E10) prüft `requireStaff` in Vorschau und Ausführung.
- Hash der Bestätigung (`4af38f6`): `stableJson` lässt `undefined`-Schlüssel aus, passend zu JSONB; Test vorhanden (`confirmations.mcp.test.ts`).
- Strikte Schemas (B2/B7): alle geprüften `inputSchema` und verschachtelten Objekte sind `.strict()`; kein `.passthrough()` mehr unter `src/lib/mcp/`.
- Keine Secrets im geprüften Code; Tokens werden nur gehasht gespeichert.
- Review 1 CR-003–CR-008: Umsetzung im Code vorhanden und mit den dort genannten Nachweisen konsistent.

## Prioritäten

1. **CR-002** – E8 funktioniert im Code nicht; betrifft eine zur Bestätigung vorgemerkte Entscheidung und scheitert erst nach der Zustimmung des Benutzers.
2. **CR-001** – Rest des Datenintegritätsrisikos aus Review 1; die Behebung erledigt einen Teil von CR-013 mit.
3. **CR-003** – verlorenes Token bei langen Texten; kleiner Eingriff (Token nach oben).
4. **CR-004** – letzter Teil von Ziel (1) des Plans.
5. **CR-005, CR-006, CR-007** – Vorschau zeigt, was wirklich passiert, und lehnt Unausführbares vor dem Token ab.
6. **CR-008, CR-009, CR-010, CR-011, CR-012, CR-013** – Aufräumen und Absichern.

## Entscheidungen (Plan-Review 2026-09-30, Projektinhaber)

| # | Betrifft | Entscheidung |
|---|---|---|
| F1 | Rahmen | Alle Findings CR-001–CR-013 werden direkt aus diesem Dokument per `/plan-run` umgesetzt und gehen zusammen mit der Relation-Bestätigung (E10, Commits `e0e794e`, `4af38f6`) als Version **`1.0.1`** hinaus. Kein eigener Plan, keine `1.0.2`. `package.json` steht bereits auf `1.0.1`; die Version wird nicht erneut erhöht. Push erst nach ausdrücklicher Freigabe; danach Nachprüfung von E2E-Prüffall 9 (`.ai/infrastructure/mcp-e2e-test.md`). |
| F2 | CR-002 | **Snapshots bleiben immer.** `teilnahme:`-Einträge werden angenommen und geprüft, aber per MCP nie entfernt; `beteiligte` steuert nur aktive Charaktere. E8 und die Feldbeschreibung werden entsprechend präzisiert. |
| F3 | CR-003 | **Inhalt gezielt kürzen**, mit der Auflage: Der gezeigte Ausschnitt deckt verlässlich die geänderte Stelle ab (angehängter Text bzw. geänderter Bereich mit Kontext), nie pauschal den Textanfang. Token, Stub-Liste und Schreibschlüssel sind immer enthalten. Regeln 1–6 bei CR-003. |
| F4 | CR-004 | **Echte Unterschemas** für das Charakterblatt (Attribute als Objekt, Fertigkeiten und Fähigkeiten als Listen strikter Objekte), erlaubte Werte in der Beschreibung (E5), bisherige Aliase bleiben über `withAliases` gültig. |
| F5 | CR-001 | **Handler liefern nur die ID** (Notizblock zusätzlich die neue Version). Titel, Stand und Sichtbarkeit der Quittung kommen aus dem Nachher-Snapshot; im Fehlerfall Titel von vorher und „Stand: –“. Die Domänenfunktionen bleiben unverändert. |
| F6 | CR-009, CR-010 | **Entfernen und vereinheitlichen.** Ungenutzte Katalog-Exporte entfallen zugunsten von Tests auf die echten Drift-Stellen; Relation und Upload-Link nutzen `formatReceipt`. |

### Rahmen für `/plan-run`

- **Reihenfolge:** CR-001 → CR-013 (baut auf CR-001 auf) → CR-008 (strukturierte Einträge; Grundlage für CR-006 und CR-007) → CR-003 → CR-002 → CR-012 → CR-004 → CR-005 → CR-006 → CR-007 → CR-010 → CR-009 → CR-011. Die Prioritätenliste oben nennt die Dringlichkeit, diese Liste die technisch sinnvolle Abfolge.
- **Normen:** `.ai/conventions.md` (vor jedem Commit `npm test`, `npm run lint`, `npm run typecheck`; nie automatisch pushen), `.ai/architecture/mcp.md` (Checkliste MCP-Werkzeuge; Plugin-Versionierung). Ändern sich Werkzeugbeschreibungen oder Schemas sichtbar (CR-003, CR-004), wird die Plugin-Version in beiden Manifesten unter `plugins/worldcraft/` nach der dortigen Regel erhöht.
- **Integrationstests:** Die mit „Integrationstest“ bezeichneten Abnahmekriterien laufen in `npm run test:mcp` (lokale Datenbank, Dev-Server, Testwelt aus `scripts/seed-mcp-test-world.mjs`). Läuft die Datenbank nicht, werden die Tests geschrieben, das Finding bleibt „offen“ mit Vermerk, und der Lauf wird vor dem Push nachgeholt.
- **Dokumente nachziehen:** Plan `012` (Nachträge bei E8, T-003, T-007), `.ai/architecture/mcp.md` (Kürzungsregeln, Charakterblatt-Schema), `.ai/features.md` nur bei geändertem nutzbarem Verhalten (CR-002, CR-003, CR-005).
- **Commits:** ein Commit je Finding mit der ID im Betreff (z. B. `fix(mcp): 012 Review 2 CR-001 …`).

**Stand nach dem Review:** `HEAD` ist seit dem Review von `4af38f6` auf `934ba66` gewandert (nur Dokumente: T-012 und T-013 abgehakt, E2E-Lauf 2 protokolliert). Der Code unter `src/` ist gegenüber der Baseline unverändert; die Fundstellen gelten weiter. Plan `012` ist abgeschlossen; das Abnahmekriterium von T-011 bezog sich auf das Review vom 2026-09-29 und bleibt dort erfüllt.
