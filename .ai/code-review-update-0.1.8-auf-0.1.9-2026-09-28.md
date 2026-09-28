# Code Review – Update 0.1.8 auf 0.1.9 (MCP-Server, Plan 002) (2026-09-28)

**Baseline:** Commit `6cc56ce92f7b82c740750498125b8aad3d39c905` (`main`), Working Tree sauber (keine uncommitteten Änderungen).
**Geprüfte Task-Datei:** `.ai/feature-tasks/002-mcp-server.md`
**Umfang:** Alle Änderungen seit dem Release-Commit 0.1.8 (`83d093c`), also `83d093c..6cc56ce` (Commits `a317aa5`, `4704360`, `a437194`, `6cc56ce`). Dazu gehören die Modulaufteilung von `src/lib/mcp/tools.ts` (CR-011 aus dem Review vom 2026-09-26), die PKCE-Prüfung am Autorisierungsendpunkt, `encodeMcpImage`, die erweiterte MCP-Suite und neue Unit-Tests, Anpassungen an den Seed-Skripten, das E2E-Protokoll sowie die neuen Plugin-Manifeste unter `plugins/worldcraft/`. Reine Dokumentationsänderungen an Plan `011` wurden nur auf Widersprüche zum Code geprüft.

## Begriffe

Es gelten die Begriffe aus `.ai/feature-tasks/002-mcp-server.md` (Abschnitt *Begriffe & Systeme*) und aus `.ai/code-review-002-mcp-server-2026-09-26.md`. Zusätzlich:
- **Demowelt:** Die von `scripts/seed-demo-world.mjs` über die öffentliche API angelegte Welt „MCP-Demo“ (T-014), Grundlage des E2E-Tests (T-010).
- **Testwelt:** Die von `scripts/seed-mcp-test-world.mjs` direkt in die lokale Datenbank geschriebene Welt „MCP-Testwelt“ (T-002), Grundlage von `npm run test:mcp`.
- **Zod-Standardmeldung:** Englischer Fehlertext, den Zod bei einer Schemaverletzung erzeugt (z. B. „Too big: expected number to be <=50“).

## Abhängigkeiten zwischen Findings

- **CR-003** (E2E-Protokoll) ist reine Dokumentkorrektur ohne neuen Testlauf und hängt von keinem anderen Finding ab (entschieden 2026-09-28, Plan-Review).
- **CR-006** (Testlücken) nimmt die Tests aus CR-001, CR-004 und CR-005 auf.

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Fehlerbehandlung & Validierung | mittel | behoben | `encodeMcpImage` meldet jeden Dekodierfehler als „Bild zu groß für die Ausgabe.“ und loggt nichts |
| CR-002 | Aufgaben-Abgleich | mittel | verworfen | Demowelt-Skript lädt ein defektes PNG hoch; kein Demobild ist über `bild_lesen` lesbar |
| CR-003 | Aufgaben-Abgleich | mittel | behoben | E2E-Protokoll wertet nicht erfüllte Fälle als „bestanden“; T-010 ist zu früh abgehakt |
| CR-004 | Lesbarkeit & Wartbarkeit | mittel | behoben | Regression durch Modulaufteilung: `suchen` gibt den englischen Vorlagenschlüssel statt des deutschen Labels aus |
| CR-005 | Fehlerbehandlung & Validierung | mittel | behoben | Eingabefehler erreichen MCP-Clients als englische Zod-Standardmeldungen; Tests zementieren das |
| CR-006 | Testabdeckung | mittel | behoben | Abnahmen T-008 und T-013 (5) nur teilweise automatisiert; Bildtest kann Regressionen nicht erkennen |
| CR-007 | Sicherheit | niedrig | behoben | `hasRequiredMcpPkce` liest nur die Query; POST-Autorisierung mit Body-Parametern wird pauschal abgelehnt |
| CR-008 | Toter Code | niedrig | behoben | `tools.ts` re-exportiert `asError`, `text`, `withAudit` und `ToolContext` ohne Verwender |
| CR-009 | Bad Practices | niedrig | behoben | `readContent` fällt für jede unbekannte Inhaltsart stillschweigend in den Pin-Zweig |
| CR-010 | Bad Practices | niedrig | behoben | `normalizeJsonFixture` repariert falsch gespeichertes JSONB nachträglich statt korrekt einzufügen |
| CR-011 | Aufgaben-Abgleich | niedrig | behoben | Plugin-Manifeste ohne Plan/Doku, doppelt gepflegte Texte und eigene Versionsnummer |

---

## Findings im Detail

### CR-001
- **Status:** behoben (2026-09-28): Dekodierfehler werden geloggt und als „Bild kann nicht gelesen werden.“ gemeldet; der Pixelgrenzen-Fehler bleibt separat getestet.
- **Fundstelle:** `src/lib/domain/mcp-read.ts`, Funktion `encodeMcpImage` (Block `try { … } catch { throw new McpToolError("Bild zu groß für die Ausgabe."); }`)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-013, T-010
- **Beschreibung:** Der `catch`-Block fängt jeden Fehler von `sharp` ab und wandelt ihn in „Bild zu groß für die Ausgabe.“ um. Das gilt auch für beschädigte oder nicht dekodierbare Dateien (z. B. `vipspng: libpng read error`) und für fehlende Codecs. Der ursprüngliche Fehler wird weder geloggt noch im Audit-Log unterschieden (`withAudit` sieht ein `McpToolError` und schreibt `tool_error`). Genau das ist im E2E-Test passiert: Das Titelbild von Burg Rabenstein ist ein 1×1-PNG (siehe CR-002), wurde aber als „zu groß“ gemeldet und im Protokoll als „erwartungsgemäß“ abgetan. Nur die Überschreitung von `limitInputPixels` ist tatsächlich ein Größenfall.
- **Empfehlung:** Fehlerfälle trennen:
  1. Überschreitet das Bild `IMAGE_MAX_PIXELS` (erkannt daran, dass die sharp-Fehlermeldung `Input image exceeds pixel limit` enthält; geprüft mit sharp der Projektversion), bleibt es bei „Bild zu groß für die Ausgabe.“.
  2. Jeder andere Fehler von `sharp` wird mit `console.error(JSON.stringify({ event: "mcp_image_decode_error", error: error.name }))` geloggt (ohne Pfad und ohne Datei-ID) und als `McpToolError("Bild kann nicht gelesen werden.")` gemeldet.
  3. Die bestehende Meldung nach Ausschöpfen aller Qualitätsstufen bleibt unverändert.
- **Abnahmekriterium:** Ein Unit-Test in `src/lib/domain/mcp-read.test.ts` ruft `encodeMcpImage` mit dem beschädigten 1×1-PNG auf, das als Base64-Konstante direkt im Test steht (Wert: der bisherige `tinyPng` aus `scripts/seed-demo-world.mjs`, Commit `6cc56ce`), und und erwartet den Werkzeugfehler „Bild kann nicht gelesen werden.“ sowie genau einen `console.error`-Aufruf mit `event: "mcp_image_decode_error"`. Ein zweiter Test mit einem Bild über `IMAGE_MAX_PIXELS` (z. B. 5001×5000, per `sharp` erzeugt) erwartet weiterhin „Bild zu groß für die Ausgabe.“.

- **Status:** behoben (Review-Check 2026-09-28): `encodeMcpImage` unterscheidet `Input image exceeds pixel limit` („Bild zu groß für die Ausgabe.“) von Dekodierfehlern (Log `mcp_image_decode_error`, „Bild kann nicht gelesen werden.“); beide Unit-Tests vorhanden und grün.
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
- **Status:** verworfen (entschieden 2026-09-28, Plan-Review): Die Demowelt ist für den Projektinhaber nicht relevant; weder Skript noch Produktionsdaten werden repariert. Der Befund bleibt als Ursache des E2E-Fehlers dokumentiert (Bezug für CR-001 und CR-003).

### CR-003
- **Status:** behoben (2026-09-28): Beide E2E-Tabellen, Gesamtbewertung und der Abnahmevermerk von T-010 dokumentieren die akzeptierten Abweichungen.
- **Fundstelle:** `.ai/infrastructure/mcp-e2e-test.md` (Tabellen „claude.ai“ und „Claude Code“, Abschnitt „Gesamtbewertung“); `.ai/feature-tasks/002-mcp-server.md`, Checkbox von T-010
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-010
- **Beschreibung:** Das Protokoll bewertet alle fünf Fälle als „bestanden“, obwohl die Abnahmekriterien von T-010 nicht erfüllt sind:
  - **Fall 5** verlangt, dass Claude das Titelbild von Burg Rabenstein über `bild_lesen` beschreibt. Das Bild wurde nicht geliefert; beschrieben wurde ein anderes Charakterbild. Die Gesamtbewertung nennt den Fehler „erwartungsgemäß“, tatsächlich ist die Ursache ein Defekt (CR-002, CR-001).
  - **Fall 1** verlangt alle Relationen der Tiefe 1. Protokolliert sind `welten_auflisten` und `inhalte_suchen`, nicht `relationen_abrufen`; ob die Relationen vollständig waren, ist nicht belegt.
  - **Fall 2** verlangt „genau die aktiven Quests“. Laut Notiz wurden Quests zweier Welten genannt.
  - Das Werkzeug `inhalte_suchen` existiert nicht (die Werkzeuge heißen `suchen` bzw. `inhalte_auflisten`). Die Werkzeugspalte ist damit als Nachweis unzuverlässig.
- **Empfehlung (entschieden 2026-09-28, Plan-Review):** **Protokoll nur korrigieren, kein neuer E2E-Lauf.** In `.ai/infrastructure/mcp-e2e-test.md`:
  1. Jedes Vorkommen von `inhalte_suchen` durch `suchen` ersetzen (einziges existierendes Suchwerkzeug; die Werkzeugliste steht in `src/lib/mcp/tools.ts`).
  2. Fall 1: Ergebnis auf „bestanden mit Abweichung“ setzen; Notiz: „`relationen_abrufen` wurde nicht aufgerufen; Vollständigkeit der Relationen der Tiefe 1 nicht belegt. Abweichung akzeptiert (CR-003).“
  3. Fall 2: Ergebnis auf „bestanden mit Abweichung“ setzen; Notiz: „Claude nannte Quests beider Welten statt nur der Demowelt. Abweichung akzeptiert (CR-003).“
  4. Fall 5: Ergebnis auf „nicht bestanden – akzeptiert“ setzen; Notiz: „Das Titelbild der Demowelt ist ein beschädigtes PNG (`vipspng: libpng read error`), `bild_lesen` meldete fälschlich ‚Bild zu groß für die Ausgabe.‘ (Fehlerklassifizierung: CR-001). Die Demowelt wird bewusst nicht repariert (CR-002 verworfen). Ersatzweise wurde ein Charakterbild erfolgreich beschrieben.“
  5. Beide Tabellen (claude.ai und Claude Code) gleich behandeln; den Satz „lieferte erwartungsgemäß die Fehlermeldung zur Übertragungsgröße“ in der Gesamtbewertung durch den Verweis auf Fall 5 ersetzen und die Gesamtbewertung auf „bestanden mit akzeptierten Abweichungen (Fälle 1, 2, 5)“ ändern.
  6. In `.ai/feature-tasks/002-mcp-server.md` bleibt T-010 `[x]`; direkt unter dem Abnahmekriterium von T-010 einen Vermerk ergänzen: „Abnahme mit akzeptierten Abweichungen, siehe `.ai/infrastructure/mcp-e2e-test.md` und CR-003 (2026-09-28).“
- **Abnahmekriterium:** `grep -n "inhalte_suchen\|erwartungsgemäß" .ai/infrastructure/mcp-e2e-test.md` findet nichts. Die Fälle 1, 2 und 5 tragen in beiden Tabellen die oben genannten Ergebnisse und Notizen. T-010 in der Task-Datei enthält den Vermerk mit Verweis auf CR-003.

- **Status:** behoben (Review-Check 2026-09-28): `mcp-e2e-test.md` nutzt nur noch `suchen`, Fälle 1/2/5 in beiden Tabellen wie festgelegt, Gesamtbewertung „bestanden mit akzeptierten Abweichungen (Fälle 1, 2, 5)“; T-010 trägt den Vermerk mit Verweis auf CR-003.
### CR-004
- **Status:** behoben (2026-09-28): `renderSearchHit` verwendet das deutsche Label aus der Vorlagen-Registry und ist unit-getestet.
- **Fundstelle:** `src/lib/mcp/tools/search.ts`, Zeile 38 (`const template = hit.templateType ? \` – ${hit.templateType}\` : "";`)
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006
- **Beschreibung:** Vor der Modulaufteilung gab `suchen` das deutsche Vorlagenlabel aus (`templateOf(hit.templateType).label`, z. B. „Gegenstand“). Nach der Aufteilung wird der rohe Datenbankschlüssel ausgegeben (`item`, `organization`, `none`). Das widerspricht der deutschen Ausgabe aller anderen Werkzeuge (V3) und ist eine unbeabsichtigte Verhaltensänderung eines reinen Refactorings. Kein Test deckt die Ausgabe ab.
- **Empfehlung:** In `search.ts` `templateOf` aus `@/lib/templates/registry` importieren und `templateOf(hit.templateType).label` ausgeben. Die Formatierung einer Trefferzeile als exportierte Funktion `renderSearchHit(hit)` herausziehen (analog zu `renderArticleListItem` in `contents-list.ts`), damit sie unit-testbar ist.
- **Abnahmekriterium:** Ein Unit-Test `src/lib/mcp/tools/search.test.ts` prüft, dass `renderSearchHit` für einen Treffer mit `templateType: "item"` den Text „Gegenstand“ und nicht „item“ enthält. In `npm run test:mcp` enthält die Antwort von `suchen` nach „Rabenstein“ für Player A die Zeile `Burg Rabenstein (Artikel, <id>) – Ort` und nicht `– place` (Vorlagentyp `place`, Label „Ort“ laut `src/lib/templates/registry.ts`).

- **Status:** behoben (Review-Check 2026-09-28): `renderSearchHit` in `search.ts` gibt `templateOf(...).label` aus; Unit-Test `search.test.ts` grün; MCP-Suite erwartet `– Ort` statt `– place`.
### CR-005
- **Status:** behoben (2026-09-28): Die serverweite Zod-Locale ist deutsch konfiguriert; Unit- und MCP-Tests prüfen die deutschen Fehlertexte.
- **Fundstelle:** Alle `inputSchema` unter `src/lib/mcp/tools/*.ts`; Erwartungen in `src/app/mcp/mcp.mcp.test.ts` (`expect(toolText(largeLimit)).toContain("Too big")`, `expect(toolText(mapImage)).toContain("Invalid option: expected one of")`)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, T-013
- **Beschreibung:** T-006 verlangt bei ungültiger Eingabe „einen verständlichen Werkzeugfehler“. Tatsächlich erreichen die MCP-Clients Zod-Standardmeldungen auf Englisch („Too big: expected number to be <=50“, „Invalid option: expected one of …“), während alle übrigen Werkzeugfehler deutsch sind. Die neuen Tests prüfen genau diese englischen Texte ab und machen eine Korrektur dadurch zu einer Teständerung.
- **Empfehlung (entschieden 2026-09-28, Plan-Review):** **Globale deutsche Zod-Locale.**
  1. Neues Modul `src/lib/zod-locale.ts` mit `export function configureZodLocale() { z.config(z.locales.de()); }` (Import `import { z } from "zod";`).
  2. `configureZodLocale()` als erste Anweisung in `register()` von `src/instrumentation.ts` aufrufen, außerhalb jeder Runtime-Verzweigung, damit es für Node- und Edge-Runtime vor der ersten Anfrage gilt. `z.config` ist prozessweit; es gibt keine Zod-Nutzung in Client-Komponenten (geprüft 2026-09-28), daher reicht der Server.
  3. Bewusst akzeptierte Nebenwirkung: `validateDomain` in `src/lib/http.ts` zeigt als Rückfall (`parsed.error.issues[0]?.message`) künftig deutsche statt englische Zod-Standardmeldungen in der App.
  4. Die beiden Erwartungen in `src/app/mcp/mcp.mcp.test.ts` (`"Too big"`, `"Invalid option: expected one of"`) auf die tatsächlich von `z.locales.de` erzeugten deutschen Texte umstellen (vorher einmal lokal ausgeben lassen und den stabilen Anfang des Textes prüfen).
  5. Unit-Tests laden `instrumentation.ts` nicht. Ein Unit-Test `src/lib/zod-locale.test.ts` ruft `configureZodLocale()` auf und prüft, dass `z.number().max(50).safeParse(500)` eine deutsche Meldung liefert.
- **Abnahmekriterium:** `src/instrumentation.ts` ruft `configureZodLocale()` auf. In `npm run test:mcp` enthält die Antwort auf `suchen` mit `limit: 500` und auf `bild_lesen` mit `art: "karte"` jeweils einen deutschen Fehlertext; `grep -rn "Too big\|Invalid option" src` findet nichts mehr. `src/lib/zod-locale.test.ts` ist grün.

- **Status:** behoben (Review-Check 2026-09-28): `src/lib/zod-locale.ts` (`configureZodLocale`) wird als erste Anweisung in `register()` aufgerufen; `zod-locale.test.ts` grün; MCP-Suite erwartet „Zu groß“ bzw. „Ungültige Option“; keine englischen Zod-Texte mehr in `src`. Zod hält die Konfiguration auf `globalThis`, sie gilt also bundleübergreifend.
### CR-006
- **Status:** behoben (2026-09-28): Die MCP-Suite prüft Sichtbarkeit für Game Master und Master in allen drei Werkzeugen; der Bildtest liefert ein Ergebnis zwingend in unter fünf Sekunden.
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
  2. Den bestehenden Rauschbild-Test (4000×4000) ersetzen durch ein per `sharp` erzeugtes Rauschbild von **1850×1850** Pixeln (als PNG ca. 9,8 MB, also knapp unter dem Upload-Limit von 10 MB für Nicht-Kartenbilder). Der Test erwartet **ohne** `try/catch` ein WebP-Ergebnis ≤ 1 MB, lange Kante ≤ 1568 px, und eine Laufzeit < 5 s (gemessen um den `encodeMcpImage`-Aufruf). Damit ist T-013 (5) abgedeckt. Hinweis: Ein Rauschbild mit 2000×2000 liegt mit ca. 1,04 MB bei Qualität 46 knapp über der Grenze und ist als Testfall zu instabil (gemessen 2026-09-28); 1850×1850 landet sicher in der 1024-px-Fallback-Stufe (ca. 0,3 MB, < 1 s).
  3. Den Fehlerpfad deckt der Test aus CR-001 ab.
- **Abnahmekriterium:** `npm run test:mcp` enthält Erwartungen, dass „Archiv der Spielleitung“ für `test-gm` und `test-master` in `suchen`, `inhalt_lesen` und `relationen_abrufen` erscheint. `src/lib/domain/mcp-read.test.ts` enthält einen Test mit einem Eingangsbild zwischen 8 und 10 MB, der ohne `try/catch` ein WebP-Ergebnis ≤ 1 MB in < 5 s erwartet; kein Test in dieser Datei akzeptiert mehr alternativ einen Fehler.

- **Status:** behoben (Review-Check 2026-09-28): T-008-Test prüft „Archiv der Spielleitung“ für GM und Master in `suchen`, `inhalt_lesen` und `relationen_abrufen`; Rauschbild-Test 1850×1850 ohne `try/catch` mit < 5 s (gemessen ca. 1 s).
### CR-007
- **Status:** behoben (2026-09-28): POST auf den Authorize-Endpunkt liefert vor jeder Query-Prüfung einen geloggten HTTP-405-Fehler mit `Allow: GET`; die Architekturentscheidung ist dokumentiert und integration-getestet.
- **Fundstelle:** `src/lib/mcp-oauth.ts`, Funktion `hasRequiredMcpPkce`; Aufruf in `src/app/api/auth/[...all]/route.ts`
- **Kategorie:** Sicherheit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-003
- **Beschreibung:** `@better-auth/oauth-provider` akzeptiert `/oauth2/authorize` mit `GET` und `POST` (Body-Parameter). `hasRequiredMcpPkce` liest ausschließlich die URL-Query. Eine gültige POST-Autorisierung mit `code_challenge` im Body wird daher mit „PKCE mit der Methode S256 ist erforderlich.“ abgelehnt. Das schlägt sicher (geschlossen) fehl, ist aber eine irreführende Meldung und nirgends als Entscheidung dokumentiert. Dasselbe Muster gilt für `hasAllowedMcpAuthorizeRedirect`.
- **Empfehlung (entschieden 2026-09-28, Plan-Review):** **GET-only, POST mit 405.**
  1. In `handle()` von `src/app/api/auth/[...all]/route.ts` direkt nach der Prüfung `isMcpOAuthRequest && !isMcpEnabled()` (der 404 des Hauptschalters hat Vorrang) einen Zweig ergänzen: `method === "POST" && pathname === "/api/auth/oauth2/authorize"` → `Response.json({ error: "invalid_request", error_description: "Die Autorisierung ist nur per GET möglich." }, { status: 405, headers: { Allow: "GET" } })`. Die Antwort wird wie alle MCP-OAuth-Antworten über `logMcpOAuthResponse` protokolliert.
  2. `hasRequiredMcpPkce` und `hasAllowedMcpAuthorizeRedirect` bleiben unverändert (Query-basiert); ihr Docstring erhält den Satz „Authorize is GET-only (see CR-007); POST is rejected earlier with 405.“
  3. Die Kompatibilitätsroute `src/app/authorize/route.ts` exportiert bereits nur `GET`; keine Änderung.
  4. In `.ai/architecture/mcp-oauth-anbindung.md` die Entscheidung mit Datum vermerken: „`/api/auth/oauth2/authorize` wird für MCP nur per GET unterstützt; POST liefert 405 (CR-007, 2026-09-28).“
- **Abnahmekriterium:** Ein Test in `src/app/mcp/mcp.mcp.test.ts` (oder ein Unit-Test des Auth-Route-Handlers mit gemocktem `auth`) sendet `POST /api/auth/oauth2/authorize` mit gültigen Parametern (S256) im Form-Body und erwartet Status 405, Header `Allow: GET` und `error: "invalid_request"`. Der bestehende GET-Flow (`authorizeMcpClient`) bleibt grün. `.ai/architecture/mcp-oauth-anbindung.md` enthält den Vermerk.

- **Status:** behoben (Review-Check 2026-09-28): POST auf `/api/auth/oauth2/authorize` liefert 405 mit `Allow: GET` direkt nach der Hauptschalter-Prüfung; Docstrings ergänzt; MCP-Suite-Test und Vermerk in `mcp-oauth-anbindung.md` vorhanden.
### CR-008
- **Status:** behoben (2026-09-28): Die ungenutzten Re-Exports wurden entfernt; der bestehende Test importiert den Audit-Wrapper direkt aus seinem Modul.
- **Fundstelle:** `src/lib/mcp/tools.ts`, Zeilen `export { asError, text, withAudit } from "./tools/shared";` und `export type { ToolContext } from "./tools/shared";`
- **Kategorie:** Toter Code
- **Schweregrad:** niedrig
- **Beschreibung:** Außerhalb von `src/lib/mcp/tools/` importiert niemand diese Re-Exports; `src/app/mcp/route.ts` nutzt nur `registerMcpReadTools`. Die Re-Exports erweitern die öffentliche Oberfläche des Moduls ohne Verwender.
- **Empfehlung:** Beide Re-Export-Zeilen entfernen. Braucht Plan `011` die Helfer später, importiert er sie direkt aus `@/lib/mcp/tools/shared`.
- **Abnahmekriterium:** `src/lib/mcp/tools.ts` enthält kein `export {` bzw. `export type {` mehr; `npm run lint`, `npm run typecheck` und `npm test` sind grün.

- **Status:** behoben (Review-Check 2026-09-28): Re-Exports aus `tools.ts` entfernt; `tools.test.ts` importiert `withAudit` jetzt aus `./tools/shared`.
### CR-009
- **Status:** behoben (2026-09-28): `readContent` nutzt nun einen erschöpfenden `switch` mit explizitem Pin-Zweig und `never`-Check.
- **Fundstelle:** `src/lib/mcp/tools/content-read.ts`, Funktion `readContent` (letzter Block ab `const row = await getMcpPin(...)`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-006
- **Beschreibung:** Vor der Aufteilung endete die Kette mit `else if (art === "pin") … else throw new McpToolError("Diese Inhaltsart wird noch nicht unterstützt.")`. Jetzt wird jeder nicht explizit behandelte Wert als Pin gelesen. Kommt in `contentKind` eine neue Art hinzu (z. B. durch Plan `011`), liefert `inhalt_lesen` stillschweigend „Inhalt nicht gefunden.“, und TypeScript warnt nicht.
- **Empfehlung:** `readContent` als `switch (art)` mit einem Zweig pro Art schreiben und am Ende einen Exhaustiveness-Check (`const unreachable: never = art; throw new McpToolError("Diese Inhaltsart wird noch nicht unterstützt.");`) setzen. Die Zweige optional in eigene Funktionen `readArticle`, `readQuest` … auslagern, um die Funktion zu verkürzen.
- **Abnahmekriterium:** `readContent` enthält einen expliziten Zweig für `"pin"` und einen `never`-Check; das Hinzufügen eines neuen Werts zu `contentKind` ohne Zweig führt zu einem Typfehler.

- **Status:** behoben (Review-Check 2026-09-28): `readContent` ist ein `switch` mit explizitem `pin`-Zweig und `never`-Check im `default`.
### CR-010
- **Status:** behoben (2026-09-28): Der Seed verwendet beim Einfügen `sql.json`; die nachträgliche Normalisierung ist entfernt und die frische Testwelt wurde ohne String-JSONB geprüft.
- **Fundstelle:** `scripts/seed-mcp-test-world.mjs`, Funktion `normalizeJsonFixture` und deren Aufruf in `main`
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-002
- **Beschreibung:** Das Skript speichert JSONB-Werte zuerst als JSON-String (durch `JSON.stringify` in SQL-Literalen) und korrigiert sie danach per `UPDATE … (#>> '{}')::jsonb` über eine handgepflegte Liste von elf Spalten. Neue JSONB-Spalten in der Testwelt müssen an zwei Stellen gepflegt werden; vergisst man die Liste, entstehen erneut String-JSONB-Werte, die sich anders verhalten als Produktdaten.
- **Empfehlung:** An den Einfügestellen `sql.json(value)` (postgres.js) statt `JSON.stringify(value)` verwenden, dann `normalizeJsonFixture` entfernen.
- **Abnahmekriterium:** `normalizeJsonFixture` existiert nicht mehr. Nach einem frischen Lauf von `scripts/seed-mcp-test-world.mjs` liefert `SELECT count(*) FROM articles WHERE jsonb_typeof(body_json) = 'string'` (analog für die übrigen zehn Spalten) `0`, und `npm run test:mcp` ist grün.

- **Status:** behoben (Review-Check 2026-09-28): `normalizeJsonFixture` entfernt, Einfügestellen nutzen `sql.json(...)`. Die DB-Abfrage aus dem Abnahmekriterium wurde in diesem Check nicht ausgeführt (keine Datenbank im isolierten Tree).
### CR-011
- **Status:** behoben (2026-09-28): Die Architektur dokumentiert Zweck, Dateien, bewusste Textdoppelung und Versionsregel; Plan 011 enthält die Folge-Annahme.
- **Fundstelle:** `plugins/worldcraft/plugin.json`, `plugins/worldcraft/.codex-plugin/plugin.json`, `plugins/worldcraft/mcp.json`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Beschreibung:** Die drei Dateien wurden mit dem Release 0.1.9 hinzugefügt, sind aber in keiner Task-Datei und keiner Doku unter `.ai/` erwähnt (Plan `002` behandelt nur Claude-Clients). Beide Manifeste enthalten dieselben Texte (`displayName`, `shortDescription`, `longDescription`, `defaultPrompt` …) doppelt. Die Plugin-Version `0.1.0` ist von der App-Version `0.1.9` entkoppelt, ohne dass eine Versionsregel festgehalten ist. Die Beschreibung verspricht „schreibgeschützt“; mit Plan `011` (schreibende Werkzeuge) wird das falsch, ohne dass eine Stelle daran erinnert.
- **Einordnung (geklärt 2026-09-28, Plan-Review):** Die Manifeste verpacken die MCP-Verbindung ausschließlich für OpenAI-Clients (ChatGPT/Codex). Claude braucht sie nicht: claude.ai/Desktop nutzt den Custom Connector mit der MCP-URL, Claude Code `claude mcp add --transport http worldcraft https://worldcraft.lagolago.at/mcp`. Das Codex-Manifest wird von Claude nicht gelesen.
- **Empfehlung (entschieden 2026-09-28, Plan-Review):** **Beide Manifeste behalten und dokumentieren.**
  1. In `.ai/architecture/mcp.md` einen Abschnitt „Client-Plugins (OpenAI)“ ergänzen mit: Zweck (Ein-Klick-Einbindung in ChatGPT/Codex; für Claude nicht nötig, Verbindung dort per URL), Dateiübersicht (`plugins/worldcraft/mcp.json` = Endpunkt; `plugins/worldcraft/plugin.json` = Manifest nach agent-plugins.org-Schema mit Erweiterung `com.openai`; `plugins/worldcraft/.codex-plugin/plugin.json` = Codex-Manifest), Hinweis „Texte (`displayName`, `shortDescription`, `longDescription`, `defaultPrompt`) stehen bewusst in beiden Manifesten und werden gemeinsam geändert“, Versionsregel „eigene SemVer, unabhängig von der App-Version; Minor-Erhöhung bei geänderten Texten oder Fähigkeiten, Patch bei Korrekturen“.
  2. In `.ai/feature-tasks/011-mcp-schreibend.md` bei `T-012: Normen und Features-Katalog` ein Abnahmekriterium ergänzen: „In beiden Plugin-Manifesten unter `plugins/worldcraft/` ist ‚schreibgeschützt‘ durch eine Beschreibung ersetzt, die Lesen und Schreiben nennt; die Plugin-Version ist gemäß `.ai/architecture/mcp.md` erhöht.“
- **Abnahmekriterium:** `.ai/architecture/mcp.md` enthält den Abschnitt „Client-Plugins (OpenAI)“ mit Zweck, Dateiübersicht, Doppelungshinweis und Versionsregel. Plan `011` enthält das genannte Abnahmekriterium. An den Dateien unter `plugins/worldcraft/` ändert sich in diesem Finding nichts.

- **Status:** behoben (Review-Check 2026-09-28): Abschnitt „Client-Plugins (OpenAI)“ in `.ai/architecture/mcp.md` mit Zweck, Dateiübersicht, Doppelungshinweis und Versionsregel; Plan 011, T-012 enthält das Abnahmekriterium zu „schreibgeschützt“ und Versionserhöhung.
---

## Prioritätenliste

1. **CR-001** – Dekodierfehler korrekt melden und loggen, damit solche Fälle nicht wieder als „zu groß“ durchrutschen.
2. **CR-003** – E2E-Protokoll korrigieren und Abweichungen als akzeptiert vermerken.
3. **CR-004** – Regression in `suchen` beheben (kleiner Fix, sichtbare Ausgabe).
4. **CR-005** – deutsche Validierungsfehler.
5. **CR-006** – fehlende Abnahmetests für T-008 und T-013 (5), Bildtest deterministisch.
6. **CR-009**, **CR-008**, **CR-007**, **CR-010**, **CR-011** – Aufräumarbeiten und Dokumentation.

---

## Review-Check 2026-09-28

- **Geprüfter Stand:** Commit `6cc56ce` (unverändert gegenüber der Baseline) **plus uncommittete Änderungen im Working Tree** (21 Dateien, darunter neu `src/lib/zod-locale.ts`, `src/lib/zod-locale.test.ts`, `src/lib/mcp/tools/search.test.ts`). Geprüft wurde ein Schnappschuss dieser Änderungen in einem isolierten Worktree.
- **Statusänderungen:** 10 × `offen` → `behoben` (CR-001, CR-003–CR-011). Keine Regressionen, kein `drift`. CR-002 bleibt `verworfen` und wurde nicht erneut geprüft.
- **Ausgeführte Prüfungen:** `tsc --noEmit` (nach `next typegen`) fehlerfrei; ESLint auf allen geänderten Quelldateien fehlerfrei; Unit-Tests `src/lib/mcp`, `src/lib/domain/mcp-read.test.ts`, `src/lib/zod-locale.test.ts`, `src/lib/mcp-oauth.test.ts`, `src/app/mcp/route.test.ts`: 11 Dateien, 24 Tests grün.
- **Nicht ausgeführt:** `npm run test:mcp` (braucht laufenden Server und Testdatenbank) und die DB-Abfrage aus CR-010. Die dort geänderten Erwartungen (CR-004, CR-005, CR-006, CR-007) sind nur per Code-Lesen bestätigt; vor dem Commit einmal `npm run test:mcp` laufen lassen.
- **Nicht abgedeckte Änderungen:**
  1. `src/lib/mcp/tools/search.test.ts` setzt per `vi.hoisted` eine Dummy-`DATABASE_URL`, weil `search.ts` beim Import den DB-Client lädt. Das funktioniert, zeigt aber die Kopplung von Formatierung und Datenzugriff (Kandidat: `renderSearchHit` in ein eigenes Modul ohne DB-Import auslagern).
  2. Im Hauptverzeichnis liegt weiterhin die ungetrackte Erstfassung `.ai/code-review-002-mcp-server-2026-09-28.md` mit gleichen Finding-IDs, aber ohne Entscheidungen und ohne Status. Das ist Verwechslungsgefahr, kein Code.
- **Empfehlung:** Ein erneuter `/code-review` ist **nicht nötig**. Die Änderungen setzen genau die Findings um, ohne nennenswerten zusätzlichen Umfang. Vor dem Commit `npm run test:mcp` ausführen.

