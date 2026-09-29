# Code Review – 011 MCP: Schreibend (zweiter Durchlauf, Stand nach Plan 012 T-010)

**Baseline:** Commit `55c36a7594a657e33523e633eda268dfc7350e78` (`main`, Working Tree sauber)
**Geprüfte Task-Datei:** `.ai/feature-tasks/011-mcp-schreibend.md`
**Anlass:** Plan `012` T-011 (1), Roadmap-Schritt 18. Das erste Review vom selben Tag (`.ai/code-review-011-mcp-schreibend-2026-09-29.md`, CR-001–CR-024, vollständige Kette inkl. `/review-check`) bleibt unverändert bestehen; dieses Dokument ist ein eigener Durchlauf mit eigener Nummerierung.
**Geprüfte Aufgaben (erledigt `[x]`):** T-001–T-010, T-012, T-013. T-011 (E2E) ist offen und wird mit `012` T-013 abgeschlossen.
**Review-Datum:** 2026-09-29
**Plan-Review / Entscheidungen:** Auf Wunsch des Projektinhabers ohne Unterbrechung umgesetzt; die Empfehlungen wurden übernommen und sind vom Projektinhaber nachträglich zu bestätigen. CR-001: Variante „leerer Wert → Fehler mit Pfad und erlaubten Werten“ (nicht „Keine Änderung“).

**Durch Plan `012` behoben (nicht erneut als Finding aufgenommen):**

| Befund `012` | Inhalt | Behoben durch |
|---|---|---|
| B1 | `felder` als freies Objekt ohne Schlüssel und Werte | `012` T-003, T-004 |
| B2 | `.passthrough()`, unbekannte Schlüssel still ignoriert, Vorschau ohne Delta mit Token | `012` T-004 |
| B3 | Zod-Fehler im Handler als allgemeiner Serverfehler | `012` T-005 |
| B4 | Nicht gesetzte Vorlagenfelder fehlen in `inhalt_lesen` | `012` T-006 |
| B5 | Vorschau mit JSON, IDs, ohne Weitergabe-Anweisung | `012` T-007 |
| B6 | Kein Delta nach dem Schreiben | `012` T-008 |
| B7 | inputSchemas nicht strikt | `012` T-004 |
| B8 | Lese- und Schreibvokabular weichen ab | `012` T-003, T-006 |

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Fehlerbehandlung & Validierung | mittel | behoben | Monster-Änderung lehnt leere Auswahlwerte mit altem, pfadlosem Fehlertext ab; Anlegen akzeptiert sie als „nicht gesetzt“ |
| CR-002 | Bad Practices | mittel | behoben | Upload-Route fragt Tabellen direkt ab statt über die Domänenschicht |
| CR-003 | Lesbarkeit & Wartbarkeit | niedrig | behoben | Upload-Route mischt HTML-Seite, Prüf- und Schreiblogik in einer 336-Zeilen-Datei |
| CR-004 | Duplizierung & Modularisierung | niedrig | behoben | Universum-„nur ich“-Sperre doppelt in Schema und Handler von `sichtbarkeit_setzen` |
| CR-005 | Sicherheit | niedrig | behoben | Ratenbegrenzung erkennt Tool-Aufrufe nur an Header oder Einzel-JSON-Body |

---

### CR-001
- **Fundstelle:** `src/lib/mcp/tools/update/monster.ts`, `required()` und `previewEnums()`
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006 (Änderung), T-005 (Anlegen)
- **Beschreibung:** `mapMonsterKind`/`mapMonsterRarity`/`mapMonsterDanger`/`mapMonsterSize` geben für `""` oder `null` `undefined` zurück. Beim Anlegen bedeutet das „nicht gesetzt“; beim Ändern wirft `required()` dann „„monster_art“ fehlt oder ist ungültig.“ – ohne Feldpfad `felder.monster_art` und ohne erlaubte Werte, also nicht im Format der verständlichen Werkzeugfehler (`012` T-005). Dasselbe Feld verhält sich beim Anlegen und Ändern unterschiedlich.
- **Empfehlung:** Beim Ändern leere Werte entweder als Fehler mit Pfad und erlaubten Werten melden (über dieselbe Hilfsfunktion wie `lookupEnum`) oder – da Monster-Auswahlfelder Pflichtwerte mit Standard sind – ausdrücklich „nicht ändern“ bedeuten. `required()` entfernen.
- **Abnahmekriterium:** `inhalt_aendern` Monster mit `felder: { gefahr: "" }` liefert einen Fehler, der `felder.gefahr` und alle Gefahrenstufen-Labels nennt (oder, je nach Entscheidung, „Keine Änderung“); `required()` existiert nicht mehr; Unit-Test deckt den Fall ab.

### CR-002
- **Fundstelle:** `src/app/upload/[ticket]/route.ts`, `currentStand()`, `targetTitle()` (Welt), `hadImage()`
- **Kategorie:** Bad Practices
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-008
- **Beschreibung:** Die Route liest `articles.updatedAt`, `monsters.updatedAt`, `worlds.name` und die Bild-Spalten per `db.select` direkt. `.ai/architecture/mcp.md` (Checkliste Punkt 2) verlangt die Domänen- und Rechteschicht; die Direktabfragen umgehen die Sichtbarkeitsprüfung (hier ungefährlich, weil `attachImage` die Schreibrechte prüft) und doppeln Wissen, das es in `visibleArticle`/`visibleMonster`/`worldStand` bereits gibt.
- **Empfehlung:** Stand, Titel und vorhandenes Bild über die bestehenden Loader (`getArticle`/`getMonster` mit Rolle aus `listMcpWorldMemberships`, `getWorldDetails`, `worldStand`) ermitteln; eine kleine Funktion `loadUploadTargetState(ticket)` bündelt das.
- **Abnahmekriterium:** `src/app/upload/[ticket]/route.ts` importiert weder `@/db/client` noch `@/db/schema`; Upload-Tests (Unit und `test:mcp`) grün.

### CR-003
- **Fundstelle:** `src/app/upload/[ticket]/route.ts`, `uploadPageHtml()`, `pageResponse()`
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-008
- **Beschreibung:** HTML-Template (inkl. CSS), Ticketprüfung, Größenprüfung, Schreiben und Quittung liegen in einer Datei. Änderungen an der Upload-Oberfläche (Roadmap-Eintrag „Bild-Upload verbessern“) berühren so die sicherheitsrelevante Route.
- **Empfehlung:** Seite in ein eigenes Modul (z. B. `src/app/upload/[ticket]/page-html.ts`) auslagern; die Route behält nur Ablauf und Prüfungen.
- **Abnahmekriterium:** HTML/CSS liegt außerhalb von `route.ts`; `route.ts` unter 250 Zeilen; Upload-Tests grün.

### CR-004
- **Fundstelle:** `src/lib/mcp/tools/visibility-set.ts`, `inputSchema.superRefine` und `HANDLERS.universum.write`
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-007
- **Beschreibung:** Die Regel „Universen unterstützen „nur ich“ nicht“ steht zweimal mit identischem Text; der Handler-Zweig ist nach der Schema-Prüfung nur für gespeicherte Bestätigungen erreichbar.
- **Empfehlung:** Text als Konstante führen; im Handler-Zweig kommentieren, dass er gespeicherte Payloads absichert, oder die Prüfung zentral vor `createMcpConfirmation` halten.
- **Abnahmekriterium:** Der Meldungstext existiert nur einmal im Code; bestehende Tests zu Universen-Sichtbarkeit grün.

### CR-005
- **Fundstelle:** `src/app/mcp/route.ts`, `isToolCall()`
- **Kategorie:** Sicherheit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-009
- **Beschreibung:** Gezählt wird nur, wenn `mcp-method: tools/call` gesetzt ist oder der JSON-Body ein Objekt mit `method: "tools/call"` ist. Ein JSON-Array (Batch) oder ein anderer Content-Type würde nicht gezählt. Ob das SDK mit `legacy: "reject"` solche Anfragen ohnehin ablehnt, ist nicht durch einen Test belegt.
- **Empfehlung:** Einen Test ergänzen, der einen Batch-Body mit `tools/call` sendet und entweder 400 (SDK lehnt ab) oder eine Zählung erwartet; bei Bedarf Arrays mit mindestens einem `tools/call` zählen.
- **Abnahmekriterium:** Test in `src/app/mcp/route.test.ts` belegt, dass ein Batch-Body mit `tools/call` entweder abgelehnt oder gezählt wird.

---

## Prioritäten

1. CR-001 – uneinheitliches Verhalten und Fehlertext bei Monster-Auswahlfeldern (passt zu den neuen Fehlerregeln aus `012`).
2. CR-002 – Direktabfragen in der Upload-Route an die Domänenschicht angleichen.
3. CR-005 – Ratenbegrenzung durch Test absichern.
4. CR-003, CR-004 – Aufräumen.

---

## Umsetzung und Review-Check (2026-09-29)

| ID | Umsetzung | Nachweis |
|---|---|---|
| CR-001 | `requiredMonsterEnum` in `src/lib/mcp/write-fields.ts` ersetzt `required()`; leere Werte → Fehler mit `felder.<feld>` und allen Labels | Unit-Test „011 Review 2 CR-001“ in `write-fields.test.ts` |
| CR-002 | `loadUploadTargetState` (`src/app/upload/[ticket]/target-state.ts`) lädt Titel, Stand und Bild über `getArticle`/`getMonster`/`getWorldDetails`; `route.ts` importiert weder `@/db/client` noch `@/db/schema` (Discord-Allowlist-Abfrage liegt als Identitätsabfrage in `target-state.ts`) | Upload-Route-Tests grün |
| CR-003 | HTML/CSS in `src/app/upload/[ticket]/page-html.ts`; `route.ts` 215 Zeilen | – |
| CR-004 | Konstante `UNIVERSE_NOT_OWNER_ONLY` | Text einmal im Code |
| CR-005 | `isToolCall` zählt JSON-Batches mit `tools/call` | Test „011 Review 2 CR-005“ in `src/app/mcp/route.test.ts` |

Review-Check: Alle fünf Findings sind am Code behoben; keine Drift. MCP-Integrationssuite (`npm run test:mcp`) auf Wunsch des Projektinhabers nicht ausgeführt.
