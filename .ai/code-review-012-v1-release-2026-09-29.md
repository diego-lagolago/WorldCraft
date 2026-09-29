# Code Review – 012 v1.0 Release

**Baseline:** Commit `bc10f1f` (`main`, Working Tree sauber; enthält die Fixes aus `.ai/code-review-011-mcp-schreibend-2026-09-29-2.md`)
**Geprüfte Task-Datei:** `.ai/feature-tasks/012-v1-release.md`
**Geprüfte Aufgaben (erledigt `[x]`):** T-001–T-010. T-011 (diese Reviews), T-012 (Release) und T-013 (E2E-Lauf 2) sind offen.
**Review-Datum:** 2026-09-29
**Plan-Review / Entscheidungen:** Auf Wunsch des Projektinhabers ohne Unterbrechung; Empfehlungen werden übernommen und sind nachträglich zu bestätigen.

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Runtime-Risiken | mittel | behoben | Quittungs-Snapshot läuft innerhalb der Stub-Kompensation; ein Lesefehler nach erfolgreichem Schreiben löscht referenzierte Stubs und meldet einen Fehler |
| CR-002 | Testabdeckung | mittel | offen | Die Abnahmetests von T-004–T-009 in `npm run test:mcp` wurden nie ausgeführt |
| CR-003 | Bad Practices | mittel | behoben | `validation.ts` erkennt eigene Meldungen und fehlende Werte an englischen Zod-Standardtexten |
| CR-004 | Duplizierung & Modularisierung | niedrig | behoben | „Label: Wert“-Parser, Rich-Text-Kürzung und `RICH_EXCERPT` doppelt in Vorschau (`update/common.ts`) und Quittung (`receipt.ts`) |
| CR-005 | Duplizierung & Modularisierung | niedrig | behoben | Handtypen `ArticleFields` … `WorldFields` in `write-schemas.ts` spiegeln den Feldkatalog per `as unknown as` |
| CR-006 | Aufgaben-Abgleich | niedrig | behoben | Nicht im Plan entschiedene Erweiterungen: Vorlagenfelder werden beim Ändern zusammengeführt, `@[Name](teilnahme:id)`, „Ja“/„Nein“ als Schreibwerte |
| CR-007 | Performance | niedrig | behoben | `relation_anlegen` baut zwei vollständige Snapshots (inkl. Vorlagenfeld-Verweisen) nur für zwei Titel |
| CR-008 | Aufgaben-Abgleich | niedrig | behoben | Relations-Quittung nennt Bezeichnungen aus der Eingabe statt aus dem gespeicherten Datensatz |

---

### CR-001
- **Fundstelle:** `src/lib/mcp/tools/content-update.ts` `executeUpdate()`, `src/lib/mcp/tools/content-create.ts` `executeCreate()` (Aufruf `snapshotContent` im `write`-Callback von `withMcpStubCompensation`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-008
- **Beschreibung:** `withMcpStubCompensation` löscht bei jedem Fehler im `write`-Callback die zuvor angelegten Stubs. Der Snapshot für die Quittung liegt im selben Callback, also **nach** dem erfolgreichen Domänen-Schreibvorgang. Schlägt das erneute Lesen fehl (Datenbankfehler, Sichtbarkeit), sind die Daten gespeichert, verweisen aber auf gelöschte Stub-Artikel, und der Client erhält einen Fehler – er hält die Änderung für gescheitert.
- **Empfehlung:** `write` gibt nur das Domänenergebnis zurück; der Snapshot und die Quittung entstehen danach außerhalb der Kompensation. Scheitert nur die Quittung, wird eine knappe Quittung ohne Delta ausgegeben („Gespeichert; die Änderungsübersicht konnte nicht geladen werden“), kein Fehler.
- **Abnahmekriterium:** Unit-Test: Ein `snapshotContent`, der nach erfolgreichem Schreiben wirft, führt nicht zu `compensateMcpStubArticles` und liefert eine Quittung mit „Gespeichert“.

### CR-002
- **Fundstelle:** `src/app/mcp/mcp.mcp.test.ts` (Tests „012 T-004(1–5)“, „012 T-006…“, „012 T-007/T-008…“, Suite „012 T-009“)
- **Kategorie:** Testabdeckung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-004, T-006, T-007, T-008, T-009
- **Beschreibung:** Die Integrationstests wurden auf Wunsch des Projektinhabers während der Umsetzung nicht ausgeführt (lokale Datenbank lief nicht). Die Abnahmekriterien dieser Aufgaben sind damit nur durch Unit-Tests und Code belegt; auch die Anpassungen bestehender `011`-Tests (CR-010-Vorschau) sind ungeprüft.
- **Empfehlung:** Vor T-012 lokal Datenbank und Dev-Server starten, `npm run test:mcp` und `npm run test:rechte` ausführen, Fehler beheben.
- **Abnahmekriterium:** `npm run test:mcp` und `npm run test:rechte` laufen lokal grün; Ergebnis im Plan `012` bei T-011 vermerkt.

### CR-003
- **Fundstelle:** `src/lib/mcp/validation.ts` `isOwnMessage()`, `issueMessage()` Fall `invalid_type`
- **Kategorie:** Bad Practices
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-005
- **Beschreibung:** Ob eine Meldung von uns stammt, wird an den Präfixen „Invalid“, „Unrecognized“, „Too“ der Zod-Standardtexte erkannt; ein fehlender Wert an „received undefined“. Ein Zod-Update oder eine gesetzte Zod-Locale ändert diese Texte, dann erscheinen englische Meldungen oder „muss … sein“ statt „fehlt“.
- **Empfehlung:** Eigene Meldungen mit einem festen deutschen Präfix erkennen (alle beginnen mit „Feld „“ bzw. „Unbekanntes Feld „“), und für fehlende Werte `issue.input === undefined` aus den Roh-Issues nutzen (Zod-Option `reportInput`) oder die Pflichtfelder aus dem Katalog prüfen.
- **Abnahmekriterium:** `validation.ts` enthält keine Abfrage auf englische Zod-Texte; Unit-Tests für „fehlt“, Typfehler und eigene Enum-Meldungen grün.

### CR-004
- **Fundstelle:** `src/lib/mcp/tools/update/common.ts` (`entriesOf`, `richChange`, `RICH_EXCERPT`), `src/lib/mcp/receipt.ts` (`addEntries`, `richDelta`, `RICH_EXCERPT`)
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-007, T-008
- **Beschreibung:** Dieselbe Zerlegung gerenderter „Label: Wert“-Einträge und dieselbe 500-Zeichen-Kürzung existieren zweimal; Änderungen am Format müssen doppelt gepflegt werden.
- **Empfehlung:** `parseEntries(text, separator)`, `RICH_EXCERPT` und Kürzungshelfer nach `src/lib/mcp/change-format.ts` verschieben und in beiden Stellen nutzen.
- **Abnahmekriterium:** `RICH_EXCERPT` und der Eintrags-Parser sind je einmal definiert; Vorschau- und Quittungstests grün.

### CR-005
- **Fundstelle:** `src/lib/mcp/tools/write-schemas.ts`, Typen `ArticleFields` … `WorldFields`, `createFieldSchemas`/`updateFieldSchemas` mit `as unknown as`
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004
- **Beschreibung:** Die Laufzeitschemas kommen aus dem Feldkatalog, die TypeScript-Typen sind von Hand gepflegt und per Doppel-Cast verbunden. Ein neues Katalogfeld erscheint im Schema, aber nicht im Typ (und umgekehrt), ohne dass der Compiler warnt.
- **Empfehlung:** Einen Test ergänzen, der je `art` die Schlüssel der Handtypen gegen `fieldsFor` prüft (Typ-Schlüssel als Konstante), oder die Typen aus einer `as const`-Katalogbeschreibung ableiten.
- **Abnahmekriterium:** Ein Test schlägt fehl, wenn `fieldsFor(op, art)` und die Handtyp-Schlüssel auseinanderlaufen.

### CR-006
- **Fundstelle:** `src/lib/mcp/tools/update/article.ts` `mergedTemplateFields`, `src/lib/mcp/write-shared.ts` `resolveParticipantIds`, `src/lib/mcp/tools/write-schemas.ts` `yesNo`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-006, T-007, T-009
- **Beschreibung:** Drei Verhaltensänderungen gehen über den Plantext hinaus: (a) `vorlagenfelder` ändert beim Ändern nur genannte Felder (vorher: Ersetzen), (b) Snapshots gelöschter Beteiligter erscheinen als `@[Name](teilnahme:id)`, (c) Ja/Nein-Felder nehmen „Ja“/„Nein“ an. Alle drei sind in `.ai/architecture/mcp.md` bzw. Commits begründet, aber nicht vom Projektinhaber entschieden; (b) fehlt außerdem in der Feldbeschreibung von `beteiligte`.
- **Empfehlung:** Entscheidungen im Plan `012` als E7–E9 nachtragen (zur Bestätigung durch den Projektinhaber); `teilnahme:` in der Katalogbeschreibung von `beteiligte` nennen.
- **Abnahmekriterium:** Plan `012` enthält E7–E9; die Beschreibung von `beteiligte` nennt `@[Name](teilnahme:id)`.

### CR-007
- **Fundstelle:** `src/lib/mcp/tools/relation-create.ts`
- **Kategorie:** Performance
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-008
- **Beschreibung:** Für zwei Titel werden zwei vollständige Snapshots gebaut (bei Artikeln inkl. Vorlagenfeld-Verweisen, bei Monstern inkl. Lebensraum).
- **Empfehlung:** Eine leichte Funktion `titleOf(world, art, id)` (Loader ohne Rendering) nutzen.
- **Abnahmekriterium:** `relation_anlegen` ruft `snapshotContent` nicht mehr auf; Titel erscheinen weiter in der Quittung.

### CR-008
- **Fundstelle:** `src/lib/mcp/tools/relation-create.ts`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-008
- **Beschreibung:** T-008 verlangt ein Delta aus dem gespeicherten Zustand. Bezeichnung und Gegenbezeichnung stammen aus der Eingabe; trimmt oder normalisiert die Domäne sie, zeigt die Quittung nicht, was gespeichert ist.
- **Empfehlung:** Bezeichnungen aus `result.data` übernehmen (sofern geliefert), sonst die Relation nachladen.
- **Abnahmekriterium:** Die Quittung nutzt die Werte des gespeicherten Datensatzes; Unit- oder Integrationstest mit führendem Leerzeichen in der Bezeichnung.

---

## Prioritäten

1. CR-001 – Datenintegrität bei Fehlern nach dem Schreiben.
2. CR-002 – Integrationssuite vor dem Release ausführen.
3. CR-003 – robuste Fehlertexte.
4. CR-006 – Entscheidungen dokumentieren und bestätigen lassen.
5. CR-004, CR-005, CR-007, CR-008 – Aufräumen.

---

## Umsetzung und Review-Check (2026-09-29)

| ID | Umsetzung | Nachweis |
|---|---|---|
| CR-001 | `receiptAfterWrite` (`src/lib/mcp/receipt.ts`) läuft nach `withMcpStubCompensation`; scheitert das erneute Lesen, meldet die Quittung „gespeichert“ ohne Delta und protokolliert `mcp_receipt_error` | `receipt-fallback.test.ts` |
| CR-002 | **offen** – `npm run test:mcp` / `test:rechte` brauchen lokale Datenbank und Dev-Server; auf Wunsch des Projektinhabers nicht ausgeführt | – |
| CR-003 | `germanError(path)` als Zod-`error` an jedem Katalogfeld; eigene Meldungen an festen deutschen Präfixen erkannt; keine Abfrage englischer Zod-Texte mehr | Test „Review 012 CR-003“ in `tool-schemas.test.ts` |
| CR-004 | `parseEntries`, `RICH_EXCERPT`, `headExcerpt`/`tailExcerpt` in `src/lib/mcp/change-format.ts`, genutzt von Vorschau und Quittung | Vorschau- und Quittungstests grün |
| CR-005 | `FIELD_TYPE_KEYS` mit Compile-Zeit-Prüfung gegen die Handtypen, Test gegen `fieldsFor` | Test „Review 012 CR-005“ |
| CR-006 | E7–E9 im Plan `012` nachgetragen (zur Bestätigung); `teilnahme:` in der Beschreibung von `beteiligte` | Plan `012`, `field-catalog.ts` |
| CR-007 | `contentTitle` statt `snapshotContent` in `relation_anlegen` | – |
| CR-008 | `createManualRelation` liefert gespeicherte `label`/`counterLabel`; die Quittung nutzt sie | – |

Review-Check: CR-001, CR-003–CR-008 am Code behoben, keine Drift. CR-002 bleibt offen bis zum lokalen Lauf der Integrationssuiten.
