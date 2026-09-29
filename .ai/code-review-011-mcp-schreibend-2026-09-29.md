# Code Review – 011 MCP: Schreibend

**Baseline:** Commit `19c98a0516359173d1cb4c90482313744341a686` (`main`, Working Tree sauber, keine uncommitteten Änderungen)
**Geprüfte Task-Datei:** `.ai/feature-tasks/011-mcp-schreibend.md`
**Geprüfte Aufgaben (erledigt `[x]`):** T-013, T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010, T-012. T-011 ist offen (E2E auf Produktion ausstehend) und wurde nur so weit einbezogen, wie ihr Teilstand (Hilfeseite) den Code berührt.
**Review-Datum:** 2026-09-29
**Plan-Review:** 2026-09-29. Offene Wahlmöglichkeiten (CR-001, CR-002, CR-003, CR-005, CR-007, CR-009, CR-013, CR-019) sind durch den Projektinhaber entschieden und bei den Findings als „Entscheidung“ vermerkt. Begriffe wie *Stand*, *Stub*, *Bestätigungs-Token*, *S1–S12* stammen aus `.ai/feature-tasks/011-mcp-schreibend.md` (Abschnitte „Entscheidungen“ und „Begriffe & Systeme“).

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Runtime-Risiken | kritisch | offen | Stub-Artikel entstehen vor der Stand- und Zielprüfung; umstellen auf „prüfen → Stubs → schreiben“ mit Kompensation |
| CR-002 | Lesbarkeit (Doku) | niedrig | behoben | Verhalten bleibt (Entscheidung 2026-09-29): S1, ADR-005 und Hilfeseite an „jede Verbindung ist Lesen und Schreiben“ anpassen |
| CR-003 | Runtime-Risiken | mittel | offen | Die Stand-Prüfung ist nicht atomar mit dem Schreiben (ADR-005 „Stand“), daher sind Lost Updates möglich |
| CR-004 | Aufgaben-Abgleich | mittel | behoben | Die Plausibilitätsprüfung sucht Wortpräfixe und wird in der MCP-Suite geprüft |
| CR-005 | Sicherheit | mittel | offen | Vorlagenverweise in Objektform `{kind,id}` umgehen die Sichtbarkeitsprüfung, Objektform wird verboten |
| CR-006 | Aufgaben-Abgleich | mittel | behoben | Der Upload-Endpunkt antwortet für Nicht-Browser standardmäßig mit JSON |
| CR-007 | Runtime-Risiken | mittel | offen | Kapitel mit Status/Position: veralteter Stand und nicht-atomare Folgeschritte, Status und Position kommen direkt in `createChapter`/`updateChapter` |
| CR-008 | Fehlerbehandlung | mittel | offen | Im Bestätigungspfad werden Fehler zur generischen Meldung „Die Anfrage konnte nicht verarbeitet werden“ |
| CR-009 | Runtime-Risiken | mittel | offen | Der Markdown-Parser verliert harte Umbrüche und macht `_` innerhalb von Wörtern kursiv, der eigene Parser wird repariert |
| CR-010 | Aufgaben-Abgleich | mittel | offen | Die Änderungsvorschau zeigt englische Schlüssel, rohe IDs und keinen alten Charakterblatt-Wert (S11, Begriff „Änderungsvorschau“) |
| CR-011 | Duplizierung | mittel | offen | Große Duplikate zwischen `content-create`, `content-update`, `visibility-set` und `image-upload` |
| CR-012 | Bad Practices | mittel | offen | `content-update.ts` (1 163 Zeilen) steuert alles über zwei riesige Verzweigungsketten je `art` |
| CR-013 | Testabdeckung | mittel | offen | Für T-004 (2) Ablauf nach 10 Minuten und (5) Rechteverlust zwischen Vorschau und Bestätigung fehlen Tests |
| CR-014 | Runtime-Risiken | niedrig | offen | Erwähnungen mit expliziter ID werden über eine Titelsuche mit Limit aufgelöst und schlagen dadurch fälschlich fehl |
| CR-015 | Performance | niedrig | offen | N+1-Abfragen: eine Suche mit 5 Abfragen je Erwähnung, das Ganze mehrfach je Aufruf; `findVisibleChapter` lädt alle Quests |
| CR-016 | Bad Practices | niedrig | behoben | Die Audit-ID wird strukturiert aus dem Anlegeergebnis übernommen |
| CR-017 | Fehlerbehandlung | niedrig | behoben | Unbekannte Felder werden strikt validiert und erzeugen keine Vorschau |
| CR-018 | Sicherheit | niedrig | offen | Upload-Tickets sind nicht an den OAuth-Client gebunden, das Audit schreibt `clientId: "upload-ticket"` |
| CR-019 | Toter Code | niedrig | behoben | Der Änderungs-Hash wird beim Einlösen gegen den normalisierten Payload geprüft |
| CR-020 | Lesbarkeit | niedrig | behoben | `registerMcpTools` beschreibt den vollständigen Werkzeugsatz; Purge-Operationen sind getrennt geloggt |
| CR-021 | Sicherheit | niedrig | offen | Der Upload-POST liest den ganzen Body vor der Größenprüfung, GET antwortet bei Stand-Drift mit 404 statt mit einer Erklärung |
| CR-022 | Testabdeckung | niedrig | behoben | Bestätigungs-Integrationstest ist nur noch Teil der MCP-Suite |
| CR-023 | Runtime-Risiken | niedrig | offen | Stub-Titel, die sich nur in Groß-/Kleinschreibung unterscheiden, erzeugen doppelte Stubs |
| CR-024 | Bad Practices | niedrig | offen | T-005 bis T-010 wurden in einem einzigen Release-Commit ausgeliefert statt als ein Commit pro Task |

---

## Findings im Detail

### CR-001 – Stubs entstehen vor Stand- und Zielprüfung und ohne Transaktion
- **Fundstelle:** `src/lib/mcp/tools/content-update.ts` `executeUpdate` (Z. 734 ff., Aufruf `materializeUpdateDocs` Z. 747 vor `assertStand` Z. 757/809/…); `src/lib/mcp/tools/content-create.ts` `executeCreate` (Z. 144–166)
- **Kategorie:** Runtime-Risiken / Aufgaben-Abgleich
- **Schweregrad:** kritisch
- **Bezug (Task-ID):** T-004, T-005, T-006
- **Beschreibung:** In `executeUpdate` legt `materializeUpdateDocs` alle vorgemerkten Stub-Artikel an, **bevor** das Ziel geladen und `assertStand` geprüft wird. Ändert sich der Stand zwischen Vorschau und Bestätigung oder verliert der Benutzer das Recht auf das Ziel, entstehen die Stubs trotzdem, und erst danach kommt der Fehler „bitte neu lesen“. Das verletzt T-004 (4): „wird nichts geändert“. In `executeCreate` werden die Stubs einzeln angelegt, bevor der eigentliche Inhalt entsteht. Scheitert danach etwas (Rechtefehler bei `createChapter`, Mehrdeutigkeit bei der Neuauflösung, Zod-Fehler), bleiben verwaiste Stubs zurück. MCP kann sie nicht löschen (S7 Maßnahme 5).
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-29):** Erst prüfen, dann Stubs, dann schreiben. Scheitert der Hauptschritt, werden die Stubs kompensiert. Es gibt **keine** domänenübergreifende Transaktion und keinen `tx`-Parameter in den Domänenfunktionen.
- **Empfehlung:** (1) `executeCreate` und `executeUpdate` in drei Phasen gliedern: **a) Prüfen:** Ziel laden (bei Anlage die Quest für Kapitel), Stand mit `assertStand` prüfen, alle Felder parsen und normalisieren, Erwähnungen ohne Stubs auflösen. Hier entsteht noch nichts. **b) Stubs anlegen:** über `createArticleStub`, die angelegten IDs merken. **c) Schreiben:** Domänenfunktion aufrufen. (2) Wirft Phase c, oder liefert sie `ok: false`, werden alle in Phase b angelegten Stubs intern über die bestehende Domänenfunktion `deleteArticle` (`src/lib/domain/articles.ts`) wieder entfernt, danach wird der ursprüngliche Fehler geworfen. Die Kompensation ist kein MCP-Löschwerkzeug und nicht nach außen sichtbar. Sie löscht ausschließlich Stubs, die im selben Aufruf entstanden sind. Scheitert die Kompensation selbst, wird das als `mcp_stub_compensation_error` geloggt (nur IDs, kein Titel), und der ursprüngliche Fehler geht an den Client. (3) Die Phasen einmal zentral implementieren (siehe CR-011), nicht getrennt in Create und Update.
- **Abnahmekriterium:** Ein MCP-Test erzeugt eine Vorschau mit Stub für einen bestehenden Artikel, ändert dann den Artikel (Stand weicht ab) und ruft `aenderung_bestaetigen` auf. Der Aufruf liefert den Neulesen-Fehler, und die Anzahl der Artikel in der Welt ist unverändert (kein Stub). Ein zweiter Test erzeugt per `inhalt_anlegen` (`art: kapitel`, Text mit `@[Neuer Stub]`) eine Vorschau, setzt die Quest danach per SQL auf `owner_only` eines anderen Benutzers und bestätigt. Der Aufruf liefert „nicht gefunden“ (Phase a), die Artikelanzahl bleibt unverändert. Ein Unit-Test mit gemockten Domänenfunktionen belegt die Kompensation: Wirft Phase c, wird `deleteArticle` genau für die in Phase b angelegten Stub-IDs aufgerufen.

### CR-002 – Scope-Erweiterung auf `worlds:write` (Doku an Entscheidung anpassen)
- **Status:** behoben – S1 und ADR-005 beschreiben seit 2026-09-29 die bewusste Scope-Erweiterung; die Hilfeseite versprach bereits keine reine Lese-Verbindung.
- **Fundstelle:** `src/lib/mcp-oauth.ts` `withExpandedMcpAuthorizeScopes` (Z. 79–90); `.ai/feature-tasks/011-mcp-schreibend.md` S1 und Begriff `worlds:write`; `.ai/decisions/005-mcp-server.md` Abschnitt „Schreiben“, Zeile „Scope `worlds:write`“; `src/app/hilfe/mcp/page.tsx`
- **Kategorie:** Lesbarkeit & Wartbarkeit (Dokumentation)
- **Schweregrad:** niedrig (ursprünglich kritisch, herabgestuft durch Entscheidung)
- **Bezug (Task-ID):** T-003, T-012
- **Beschreibung:** Jede Authorize-Anfrage an `/mcp` mit `worlds:read` wird serverseitig um `worlds:write` ergänzt, eine reine Lese-Verbindung ist damit nicht möglich. Das widerspricht dem Wortlaut von S1 („Ein Benutzer kann einen Client weiterhin nur lesend verbinden“) und ADR-005 („keine stille Erweiterung“).
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-29):** Das Verhalten **bleibt wie heute**. Die Zustimmungsseite steuert „Lesen und Schreiben“ als Ganzes, es gibt keine Wahl „nur lesen“. Begründung: weniger Komplexität. Jede Änderung an bestehendem Inhalt braucht ohnehin eine Bestätigung, und ohne ausdrückliche Zustimmung in der App wird nie geschrieben. Code, Migration 0031 und der Unit-Test in `mcp-oauth.test.ts` bleiben unverändert.
- **Empfehlung:** Nur Dokumentation anpassen: (1) S1 in Plan 011 um einen datierten Zusatz ergänzen: „Geändert 2026-09-29: Jede MCP-Verbindung erhält Lesen und Schreiben; eine reine Lese-Verbindung wird nicht angeboten (`withExpandedMcpAuthorizeScopes`).“ Den Satz über das nur lesende Verbinden als überholt markieren. (2) In ADR-005, Zeile „Scope `worlds:write`“, festhalten, dass Anfragen mit `worlds:read` für `/mcp` bewusst auf `worlds:write` erweitert werden, samt Begründung. (3) Die Hilfeseite prüfen, dass sie keine „nur lesend verbinden“-Option verspricht.
- **Abnahmekriterium:** S1 in `.ai/feature-tasks/011-mcp-schreibend.md` und ADR-005 enthalten den datierten Hinweis auf die Erweiterung und keine gegenteilige Aussage mehr. `grep -n "nur lesend verbinden" .ai src/app/hilfe` liefert keinen Treffer, der dem widerspricht. Am Code ändert sich nichts.

### CR-003 – Stand-Prüfung nicht atomar
- **Fundstelle:** `src/lib/mcp/write-rich.ts` `assertStand` (Z. 33–37) und alle Aufrufer in `content-update.ts`, `visibility-set.ts`; Domänen-Updates `updateArticle`, `updateQuest`, `updateChapter`, `updateMonster`, `updateUniverse`, `updateWorld` ohne erwarteten Stand
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-001 (Punkt 5), T-006, T-007
- **Beschreibung:** ADR-005 legt fest: „Jede schreibende Domänenoperation prüft den Stand atomar in ihrer Update-Bedingung.“ Umgesetzt ist das nur beim Notizblock (`saveQuestNote` mit `version`). Überall sonst gilt: lesen → `assertStand` → separates `update…`. Speichert ein App-Benutzer im Zeitfenster dazwischen, wird seine Änderung überschrieben. Bei `anhaengen` wird der neue Body aus dem **vorher gelesenen** Stand zusammengesetzt, sodass die App-Änderung verloren geht.
- **Empfehlung:** Den Domänen-Updates einen optionalen `expectedUpdatedAt` geben, der in der `WHERE`-Bedingung landet (`AND updated_at = $expected`). Liefert das Update 0 Zeilen, gibt es einen eigenen Fehlercode „stale“, den MCP auf „Inhalt wurde inzwischen geändert, bitte neu lesen.“ abbildet.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-29):** Die Abnahme erfolgt über einen **Domänen-Integrationstest** (`npm run test:triggers`), nicht über Hooks, Mocks oder E2E.
- **Abnahmekriterium:** (a) Jede MCP-Änderung (Artikel, Quest, Kapitel, Monster, Universum, Welt, Sichtbarkeit) übergibt den Stand an die Domänenfunktion, und diese prüft ihn in der `WHERE`-Bedingung des Updates (per Review nachvollziehbar). (b) Neue Datei `src/lib/domain/expected-updated-at.integration.test.ts`: Für `updateArticle`, `updateQuest`, `updateChapter`, `updateMonster`, `updateUniverse` und `updateWorld` gilt je: Ein Aufruf mit einem `expectedUpdatedAt`, der eine Millisekunde vom DB-Wert abweicht, liefert den Fehlercode „stale“, und `updated_at` sowie die geänderten Felder sind danach unverändert. Mit dem aktuellen Wert gelingt der Aufruf. Ohne `expectedUpdatedAt` (App-Pfad) verhält sich die Funktion wie bisher.

### CR-004 – Plausibilitätsprüfung für Stubs wirkungslos
- **Status:** behoben – Die Auflösung prüft sichtbare Wortpräfixe; ein MCP-Test verifiziert Vorschlag statt Stub und Token.
- **Fundstelle:** `src/lib/domain/mcp-mentions.ts` Z. 31–36 und 51–52; Test `src/lib/domain/mcp-mentions.test.ts` „does not create a plausible accidental stub“
- **Kategorie:** Aufgaben-Abgleich / Testabdeckung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-002 (Abnahme 9), S7 Maßnahme 3
- **Beschreibung:** Die Prüfung sucht Kandidaten mit `searchMentionTargets({ query: mention.title })`. Die Suche filtert per `title ILIKE '%query%'`. Für den langen Stub-Titel „Gegenstand Y und noch viele andere …“ kommt der kürzere Artikel „Gegenstand Y“ daher **nie** zurück. Die Bedingung `mention.title.includes(candidate.title)` kann in der Praxis nur für exakte Treffer greifen, die schon vorher behandelt werden. Der Unit-Test mockt die Suche so, dass sie „Gegenstand Y“ liefert, und ist deshalb grün, obwohl das Verhalten real fehlt. „Beginnt damit“ (sichtbarer Titel beginnt mit dem Stub-Titel) wird gar nicht geprüft.
- **Empfehlung:** Eigene Abfrage für die Plausibilitätsprüfung: sichtbare Titel, für die `lower($stub) LIKE '%' || lower(title) || '%'` gilt oder die mit dem Stub-Titel beginnen. Alternativ die Wortpräfixe des Stub-Titels einzeln suchen. Den Test auf den `*.mcp.test.ts`-Pfad (echte DB) heben oder zusätzlich dort abdecken.
- **Abnahmekriterium:** MCP-Integrationstest gegen die Testwelt: Mit vorhandenem Artikel „Gegenstand Y“ liefert `inhalt_anlegen` mit `@[Gegenstand Y und noch viele andere seltene Gegenstände]` einen Fehler mit Vorschlag „Gegenstand Y“ und kein Bestätigungs-Token. Mit vorhandenem „Burg Rabenstein“ liefert `@[Burg]` ebenfalls einen Fehler mit Vorschlag.

### CR-005 – Vorlagenverweise in Objektform umgehen die Sichtbarkeit
- **Fundstelle:** `src/lib/mcp/write-rich.ts` `resolveMentionRef` Z. 91–96; `src/lib/domain/articles.ts` `assertRefTargets` (prüft nur Existenz in der Welt)
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-002 (Abnahme 4), T-005
- **Beschreibung:** Übergibt der Client in `vorlagenfelder` statt Erwähnungssyntax ein Objekt `{ "kind": "article", "id": "<uuid>" }`, wird es ungeprüft durchgereicht. `assertRefTargets` prüft nur, ob der Artikel in der Welt existiert, nicht, ob er für den Benutzer sichtbar ist. So entstehen Verweise und Relationen auf fremde `nur ich`-Artikel. Die unterschiedliche Antwort (Erfolg vs. „akzeptiert dieses Ziel nicht“) verrät außerdem, ob eine ID existiert. Das widerspricht dem Prinzip aus T-002 (4).
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-29):** Die Objektform wird **verboten**. MCP akzeptiert Verweise in `vorlagenfelder` und `lebensraum` ausschließlich in Erwähnungssyntax.
- **Empfehlung:** In `resolveMentionRef` (`write-rich.ts`) den Objekt-Zweig (Z. 91–96) entfernen. Ein Objekt- oder Array-Wert führt zu `McpToolError("Verweis muss in Erwähnungssyntax angegeben werden, z. B. @[Titel](artikel:id).")`. Die Beschreibungen von `inhalt_anlegen` und `inhalt_aendern` nennen die Erwähnungssyntax als einzige Form für Verweise. `assertRefTargets` in der Domäne bleibt unverändert.
- **Abnahmekriterium:** MCP-Test: `inhalt_anlegen` mit `vorlagenfelder: { Rasse: { kind: "article", id: <UUID> } }` liefert die Meldung „Verweis muss in Erwähnungssyntax angegeben werden …“. Die Meldung ist identisch für eine existierende sichtbare, eine fremde `nur ich`- und eine nicht existierende ID. Es entsteht weder Artikel noch Relation. `resolveMentionRef` enthält keinen Zweig mehr, der ein Objekt mit `kind`/`id` übernimmt.

### CR-006 – Upload antwortet Programmen nur mit Accept-Header in JSON
- **Status:** behoben – Nicht-Browser erhalten JSON als Standard; die MCP-Suite prüft Upload ohne `Accept`-Header.
- **Fundstelle:** `src/app/upload/[ticket]/route.ts` `wantsJson` (Z. 27–30); Hinweistext `src/lib/mcp/tools/image-upload.ts` Z. 95; Test `src/app/mcp/mcp.mcp.test.ts` Z. 868 (setzt `accept: application/json`)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-008 (Abnahme 1), S9
- **Beschreibung:** T-008 (1) verlangt: `curl -F "datei=@bild.png" <link>` setzt das Bild und antwortet mit JSON. curl sendet standardmäßig `Accept: */*`, daher liefert die Route HTML. Das Werkzeug empfiehlt Agenten genau diesen Befehl ohne Header. Der Test umgeht das Problem mit einem explizit gesetzten Accept-Header.
- **Empfehlung:** JSON als Standard für Nicht-Browser-Aufrufer: HTML nur, wenn `Accept` `text/html` enthält, sonst JSON. Alternativ den Hinweistext um `-H "Accept: application/json"` ergänzen und die Abnahme anpassen. Die erste Variante ist robuster.
- **Abnahmekriterium:** Ein Test ruft den Upload-Link per `fetch` **ohne** Accept-Header (bzw. mit `*/*`) auf und erhält `201` mit `Content-Type: application/json`. Ein Aufruf mit `Accept: text/html,…` erhält weiter die Erfolgsseite.

### CR-007 – Kapitel: veralteter Stand und nicht-atomare Mehrschritt-Schreibvorgänge
- **Fundstelle:** `src/lib/mcp/tools/content-create.ts` Z. 268–319 (`createChapter` → `updateChapter` → `reorderChapters`, Stand aus `result.data.updatedAt` Z. 307); `src/lib/mcp/tools/content-update.ts` Kapitel-Zweig in `executeUpdate` (`updateChapter` → `reorderChapters`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-005, T-006
- **Beschreibung:** Beim Anlegen eines Kapitels mit `status` ≠ `offen` oder mit `position` setzen `updateChapter` und `reorderChapters` `updated_at` neu. Die Antwort meldet aber den Stand **vor** diesen Schritten. Eine direkt folgende `inhalt_aendern`- oder `sichtbarkeit_setzen`-Anfrage mit diesem Stand scheitert. Außerdem laufen die Schritte ohne gemeinsame Transaktion: Scheitert `reorderChapters`, existiert das Kapitel trotzdem, und der Client bekommt einen Fehler, als wäre nichts passiert. Beim Ändern gilt dasselbe für Update und Umsortierung.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-29):** Problem A (veralteter Stand) **und** Problem B (Kapitel bleibt nach Fehler im Folgeschritt übrig, Client hält die Anlage für gescheitert) werden **atomar** gelöst: Status und Position werden direkt in der Domänenfunktion gesetzt, nicht in Folgeschritten. Es gibt keine Kompensation und keine Mocks.
- **Empfehlung:** (1) `createChapter` (`src/lib/domain/quest-chapters.ts`) bekommt optionale Parameter `status` und `position` (1-basiert, Standard ans Ende). Einfügen und Verschieben der übrigen sichtbaren Kapitel geschehen in **einer** Transaktion mit der bestehenden `FOR UPDATE`-Sperre der Quest, analog zu `reorderChapters`. (2) `updateChapter` bekommt analog einen optionalen Parameter `position`, sodass `inhalt_aendern` Update und Umsortierung in einer Transaktion ausführt. (3) `content-create.ts` und `content-update.ts` rufen für Kapitel nur noch je **eine** Domänenfunktion auf, und der gemeldete Stand ist das `updated_at` aus deren Rückgabe. (4) Die App-Routen können die neuen Parameter nutzen, müssen aber nicht.
- **Abnahmekriterium:** (a) Domänen-Integrationstest (`npm run test:triggers`): `createChapter` mit `status: "active"` und `position: 1` liefert ein Kapitel mit Status aktiv an erster Stelle, und das zurückgegebene `updatedAt` entspricht dem DB-Wert. Mit einer ungültigen Position oder einer unsichtbaren Quest entsteht kein Kapitel. Dasselbe gilt für `updateChapter` mit `position`. (b) MCP-Suite (`npm run test:mcp`): `inhalt_anlegen` mit `art: kapitel, status: aktiv, position: 1`, danach sofort `inhalt_aendern` mit dem gemeldeten Stand liefert eine Vorschau mit Token, keinen Stand-Fehler. (c) `content-create.ts` ruft für Kapitel weder `updateChapter` noch `reorderChapters` auf. (d) Ein Protokollschritt dazu steht im E2E-Abschnitt „Schreiben“ von `.ai/infrastructure/mcp-e2e-test.md`.

### CR-008 – Generische Fehlermeldungen im Bestätigungspfad
- **Fundstelle:** `src/lib/domain/mcp-mentions.ts` Z. 9 (`McpMentionError extends Error`); `content-create.ts` `executeCreate` (`rich`, `articleFields.parse`); `content-update.ts` `materializeUpdateDocs.rich`, `executeUpdate` (`*.parse`); `src/lib/editor/mcp-markdown.ts` Z. 84 (`throw new Error`); `src/lib/mcp/tools/shared.ts` `asError`
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-004, T-005, T-006
- **Beschreibung:** Nur `McpToolError` wird dem Client als Klartext gezeigt. In der Vorschau-Phase wandeln `collectCreateStubs`, `prepareUpdate` und `resolveRichText` Fehler um. In der Ausführung über `aenderung_bestaetigen` (`executeCreate`/`executeUpdate`) geschieht das nicht. Eine dort auftretende Mehrdeutigkeit (inzwischen gleichnamiger Artikel), ein Sanitize-Fehler oder ein Zod-Fehler erscheint als „Die Anfrage konnte nicht verarbeitet werden.“ und wird als `error` statt `tool_error` protokolliert, obwohl das Token schon verbraucht ist.
- **Empfehlung:** `McpMentionError` von `McpToolError` erben lassen. `resolveMcpMarkdown` wirft einen eigenen, von `McpToolError` abgeleiteten Fehler. Zod-Fehler in den `execute*`-Funktionen gibt es nicht mehr, weil die Felder nur einmal geparst und typisiert im Payload gespeichert werden (siehe CR-011).
- **Abnahmekriterium:** Unit-Test: `McpMentionError` ist `instanceof McpToolError`. MCP-Test: Zwischen Vorschau und Bestätigung wird ein zweiter sichtbarer Artikel mit dem erwähnten Titel angelegt. `aenderung_bestaetigen` liefert die Mehrdeutigkeitsmeldung mit Trefferliste, und im Audit-Log steht `result = 'tool_error'`.

### CR-009 – Markdown-Parser verliert Formatierung
- **Fundstelle:** `src/lib/editor/mcp-markdown.ts` Z. 48 (`trimEnd`), Z. 107 (`split("  \n")`), Z. 117 (Token-Regex), Z. 49–56
- **Kategorie:** Runtime-Risiken / Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-002 (Abnahme 1 und 3)
- **Beschreibung:** (1) `tiptapJsonToMcpMarkdown` gibt harte Umbrüche als `"  \n"` aus. Der Parser entfernt mit `trimEnd()` aber genau diese Leerzeichen, sodass `markedText` nie teilt. Ein harter Umbruch wird zu einem literalen `\n` im Textknoten, die Rundreise ist für Texte mit Zeilenumbruch kaputt. Das wird kritisch bei `modus: ersetzen` nach `inhalt_lesen`. (2) `_` bzw. `*` innerhalb von Wörtern (`snake_case_name`, `2*3*4`) wird kursiv. (3) Verschachtelte Marks (`***fett-kursiv***`, `**[Link](…)**`) werden nicht erkannt. (4) Mehrzeilige Zitate werden zu mehreren Blockquotes. (5) `# H1` bleibt als literales „# …“ stehen, statt auf H2 abgebildet oder als Text ohne `#` behalten zu werden. Die Rundreise-Abnahme T-002 (3) ist nur für die Testwelt belegt, und die enthält diese Fälle offenbar nicht.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-29):** Der **eigene Parser wird repariert**. Es kommt keine Bibliothek dazu, und ADR-005 Punkt 4 (Eigenbau) bleibt unverändert.
- **Empfehlung:** In `mcp-markdown.ts`: (1) Harte Umbrüche erkennen, **bevor** `trimEnd` greift. Eine Zeile, die auf zwei Leerzeichen oder `\` endet, erzeugt am Zeilenende einen `hardBreak`. Folgezeilen desselben Absatzes ohne diese Endung werden wie in CommonMark mit einem Leerzeichen verbunden (kein literales `\n` im Textknoten). (2) `_`/`__` und `*`/`**` nur als Mark werten, wenn der Öffner nicht direkt auf ein Wortzeichen folgt und der Schließer nicht direkt vor einem Wortzeichen steht (CommonMark-Flanking vereinfacht). (3) Marks rekursiv parsen, sodass `***x***`, `**[Link](https://…)**`, `~~**x**~~` und `<u>*x*</u>` verschachtelt entstehen. (4) Aufeinanderfolgende `>`-Zeilen zu einem Blockquote mit einem Absatz je Leerzeilen-Block zusammenfassen. (5) `# Titel` (H1) als Überschrift Ebene 2 übernehmen, `####`–`######` als Ebene 3.
- **Abnahmekriterium:** Unit-Tests in `src/lib/editor/mcp-markdown.test.ts` (laufen mit `npm test` in der CI): (a) Rundreise TipTap → `tiptapJsonToMcpMarkdown` → `mcpMarkdownToTiptap` → `sanitizeRichDoc` ist identisch für ein Dokument mit hartem Umbruch, fett+kursiv verschachtelt, fettem Link, unterstrichen+kursiv und einem zweizeiligen Zitat. (b) `snake_case_name` und `2*3*4` bleiben Text ohne Mark. (c) `# Titel` ergibt `heading` Ebene 2, `#### Titel` ergibt Ebene 3. (d) Kein Textknoten des Ergebnisses enthält ein literales `\n`.

### CR-010 – Änderungsvorschau unvollständig bzw. nicht lesbar
- **Fundstelle:** `src/lib/mcp/tools/content-update.ts` Z. 418–420 (vorlagenfelder als JSON mit Registry-Schlüsseln), Z. 464–467 (beteiligte als IDs), Z. 628–631 (lebensraum als ID), Z. 637 (`"(bisheriges Blatt)"`); `src/lib/mcp/tools/visibility-set.ts` Z. 247 (generischer Folgetext)
- **Kategorie:** Aufgaben-Abgleich / Lesbarkeit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006 (Abnahme 1), T-007, S11, Begriff „Änderungsvorschau“
- **Beschreibung:** Laut Plan zeigt die Vorschau geänderte Felder mit altem **und** neuem Wert, und die Ausgabe nutzt deutsche Labels als Schlüssel (S11). Tatsächlich zeigt `vorlagenfelder` `JSON.stringify` mit englischen Registry-Schlüsseln und Verweis-Objekten (`{"race":{"kind":"article","id":…}}`). Beim Charakterblatt fehlt der alte Wert ganz, Lebensraum und Beteiligte erscheinen als UUIDs. Der Benutzer bestätigt damit Änderungen, die er nicht beurteilen kann.
- **Empfehlung:** Einen Vorschau-Formatter pro Feldtyp nutzen, der vorhandene Renderer aus `inhalt_lesen` wiederverwendet: Vorlagenfelder mit deutschem Label und Erwähnungssyntax, Charakterblatt alt/neu als Markdown, IDs als `Titel (id)`. Bei `sichtbarkeit_setzen` die Folge konkret für die Zielstufe nennen.
- **Abnahmekriterium:** MCP-Test: Die Vorschau einer Vorlagenfeld-Änderung enthält „Rasse:“ und `@[<Titel>](artikel:<id>)`, aber nicht `"race"`. Die Vorschau einer Charakterblatt-Änderung enthält einen alten Wert ungleich „(bisheriges Blatt)“. Die Lebensraum-Vorschau enthält den Titel des Ort-Artikels.

### CR-011 – Duplizierter Code in den Schreibwerkzeugen
- **Fundstelle:** `content-create.ts` und `content-update.ts`: Feld-Schemas (Z. 37–79 bzw. 57–102), `prepareTemplateFields` (create Z. 97, update Z. 214, identisch), `resolveHabitat` (create Z. 125, update Z. 242, fast identisch), Stub-Materialisierung/`fillStubRefs`/`rich` (create Z. 152–204, update `materializeUpdateDocs` Z. 301–370); `findVisibleChapter` (update Z. 260, `visibility-set.ts` Z. 38, identisch); `worldStand` (update Z. 274, `image-upload.ts` Z. 35, identisch); Quest-Status- und Vorlagentyp-Enums mehrfach neu definiert statt `questStatus`/`templateTypes` aus `shared.ts`; Vorschau-Kopf „Änderung noch nicht ausgeführt …“ viermal; außerdem ungenutztes `materializeStubs` in `write-rich.ts` Z. 128
- **Kategorie:** Duplizierung & Modularisierung / Toter Code
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-005, T-006, T-007, T-008
- **Beschreibung:** Dieselbe Logik liegt an zwei bis drei Stellen, teils mit kleinen Abweichungen (`resolveHabitat` behandelt `null` unterschiedlich). Korrekturen wie CR-001, CR-008 oder CR-010 müssen mehrfach nachgezogen werden. `materializeStubs` in `write-rich.ts` wird nirgends verwendet, weil beide Werkzeuge eigene Kopien haben.
- **Empfehlung:** Ein Modul `src/lib/mcp/write-shared.ts` (oder Erweiterung von `write-rich.ts`) mit `prepareTemplateFields`, `resolveHabitat(value, { allowClear })`, `findVisibleChapter`, `worldStand`, einer Stub-Materialisierung und `formatPreviewHeader/Footer`. Feld-Schemas einmal definieren: Update = `createSchema.partial()` ohne `quest_id`. Enums aus `shared.ts`/`enums.ts` verwenden. `materializeStubs` entfernen oder als einzige Implementierung nutzen.
- **Abnahmekriterium:** `grep -n "async function prepareTemplateFields\|async function findVisibleChapter\|async function worldStand\|async function resolveHabitat" src/lib/mcp` liefert je genau eine Definition. `z.enum(["offen", "aktiv", "abgeschlossen", "gescheitert"])` kommt unter `src/lib/mcp/tools` nur noch in `shared.ts` vor. `materializeStubs` ist entweder referenziert oder gelöscht. `npm run test:mcp` bleibt grün.

### CR-012 – `content-update.ts` zu groß und zu verzweigt
- **Fundstelle:** `src/lib/mcp/tools/content-update.ts` `prepareUpdate` (Z. 380–732, ~350 Zeilen) und `executeUpdate` (Z. 734–1064, ~330 Zeilen)
- **Kategorie:** Bad Practices / Lesbarkeit
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006
- **Beschreibung:** Beide Funktionen sind lange `if (art === …)`-Ketten mit je sieben Zweigen. Jeder Zweig lädt das Ziel, prüft den Stand und parst die Felder, und zwar in Vorschau und Ausführung doppelt. Die zyklomatische Komplexität ist hoch, neue Arten erweitern zwei weit entfernte Stellen, und die Datei ist schwer reviewbar. `content-create.ts` hat das gleiche Muster (`collectCreateStubs` + `executeCreate`).
- **Empfehlung:** Pro `art` einen Handler mit einheitlicher Schnittstelle `{ load(world,id), assertStand(row,stand), preview(row,felder,modus), execute(row,felder,modus,stubs) }` in eigenen Dateien (z. B. `tools/update/article.ts`). `prepareUpdate`/`executeUpdate` werden zu einem Dispatch über eine `Record<art, Handler>`.
- **Abnahmekriterium:** Keine Funktion unter `src/lib/mcp/tools/` ist länger als 80 Zeilen. `content-update.ts` enthält keine `if (input.art === …)`-Kette mehr, sondern einen Lookup in einer Handler-Tabelle. `npm run test:mcp` bleibt grün.

### CR-013 – Fehlende Tests für Ablauf und Rechteverlust bei Bestätigungen
- **Fundstelle:** `src/lib/mcp/confirmations.integration.test.ts`, `src/app/mcp/mcp.mcp.test.ts` (Blöcke T-004/T-006/T-010)
- **Kategorie:** Testabdeckung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-004 (Abnahme 2 und 5)
- **Beschreibung:** Belegt sind: einmalige Einlösung, fremder Benutzer/Client, kein Klartext, veralteter Stand. Es gibt **keinen** Test, der ein Bestätigungs-Token nach 10 Minuten ablehnt (für Upload-Tickets existiert ein solcher Test, Z. 1348). Ebenso fehlt ein Test, bei dem der Benutzer zwischen Vorschau und Bestätigung die Rolle verliert (Master → Player), die Welt-Freigabe abgeschaltet wird oder die Discord-ID von der Allowlist fällt.
- **Empfehlung:** Tests ergänzen: (1) **T-004(2):** `UPDATE mcp_change_confirmations SET expires_at = now() - interval '1 minute'`, danach schlägt die Einlösung fehl. (2) **T-004(5), Rolle:** Rolle des Benutzers per SQL von `master` auf `player` setzen, `aenderung_bestaetigen` ändert nichts, danach zurücksetzen. (3) **T-004(5), Welt-Freigabe:** `worlds.mcp_enabled = false`, gleiche Erwartung, danach zurücksetzen. (4) **T-004(5), Allowlist (Entscheidung Projektinhaber, Plan-Review 2026-09-29):** `users.discord_id` des Benutzers per SQL auf einen nicht freigegebenen Wert (z. B. `'000000000000000000'`) setzen, dann `aenderung_bestaetigen` aufrufen. Erwartet wird die Ablehnung am `/mcp`-Endpunkt (401/403) und keine Änderung am Ziel. Den Originalwert im `finally` wiederherstellen. Alle vier Fälle nutzen je ein frisches Token aus einer echten Vorschau.
- **Abnahmekriterium:** `npm run test:mcp` enthält benannte Tests „T-004(2)“ und „T-004(5)“ mit je mindestens einer Assertion, dass sich der Zielinhalt (Stand/Text) nach dem Einlöseversuch nicht geändert hat.

### CR-014 – Explizite Erwähnungs-IDs über Titelsuche aufgelöst
- **Fundstelle:** `src/lib/domain/mcp-mentions.ts` Z. 31–41
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-002
- **Beschreibung:** Für `@[Titel](art:id)` wird mit `query = Titel` gesucht und die ID im Ergebnis (limitiert auf `MENTION_RESULT_LIMIT`) gesucht. Weicht der angegebene Titel vom echten ab (Kurzname, Tippfehler, inzwischen umbenannt) oder gibt es mehr Treffer als das Limit, ist das Ziel „nicht gefunden“, obwohl ID und Sichtbarkeit stimmen.
- **Empfehlung:** Explizite Ziele direkt per ID und Sichtbarkeitsprüfung laden (vorhandene `get*`-Loader bzw. `visibleContentWhere` mit `id = $id`). Den Anzeigetitel aus der DB übernehmen.
- **Abnahmekriterium:** Unit-/MCP-Test: `@[Burg](artikel:<id von „Burg Rabenstein“>)` löst auf und rendert als „Burg Rabenstein“. Ein unsichtbares Ziel liefert weiterhin „Erwähntes Ziel nicht gefunden.“

### CR-015 – N+1-Abfragen bei Erwähnungen und Kapitelsuche
- **Fundstelle:** `src/lib/domain/mcp-mentions.ts` Schleife Z. 30 (sequenzielle `searchMentionTargets` je Erwähnung, jeweils 5 Tabellen); mehrfache Auflösung pro Aufruf in `content-create.ts` (`collectCreateStubs` + `executeCreate`) und `content-update.ts` (`prepareUpdate` + `executeUpdate`); `findVisibleChapter` (`content-update.ts` Z. 260, `visibility-set.ts` Z. 38) lädt alle Quests und für jede die Kapitel, bei Update/Sichtbarkeit bis zu dreimal pro Aufruf
- **Kategorie:** Performance
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005, T-006, T-007
- **Beschreibung:** Ein Sitzungsbericht mit 20 Erwähnungen erzeugt ≥ 100 Suchabfragen pro Phase, bei Stubs × 2–3. Die Kapitelsuche skaliert mit der Anzahl der Quests. Bei den aktuellen Datenmengen unkritisch, aber vermeidbar.
- **Empfehlung:** Erwähnungen mit expliziter ID gebündelt per `IN (…)` laden (siehe CR-014). Gleiche Titel deduplizieren. Kapitel per `quest_chapters.id` + Join auf die Quest direkt laden und die Sichtbarkeit von Quest und Kapitel in einer Abfrage prüfen (neue Domänenfunktion `getVisibleChapter`).
- **Abnahmekriterium:** `findVisibleChapter` ruft `listQuests` nicht mehr auf. Ein Unit-Test mit gemocktem `searchMentionTargets` zeigt für einen Text mit 3 gleichen `@[X]` genau einen Suchaufruf.

### CR-016 – ID per Regex aus dem Antworttext
- **Status:** behoben – `executeCreate` liefert die erzeugte ID strukturiert; das Audit verwendet sie direkt.
- **Fundstelle:** `src/lib/mcp/tools/content-create.ts` Z. 543
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005, T-009
- **Beschreibung:** Die Audit-Ziel-ID wird mit `/ID: ([0-9a-f-]{36})/` aus dem formatierten Text gelesen. Ändert sich der Text oder steht eine andere UUID früher (z. B. in einer Stub-Zeile), landet eine falsche ID im Audit.
- **Empfehlung:** `executeCreate` gibt `{ value, worldId, id }` strukturiert zurück, und der Formatter bleibt reine Darstellung.
- **Abnahmekriterium:** Keine Regex-Auswertung von Werkzeugantworttext mehr in `src/lib/mcp/tools/`. Der T-009-Test prüft `target_id` des Anlege-Audits gegen die tatsächlich angelegte ID.

### CR-017 – Unbekannte Felder werden stillschweigend akzeptiert
- **Status:** behoben – Feldschemas sind strikt; der MCP-Test prüft die Ablehnung ohne Bestätigungs-Token.
- **Fundstelle:** alle Feld-Schemas mit `.passthrough()` in `content-create.ts` Z. 37–79 und `content-update.ts` Z. 57–102; `requireFields` (`content-update.ts` Z. 126)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005, T-006
- **Beschreibung:** Tippfehler wie `felder: { Text: "…" }` oder `beschreibung` bei einem Artikel werden ignoriert, landen aber im Bestätigungs-Payload. Bei `inhalt_aendern` zählt `requireFields` das unbekannte Feld als Änderung. Der Client bekommt dann eine Vorschau ohne geänderte Felder und ein Token, dessen Bestätigung nur `updated_at` hochsetzt.
- **Empfehlung:** Schemas `.strict()`. `sichtbarkeit` bleibt beim Anlegen als explizit erlaubtes, ignoriertes Feld. `requireFields` prüft gegen die bekannten Schema-Schlüssel.
- **Abnahmekriterium:** MCP-Test: `inhalt_aendern` mit `felder: { unbekannt: "x" }` liefert einen Validierungsfehler, der das Feld nennt, und kein Bestätigungs-Token.

### CR-018 – Upload-Tickets ohne Client-Bindung
- **Fundstelle:** `src/db/migrations/0029_mcp_upload_tickets.sql`, `src/lib/mcp/upload-tickets.ts`, `src/app/upload/[ticket]/route.ts` Z. 251 (`clientId: "upload-ticket"`)
- **Kategorie:** Sicherheit / Fehlerbehandlung (Audit)
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-008, T-009 („Herkunft MCP … mit Client-ID“)
- **Beschreibung:** Das Ticket speichert keinen OAuth-Client. Das Audit der Einlösung trägt daher den Platzhalter `upload-ticket` statt der echten Client-ID. Widerruft der Benutzer die Anwendung, bleiben bereits ausgegebene Upload-Links bis zum Ablauf gültig.
- **Empfehlung:** Spalte `client_id` in `mcp_upload_tickets` (neue Migration). Beim Einlösen prüfen, dass für `(user_id, client_id)` noch eine Zustimmung existiert. Die echte Client-ID ins Audit schreiben.
- **Abnahmekriterium:** MCP-Test: Nach Widerruf der Anwendung liefert ein zuvor erzeugter Upload-Link 404. Der Audit-Eintrag `upload_einloesen` hat die `client_id` des erzeugenden Clients.

### CR-019 – `change_hash` ungenutzt
- **Status:** behoben – Der normalisierte Payload wird vor dem Handler gegen `change_hash` geprüft; Manipulation wird abgelehnt.
- **Fundstelle:** `src/lib/mcp/confirmations.ts` Z. 40/43; Migration `0028`
- **Kategorie:** Toter Code
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004
- **Beschreibung:** Der Hash der Änderung wird gespeichert, aber weder beim Einlösen noch anderswo geprüft. Da der Payload serverseitig liegt, ist die Bindung ohnehin gegeben. Die Spalte suggeriert eine Prüfung, die nicht stattfindet.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-29):** `change_hash` wird **beim Einlösen geprüft**.
- **Empfehlung:** In `executeMcpConfirmation` (`confirmations.ts`) vor dem Handler-Aufruf `hash(JSON.stringify(row.payload)) === row.changeHash` prüfen. Bei Abweichung `McpToolError("Die vorgemerkte Änderung ist ungültig. Bitte neu anfordern.")` werfen, ohne den Handler aufzurufen, und `mcp_confirmation_integrity_error` loggen (nur Token-Zeilen-ID, kein Inhalt). Hinweis: Weil PostgreSQL `jsonb` die Schlüsselreihenfolge normalisiert, muss der Hash beim Anlegen über dieselbe normalisierte Form berechnet werden wie beim Prüfen. Entweder die Einfügung per `returning` zurücklesen und darüber hashen, oder vor dem Hashen stabil serialisieren (Schlüssel sortiert).
- **Abnahmekriterium:** Test in der Bestätigungs-Testdatei (siehe CR-022): Ein angelegtes Token mit unverändertem Payload wird ausgeführt. Nach `UPDATE mcp_change_confirmations SET payload = jsonb_set(payload, '{art}', '"quest"')` schlägt die Einlösung mit der Integritätsmeldung fehl, und der registrierte Handler wird nicht aufgerufen.

### CR-020 – Irreführende Namen und Log-Events
- **Status:** behoben – `registerMcpTools` ersetzt den alten Namen, und jede Purge-Art erhält eine eigene Operation im Log.
- **Fundstelle:** `src/lib/mcp/tools.ts` `registerMcpReadTools` (Z. 19); `src/instrumentation.ts` `reportPurgeError` (`event: "mcp_audit_error"` auch für Bestätigungen/Tickets)
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004, T-008
- **Beschreibung:** Die Funktion registriert inzwischen auch alle Schreibwerkzeuge, der Name suggeriert „nur lesend“. Purge-Fehler von Bestätigungen und Tickets erscheinen als Audit-Fehler und lassen sich nicht unterscheiden.
- **Empfehlung:** In `registerMcpTools` umbenennen (inkl. `route.ts`, `route.test.ts`). `reportPurgeError(operation)` mit `operation: "purge_audit" | "purge_confirmations" | "purge_upload_tickets"`.
- **Abnahmekriterium:** `grep -rn registerMcpReadTools src` ist leer. Jeder der drei Purge-Aufrufe loggt eine eigene `operation`.

### CR-021 – Upload-Route: Body ohne Obergrenze gelesen, GET inkonsistent
- **Fundstelle:** `src/app/upload/[ticket]/route.ts` Z. 208 (`request.formData()`) vor der Größenprüfung Z. 224; GET Z. 173
- **Kategorie:** Sicherheit / Fehlerbehandlung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-008
- **Beschreibung:** Die gesamte Multipart-Anfrage wird in den Speicher gelesen, bevor die Dateigröße geprüft wird. Wer den Link kennt, kann beliebig große Bodies schicken. Der Link ist ein Geheimnis, daher ist das Risiko gering. Außerdem antwortet GET bei Stand-Drift mit 404, POST dagegen mit 409 und Erklärung, und für den Browser-Benutzer ist nicht erkennbar, warum der Link „nicht existiert“.
- **Empfehlung:** Vor `formData()` `Content-Length` gegen `maxBytes` + Puffer prüfen (413), bei fehlendem Header ablehnen. GET bei Stand-Drift mit der Upload-Seite und einem Hinweis „Inhalt wurde inzwischen geändert“ beantworten (Status 409).
- **Abnahmekriterium:** Test: POST mit `Content-Length` über dem Limit liefert 413, ohne dass `formData` gelesen wird. GET auf ein Ticket mit abweichendem Stand liefert 409 mit dem Hinweistext.

### CR-022 – Integrationstest läuft in zwei Suites
- **Status:** behoben – Die Datei heißt `confirmations.mcp.test.ts`; die MCP-Konfiguration nutzt ausschließlich ihren Glob.
- **Fundstelle:** `src/lib/mcp/confirmations.integration.test.ts`; `vitest.mcp.config.ts` Z. 6; `vitest.triggers.config.ts` (Glob `src/**/*.integration.test.ts`)
- **Kategorie:** Testabdeckung / Konventionen
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004
- **Beschreibung:** Die Datei passt auf den Glob von `npm run test:triggers` und steht zusätzlich explizit in der MCP-Config. Sie läuft also doppelt, und `test:triggers` setzt die MCP-Testwelt voraus, die dort nicht garantiert ist.
- **Empfehlung:** Umbenennen in `confirmations.mcp.test.ts` und den Sondereintrag aus `vitest.mcp.config.ts` entfernen (oder umgekehrt nur in `test:triggers` führen und die Fixture selbst anlegen).
- **Abnahmekriterium:** Die Datei wird von genau einer Vitest-Config erfasst (`vitest list` bzw. Glob-Abgleich). `vitest.mcp.config.ts` enthält keinen Einzeldatei-Sondereintrag mehr.

### CR-023 – Doppelte Stubs bei unterschiedlicher Groß-/Kleinschreibung
- **Fundstelle:** `content-create.ts` `collectCreateStubs` (`Set<string>` Z. 392), `content-update.ts` `prepareUpdate` (`Set`, Z. 388); Zuordnung per `toLocaleLowerCase` in `stubIdByTitle`
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005, T-006, S7
- **Beschreibung:** `@[Gräfin Mirelda]` und `@[gräfin mirelda]` im selben Text ergeben zwei Stubs, weil die Deduplizierung case-sensitiv ist. Die Zuordnung ist dagegen case-insensitiv, sodass der zweite Stub die Map überschreibt und verwaist.
- **Empfehlung:** Stub-Titel mit `toLocaleLowerCase("de")` als Schlüssel deduplizieren und den ersten Schreibweg als Titel behalten.
- **Abnahmekriterium:** Unit-/MCP-Test: Ein Text mit beiden Schreibweisen liefert in der Vorschau genau einen geplanten Stub, und nach der Bestätigung existiert genau ein Stub-Artikel.

### CR-024 – Mehrere Tasks in einem Release-Commit
- **Fundstelle:** Commit `f06ec37` („release: MCP write tools 0.1.10“)
- **Kategorie:** Bad Practices (Projekt-Konvention)
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005 bis T-010, T-012
- **Beschreibung:** `.ai/roadmap.md` (Arbeitsweise) verlangt einen Commit pro Task. T-005 bis T-010 und T-012 (≈ 3 000 Zeilen Produktcode plus Tests und Doku) sind in einem Commit gebündelt. Nachvollziehbarkeit, `git bisect` und künftige `/review-check`-Läufe pro Task werden dadurch schwieriger.
- **Empfehlung:** Kein Umschreiben der Historie auf `main`. Für künftige Pläne die Commit-pro-Task-Regel einhalten. Die Behebung dieser Findings erfolgt in einzelnen Commits je CR-ID.
- **Abnahmekriterium:** Die Commits zur Behebung dieses Reviews nennen jeweils die CR-ID(s) im Commit-Text, und kein Commit bündelt mehr als drei CR-IDs.

---

## Prioritätenliste

1. **CR-001** – Stubs vor Prüfungen und ohne Transaktion (verletzt die Kernzusage „ohne gültige Bestätigung ändert sich nichts“).
2. **CR-003** – Atomare Stand-Prüfung (ADR-005), verhindert Lost Updates bei gleichzeitiger App-Nutzung.
3. **CR-005** – Sichtbarkeitsumgehung bei Vorlagenverweisen.
4. **CR-004**, **CR-006**, **CR-007** – Abnahmekriterien, die real nicht erfüllt sind (Plausibilitätsprüfung, JSON-Upload, Kapitel-Stand).
5. **CR-008**, **CR-009**, **CR-010** – Fehlermeldungen, Markdown-Treue und lesbare Vorschau (Benutzer bestätigt, was er sieht).
6. **CR-013** – Fehlende Tests für T-004 (2)/(5) nachziehen, am besten vor dem Refactoring.
7. **CR-011**, **CR-012** – Duplizierung und Handler-Struktur. Am besten zusammen umsetzen, nachdem 1.–6. mit Tests abgesichert sind.
8. **CR-002** (nur Doku) sowie **CR-014** bis **CR-023** – Aufräumarbeiten mit geringem Risiko.
9. **CR-024** – Prozesshinweis für künftige Pläne.
