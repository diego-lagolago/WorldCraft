# Code Review – 002 MCP-Server, Änderungen seit 0.1.8 (2026-09-28)

**Baseline:** Commit `6cc56ce92f7b82c740750498125b8aad3d39c905` (`main`), Working Tree sauber (keine uncommitteten Änderungen).
**Geprüfte Task-Datei:** `.ai/feature-tasks/002-mcp-server.md`
**Umfang:** Alle Änderungen seit dem Release-Commit 0.1.8 (`83d093c`), also `83d093c..6cc56ce` (Commits `a317aa5`, `4704360`, `a437194`, `6cc56ce`). Dazu gehören die Modulaufteilung von `src/lib/mcp/tools.ts` (CR-011 aus dem Review vom 2026-09-26), die PKCE-Prüfung am Autorisierungsendpunkt, `encodeMcpImage`, die erweiterte MCP-Suite und neue Unit-Tests, Anpassungen an den Seed-Skripten, das E2E-Protokoll sowie die neuen Plugin-Manifeste unter `plugins/worldcraft/`. Reine Dokumentationsänderungen an Plan `011` wurden nur auf Widersprüche zum Code geprüft.

## Begriffe

Es gelten die Begriffe aus `.ai/feature-tasks/002-mcp-server.md` (Abschnitt *Begriffe & Systeme*) und aus `.ai/code-review-002-mcp-server-2026-09-26.md`. Zusätzlich:
- **Demowelt:** Die von `scripts/seed-demo-world.mjs` über die öffentliche API angelegte Welt „MCP-Demo“ (T-014), Grundlage des E2E-Tests (T-010).
- **Testwelt:** Die von `scripts/seed-mcp-test-world.mjs` direkt in die lokale Datenbank geschriebene Welt „MCP-Testwelt“ (T-002), Grundlage von `npm run test:mcp`.
- **Zod-Standardmeldung:** Englischer Fehlertext, den Zod bei einer Schemaverletzung erzeugt (z. B. „Too big: expected number to be <=50“).

## Abhängigkeiten zwischen Findings

- **CR-003** (E2E-Protokoll) setzt **CR-002** (defektes Demobild) und **CR-001** (Fehlerklassifizierung) voraus: Der E2E-Fall 5 kann erst nach deren Behebung wiederholt werden.
- **CR-006** (Testlücken) nimmt die Tests aus CR-001, CR-004 und CR-005 auf.

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Fehlerbehandlung & Validierung | mittel | offen | `encodeMcpImage` meldet jeden Dekodierfehler als „Bild zu groß für die Ausgabe.“ und loggt nichts |
| CR-002 | Aufgaben-Abgleich | mittel | offen | Demowelt-Skript lädt ein defektes PNG hoch; kein Demobild ist über `bild_lesen` lesbar |
| CR-003 | Aufgaben-Abgleich | mittel | offen | E2E-Protokoll wertet nicht erfüllte Fälle als „bestanden“; T-010 ist zu früh abgehakt |
| CR-004 | Lesbarkeit & Wartbarkeit | mittel | offen | Regression durch Modulaufteilung: `suchen` gibt den englischen Vorlagenschlüssel statt des deutschen Labels aus |
| CR-005 | Fehlerbehandlung & Validierung | mittel | offen | Eingabefehler erreichen MCP-Clients als englische Zod-Standardmeldungen; Tests zementieren das |
| CR-006 | Testabdeckung | mittel | offen | Abnahmen T-008 und T-013 (5) nur teilweise automatisiert; Bildtest kann Regressionen nicht erkennen |
| CR-007 | Sicherheit | niedrig | offen | `hasRequiredMcpPkce` liest nur die Query; POST-Autorisierung mit Body-Parametern wird pauschal abgelehnt |
| CR-008 | Toter Code | niedrig | offen | `tools.ts` re-exportiert `asError`, `text`, `withAudit` und `ToolContext` ohne Verwender |
| CR-009 | Bad Practices | niedrig | offen | `readContent` fällt für jede unbekannte Inhaltsart stillschweigend in den Pin-Zweig |
| CR-010 | Bad Practices | niedrig | offen | `normalizeJsonFixture` repariert falsch gespeichertes JSONB nachträglich statt korrekt einzufügen |
| CR-011 | Aufgaben-Abgleich | niedrig | offen | Plugin-Manifeste ohne Plan/Doku, doppelt gepflegte Texte und eigene Versionsnummer |

---

## Findings im Detail

### CR-001
- **Fundstelle:** `src/lib/domain/mcp-read.ts`, Funktion `encodeMcpImage` (Block `try { … } catch { throw new McpToolError("Bild zu groß für die Ausgabe."); }`)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-013, T-010
- **Beschreibung:** Der `catch`-Block fängt jeden Fehler von `sharp` ab und wandelt ihn in „Bild zu groß für die Ausgabe.“ um. Das gilt auch für beschädigte oder nicht dekodierbare Dateien (z. B. `vipspng: libpng read error`) und für fehlende Codecs. Der ursprüngliche Fehler wird weder geloggt noch im Audit-Log unterschieden (`withAudit` sieht ein `McpToolError` und schreibt `tool_error`). Genau das ist im E2E-Test passiert: Das Titelbild von Burg Rabenstein ist ein 1×1-PNG (siehe CR-002), wurde aber als „zu groß“ gemeldet und im Protokoll als „erwartungsgemäß“ abgetan. Nur die Überschreitung von `limitInputPixels` ist tatsächlich ein Größenfall.
- **Empfehlung:** Fehlerfälle trennen:
  1. Überschreitet das Bild `IMAGE_MAX_PIXELS` (sharp-Meldung enthält „pixel limit“; alternativ vorher `sharp(input).metadata()` prüfen), bleibt es bei „Bild zu groß für die Ausgabe.“.
  2. Jeder andere Fehler von `sharp` wird mit `console.error(JSON.stringify({ event: "mcp_image_decode_error", error: error.name }))` geloggt (ohne Pfad und ohne Datei-ID) und als `McpToolError("Bild kann nicht gelesen werden.")` gemeldet.
  3. Die bestehende Meldung nach Ausschöpfen aller Qualitätsstufen bleibt unverändert.
- **Abnahmekriterium:** Ein Unit-Test in `src/lib/domain/mcp-read.test.ts` ruft `encodeMcpImage` mit dem 1×1-PNG aus `scripts/seed-demo-world.mjs` (vor CR-002) auf und erwartet den Werkzeugfehler „Bild kann nicht gelesen werden.“ sowie genau einen `console.error`-Aufruf mit `event: "mcp_image_decode_error"`. Ein zweiter Test mit einem Bild über `IMAGE_MAX_PIXELS` (z. B. 5001×5000, per `sharp` erzeugt) erwartet weiterhin „Bild zu groß für die Ausgabe.“.

### CR-002
- **Fundstelle:** `scripts/seed-demo-world.mjs`, Konstante `tinyPng` (Zeile 14–17) und Funktion `upload`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-014, T-010
- **Beschreibung:** Das eingebettete Base64-PNG ist beschädigt. Nachgeprüft: `sharp(tinyPng).webp().toBuffer()` wirft `vipspng: libpng read error`. Das Upload-Endpunkt akzeptiert die Datei, weil `inspectImage` nur den Header prüft. Damit sind alle Bilder der Demowelt (Weltbild, Titelbild von Burg Rabenstein, Monster-Profilbild, beide Kartenbilder) in der App kaputt und über `bild_lesen` nicht lesbar. In der Testwelt wurde dasselbe PNG im selben Zeitraum durch ein gültiges 8×8-PNG ersetzt (`scripts/seed-mcp-test-world.mjs`, `fixturePng`), im Demowelt-Skript nicht. Außerdem verlangt T-014 „Bilder als kleine Dateien unter `scripts/demo-assets/`“; das Verzeichnis existiert nicht, das Skript bettet die Daten inline ein.
- **Empfehlung:**
  1. Ein gültiges, sichtbar erkennbares Bild (z. B. 256×256 PNG mit einfachem Motiv, damit Claude im E2E-Fall 5 etwas beschreiben kann) als `scripts/demo-assets/burg-rabenstein.png` ablegen; für Welt, Monster und Karten je eine eigene kleine Datei oder dieselbe wiederverwenden.
  2. `upload` liest die Datei per `fs.readFile` statt der Inline-Konstante.
  3. Auf Produktion die Bilder der bestehenden Demowelt über die App ersetzen (das Skript bricht bei vorhandener Welt ab) oder die Demowelt löschen und neu anlegen – Entscheidung des Projektinhabers.
  4. Optional als eigene Aufgabe: `inspectImage` bzw. der Upload-Pfad dekodiert Bilder einmal mit `sharp(...).metadata()`, damit beschädigte Dateien schon beim Upload abgelehnt werden.
- **Abnahmekriterium:** `scripts/demo-assets/` enthält mindestens eine Bilddatei; `grep -n "tinyPng" scripts/seed-demo-world.mjs` findet nichts mehr. Jede dort verwendete Datei lässt sich mit `sharp(<datei>).webp().toBuffer()` ohne Fehler umwandeln. Lokal ausgeführt liefert `bild_lesen` für das Titelbild von Burg Rabenstein der Demowelt einen Bildinhalt.

### CR-003
- **Fundstelle:** `.ai/infrastructure/mcp-e2e-test.md` (Tabellen „claude.ai“ und „Claude Code“, Abschnitt „Gesamtbewertung“); `.ai/feature-tasks/002-mcp-server.md`, Checkbox von T-010
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-010
- **Beschreibung:** Das Protokoll bewertet alle fünf Fälle als „bestanden“, obwohl die Abnahmekriterien von T-010 nicht erfüllt sind:
  - **Fall 5** verlangt, dass Claude das Titelbild von Burg Rabenstein über `bild_lesen` beschreibt. Das Bild wurde nicht geliefert; beschrieben wurde ein anderes Charakterbild. Die Gesamtbewertung nennt den Fehler „erwartungsgemäß“, tatsächlich ist die Ursache ein Defekt (CR-002, CR-001).
  - **Fall 1** verlangt alle Relationen der Tiefe 1. Protokolliert sind `welten_auflisten` und `inhalte_suchen`, nicht `relationen_abrufen`; ob die Relationen vollständig waren, ist nicht belegt.
  - **Fall 2** verlangt „genau die aktiven Quests“. Laut Notiz wurden Quests zweier Welten genannt.
  - Das Werkzeug `inhalte_suchen` existiert nicht (die Werkzeuge heißen `suchen` bzw. `inhalte_auflisten`). Die Werkzeugspalte ist damit als Nachweis unzuverlässig.
- **Empfehlung:** Nach CR-001 und CR-002 den E2E-Test in claude.ai und Claude Code wiederholen und das Protokoll mit den tatsächlich aufgerufenen Werkzeugnamen neu schreiben. Für Fall 2 die Frage auf die Demowelt eingrenzen („Welche Quests sind in MCP-Demo gerade aktiv?“) oder die Abweichung als bewusst akzeptiert vermerken (Entscheidung des Projektinhabers). Bis dahin T-010 in der Task-Datei wieder auf `- [ ]` setzen oder mit einem Vermerk „Fall 5 offen, siehe CR-002/CR-003“ versehen.
- **Abnahmekriterium:** `.ai/infrastructure/mcp-e2e-test.md` enthält nur existierende Werkzeugnamen (`grep -n "inhalte_suchen"` findet nichts). Fall 1 nennt `relationen_abrufen` als aufgerufenes Werkzeug, Fall 5 nennt `bild_lesen` mit dem Titelbild von Burg Rabenstein und eine Beschreibung dieses Bildes. Fall 2 ist entweder auf eine Welt eingegrenzt oder die Abweichung ist als Entscheidung mit Datum vermerkt. Die Checkbox von T-010 ist erst danach `[x]`.

### CR-004
- **Fundstelle:** `src/lib/mcp/tools/search.ts`, Zeile 38 (`const template = hit.templateType ? \` – ${hit.templateType}\` : "";`)
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006
- **Beschreibung:** Vor der Modulaufteilung gab `suchen` das deutsche Vorlagenlabel aus (`templateOf(hit.templateType).label`, z. B. „Gegenstand“). Nach der Aufteilung wird der rohe Datenbankschlüssel ausgegeben (`item`, `organization`, `none`). Das widerspricht der deutschen Ausgabe aller anderen Werkzeuge (V3) und ist eine unbeabsichtigte Verhaltensänderung eines reinen Refactorings. Kein Test deckt die Ausgabe ab.
- **Empfehlung:** In `search.ts` `templateOf` aus `@/lib/templates/registry` importieren und `templateOf(hit.templateType).label` ausgeben. Die Formatierung einer Trefferzeile als exportierte Funktion `renderSearchHit(hit)` herausziehen (analog zu `renderArticleListItem` in `contents-list.ts`), damit sie unit-testbar ist.
- **Abnahmekriterium:** Ein Unit-Test `src/lib/mcp/tools/search.test.ts` prüft, dass `renderSearchHit` für einen Treffer mit `templateType: "item"` den Text „Gegenstand“ und nicht „item“ enthält. In `npm run test:mcp` enthält die Antwort von `suchen` nach „Rabenstein“ für Player A das Label „Ort“ und nicht „place“ bzw. den jeweiligen DB-Schlüssel.

### CR-005
- **Fundstelle:** Alle `inputSchema` unter `src/lib/mcp/tools/*.ts`; Erwartungen in `src/app/mcp/mcp.mcp.test.ts` (`expect(toolText(largeLimit)).toContain("Too big")`, `expect(toolText(mapImage)).toContain("Invalid option: expected one of")`)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, T-013
- **Beschreibung:** T-006 verlangt bei ungültiger Eingabe „einen verständlichen Werkzeugfehler“. Tatsächlich erreichen die MCP-Clients Zod-Standardmeldungen auf Englisch („Too big: expected number to be <=50“, „Invalid option: expected one of …“), während alle übrigen Werkzeugfehler deutsch sind. Die neuen Tests prüfen genau diese englischen Texte ab und machen eine Korrektur dadurch zu einer Teständerung.
- **Empfehlung:** Zod-Meldungen für den MCP-Server auf Deutsch umstellen. Empfohlen: einmalig beim Laden des MCP-Moduls (z. B. am Anfang von `src/lib/mcp/tools/shared.ts`) `z.config(z.locales.de())` setzen, sofern das die App-weiten Zod-Meldungen nicht unerwünscht verändert; sonst pro Schema eigene deutsche Meldungen (`.max(50, "limit darf höchstens 50 sein.")`, `z.enum([...], { error: "Unbekannte Art. Erlaubt: welt, artikel, charakter, monster." })`). Die beiden Testerwartungen auf die deutschen Texte umstellen.
- **Abnahmekriterium:** In `npm run test:mcp` enthält die Antwort auf `suchen` mit `limit: 500` und auf `bild_lesen` mit `art: "karte"` jeweils einen deutschen Fehlertext; `grep -n "Too big\|Invalid option" src/app/mcp/mcp.mcp.test.ts` findet nichts mehr.

### CR-006
- **Fundstelle:** `src/app/mcp/mcp.mcp.test.ts` (Tests `T-007(1–4)`, `T-008`, `T-013(1–4)`), `src/lib/domain/mcp-read.test.ts` (`CR-006: never returns more than one megabyte …`)
- **Kategorie:** Testabdeckung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-008, T-013
- **Beschreibung:** T-008 und T-013 sind abgehakt, ihre Abnahmen aber nur teilweise automatisiert:
  - **T-008, zweiter Punkt:** Der `nur Spielleitung`-Artikel („Archiv der Spielleitung“) muss für Game Master **und** Master in `suchen`, `inhalt_lesen` und `relationen_abrufen` erscheinen. Geprüft ist nur `relationen_abrufen` für den Game Master; für den Master fehlt `toContain("Archiv der Spielleitung")`, `suchen` und `inhalt_lesen` fehlen für beide.
  - **T-013 (5):** Ein 10-MB-Bild wird in unter 5 s verkleinert ausgeliefert – kein Test vorhanden.
  - **`encodeMcpImage`-Test:** Er akzeptiert sowohl ein Ergebnis ≤ 1 MB als auch den Fehler „Bild zu groß für die Ausgabe.“. Würde die Funktion für jede Eingabe den Fehler werfen, bliebe der Test grün – genau diese Klasse von Fehler ist im E2E aufgetreten (CR-001). Er erzeugt zudem bei jedem Lauf ein 48-MB-Rauschbild (Timeout 30 s), was die Unit-Suite verlangsamt.
- **Empfehlung:**
  1. Den T-007/T-008-Test um `suchen` („Archiv“) und `inhalt_lesen` (`data.guildId`) für Game Master und Master ergänzen sowie `expect(toolText(masterRelations)).toContain("Archiv der Spielleitung")`.
  2. Einen Unit-Test für `encodeMcpImage` mit einem per `sharp` erzeugten ~10-MB-Bild (≤ 25 MP) ergänzen, der das Ergebnis ≤ 1 MB, lange Kante ≤ 1568 px und eine Laufzeit < 5 s prüft.
  3. Den bestehenden Rauschbild-Test deterministisch machen: Er muss für ein gültiges Bild **immer** ein Ergebnis liefern (ggf. kleineres Rauschbild, z. B. 2000×2000, damit die Fallback-Stufe greift); den Fehlerpfad deckt der Test aus CR-001 ab.
- **Abnahmekriterium:** `npm run test:mcp` enthält Erwartungen, dass „Archiv der Spielleitung“ für `test-gm` und `test-master` in `suchen`, `inhalt_lesen` und `relationen_abrufen` erscheint. `src/lib/domain/mcp-read.test.ts` enthält einen Test mit einem Eingangsbild > 8 MB, der ohne `try/catch` ein WebP-Ergebnis ≤ 1 MB in < 5 s erwartet; kein Test in dieser Datei akzeptiert mehr alternativ einen Fehler.

### CR-007
- **Fundstelle:** `src/lib/mcp-oauth.ts`, Funktion `hasRequiredMcpPkce`; Aufruf in `src/app/api/auth/[...all]/route.ts`
- **Kategorie:** Sicherheit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-003
- **Beschreibung:** `@better-auth/oauth-provider` akzeptiert `/oauth2/authorize` mit `GET` und `POST` (Body-Parameter). `hasRequiredMcpPkce` liest ausschließlich die URL-Query. Eine gültige POST-Autorisierung mit `code_challenge` im Body wird daher mit „PKCE mit der Methode S256 ist erforderlich.“ abgelehnt. Das schlägt sicher (geschlossen) fehl, ist aber eine irreführende Meldung und nirgends als Entscheidung dokumentiert. Dasselbe Muster gilt für `hasAllowedMcpAuthorizeRedirect`.
- **Empfehlung:** Entscheidung festhalten: Entweder in ADR-005 bzw. `.ai/architecture/mcp-oauth-anbindung.md` vermerken, dass `/oauth2/authorize` für MCP nur per `GET` unterstützt wird, und POST dort explizit mit `405`/`invalid_request` („Nur GET wird unterstützt.“) ablehnen; oder beide Prüfungen lesen bei `POST` zusätzlich den Body (wie `formBody` es für den Token-Endpunkt tut).
- **Abnahmekriterium:** Ein Unit-Test in `src/lib/mcp-oauth.test.ts` deckt `POST /api/auth/oauth2/authorize` ab und erwartet das dokumentierte Verhalten (entweder die eindeutige GET-only-Meldung oder `true` bei S256 im Body). Die Entscheidung steht mit Datum in der OAuth-Architekturdoku.

### CR-008
- **Fundstelle:** `src/lib/mcp/tools.ts`, Zeilen `export { asError, text, withAudit } from "./tools/shared";` und `export type { ToolContext } from "./tools/shared";`
- **Kategorie:** Toter Code
- **Schweregrad:** niedrig
- **Beschreibung:** Außerhalb von `src/lib/mcp/tools/` importiert niemand diese Re-Exports; `src/app/mcp/route.ts` nutzt nur `registerMcpReadTools`. Die Re-Exports erweitern die öffentliche Oberfläche des Moduls ohne Verwender.
- **Empfehlung:** Beide Re-Export-Zeilen entfernen. Braucht Plan `011` die Helfer später, importiert er sie direkt aus `@/lib/mcp/tools/shared`.
- **Abnahmekriterium:** `src/lib/mcp/tools.ts` enthält kein `export {` bzw. `export type {` mehr; `npm run lint`, `npm run typecheck` (bzw. `tsc --noEmit`) und `npm test` sind grün.

### CR-009
- **Fundstelle:** `src/lib/mcp/tools/content-read.ts`, Funktion `readContent` (letzter Block ab `const row = await getMcpPin(...)`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-006
- **Beschreibung:** Vor der Aufteilung endete die Kette mit `else if (art === "pin") … else throw new McpToolError("Diese Inhaltsart wird noch nicht unterstützt.")`. Jetzt wird jeder nicht explizit behandelte Wert als Pin gelesen. Kommt in `contentKind` eine neue Art hinzu (z. B. durch Plan `011`), liefert `inhalt_lesen` stillschweigend „Inhalt nicht gefunden.“, und TypeScript warnt nicht.
- **Empfehlung:** `readContent` als `switch (art)` mit einem Zweig pro Art schreiben und am Ende einen Exhaustiveness-Check (`const unreachable: never = art; throw new McpToolError("Diese Inhaltsart wird noch nicht unterstützt.");`) setzen. Die Zweige optional in eigene Funktionen `readArticle`, `readQuest` … auslagern, um die Funktion zu verkürzen.
- **Abnahmekriterium:** `readContent` enthält einen expliziten Zweig für `"pin"` und einen `never`-Check; das Hinzufügen eines neuen Werts zu `contentKind` ohne Zweig führt zu einem Typfehler.

### CR-010
- **Fundstelle:** `scripts/seed-mcp-test-world.mjs`, Funktion `normalizeJsonFixture` und deren Aufruf in `main`
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-002
- **Beschreibung:** Das Skript speichert JSONB-Werte zuerst als JSON-String (durch `JSON.stringify` in SQL-Literalen) und korrigiert sie danach per `UPDATE … (#>> '{}')::jsonb` über eine handgepflegte Liste von elf Spalten. Neue JSONB-Spalten in der Testwelt müssen an zwei Stellen gepflegt werden; vergisst man die Liste, entstehen erneut String-JSONB-Werte, die sich anders verhalten als Produktdaten.
- **Empfehlung:** An den Einfügestellen `sql.json(value)` (postgres.js) statt `JSON.stringify(value)` verwenden, dann `normalizeJsonFixture` entfernen.
- **Abnahmekriterium:** `normalizeJsonFixture` existiert nicht mehr. Nach einem frischen Lauf von `scripts/seed-mcp-test-world.mjs` liefert `SELECT count(*) FROM articles WHERE jsonb_typeof(body_json) = 'string'` (analog für die übrigen zehn Spalten) `0`, und `npm run test:mcp` ist grün.

### CR-011
- **Fundstelle:** `plugins/worldcraft/plugin.json`, `plugins/worldcraft/.codex-plugin/plugin.json`, `plugins/worldcraft/mcp.json`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Beschreibung:** Die drei Dateien wurden mit dem Release 0.1.9 hinzugefügt, sind aber in keiner Task-Datei und keiner Doku unter `.ai/` erwähnt (Plan `002` behandelt nur Claude-Clients). Beide Manifeste enthalten dieselben Texte (`displayName`, `shortDescription`, `longDescription`, `defaultPrompt` …) doppelt. Die Plugin-Version `0.1.0` ist von der App-Version `0.1.9` entkoppelt, ohne dass eine Versionsregel festgehalten ist. Die Beschreibung verspricht „schreibgeschützt“; mit Plan `011` (schreibende Werkzeuge) wird das falsch, ohne dass eine Stelle daran erinnert.
- **Empfehlung:** In `.ai/architecture/mcp.md` (oder einer eigenen Datei unter `.ai/infrastructure/`) einen Abschnitt „Client-Plugins“ anlegen: Zweck der Dateien, welche Datei welcher Client liest, Versionsregel (eigene SemVer oder an App gekoppelt) und Hinweis, dass die Beschreibung bei Plan `011` angepasst werden muss. Plan `011` um einen entsprechenden Punkt ergänzen. Falls nur ein Manifest-Format tatsächlich gebraucht wird, das andere entfernen.
- **Abnahmekriterium:** Eine Datei unter `.ai/` beschreibt die Plugin-Manifeste inklusive Versionsregel; Plan `011` enthält eine Aufgabe oder ein Abnahmekriterium zur Anpassung von „schreibgeschützt“ in den Manifesten. Entweder existiert nur noch ein Manifest, oder die Doppelung ist dort als bewusst begründet vermerkt.

---

## Prioritätenliste

1. **CR-002** – defektes Demobild ersetzen (Voraussetzung für einen gültigen E2E-Nachweis).
2. **CR-001** – Dekodierfehler korrekt melden und loggen, damit solche Fälle nicht wieder als „zu groß“ durchrutschen.
3. **CR-003** – E2E-Test wiederholen, Protokoll korrigieren, T-010 erst danach abhaken.
4. **CR-004** – Regression in `suchen` beheben (kleiner Fix, sichtbare Ausgabe).
5. **CR-005** – deutsche Validierungsfehler.
6. **CR-006** – fehlende Abnahmetests für T-008 und T-013 (5), Bildtest deterministisch.
7. **CR-009**, **CR-008**, **CR-007**, **CR-010**, **CR-011** – Aufräumarbeiten und Dokumentation.
