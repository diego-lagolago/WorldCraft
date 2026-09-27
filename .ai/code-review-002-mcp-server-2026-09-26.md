# Code Review – 002 MCP-Server (2026-09-26)

**Baseline:** Commit `ff09c34d3906b81bf96384e3833ddb303de05a09` (`main`). Uncommittete Änderungen im Working Tree: `.ai/architecture/mcp.md` (geändert), `.ai/architecture/mcp-oauth-anbindung.md` (neu, unversioniert); beide nur Doku, nicht Gegenstand der Code-Findings.
**Geprüfte Task-Datei:** `.ai/feature-tasks/002-mcp-server.md`
**Umfang:** In der Task-Datei sind nur T-001 und T-002 abgehakt. Auf Wunsch des Projektinhabers (2026-09-26) umfasst das Review den gesamten umgesetzten MCP-Code (T-001–T-014; Release `8962a81` sowie die OAuth-Fixes bis `ff09c34`).

## Begriffe

Es gelten die Begriffe aus `.ai/feature-tasks/002-mcp-server.md` (Abschnitt *Begriffe & Systeme*: MCP, DCR, PKCE, Scope, Rechteschicht, Testwelt, Audit-Log …). Zusätzlich:
- **CIMD (Client ID Metadata Document):** OAuth-Client-Registrierung, bei der die Client-ID eine HTTPS-URL ist, unter der der Client seine Metadaten (u. a. `redirect_uris`) veröffentlicht. WorldCraft lädt dieses Dokument selbst (`@better-auth/cimd`); es gibt keinen Aufruf von `/api/auth/oauth2/register`.
- **JWT / JWKS:** Die Access-Tokens sind signierte JSON Web Tokens. `/mcp` prüft sie mit den öffentlichen Schlüsseln (JWKS) des Autorisierungsservers, ohne Datenbankzugriff.
- **N+1:** Eine Listenabfrage, gefolgt von einer weiteren Abfrage pro Listeneintrag.
- **Plan-Review-Entscheidung:** Mit „entschieden 2026-09-26, Plan-Review“ markierte Empfehlungen sind vom Projektinhaber festgelegt und nicht mehr als Alternativen zu verstehen.

## Abhängigkeiten zwischen Findings

- **CR-002** hängt von **CR-010** ab (korrigierte Testwelt und Marker `SLTEST`/`NURICHTEST`). Die Tests zu CR-001, CR-004, CR-005, CR-006, CR-007 und CR-008 sind Teil der Suite aus CR-002 bzw. der dort festgelegten Unit-Tests.
- **CR-012** (Hilfetext) nutzt den in **CR-018** entschiedenen Ort der Karte.
- **CR-013** (Task-Datei nachführen) zuletzt: Es übernimmt die Vermerke aus CR-018 und CR-021 und hakt Aufgaben erst ab, wenn CR-001 und CR-002 erledigt sind.
- **CR-009** ändert nur ADR-005. Die zugehörige Anpassung von Plan `011` ist im Plan-Review bereits erfolgt.
- **CR-011** (Modulaufteilung von `tools.ts`) nach CR-003, CR-007, CR-008, CR-014 und CR-022 umsetzen, damit diese Korrekturen nicht in eine laufende Umstrukturierung fallen.

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Sicherheit | kritisch | behoben | „Zugriff widerrufen“ macht Access-Tokens nicht ungültig (JWT wird nur per JWKS geprüft) |
| CR-002 | Testabdeckung | kritisch | offen | Rechte-/Ausschlusssuite T-008 und fast alle automatisierten Abnahmetests fehlen, obwohl Produktion aktiv ist |
| CR-003 | Sicherheit | mittel | behoben | Unerwartete Exceptions werden mit interner Fehlermeldung an den MCP-Client zurückgegeben |
| CR-004 | Sicherheit | mittel | behoben | CIMD-Clients umgehen die Redirect-URI-Policy (HTTP auf Fremdhosts, private-use URIs) |
| CR-005 | Sicherheit | mittel | behoben | Allowlist-Prüfung beim Token-Tausch baut internes Token-Hashing nach, schlägt still offen fehl und ist ungetestet |
| CR-006 | Runtime-Risiken | mittel | offen | `bild_lesen`: `limitInputPixels: false` (Dekompressionsbombe) und 1-MB-Grenze nicht garantiert |
| CR-007 | Sicherheit | mittel | offen | Referenz-Vorlagenfelder geben rohe IDs aus, ohne Titel und ohne Sichtbarkeitsprüfung |
| CR-008 | Performance | mittel | offen | `inhalte_auflisten`: N+1-Abfragen, Limit erst nach dem Laden, Seltenheit als englischer DB-Schlüssel |
| CR-009 | Bad Practices | mittel | offen | Abweichungen von ADR-005 (keine Scope-Deklaration pro Werkzeug, direkter DB-Zugriff in MCP-Modulen) |
| CR-010 | Aufgaben-Abgleich | mittel | offen | Testwelt-Skript erfüllt T-002/D19 nicht vollständig und macht die T-008-Invariante unprüfbar |
| CR-011 | Lesbarkeit & Wartbarkeit | mittel | offen | `tools.ts` schwer wartbar: überlange Einzeiler, verstreute Enum-Mappings, `monster_art` ungeprüft |
| CR-012 | Aufgaben-Abgleich | mittel | offen | Hilfeseite enthält sachlich falsche Aussagen zu sichtbaren Daten und zum Ort des Widerrufs |
| CR-013 | Aufgaben-Abgleich | mittel | offen | Task-Datei und E2E-Protokoll nicht nachgeführt (Checkboxen, `mcp-e2e-test.md` fehlt) |
| CR-014 | Runtime-Risiken | niedrig | offen | `bild_nr` wird über `sortOrder === n-1` statt über die Position aufgelöst |
| CR-015 | Bad Practices | niedrig | offen | MCP-Serverversion hart kodiert (`0.1.6.3`), weicht von `package.json` ab |
| CR-016 | Aufgaben-Abgleich | niedrig | offen | Hauptschalter-Lücken: `/authorize` antwortet 307, `/mcp` mit anderen Methoden 405 statt 404 |
| CR-017 | Fehlerbehandlung & Validierung | niedrig | offen | Audit- und Purge-Fehler werden ohne Log verschluckt; kein Runtime-Guard in `instrumentation.ts` |
| CR-018 | Aufgaben-Abgleich | niedrig | offen | Verbundene Anwendungen: „Letzte Nutzung“ ungenau, N+1-Abfrage, Karte nicht in Kontoeinstellungen |
| CR-019 | Duplizierung & Modularisierung | niedrig | offen | `MCP_RESOURCE` und Protected-Resource-Metadaten doppelt gepflegt, inkonsistente Metadaten-URL |
| CR-020 | Runtime-Risiken | niedrig | offen | Leerer `userId`-Fallback im MCP-Handler; Aufruflimit-Map wird nie aufgeräumt |
| CR-021 | Aufgaben-Abgleich | niedrig | verworfen | Demowelt-Skript nicht atomar und inhaltlich abweichend von T-014 |
| CR-022 | Duplizierung & Modularisierung | niedrig | offen | Universum-Sichtbarkeitslabel hart kodiert; `inhalt_lesen` für Universum lädt alle Universen |
| CR-023 | Aufgaben-Abgleich | mittel | teilweise behoben | Ist-Flow und Codex-CIMD-Weg dokumentiert; realer Codex-/Claude-Quest-Abruf noch ausstehend |
| CR-024 | Sicherheit | mittel | behoben | Discovery, 401-Challenge, PKCE S256 und dynamischer HTTP-Loopback getestet; HTTPS-Loopback wird abgelehnt |
| CR-025 | Sicherheit | mittel | behoben | DCR-Redirect-Policy, PKCE, 5/min-IP-Limit sowie Ablehnung vertraulicher Clients und nicht unterstützter Grants getestet |
| CR-026 | Sicherheit | mittel | teilweise behoben | Sichere CIMD-Transport-/Cache-Konfiguration und Validierung getestet; positiver 15-Minuten-Cache-Nachweis noch offen |
| CR-027 | Testabdeckung | mittel | offen | Zusatzauftrag OAuth: Kompatibilitätsmatrix Codex/Claude für feste Client-ID, DCR und CIMD |

---

## Review-Check 2026-09-27 — CR-023 bis CR-027

**Prüfgrundlage:** ausgelieferte Revision `83d093c` sowie der Umsetzungsstand für Release 0.1.9. Der Produktionsendpunkt liefert für ein nicht authentifiziertes `POST /mcp` die erwartete `401`-Challenge mit `resource_metadata`; Codex erkennt den Server als OAuth.

| Ergebnis | Anzahl |
|---|---:|
| behoben | 2 |
| teilweise behoben | 2 |
| offen | 1 |
| nicht mehr zuordenbar | 0 |

CR-024 ist mit der zusätzlichen Ablehnung von HTTPS-Loopback sowie den vorhandenen Discovery-, PKCE- und DCR-Tests abgeschlossen. CR-025 ist nach der zusätzlichen Ablehnung vertraulicher Client-Authentifizierung und nicht unterstützter Grants ebenfalls abgeschlossen. CR-023 benötigt noch die reale Codex-/Claude-Client-Abnahme. Bei CR-026 fehlt nur der positive 15-Minuten-Cache-Test; die Negativfälle für Ziel-URL, Metadaten, Redirect, 5-KB-Grenze, Timeout und Retry-Drosselung sind automatisiert geprüft. CR-027 bleibt offen, bis Codex und Claude den Browser-Login durchlaufen und die sichtbarkeitskonforme Quest-Abfrage erfolgreich dokumentiert ist.

---

## Findings im Detail

### CR-001
- **Fundstelle:** `src/app/mcp/route.ts` (`requireMcpAuth(...)`), `src/lib/domain/connected-applications.ts` (`revokeConnectedApplication`)
- **Kategorie:** Sicherheit
- **Schweregrad:** kritisch
- **Bezug (Task-ID):** T-004, T-005, T-008
- **Beschreibung:** `requireMcpAuth` aus `@better-auth/mcp@1.7.6` prüft das Access-Token ausschließlich als JWT gegen die JWKS: Signatur, Issuer, Audience, Ablauf. Die Datenbank wird dabei nicht gelesen. `revokeConnectedApplication` setzt zwar `revoked` in `oauth_access_tokens` und `oauth_refresh_tokens`, das JWT bleibt aber bis zu 1 Stunde gültig. Die Abnahmen „nächster Aufruf von `/mcp` mit dem bisherigen Zugriffstoken → 401“ (T-004) und „widerrufenes Token → 401“ (T-005) sind damit nicht erfüllt. ADR-005 (Punkt 3, Tabelle) sieht eine „Revocation-/Allowlist-Prüfung“ vor, umgesetzt ist nur die Allowlist.
- **Empfehlung (entschieden 2026-09-26, Plan-Review):** **Consent-Prüfung.** Im Handler von `/mcp` (`protectedMcpHandler` in `src/app/mcp/route.ts`), nach der JWT-Prüfung und zusammen mit der bestehenden Allowlist-Prüfung, per Abfrage prüfen, ob in `oauth_consents` noch ein Eintrag für (`claims.sub`, `claims.client_id`) existiert. Fehlt er, mit 401 und demselben `WWW-Authenticate`-Header antworten, den `requireMcpAuth` bei fehlendem Token setzt. Die Abfrage gehört als Funktion in die Domänenschicht (z. B. `hasActiveMcpConsent(userId, clientId)` in `src/lib/domain/connected-applications.ts`). Nicht gewählt: ein Lookup in `oauth_access_tokens`, weil JWT-Access-Tokens dort nicht verlässlich (ohne `jti`) gespeichert sind; opake Tokens (zu großer Umbau); eine verkürzte Laufzeit (bricht das Sofort-Versprechen aus T-004). ADR-005 Punkt 3 (Tabellenzeile `WWW-Authenticate`…) um „Widerruf über Consent-Prüfung pro Anfrage“ ergänzen.
- **Abnahmekriterium:** Ein automatisierter Test in `npm run test:mcp` holt ein Token, ruft `DELETE /api/connected-applications/<clientId>` auf, und der nächste `POST /mcp` mit demselben Access-Token liefert 401. Ein Refresh mit dem alten Refresh-Token liefert `invalid_grant`.
- **Status:** behoben (2026-09-27). `hasActiveMcpConsent` prüft den Consent auf jeder MCP-Anfrage; die MCP-Integration `CR-001` bestätigt nach dem Widerruf sowohl `401` für das vorhandene Access-Token als auch `invalid_grant` für das Refresh-Token.

### CR-002
- **Fundstelle:** `src/app/mcp/mcp.mcp.test.ts` (einziger `*.mcp.test.ts`), `vitest.mcp.config.ts`
- **Kategorie:** Testabdeckung
- **Schweregrad:** kritisch
- **Bezug (Task-ID):** T-003, T-005, T-006, T-007, T-008, T-009, T-012, T-013
- **Beschreibung:** Die MCP-Suite enthält genau einen Happy-Path-Test (DCR ablehnen/anlegen, PKCE-Code tauschen, `welten_auflisten`). Folgende geforderte Nachweise fehlen:
  - **T-008 komplett:** kein `GEHEIMTEST`/`CHATTEST`-Scan, keine Rollenmatrix, kein D5-Nachweis, keine D9-Ausschlüsse, kein Scope-Test.
  - **T-003 (3)–(6):** `plain`/fehlendes PKCE, wiederverwendeter Refresh-Token, doppelt eingelöster Code, `access_denied` bei Ablehnung, Allowlist, archivierte Mitgliedschaft.
  - **T-005 (1)/(2):** 401 mit `WWW-Authenticate`, abgelaufene Tokens, fremde Audience, widerrufene Tokens.
  - **T-006 (1)–(7), T-007 (1)–(4), T-013 (1)–(5).**
  - **T-009 (1)–(3):** 429 per HTTP, Audit-Eintrag ohne Suchbegriff, `purgeMcpAuditLog` mit 29/31 Tagen. Vorhanden sind nur Unit-Tests des Zählers.
  - **T-012 (1)/(3)/(4):** 404 bei ausgeschaltetem Hauptschalter, 403 für den Master, Werkzeugfehler bei gesperrter Welt.

  D21 hat Produktion bewusst vor dem Review eingeschaltet. Gerade deshalb fehlt der Nachweis, dass die Rechteschicht über MCP hält.
- **Empfehlung:** Die Suite gemäß der Abnahmekriterien ergänzen, sinnvoll aufgeteilt in je eine Datei pro Aufgabe (`oauth.mcp.test.ts`, `tools-read.mcp.test.ts`, `authz-matrix.mcp.test.ts`, `audit.mcp.test.ts`, `switches.mcp.test.ts`). Dazu einen Test-Helper, der für jeden der vier Testbenutzer ein MCP-Token erzeugt und `callTool(user, name, args)` bereitstellt. Die heutige Happy-Path-Logik enthält ihn bereits inline und kann extrahiert werden.
- **Festlegung D13-Tests (Plan-Review 2026-09-26):** Weil `isDiscordIdAllowed` `test-*`-IDs immer erlaubt, werden alle Allowlist-Fälle (T-003 Abnahme 5, T-005 Abnahme 2 „nicht mehr auf der Allowlist“) als Unit-Tests in `npm test` mit gemocktem `isDiscordIdAllowed` geprüft, nicht in `npm run test:mcp`. Betroffen sind `mcpTokenGrantFailure` (siehe CR-005) und der `/mcp`-Handler: Er liefert 401, wenn `isDiscordIdAllowed` `false` liefert. Dafür wird `protectedMcpHandler` bzw. dessen Innenfunktion so exportiert, dass sie ohne `requireMcpAuth` mit Claims testbar ist.
- **Abnahmekriterium:** `npm run test:mcp` ist grün und enthält für jeden Unterpunkt der Abnahmekriterien von T-003, T-005–T-009, T-012 und T-013 mindestens einen benannten Test (Testname nennt Task-ID und Punkt, z. B. `T-008: GEHEIMTEST erscheint für keinen Benutzer`). Ausnahme: Die Allowlist-Fälle (D13) liegen als Unit-Tests in `npm test` (siehe Festlegung oben) und sind dort ebenfalls nach Task-ID und Punkt benannt.

### CR-003
- **Fundstelle:** `src/lib/mcp/tools.ts`, `asError()` / `withAudit()`
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, T-007
- **Beschreibung:** `asError` gibt für **jede** `Error`-Instanz `error.message` an den Client zurück, auch für unerwartete Fehler (Postgres-Fehler mit Tabellen-/Spaltennamen, Dateisystempfade aus `readFile`, `sharp`-Meldungen). Solche internen Details landen beim KI-Anbieter. Gleichzeitig wird der Fehler serverseitig nirgends geloggt, er ist also für den Betrieb unsichtbar.
- **Empfehlung:** Nur `McpToolError` mit ihrer Nachricht durchreichen. Alle anderen Fehler mit einer generischen Meldung („Die Anfrage konnte nicht verarbeitet werden.“) beantworten und serverseitig strukturiert loggen (Werkzeugname, Fehlertyp, keine Parameterinhalte).
- **Abnahmekriterium:** Ein Unit-Test, in dem die Aktion eine `new Error("relation \"articles\" does not exist")` wirft, erhält als Werkzeugergebnis nur den generischen Text. `console.error` wurde mit dem Werkzeugnamen aufgerufen.
- **Status:** behoben (2026-09-27). `withAudit` protokolliert unerwartete Fehler strukturiert und gibt nur die generische Meldung zurück; `src/lib/mcp/tools.test.ts` prüft den vollständigen Fall ohne interne Datenbankmeldung im Werkzeugergebnis.

### CR-004
- **Fundstelle:** `src/lib/auth.ts` (`cimd({...})`), `src/lib/mcp-oauth.ts` (`mcpRegistrationValidationError`), `src/app/api/auth/[...all]/route.ts`
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-003 (Punkt 3), D8
- **Beschreibung:** Die Redirect-Policy („nur `https://` oder Loopback-HTTP“) greift nur beim DCR-Endpunkt `/api/auth/oauth2/register`. Bei CIMD wird das Metadatendokument von einer URL geladen und nie über `/register` registriert. `@better-auth/cimd` akzeptiert dabei „absolute HTTP(S) or private-use URIs“, also auch `http://evil.example/cb`. Die in T-003 geforderte Ablehnung ist damit umgehbar. Die Zustimmungsseite zeigt zwar die Redirect-Domain, die technische Schranke fehlt aber.
- **Empfehlung (entschieden 2026-09-26, Plan-Review):** **Prüfung am Autorisierungsendpunkt.** In `handle()` in `src/app/api/auth/[...all]/route.ts` bei `GET` und `POST` auf `/api/auth/oauth2/authorize` den Query-Parameter `redirect_uri` mit `isAllowedMcpRedirectUri` prüfen. Die Prüfung gehört als Funktion `hasAllowedMcpAuthorizeRedirect(request)` in `src/lib/mcp-oauth.ts`. Ist die URI unzulässig oder fehlt sie, mit HTTP 400 und JSON `{ "error": "invalid_request", "error_description": "Redirect-URIs müssen HTTPS oder lokale Loopback-Adressen sein." }` antworten, **ohne** Weiterleitung an die unzulässige URI. Die bestehende DCR-Prüfung bleibt zusätzlich, CIMD bleibt aktiv. Nicht gewählt: CIMD abschalten, nur CIMD-Metadaten filtern. ADR-005 Punkt 3 um den Satz ergänzen, dass die Redirect-Policy am Autorisierungsendpunkt für alle Client-Arten (DCR, CIMD, manuell) gilt.
- **Abnahmekriterium:** Ein Unit-Test für `hasAllowedMcpAuthorizeRedirect` lehnt `http://evil.example/callback` und `myapp://cb` ab und akzeptiert `https://claude.ai/api/mcp/auth_callback` sowie `http://127.0.0.1:9876/callback`. Ein Test in `npm run test:mcp` mit einem registrierten Client und `redirect_uri=http://evil.example/callback` am Autorisierungsendpunkt erhält 400 ohne `Location`-Header und ohne Code.
- **Status:** behoben (2026-09-27). Die Redirect-Policy läuft vor dem OAuth-Provider für jeden Client-Typ; Unit- und MCP-Integrationstests belegen die vier URI-Klassen sowie `400 invalid_request` ohne Weiterleitung für einen registrierten Client.

### CR-005
- **Fundstelle:** `src/lib/mcp-oauth.ts`, `hashStoredOAuthToken`, `ownerForAuthorizationCode`, `ownerForRefreshToken`, `mcpTokenGrantFailure`
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-003 (Punkt 8), D13
- **Beschreibung:** Die D13-Prüfung beim Token-Tausch findet den Besitzer über einen nachgebauten SHA-256/base64url-Hash. Das entspricht dem internen `defaultHasher` von `@better-auth/oauth-provider` (`storeTokens: "hashed"`). Ändert sich das Hash-Verfahren oder die Speicherung (etwa bei einem Minor-Upgrade), findet `owner*` nichts, und die Funktion gibt `null` zurück. Die Allowlist- und Mitgliedschaftsprüfung wird dann **still übersprungen** (fail-open). Dazu kommt: Der Request-Body wird bis zu dreimal geklont und geparst (Observability, Grant-Check, Provider).
- **Empfehlung (entschieden 2026-09-26, Plan-Review):** **Eine gemeinsame Hash-Quelle über `storeTokens`.**
  1. `hashStoredOAuthToken` aus `src/lib/mcp-oauth.ts` exportieren und in `src/lib/auth.ts` in `mcp({ …, storeTokens: { hash: (token) => hashStoredOAuthToken(token) } })` übergeben. Die Bibliothek und die D13-Prüfung nutzen damit dieselbe Funktion. Der Algorithmus bleibt SHA-256/base64url, damit bestehende, bereits gehashte Codes und Refresh-Tokens gültig bleiben.
  2. Fail-closed-Logging: Findet `mcpTokenGrantFailure` bei `grant_type` `authorization_code` oder `refresh_token` keinen Besitzer, wird ein strukturiertes `console.warn(JSON.stringify({ event: "mcp_oauth_grant_owner_not_found", grant_type }))` ohne Token-Wert geschrieben. Der Provider antwortet danach wie bisher selbst mit `invalid_grant`.

  Nicht gewählt: Hook am Token-Endpunkt; nur den Hasher importieren.
- **Abnahmekriterium:** `src/lib/auth.ts` übergibt `storeTokens.hash` mit `hashStoredOAuthToken`. Ein Unit-Test belegt, dass `hashStoredOAuthToken("abc")` denselben Wert liefert wie der Default-Hasher der Bibliothek (Regressionsschutz für Bestandstokens). Unit-Tests in `npm test` (`src/lib/mcp-oauth.test.ts`) mit gemocktem `isDiscordIdAllowed` (liefert `false`) und gemockter DB-Auflösung des Besitzers: `mcpTokenGrantFailure` liefert für `grant_type=refresh_token` den Wert `invalid_grant` und für `grant_type=authorization_code` den Wert `access_denied`. (Hintergrund, entschieden 2026-09-26: `test-*`-IDs sind laut `isDiscordIdAllowed` immer erlaubt, deshalb werden D13-Fälle nicht gegen den Dev-Server, sondern als Unit-Tests mit Mock geprüft.)
- **Status:** behoben (2026-09-27). Better Auth und die D13-Prüfung verwenden dieselbe exportierte Hash-Funktion; Unit-Tests fixieren den Hash und prüfen mit gemockter Allowlist `access_denied` für den Code-Tausch sowie `invalid_grant` für Refresh.

### CR-006
- **Fundstelle:** `src/lib/domain/mcp-read.ts`, `readMcpImage`
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-013
- **Beschreibung:**
  1. `sharp(input, { limitInputPixels: false })` hebt den Schutz gegen Dekompressionsbomben auf. Ein zulässiger 10-MB-Upload mit extremen Abmessungen kann den einzigen App-Prozess (ADR-001, eine Instanz) in Speicherdruck bringen.
  2. Die Qualitätsschleife (82 → 70 → 58 → 46) gibt beim vierten Versuch wegen `quality <= 48` **unabhängig von der Größe** zurück. Die geforderte Grenze „≤ 1 MB“ ist also nicht garantiert. Das abschließende `return null` ist unerreichbar.
  3. Laut Plan ist JPEG oder WebP zulässig. Es wird immer WebP geliefert; das ist in Ordnung, der Rückgabetyp suggeriert aber beides.
- **Empfehlung (Limit entschieden 2026-09-26, Plan-Review):** **25 Megapixel, sowohl beim Lesen als auch beim Upload.**
  1. Eine gemeinsame Konstante `IMAGE_MAX_PIXELS = 25_000_000` in `src/lib/files/inspect.ts` exportieren.
  2. **Upload:** `inspectImage` lehnt Bilder mit `width * height > IMAGE_MAX_PIXELS` mit `{ error: "Das Bild darf höchstens 25 Megapixel haben." }` ab. Das gilt für alle Bildarten einschließlich Kartenbilder (bewusst akzeptiert: sehr große Karten müssen vor dem Upload verkleinert werden). Bereits gespeicherte größere Bilder bleiben unverändert.
  3. **`readMcpImage`:** `sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS })`. Überschreitet ein Bestandsbild das Limit, gibt `bild_lesen` den Werkzeugfehler „Bild zu groß für die Ausgabe.“ zurück (`McpToolError`, keine generische Exception).
  4. **Größengrenze:** Die Schleife versucht WebP mit Qualität 82, 70, 58, 46 bei 1568 px. Ist das Ergebnis danach noch über 1 MB, folgt ein letzter Versuch mit 1024 px und Qualität 46. Ist auch dieser über 1 MB, wird ein `McpToolError` „Bild zu groß für die Ausgabe.“ geworfen. Den unerreichbaren Code entfernen und den Rückgabetyp auf `image/webp` einengen.

  Nicht gewählt: 50 MP nur in `bild_lesen`; sharp-Standard (ca. 268 MP).
- **Abnahmekriterium:** Ein Unit-Test in `src/lib/files/files.test.ts` belegt, dass `inspectImage` ein PNG mit 5001×5000 Pixeln (Header genügt) mit der Meldung „Das Bild darf höchstens 25 Megapixel haben.“ ablehnt und 5000×5000 akzeptiert. `readMcpImage` verwendet `limitInputPixels: IMAGE_MAX_PIXELS` (kein `false`). Ein Unit-Test mit einem schwer komprimierbaren Rauschbild (z. B. 4000×4000, per `sharp` erzeugt) liefert entweder ≤ 1 MB oder den Werkzeugfehler „Bild zu groß für die Ausgabe.“, nie mehr als 1 MB.

### CR-007
- **Fundstelle:** `src/lib/mcp/tools.ts`, `renderTemplateFields` (Zweig `field.type === "ref"`)
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, D5, D18
- **Beschreibung:** Referenzfelder (z. B. `ruler`, `race`, `seat`, `location`) werden als rohe UUID ausgegeben. Es gibt keine Sichtbarkeitsprüfung und keinen Titel. Verweist ein veröffentlichter Artikel auf einen `nur Spielleitung`- oder fremden `nur ich`-Artikel, erhält ein Player dessen ID. Das verrät die Existenz eines verdeckten Inhalts, den `relationen_abrufen` bewusst weglässt. Außerdem entspricht die Ausgabe weder der Erwähnungssyntax aus D18 noch ist sie für Claude verständlich.
- **Empfehlung:** Referenzen über die Domänenschicht auflösen (sichtbare Titel für die referenzierten IDs mit Rolle und Viewer). Sichtbare Referenzen als `@[Titel](art:id)` ausgeben, nicht sichtbare vollständig weglassen, so wie in der App-Anzeige der Vorlagenfelder.
- **Abnahmekriterium:** `inhalt_lesen` für einen Artikel, dessen Referenzfeld auf den `nur Spielleitung`-Artikel zeigt, enthält für Player A weder Feld noch ID. Für den Game Master enthält es `@[<Titel>](artikel:<id>)` (Test in der T-008-Suite).

### CR-008
- **Fundstelle:** `src/lib/mcp/tools.ts`, Werkzeug `inhalte_auflisten`
- **Kategorie:** Performance
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, D10 (V3), D11, D12
- **Beschreibung:**
  1. Für **jeden** sichtbaren Artikel wird zusätzlich `getArticle` aufgerufen (N+1), nur um `templateFields.quest` zu lesen. Das passiert auch ohne Filter `quest_gegenstand`, und `limit` wird erst **nach** allen Detailabfragen angewendet. Bei hunderten Artikeln sind das hunderte Queries pro Aufruf.
  2. `row.rarity` wird roh ausgegeben (englischer DB-Schlüssel wie `rare`) statt als deutsches Label (V3). Bei Monstern ist das korrekt gelöst.
  3. `quest_gegenstand` ohne `vorlagentyp: gegenstand` wird nicht als ungültige Kombination abgelehnt, obwohl die Tabelle *MCP-Werkzeuge* das vorsieht.
- **Empfehlung:** Ein Feld `isQuestItem: boolean` in `ArticleSummary` bzw. `summaryColumns` von `src/lib/domain/articles.ts` aufnehmen (SQL: `(template_fields->>'quest')::boolean IS TRUE`), damit `inhalte_auflisten` kein `getArticle` mehr braucht (Festlegung Plan-Review 2026-09-26: kleinster Eingriff, keine neue Domänenfunktion). `limit` vor Detailabfragen anwenden. Seltenheit über das Label aus der Vorlagen-Registry ausgeben. `quest_gegenstand` nur bei `vorlagentyp: gegenstand` zulassen, sonst `McpToolError`.
- **Abnahmekriterium:** `inhalte_auflisten` führt unabhängig von der Artikelanzahl eine konstante Zahl an DB-Abfragen aus (per Code-Review oder Query-Zählung im Test). Die Ausgabe für den Quest-Gegenstand enthält „Selten“ statt `rare`. `quest_gegenstand: true` mit `vorlagentyp: person` liefert einen Werkzeugfehler.

### CR-009
- **Fundstelle:** `src/lib/mcp/tools.ts` (`registerMcpReadTools`), `src/lib/mcp/context.ts`, `src/lib/mcp/audit.ts`, `.ai/decisions/005-mcp-server.md` (Punkte 4 und 5)
- **Kategorie:** Bad Practices
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-001, T-005, T-011
- **Beschreibung:** ADR-005 legt fest:
  - Punkt 4: „Jede Tool-Definition deklariert ihren benötigten Scope in einer zentralen Tool-Registry … die Registry prüft ihn vor der Toolausführung noch einmal“. Umgesetzt ist das nicht: `requiredScopes` wird nur global am Route-Handler gesetzt, und `ctx` kennt keine Scopes. Für den geplanten `worlds:write`-Plan (`011`) fehlt damit genau die Schutzschicht, die ADR-005 verspricht.
  - Punkt 5: „MCP-Module importieren weder `db` noch Tabellen“. Dagegen fragen `context.ts` (Weltauflösung) und `audit.ts` direkt Tabellen ab.

  Code und ADR widersprechen sich also.
- **Empfehlung (entschieden 2026-09-26, Plan-Review, Projektinhaber):** **ADR-005 an den Code anpassen, mit Scope-Hierarchie `worlds:write` ⊇ `worlds:read`.** Ein Token mit `worlds:write` darf auch alle Lesewerkzeuge nutzen; der Bestätigungsablauf in Plan `011` muss technisch ohnehin lesen. Damit ist in Plan `002` **keine Code-Änderung** nötig, nur ADR-005 wird angepasst:
  1. **Punkt 4 neu:** „`worlds:write` schließt `worlds:read` ein. Lesewerkzeuge sind durch die globale Scope-Prüfung am Route-Handler (`requireMcpAuth`, heute `requiredScopes: ["worlds:read"]`) geschützt und deklarieren keinen eigenen Scope. Plan `011` lockert die globale Prüfung auf ‚`worlds:read` oder `worlds:write`‘. Nur Schreibwerkzeuge prüfen zusätzlich im Handler, dass `worlds:write` im Token enthalten ist; dafür reicht ein kleiner Helfer in Plan `011`, eine Registry für alle Werkzeuge entfällt.“
  2. **Punkt 5 neu:** Ausnahme festhalten: `src/lib/mcp/context.ts` (Weltauflösung: Mitgliedschaft und Welt-Freigabe) und `src/lib/mcp/audit.ts` (Audit-Persistenz, Aufruflimit) dürfen direkt auf `db` zugreifen, weil sie MCP-Infrastruktur sind und keine Fachinhalte lesen. Fachinhalte laufen weiterhin ausschließlich über `src/lib/domain/` und `src/lib/authz/`.
  3. **Folgeänderung Plan `011`** (im selben Plan-Review erledigt): S1, der Begriff `worlds:write` und die Abnahme 3 von 011 T-003 („Ein Token nur mit `worlds:write` erhält bei den Lesewerkzeugen einen Autorisierungsfehler“) sind an die Hierarchie angepasst.

  Nicht gewählt: Scope-Registry für alle Werkzeuge jetzt bauen; Weltauflösung und Audit in die Domänenschicht verschieben.
- **Abnahmekriterium:** ADR-005 Punkt 4 beschreibt die Hierarchie `worlds:write` ⊇ `worlds:read` und dass nur Schreibwerkzeuge (Plan `011`) einen eigenen Scope-Check haben. ADR-005 Punkt 5 nennt `context.ts` und `audit.ts` als einzige zulässige DB-Zugriffe in `src/lib/mcp/`. `grep -rln "@/db" src/lib/mcp/` liefert nur diese beiden Dateien. Plan `011` enthält keine Anforderung mehr, dass ein reines `worlds:write`-Token nicht lesen darf.

### CR-010
- **Fundstelle:** `scripts/seed-mcp-test-world.mjs`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-002, T-007, T-008, D19
- **Beschreibung:**
  1. `GEHEIMTEST` steht auch im Text des `nur Spielleitung`-Artikels, im SL-Kapitel und im SL-Monster. T-008 fordert aber, dass `GEHEIMTEST` in **keiner** Antwort für **irgendeinen** Benutzer vorkommt. Game Master und Master sehen diese Inhalte legitim, der Test wäre für sie also rot bzw. nicht aussagekräftig. Laut Plan gehört `GEHEIMTEST` nur in die Tagebucheinträge.
  2. D19 fordert je eine **manuelle** Relation von „Burg Rabenstein“ zum `nur Spielleitung`-Artikel und zum `nur ich`-Artikel. Zum SL-Artikel existiert nur eine Erwähnung.
  3. Die Person hat `race` im Vorlagenfeld, aber keine Relationszeile mit Herkunft Vorlagenfeld `race` (T-002: „Relation mit Herkunft Vorlagenfeld“). Ebenso fehlen die abgeleiteten Relationen für Lebensraum (Monster → Burg) und Beteiligung (Quest → Charakter). Die Mention-Relationen der Pins sind dagegen vorhanden.

  Da das Skript per SQL an der Domänenschicht vorbeischreibt, bildet es abgeleitete Relationen nur teilweise nach. Relationstests aus T-007 würden damit andere Daten sehen als die App erzeugt.
- **Empfehlung (entschieden 2026-09-26, Plan-Review):** **SQL im Skript ergänzen**, ohne App-Imports, mit exakt den Werten, die die Domänenschicht (`src/lib/domain/relations.ts`) schreibt:
  1. **Marker:** `GEHEIMTEST` nur noch in den beiden `journal_entries`. Im Text des `nur Spielleitung`-Artikels, des SL-Kapitels und des SL-Monsters stattdessen `SLTEST`. Im `nur ich`-Artikel des Masters `NURICHTEST`. So kann T-008 prüfen: `GEHEIMTEST` nie für niemanden; `SLTEST` nur für Game Master und Master; `NURICHTEST` nur für den Master.
  2. **Manuelle Relation zum SL-Artikel (D19):** zusätzlich `addRelation(… from: burg, to: guild, origin: "manual", label: "wird bewacht von", counterLabel: "bewacht")`. Die bestehende Erwähnung bleibt.
  3. **Vorlagenfeld `race`:** `addRelation(… from: person, to: race, origin: "template_field", templateFieldKey: "race")`.
  4. **Lebensraum:** `addRelation(… from: { kind: "monster", id: visibleMonster.id }, to: burg, origin: "template_field", templateFieldKey: "habitat")`. So schreibt `recalcMonsterRelations` den Lebensraum.
  5. **Beteiligung:** `addRelation(… from: { kind: "quest", id: activeQuest.id }, to: { kind: "character", id: character.id }, origin: "participation")`.

  Nicht gewählt: Domain-Sync per TypeScript aufrufen; Seed über die HTTP-API.
- **Abnahmekriterium:** `grep -n GEHEIMTEST scripts/seed-mcp-test-world.mjs` findet nur Zeilen der `journal_entries`-Einfügung. `SLTEST` und `NURICHTEST` kommen je mindestens einmal vor. Nach dem Seed existieren in `relations` für die Testwelt: Burg → SL-Artikel mit `mention` **und** `manual`; Burg → `nur ich`-Artikel `manual`; Person → Rasse `template_field`/`race`; Monster „Rabenwolf“ → Burg `template_field`/`habitat`; Quest „Die Rückkehr des Rabens“ → Charakter „Liora“ `participation`. Zweimaliges Ausführen ergibt identische Zählungen.

### CR-011
- **Fundstelle:** `src/lib/mcp/tools.ts` (gesamt)
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, T-007, T-013, D14
- **Beschreibung:**
  1. Die Werkzeuge sind als Einzeiler mit teils über 500 Zeichen geschrieben (Registrierung, Schema und Handler in einer Zeile; `renderSheet` mit Inline-Typ). `registerMcpReadTools` ist eine einzige Funktion mit rund 150 Zeilen, `inhalt_lesen` eine sechsarmige if-Kette.
  2. Die Enum-Abbildungen sind verstreut und teils doppelt: `inverse` in `quests_auflisten` ist die Umkehrung von `statusLabel`. D14 fordert „eine Abbildungstabelle pro Enum, mit Test auf Vollständigkeit“, dieser Test fehlt.
  3. `monster_art` ist ein freier `z.string()`. Eine unbekannte oder falsch geschriebene Art liefert still „Keine Monster.“ statt eines Validierungsfehlers.

  Mit Plan `011` kommen weitere Werkzeuge in diese Datei; der heutige Stil skaliert nicht.
- **Empfehlung:** Ein Modul pro Werkzeug (z. B. `src/lib/mcp/tools/inhalt-lesen.ts`) und ein Renderer pro Inhaltsart (`renderArticle`, `renderQuest` …). Die Enum-Abbildungen in `src/lib/mcp/enums.ts` bündeln, beide Richtungen aus einer Quelle ableiten und Vollständigkeitstests gegen die DB-Enums schreiben. `monster_art` als `z.enum` der deutschen Labels definieren.
- **Festlegung (Plan-Review 2026-09-26):** Die Zeilenlänge wird per ESLint erzwungen: In `eslint.config.mjs` einen Override für `src/lib/mcp/**/*.ts` mit `max-len: ["error", { code: 160, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true, ignoreComments: true }]` ergänzen. Kein Prettier, keine repo-weite Regel.
- **Abnahmekriterium:** Der ESLint-Override für `src/lib/mcp/**` mit `max-len` 160 existiert, und `npx eslint src/lib/mcp` läuft fehlerfrei. Es existiert `enums.ts` mit einem Test, der für jedes DB-Enum (Status, Vorlagentyp, Monster-Art, Inhaltsart) eine vollständige Abbildung belegt. `inhalte_auflisten` mit `monster_art: "Drache123"` liefert einen Validierungsfehler.

### CR-012
- **Fundstelle:** `src/app/hilfe/mcp/page.tsx`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-010, D5, D8
- **Beschreibung:** Die Hilfeseite behauptet:
  - „Beim ersten Verbinden sieht die KI nur Weltname, deine Rolle und deine eigenen Charaktere.“ Das gilt nur für nicht freigegebene Welten.
  - „unveröffentlichte Inhalte … bleiben ausgeschlossen“. Das ist falsch für Spielleitung: Game Master und Master sehen `nur Spielleitung`- und eigene `nur ich`-Inhalte (D5).
  - Der Widerruf erfolge „in den WorldCraft-Kontoeinstellungen“. Die Karte liegt tatsächlich im Weltmenü (`/w/[worldId]/menu`).

  Da der Plan die Transparenz gegenüber dem KI-Anbieter betont (D8), sind falsche Datenschutzaussagen besonders heikel.
- **Empfehlung:** Die Texte an die tatsächliche Rechtelogik anpassen: „Die KI sieht genau das, was du in der App siehst, in Welten, die der Game Master freigegeben hat. Das schließt als Spielleitung auch `nur Spielleitung`- und eigene `nur ich`-Inhalte ein.“ Den Widerrufsort korrekt benennen: „im Weltmenü deiner Welt unter ‚Verbundene Anwendungen‘“ (Ort entschieden in CR-018).
- **Abnahmekriterium:** Die Hilfeseite enthält keine der drei zitierten Aussagen mehr. Sie nennt ausdrücklich, dass Spielleitung auch nicht veröffentlichte Inhalte überträgt, und nennt als Ort von „Verbundene Anwendungen“ das Weltmenü.

### CR-013
- **Fundstelle:** `.ai/feature-tasks/002-mcp-server.md`, `.ai/infrastructure/` (fehlend: `mcp-e2e-test.md`), `.ai/architecture/mcp.md`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-003–T-014
- **Beschreibung:** T-003 bis T-014 sind umgesetzt und produktiv, in der Task-Datei aber als offen (`- [ ]`) markiert. Die in T-010 und T-014 geforderte Protokolldatei `.ai/infrastructure/mcp-e2e-test.md` existiert nicht, die Abnahme von T-010 (fünf Fragen in claude.ai **und** Claude Code) ist damit nicht belegt. Die T-011-Dokumentation ist teilweise uncommittet (`mcp.md` geändert, `mcp-oauth-anbindung.md` unversioniert).
- **Empfehlung:** Pro Aufgabe den tatsächlichen Stand eintragen und nur Aufgaben mit erfüllter Abnahme abhaken; offene Punkte (etwa aus CR-001/CR-002) als Rest vermerken. Bei T-014 die akzeptierten Abweichungen des Demowelt-Skripts vermerken (siehe CR-021, verworfen): kein `scripts/demo-assets/`, 1×1-px-Bilder, 2 Pins je Universum statt 4 im ersten, keine manuelle 2-Stufen-Relation. Bei T-004 den Ort der Karte vermerken (siehe CR-018). `mcp-e2e-test.md` mit Protokoll der Demowelt-Erstellung und der fünf E2E-Fragen anlegen. Die Doku committen.
- **Abnahmekriterium:** Die Checkboxen der Task-Datei stimmen mit dem Stand der Abnahmekriterien überein. `.ai/infrastructure/mcp-e2e-test.md` existiert mit Datum, Client (claude.ai, Claude Code), aufgerufenen Werkzeugen und Ergebnis je Frage. `git status` zeigt keine uncommitteten MCP-Dokumente.

### CR-014
- **Fundstelle:** `src/lib/mcp/tools.ts`, `bild_lesen` (Zweig `charakter`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-013
- **Beschreibung:** `images.find((image) => image.sortOrder === bild_nr - 1)` setzt voraus, dass `sort_order` lückenlos bei 0 beginnt. Nach dem Löschen oder Umsortieren von Bildanhängen ist das nicht garantiert. `bild_nr: 1` findet dann kein Bild, obwohl `inhalt_lesen` Bilder meldet. Die Tabelle *MCP-Werkzeuge* verlangt „`bild_nr` nach `sort_order`“, also die Position in der sortierten Liste.
- **Empfehlung:** `character.images[bild_nr - 1]` verwenden; `loadSheet` sortiert bereits nach `sortOrder`.
- **Abnahmekriterium:** Ein Test mit Bildanhängen mit `sort_order` 2 und 5 liefert für `bild_nr: 1` das Bild mit `sort_order` 2 und für `bild_nr: 2` das mit `sort_order` 5.

### CR-015
- **Fundstelle:** `src/app/mcp/route.ts` (`new McpServer({ name: "WorldCraft", version: "0.1.6.3" })`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005
- **Beschreibung:** Die Version wird bei jedem Release per Hand im Code gepflegt (Commits „label MCP 0.1.6.x“) und weicht bereits von `package.json` (`0.1.6`) ab. T-005 fordert „die App-Version“.
- **Empfehlung (entschieden 2026-09-26, Plan-Review):** **`package.json` ist die einzige Versionsquelle, jede Auslieferung erhöht die Patch-Version** (0.1.6 → 0.1.7 …). Die vierstellige Zwischennummerierung (`0.1.6.x`) entfällt. In `src/app/mcp/route.ts` die Version per JSON-Import lesen (`import packageJson from "../../../package.json"`, `resolveJsonModule` ist in `tsconfig.json` aktiv) und `new McpServer({ name: "WorldCraft", version: packageJson.version })` setzen. Nicht `process.env.npm_package_version` verwenden, weil die Variable im Container-Start ohne npm fehlt. Nicht gewählt: Semver-Build-Metadaten; eigene Versionskonstante.
- **Abnahmekriterium:** `route.ts` enthält kein Versionsliteral. Die `initialize`-Antwort von `/mcp` meldet dieselbe Version wie `package.json`.

### CR-016
- **Fundstelle:** `src/app/authorize/route.ts`, `src/app/mcp/route.ts`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-012, D2
- **Beschreibung:** D2 verlangt 404 für alle MCP- und OAuth-Endpunkte bei `MCP_ENABLED ≠ true`. Die Kompatibilitätsroute `/authorize` leitet dann trotzdem mit 307 weiter (das Ziel antwortet erst dort mit 404). `/token` ist über das Delegat korrekt. `/mcp` exportiert nur `GET`/`POST`, andere Methoden (z. B. `DELETE`) liefern von Next.js 405 statt 404. Das ist ein kleiner Existenzhinweis bei abgeschaltetem Server.
- **Empfehlung:** In `/authorize` zuerst `isMcpEnabled()` prüfen. In `/mcp` die übrigen Methoden (`DELETE`, `PUT`, `PATCH`) mit derselben Schalterlogik wie `GET` exportieren.
- **Abnahmekriterium:** Mit `MCP_ENABLED` aus liefern `GET /authorize`, `POST /token` sowie `DELETE /mcp` jeweils 404 (Unit-Tests analog `src/app/authorize/route.test.ts`).

### CR-017
- **Fundstelle:** `src/lib/mcp/tools.ts` (`withAudit`, `.catch(() => undefined)`), `src/app/mcp/route.ts` (Rate-Limit-Audit), `src/instrumentation.ts`
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-009
- **Beschreibung:** Fehler beim Schreiben des Audit-Logs und beim täglichen `purgeMcpAuditLog` werden kommentarlos verschluckt. Ein dauerhaft fehlschlagender Löschjob (30-Tage-Aufbewahrung) oder ein fehlendes Audit fällt niemandem auf. `register()` hat außerdem keinen Guard auf `process.env.NEXT_RUNTIME === "nodejs"`: Timer und DB-Zugriff würden auch in einer Edge-Runtime-Instanz angestoßen.
- **Empfehlung:** In den `catch`-Zweigen strukturiert loggen (`console.error(JSON.stringify({ event: "mcp_audit_error", … }))`, ohne Inhalte). Die Purge-Registrierung in `if (process.env.NEXT_RUNTIME === "nodejs")` kapseln.
- **Abnahmekriterium:** Ein Unit-Test mit einer fehlschlagenden DB-Einfügung belegt einen `console.error`-Aufruf mit `event: "mcp_audit_error"`. `instrumentation.ts` registriert den Timer nur für die Node-Runtime.

### CR-018
- **Fundstelle:** `src/lib/domain/connected-applications.ts` (`listConnectedApplications`), `src/app/w/[worldId]/menu/page.tsx`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004
- **Beschreibung:**
  1. „Letzte Nutzung“ ist das Datum des zuletzt **ausgestellten** Access-Tokens, nicht des letzten Aufrufs von `/mcp`. Ein stündlich erneuertes Token, das nie verwendet wird, erscheint als „genutzt“. Das Audit-Log enthält die echte Nutzung.
  2. Pro Zustimmung wird eine eigene `max()`-Abfrage abgesetzt (N+1).
  3. T-004 verlangt die Seite in den **Kontoeinstellungen**. Sie ist als Karte im Weltmenü jeder Welt eingebaut und zeigt dort weltübergreifende Daten.
- **Empfehlung (Ort entschieden 2026-09-26, Plan-Review):** Die letzte Nutzung aus `mcp_audit_logs` (`max(created_at)` je `user_id`/`client_id`) in **einer** gruppierten Abfrage ermitteln und per `clientId` den Zustimmungen zuordnen. **Die Karte bleibt im Weltmenü** (`/w/[worldId]/menu`). Die Abweichung von T-004 („Kontoeinstellungen“) wird in `.ai/feature-tasks/002-mcp-server.md` bei T-004 und in `.ai/features.md` vermerkt: „Verbundene Anwendungen liegt im Weltmenü jeder Welt und zeigt dort die weltunabhängigen Zustimmungen des Benutzers.“ Die Hilfeseite verweist darauf (siehe CR-012). Nicht gewählt: neue Kontoseite `/konto`; bestehende Profilseite.
- **Abnahmekriterium:** `listConnectedApplications` setzt genau eine bzw. eine konstante Zahl an Abfragen ab. „Letzte Nutzung“ entspricht dem letzten Audit-Eintrag des Clients. T-004 in der Task-Datei und `features.md` enthalten den oben genannten Satz zum Ort der Karte.

### CR-019
- **Fundstelle:** `src/lib/auth.ts` (`MCP_RESOURCE`), `src/lib/mcp-oauth.ts` (`MCP_RESOURCE`), `src/app/.well-known/oauth-protected-resource/route.ts`, `src/app/mcp/route.ts` (`resourceMetadataUrl`)
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-003, T-005
- **Beschreibung:** Die Ressourcen-URL wird zweimal unabhängig berechnet. Die Protected-Resource-Metadaten sind handgeschrieben (Scopes, DPoP-Algorithmen), obwohl `mcp()` dasselbe Dokument unter `/api/auth/.well-known/…` erzeugt. Beide können auseinanderlaufen. `authInfo.resourceMetadataUrl` zeigt auf das Origin-Dokument, `WWW-Authenticate` auf das pfadsuffigierte (`…/oauth-protected-resource/mcp`).
- **Empfehlung:** `MCP_RESOURCE` nur in `mcp-oauth.ts` definieren und in `auth.ts` importieren. Die Root-Route als Delegat auf die Plugin-Metadaten umsetzen (wie bei `oauth-authorization-server`). `resourceMetadataUrl` auf die pfadsuffigierte URL setzen.
- **Abnahmekriterium:** `grep -rn '/mcp`' src/lib` findet die Ressourcen-URL-Berechnung nur einmal. Das Root-Metadatendokument ist inhaltlich identisch mit `/api/auth/.well-known/oauth-protected-resource/mcp` (Test).

### CR-020
- **Fundstelle:** `src/app/mcp/route.ts` (`const userId = … : ""`), `src/lib/mcp/audit.ts` (`callsByUser`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005, T-009
- **Beschreibung:** Fehlt `extra.userId`, laufen die Werkzeuge mit `userId = ""` weiter, statt abzubrechen. Das ist heute harmlos (keine Mitgliedschaften), verschleiert aber einen Integrationsfehler. Die Map `callsByUser` behält Einträge inaktiver Benutzer dauerhaft; bei der kleinen Allowlist ist das unkritisch, aber unnötig.
- **Empfehlung:** Ohne `userId` im Server-Factory eine Exception werfen bzw. 401 liefern. In `consumeMcpCall` leere Fenster löschen (`if (recent.length === 0) callsByUser.delete(userId)`).
- **Abnahmekriterium:** Ein Unit-Test belegt, dass ein Handler-Aufruf ohne `userId` keinen Werkzeugaufruf ausführt. Nach Ablauf des Fensters enthält `callsByUser` für den Benutzer keinen Eintrag mehr (Test mit Testhook).

### CR-021
- **Fundstelle:** `scripts/seed-demo-world.mjs`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-014
- **Beschreibung:** Bricht ein API-Aufruf mittendrin ab, bleibt eine halbe Welt „MCP-Demo“ zurück. Der zweite Lauf verweigert dann jede Aktion, und die Welt muss manuell gelöscht werden. Abweichungen von T-014: keine Dateien unter `scripts/demo-assets/` (die Bilder sind inline, 1×1 px, für die E2E-Frage „Beschreibe das Titelbild“ unbrauchbar); nur 2 Pins im ersten Universum statt 4 mit Erwähnungen; keine manuelle Relation über 2 Stufen.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-26): verworfen.** Das Skript ist auf Produktion bereits gelaufen, am Code wird nichts geändert. Die inhaltlichen Abweichungen von T-014 (kein `scripts/demo-assets/`, 1×1-px-Bilder, 2+2 Pins, keine manuelle 2-Stufen-Relation) werden im Rahmen von CR-013 bei T-014 in der Task-Datei als bewusst akzeptiert vermerkt.
- **Abnahmekriterium:** entfällt (verworfen); der Vermerk bei T-014 wird über CR-013 geprüft.

### CR-022
- **Fundstelle:** `src/lib/mcp/tools.ts`, `inhalt_lesen` Zweig `universum`
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-006
- **Beschreibung:** Das Sichtbarkeitslabel wird per Ternary hart kodiert (`"nur Spielleitung" : "veröffentlicht"`) statt über `CONTENT_VISIBILITY_LABEL` wie bei allen anderen Arten. Um die Karten eines einzelnen Universums zu finden, lädt `listMcpUniverseMaps` alle Universen und Karten der Welt.
- **Empfehlung:** `CONTENT_VISIBILITY_LABEL[row.visibility]` verwenden. `listMcpUniverseMaps` um einen optionalen `universeId`-Filter ergänzen.
- **Abnahmekriterium:** Im Zweig `universum` steht kein Sichtbarkeitsliteral mehr. `inhalt_lesen` für ein Universum setzt eine auf dieses Universum gefilterte Kartenabfrage ab.

---

## Zusatzauftrag: Robuste OAuth-Integration für MCP-Clients (ergänzt 2026-09-26)

Vom Projektinhaber nachträglich als Aufgaben an dieses Review angehängt. Die Punkte stammen nicht aus der Code-Analyse, sondern aus einem eigenen Auftrag. Die ursprünglichen Task-IDs (T-001–T-005) werden hier als **OAUTH-T-001 … OAUTH-T-005** geführt, damit sie nicht mit den Task-IDs aus Plan `002` verwechselt werden.

**Kontext & Ziel:** WorldCraft soll als MCP-Server zuverlässig mit Codex und Claude funktionieren. Die bisherige feste Client-ID scheitert bei Codex an einer nicht registrierten lokalen Redirect-URI. Ziel ist eine standardkonforme OAuth-Integration für öffentliche native MCP-Clients mit Dynamic Client Registration (DCR) und Client-ID-Metadatendokumenten (CIMD). Die Registrierung eines Clients gewährt keinen Zugriff auf Welten oder Werkzeuge. Die bestehende User-Whitelist (Discord-Allowlist, D13, `isDiscordIdAllowed`) bleibt die alleinige Zutrittskontrolle bei der Autorisierung.

**Nicht im Umfang:** Änderungen an den fachlichen WorldCraft-Berechtigungen, der Whitelist-Verwaltung oder den MCP-Werkzeugen selbst.

**Begriffe (zusätzlich zu oben):**
- **OAuth Authorization Server:** WorldCraft-Komponente (Better Auth mit `@better-auth/mcp`), die Nutzer autorisiert sowie Access- und Refresh-Tokens ausstellt.
- **Loopback-Redirect:** Lokale Callback-Adresse einer Desktop-Anwendung, etwa `http://127.0.0.1:<port>/callback`.
- **User-Whitelist:** Die Discord-Allowlist `ALLOWED_DISCORD_IDS` (Plan `002` D13).
- **Protected Resource Metadata:** OAuth-Metadaten des MCP-Servers (RFC 9728), über die ein Client den zuständigen Authorization Server ermittelt.
- **Feste Client-ID:** Ein manuell bzw. statisch registrierter OAuth-Client mit fest hinterlegten Redirect-URIs, im Gegensatz zu DCR und CIMD.

**Globale Abhängigkeiten:** Zugriff auf Quellcode, OAuth-Client-Registrierung und Produktionskonfiguration (Coolify); bestehende User-Whitelist; lokaler Dev-Server mit Test-Login und Testwelt (Plan `002` T-002) sowie Produktion mit Demowelt und dem Projektinhaber als freigegebenem Nutzer (K1, statt Staging); aktuelle Versionen von Codex und Claude.

**Abgleich mit dem bestehenden Stand:**
- **K1 – Staging (entschieden 2026-09-26, Plan-Review): Lokal + Produktion, kein Staging.** Automatisierte Tests (Discovery, DCR, PKCE, Redirect-Policy, CIMD-Validierung, Fehlerfälle) laufen lokal über `npm run test:mcp` bzw. `npm test`. Die Tests mit echten Clients (Codex, Claude) laufen auf Produktion (`https://worldcraft.lagolago.at/mcp`) mit der Demowelt „MCP-Demo“ und dem Konto des Projektinhabers (analog Plan `002` D16). Wo der Auftrag „Staging“ sagt, gilt diese Regel.
- **K2 – `localhost` (entschieden 2026-09-26, Plan-Review): bleibt erlaubt.** Zulässige native Loopback-Redirects sind `http://127.0.0.1`, `http://[::1]` und `http://localhost`, jeweils mit beliebigem Port, bei exakt gleichem Schema, Host und Pfad.
- **K3 – Rate-Limit (entschieden 2026-09-26, Plan-Review): Better-Auth-Limiter nutzen.** In `src/lib/auth.ts` wird `rateLimit` explizit konfiguriert: `enabled: true` (auch lokal, damit testbar), `storage: "memory"` (eine Instanz, ADR-001), `window: 10`, `max: 100` (Better-Auth-Standard für alle übrigen Pfade) und `customRules` pro IP:
  - `/oauth2/register`: 5 Anfragen pro 60 s
  - `/oauth2/authorize`: 30 pro 60 s (begrenzt damit auch die CIMD-Abrufe, die beim Autorisieren ausgelöst werden)
  - `/oauth2/token`: 30 pro 60 s (gilt auch für die Kompatibilitätsroute `/token`, die in-process an den Better-Auth-Handler weitergibt)

  Die Werte stehen als benannte Konstanten in `src/lib/mcp-oauth.ts` (z. B. `MCP_OAUTH_RATE_LIMITS`) und werden in `.ai/architecture/mcp.md` (Abschnitt Aufruflimit) dokumentiert. Die `/.well-known/…`-Routen sind eigene Next-Routen mit statischen, billigen Antworten und werden **nicht** limitiert. Hinter dem Coolify-Proxy muss Better Auth die Client-IP aus `x-forwarded-for` lesen; die Umsetzung prüft das und hält es in `.ai/infrastructure/deployment.md` fest. Die übrigen Tests in `npm run test:mcp` dürfen pro Minute höchstens 5 DCR-Registrierungen auslösen oder müssen den Test-Helfer mit einem wiederverwendeten Client nutzen.
- **K4 – Überschneidungen:** OAUTH-T-002 und OAUTH-T-003 überschneiden sich mit CR-004 (Redirect-Policy am Autorisierungsendpunkt) und CR-016/CR-019 (Discovery). OAUTH-T-005 überschneidet sich mit CR-002 (MCP-Testsuite). Die Umsetzung soll dieselben Funktionen und Tests nutzen, nicht parallel bauen.

**Ist-Stand im Code (Baseline `ff09c34`), damit nichts doppelt gebaut wird:**
- **Discovery:** `src/app/.well-known/oauth-protected-resource/route.ts` (+ `/mcp`-Suffix), `src/app/.well-known/oauth-authorization-server/route.ts` (+ `/api/auth`-Pfad). Die 401-Challenge mit `WWW-Authenticate` liefert `requireMcpAuth` in `src/app/mcp/route.ts`.
- **DCR:** In `src/lib/auth.ts` sind `allowDynamicClientRegistration` und `allowUnauthenticatedClientRegistration` aktiv. Die DCR-Policy `mcpRegistrationValidationError` sitzt in `src/app/api/auth/[...all]/route.ts`.
- **CIMD:** `cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" })` in `src/lib/auth.ts`, Abruf über `@better-auth/cimd/node`.
- **Loopback-Port-Matching:** `@better-auth/oauth-provider` bringt ein portunabhängiges Loopback-Matching mit (`stripLoopbackRedirectPort`, nach node-oidc-provider). Ob es für DCR- und CIMD-Clients greift, ist in OAUTH-T-001 zu belegen.

### CR-023
- **Fundstelle:** OAuth-/MCP-Flow gesamt: `src/lib/auth.ts`, `src/lib/mcp-oauth.ts`, `src/app/api/auth/[...all]/route.ts`, `src/app/.well-known/**`, `src/app/authorize/route.ts`, `src/app/token/route.ts`, `src/app/mcp/route.ts`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** OAUTH-T-001 (Plan `002` T-003, T-005)
- **Beschreibung:** Die aktuelle Implementierung für MCP-Authentifizierung, OAuth-Discovery, Authorization Endpoint, Token Endpoint, Redirect-URI-Validierung und User-Whitelist ist zu lokalisieren und der Ist-Flow zu dokumentieren. Der bisherige Codex-Fehler `invalid_redirect` ist reproduzierbar festzuhalten.
- **Abhängigkeiten:** keine
- **Empfehlung:** Die Bestandsaufnahme in `.ai/architecture/mcp-oauth-anbindung.md` ergänzen (existiert bereits mit Claude-Fehleranalyse), nicht in einer neuen Datei. Dazu die Stelle belegen, an der Better Auth die Redirect-URI vergleicht, sowie das Loopback-Port-Matching (siehe Ist-Stand). Zusätzlich die **feste Client-ID** dokumentieren: wo und wie sie registriert wurde (DCR-Aufruf, Datenbankeintrag in `oauth_clients`, Eintrag in Codex bzw. im Claude-Connector), welche Redirect-URIs sie hat und warum Codex damit `invalid_redirect` erhält.
- **Abnahmekriterium:** Eine technische Bestandsaufnahme benennt Quellmodule, Endpunkte, erwartete HTTP-Statuscodes und Header sowie die genaue Stelle der Redirect-URI-Prüfung. Ein reproduzierbarer Testfall für Codex und einer für Claude sind dokumentiert.
- **Während des Baus definieren:** keine

### CR-024
- **Fundstelle:** `src/app/.well-known/**`, `src/app/mcp/route.ts`, `src/lib/mcp-oauth.ts` (`isAllowedMcpRedirectUri`), `src/lib/auth.ts`
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** OAUTH-T-002 (Plan `002` T-003, T-005); überschneidet sich mit CR-004, CR-016, CR-019
- **Beschreibung:** Protected Resource Metadata und Authorization-Server-Metadaten so bereitstellen, dass MCP-Clients den OAuth-Flow automatisch entdecken. Nicht authentifizierte MCP-Anfragen liefern eine maschinenlesbare OAuth-Challenge. Die Redirect-URI-Prüfung für öffentliche native Clients akzeptiert `127.0.0.1` und `[::1]` mit dynamischem Port, während Schema, Host und Pfad weiterhin exakt validiert werden. PKCE mit `S256` ist für öffentliche Clients verpflichtend.
- **Abhängigkeiten:** CR-023
- **Empfehlung:** Auf dem Ist-Stand aufbauen. Das portunabhängige Matching der Bibliothek nutzen, statt es nachzubauen. Die Prüfung am Autorisierungsendpunkt aus CR-004 als gemeinsame Stelle verwenden. `localhost` bleibt erlaubt (K2).
- **Abnahmekriterium:** Eine nicht authentifizierte Anfrage an den MCP-Endpunkt liefert HTTP 401 einschließlich Verweis auf die Protected Resource Metadata. Die Metadaten verweisen auf den Authorization Server. Ein gültiger Authorization Request mit `http://127.0.0.1:<beliebiger-freier-port>/callback` wird angenommen, ebenso mit `http://[::1]:<port>/callback` und `http://localhost:<port>/callback` (K2). Der gleiche Request mit verändertem Host (z. B. `127.0.0.2`, `evil.example`), Schema (`https` statt `http` auf Loopback) oder Pfad (`/callback2`) wird abgelehnt. Ein Authorization-Code-Flow ohne gültige PKCE-Verifikation kann kein Token ausstellen.
- **Während des Baus definieren:** keine
- **Zusätzliches Abnahmekriterium (K3):** Die sechste DCR-Registrierung von derselben IP innerhalb von 60 s erhält HTTP 429 (Test in `npm run test:mcp`). Die Grenzwerte stehen als Konstanten in `src/lib/mcp-oauth.ts` und sind in `.ai/architecture/mcp.md` dokumentiert.

### CR-025
- **Fundstelle:** `/api/auth/oauth2/register` (Better Auth), `src/lib/mcp-oauth.ts` (`mcpRegistrationValidationError`), `src/app/api/auth/[...all]/route.ts`
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** OAUTH-T-003 (Plan `002` T-003, D8, D13)
- **Beschreibung:** Einen per OAuth-Metadaten veröffentlichten DCR-Endpoint bereitstellen. Er akzeptiert öffentliche native Clients ohne Client-Secret, validiert registrierte Redirect-URIs nach der Policy aus CR-024 und speichert die zugelassenen Client-Metadaten. Die Registrierung ist rate-limitiert und erzeugt keine Berechtigung an Welten oder MCP-Werkzeugen. Ist-Stand: Der Endpunkt existiert bereits; offen sind die Nachweise, die Fehlerantworten und das Rate-Limit.
- **Abhängigkeiten:** CR-024
- **Empfehlung:** Den bestehenden Endpunkt härten statt neu bauen. Die heutige Fehlerantwort `invalid_redirect_uri` aus `[...all]/route.ts` auf RFC-7591-Fehlercodes prüfen (`invalid_redirect_uri`, `invalid_client_metadata`). Das Rate-Limit gemäß K3 (`/oauth2/register`: 5 pro 60 s und IP) wird mit der Umsetzung von CR-024 konfiguriert; CR-025 belegt es nur per Test.
- **Abnahmekriterium:** Ein DCR-`POST` mit gültigen Metadaten liefert eine eindeutige Client-ID; ein anschließender PKCE-Flow für einen Whitelist-Nutzer funktioniert. Ungültige Redirect-URIs, nicht unterstützte Grant-Typen und vertrauliche Client-Authentifizierungsformen werden mit OAuth-konformen Fehlerantworten abgelehnt. Ein dynamisch registrierter Client kann ohne freigegebenen Nutzer keine Tokens erhalten und keine MCP-Werkzeuge aufrufen.
- **Während des Baus definieren:** keine

### CR-026
- **Fundstelle:** `src/lib/auth.ts` (`cimd(...)`, `fetchClientMetadataResource` aus `@better-auth/cimd/node`)
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** OAUTH-T-004 (Plan `002` T-003); überschneidet sich mit CR-004
- **Beschreibung:** CIMD in den Authorization-Server-Metadaten deklarieren und Clients unterstützen, deren `client_id` eine HTTPS-URL zu einem Metadatendokument ist. Das Dokument sicher abrufen, gegen Missbrauch absichern und gegen die angeforderte Client-ID sowie die Redirect-URIs validieren. Ist-Stand: CIMD ist aktiv, der Abruf läuft über den Node-Transport der Bibliothek. Offen sind der Nachweis der Schutzmaßnahmen (SSRF, Größe, Weiterleitungen, Cache) und die Redirect-Policy (CR-004).
- **Abhängigkeiten:** CR-024
- **Empfehlung (entschieden 2026-09-26, Plan-Review): Bibliotheks-Defaults ermitteln, eigene Werte als verbindliche Obergrenze.**
  1. Die eingebauten Schutzmaßnahmen und Grenzwerte von `@better-auth/cimd/node` (`fetchClientMetadataResource`) ermitteln und in `.ai/architecture/mcp-oauth-anbindung.md` dokumentieren: HTTPS-Pflicht, Blockade privater und reservierter Adressen (auch nach DNS-Auflösung), Weiterleitungen, Antwortgröße, Timeout, Cache.
  2. Verbindliche Obergrenzen für WorldCraft, als Konstanten in `src/lib/mcp-oauth.ts` (z. B. `MCP_CIMD_LIMITS`): Antwort höchstens **5 KB**, Timeout **5 s**, **keine** Weiterleitungen, Cache **15 Minuten** pro `client_id`-URL, fehlgeschlagene Abrufe **1 Minute** (Negativ-Cache).
  3. Nur wo die Bibliothek lockerer ist oder einen Schutz nicht hat, einen Wrapper um `fetchClientMetadataResource` ergänzen und in `cimd({ fetchClientMetadataResource: … })` übergeben. Wo die Bibliothek bereits strenger ist, bleibt ihr Wert.
  4. Die Tests prüfen die WorldCraft-Werte, nicht die Bibliotheks-Defaults. Ein Upgrade, das die Bibliothek lockert, fällt so im Test auf.
- **Abnahmekriterium:** Ein gültiges HTTPS-CIMD mit übereinstimmender Client-ID und gültiger Loopback-Redirect-URI kann einen PKCE-Flow durchführen. Nicht-HTTPS-URLs, private oder reservierte Zieladressen, zu große Antworten, unerlaubte Weiterleitungen, nicht erreichbare Dokumente sowie abweichende Client-ID- oder Redirect-Werte werden abgelehnt. Abrufe werden begrenzt und zwischengespeichert, sodass ein Client die Infrastruktur nicht ungebremst für externe Requests nutzen kann. Konkret (Tests in `npm test` mit gemocktem Netzwerk): eine Antwort über 5 KB, eine Antwort nach mehr als 5 s und jede 3xx-Weiterleitung führen zur Ablehnung. Zwei Autorisierungen mit derselben `client_id`-URL innerhalb von 15 Minuten lösen genau einen Abruf aus; nach einem Fehlschlag erfolgt innerhalb von 1 Minute kein erneuter Abruf. Die Bibliotheks-Defaults sind in `mcp-oauth-anbindung.md` dokumentiert.
- **Während des Baus definieren:** keine

### CR-027
- **Fundstelle:** MCP-Testsuite (`npm run test:mcp`, `vitest.mcp.config.ts`), `.ai/infrastructure/` (Protokoll manueller Schritte)
- **Kategorie:** Testabdeckung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** OAUTH-T-005 (Plan `002` T-010); überschneidet sich mit CR-002
- **Beschreibung:** Eine wiederholbare Testmatrix für feste Client-ID, DCR und CIMD erstellen. Sie prüft Discovery, Browser-Login, Callback, Token-Austausch, Refresh-Token und MCP-`tools/list` für Codex und Claude.
- **Abhängigkeiten:** CR-025, CR-026; teilt Helfer und Tests mit CR-002
- **Empfehlung:** Die automatisierbaren Teile (Discovery, DCR, PKCE, Token, Refresh, `tools/list`, Fehlerfälle) in die Suite aus CR-002 aufnehmen. Die Client-spezifischen Schritte für Codex und Claude als manuelles Protokoll in `.ai/infrastructure/mcp-e2e-test.md` festhalten (siehe CR-013). Umgebung gemäß K1 klären.
- **Festlegung feste Client-ID (Projektinhaber, Plan-Review 2026-09-26):** Die feste Client-ID bleibt **vorerst als Backup** erhalten und ist Teil der Matrix. Sie wird nicht entfernt, bevor (1) Codex über DCR bzw. CIMD ohne `invalid_redirect` funktioniert und (2) Claude über den neuen Weg (CIMD bzw. DCR) erfolgreich getestet ist.
- **Abnahmekriterium:** Die Testmatrix läuft automatisiert oder mit klar dokumentierten manuellen Schritten. Codex kann sich ohne `invalid_redirect` authentifizieren und WorldCraft-Werkzeuge auflisten. Claude bleibt funktionsfähig. Fehlerfälle für Redirect-URI, PKCE, nicht freigegebenen Nutzer und abgelaufenes bzw. manipuliertes Token sind abgedeckt.
- **Während des Baus definieren:** keine

---

## Prioritätenliste

1. **CR-001**: Widerruf muss sofort wirken. Sicherheitsversprechen aus T-004, Produktion ist aktiv.
2. **CR-010**: Testwelt korrigieren. Voraussetzung für aussagekräftige Tests in CR-002.
3. **CR-002**: Die Rechte- und Ausschlusssuite (T-008) und die OAuth-Negativtests nachziehen. Ohne sie ist keine der übrigen Sicherheitsaussagen belegt.
4. **CR-003, CR-004, CR-005, CR-007**: Informationslecks und umgehbare OAuth-Schranken schließen.
5. **CR-006**: Speicher-DoS über `bild_lesen` verhindern und die 1-MB-Grenze garantieren.
6. **CR-012**: Hilfeseite richtigstellen.
7. **CR-009, CR-008**: ADR-005 an die Scope-Hierarchie anpassen und die N+1-Abfrage in `inhalte_auflisten` beseitigen.
8. **CR-014 bis CR-022** (ohne das verworfene CR-021): kleinere Korrekturen und Aufräumarbeiten.
9. **CR-011**: `tools.ts` in Module aufteilen und die ESLint-Regel einführen (nach den Korrekturen in `tools.ts`, vor Beginn von Plan `011`).
10. **CR-013**: Task-Datei und E2E-Protokoll zuletzt nachführen, wenn der tatsächliche Abnahmestand feststeht.
11. **CR-023 bis CR-027** (Zusatzauftrag OAuth): nach Klärung von K1–K3 in der Reihenfolge CR-023 → CR-024 → CR-025/CR-026 → CR-027. Wegen der Überschneidungen (K4) sinnvollerweise zusammen mit CR-004 und CR-002 umsetzen; CR-027 vor CR-013 abschließen.
