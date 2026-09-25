# 002 – MCP-Server für Claude

## Kontext & Ziel

WorldCraft-Benutzer sollen Claude mit ihrem **eigenen Claude-Abo** Fragen zu ihrer Welt stellen können, etwa: „Welche Personen und Quests hängen mit Burg Rabenstein zusammen?“ oder „Welche offenen Quests gibt es gerade?“. Dafür stellt WorldCraft einen **Remote-MCP-Server** bereit. Jeder Benutzer bindet ihn in claude.ai, in der Claude-Desktop-App oder in Claude Code als **Custom Connector** ein und meldet sich dabei mit seinem WorldCraft-Konto (Discord-Login) an.

**Ziel dieses Plans:** ein produktiv nutzbarer, **nur lesender** MCP-Server mit sechs Werkzeugen, sicherer Anmeldung per OAuth und strikter Anwendung der Rechtematrix. Claude darf nie mehr sehen als der angemeldete Benutzer in der App.

**Umsetzungszeitpunkt:** Dieser Plan wird **nach** dem MVP-Funktionsplan umgesetzt (siehe Globale Abhängigkeiten). Die MCP-Werkzeuge nutzen die dort gebaute Daten- und Rechteschicht und bauen keine eigene.

### Abgrenzung

- **Nur lesend.** Schreibende Werkzeuge (z. B. „lege aus diesem Gespräch einen Artikel an“) sind nicht Teil dieses Plans. Architektur und Scope-Modell (T-001) müssen sie aber später ohne Umbau ermöglichen.
- **Tagebucheinträge und Geheimnisse sind über MCP vollständig ausgeschlossen**, unabhängig von Rolle, Besitz und Sichtbarkeit des Eintrags, also auch die eigenen. Hintergrund: Alles, was Claude liest, wird an Anthropic übertragen.
- **Chat-Nachrichten** sind über MCP nicht abrufbar.
- **Kein KI-Chat innerhalb der App** (bleibt im Backlog, siehe Plan `001`).
- **Freischaltung in zwei Stufen** (D2, D3): Der MCP-Server ist nur erreichbar, wenn der Hauptschalter an ist, und liefert Inhalte einer Welt nur, wenn deren Game Master MCP für diese Welt freigegeben hat.

## Entscheidungen (Projektinhaber, 2026-09-25)

| # | Frage | Entscheidung |
|---|---|---|
| D1 | Lesen, Schreiben, Löschen | **Plan `002` bleibt nur lesend.** Schreiben folgt als eigener Plan, sobald Lesen auf Produktion wie erwartet funktioniert; ADR-005 legt die Grundlagen dafür schon fest (T-001 Punkt 7), damit kein Umbau nötig wird. **Löschen über MCP gibt es nie.** Schreibrechte über MCP entsprechen später genau denen in der App (Players etwa nur Notizblock und eigener Charakter); die Lesefunktionen bleiben für alle Rollen unverändert. |
| D2 | Hauptschalter | Umgebungsvariable `MCP_ENABLED` (Standard: aus). Ist sie nicht `true`, antworten `/mcp`, alle OAuth-Endpunkte aus T-003 und beide `/.well-known/…`-Metadaten mit HTTP 404. Abschalten ohne neuen Code-Stand, nur per Umgebungsvariable und Neustart in Coolify. |
| D3 | Freigabe pro Welt | Schalter **an/aus** pro Welt, setzbar nur vom Game Master. **Standard aus**, für neue und bestehende Welten. Keine Abstufung nach Rolle oder Bereich. |
| D4 | Ausschlüsse | **Feste Ausschlussliste im Code**, nicht pro Welt konfigurierbar. Fest ausgeschlossen: Tagebuch und Chat (siehe oben). Weitere Einträge werden zusammen mit dem Umfang der Werkzeuge im Plan-Review festgelegt. |
| D5 | `nur ich`-Inhalte (`owner_only`) | **Keine Zusatzsperre.** MCP liefert, was die Rechteschicht dem angemeldeten Benutzer auch in der App zeigt, also die eigenen `nur ich`-Inhalte, solange er Spielleitung ist. Pflicht: Benutzer A sieht die `nur ich`-Inhalte von Benutzer B über kein Werkzeug, auch nicht als Game Master (Nachweis in T-008). |
| D6 | Per MCP angelegte Inhalte (für den späteren Schreib-Plan) | Durch D5 erledigt: Was Claude für den Benutzer anlegt, gehört ihm, startet mit `nur ich` und bleibt für ihn über MCP les- und bearbeitbar. Veröffentlichen bleibt eine bewusste Handlung des Benutzers. |
| D7 | Welt-Angabe bei mehreren Welten (2026-09-25) | (1) Der Welt-Parameter aller Werkzeuge nimmt eine **ID oder den Weltnamen** an (ohne Groß-/Kleinschreibung); bei mehrdeutigem oder unbekanntem Namen gibt es einen Werkzeugfehler mit der Liste der passenden freigegebenen Welten (Name, ID). (2) Hat der Benutzer genau **eine** freigegebene Welt, ist der Welt-Parameter optional und diese Welt gilt. (3) Die Werkzeugbeschreibungen bitten Claude, bei mehreren freigegebenen Welten ohne genannte Welt nachzufragen, statt in allen zu suchen. **Keine** weltübergreifende Suche. Name des Parameters (`welt` / `welt_id` / englisch) wird mit der offenen Namensfrage im Plan-Review festgelegt. |

## Begriffe & Systeme

- **MCP (Model Context Protocol)**: Offenes Protokoll, über das Claude Werkzeuge externer Anwendungen aufruft.
- **Remote-MCP-Server**: MCP-Server, der per HTTPS erreichbar ist. Transport: **Streamable HTTP** (ein HTTP-Endpunkt, der JSON-RPC-Nachrichten per POST annimmt). Hier unter dem Pfad `/mcp` der Produktiv- bzw. Staging-Domain.
- **Custom Connector**: Ein vom Benutzer selbst eingetragener Remote-MCP-Server in claude.ai (*Einstellungen → Connectors*). Er steht danach auch in der Claude-Desktop-App zur Verfügung. In Claude Code wird er per `claude mcp add --transport http <name> <url>` eingebunden.
- **MCP-Werkzeug (Tool)**: Eine Funktion, die der MCP-Server anbietet und die Claude mit Parametern aufrufen kann. Sie hat einen Namen, eine Beschreibung und ein Eingabeschema.
- **OAuth 2.1**: Standard für delegierte Autorisierung. Hier gibt es zwei Beziehungen, die nicht verwechselt werden dürfen:
  - **WorldCraft als OAuth-Client gegenüber Discord**: der bestehende Discord-Login aus Plan `001`.
  - **WorldCraft als OAuth-Autorisierungsserver gegenüber Claude**: neu in diesem Plan. Claude ist dabei der Client und erhält ein Zugriffstoken für einen WorldCraft-Benutzer.
- **PKCE (S256)**: Absicherung des OAuth-Autorisierungsablaufs gegen abgefangene Autorisierungscodes. Pflicht, nur die Methode `S256` ist zulässig.
- **Dynamic Client Registration (DCR, RFC 7591)**: Ein OAuth-Client (hier: Claude) registriert sich selbst beim Autorisierungsserver und erhält eine Client-ID, ohne dass jemand sie manuell anlegt.
- **Protected Resource Metadata (RFC 9728)**: Dokument unter `/.well-known/oauth-protected-resource`, das angibt, welcher Autorisierungsserver für den MCP-Endpunkt zuständig ist.
- **Authorization Server Metadata (RFC 8414)**: Dokument unter `/.well-known/oauth-authorization-server` mit den Endpunkten und Fähigkeiten des Autorisierungsservers.
- **Resource Indicator (RFC 8707)**: Parameter `resource`, mit dem der Client angibt, für welche Ressource (hier: die URL von `/mcp`) das Token gilt. Das ausgestellte Token ist an genau diese Ressource gebunden (Audience).
- **Scope `worlds:read`**: Die einzige Berechtigung in diesem Plan. Sie erlaubt das Lesen aller Inhalte, die der Benutzer laut Rechtematrix sehen darf, mit Ausnahme der in der Abgrenzung ausgeschlossenen Inhalte. Ein späterer Scope `worlds:write` ist vorgesehen, aber nicht Teil dieses Plans.
- **Zustimmungsseite (Consent)**: WorldCraft-Seite, auf der der angemeldete Benutzer bestätigt, dass ein Client (z. B. Claude) mit dem Scope `worlds:read` auf seine Welten zugreifen darf.
- **Verbundene Anwendung**: Eine erteilte Zustimmung samt der zugehörigen Tokens, die der Benutzer in WorldCraft einsehen und widerrufen kann.
- **Rechteschicht**: Die im MVP-Funktionsplan gebaute serverseitige Schicht, die für einen Benutzer entscheidet, welche Datensätze er lesen darf. Sie setzt die Rechtematrix aus Plan `001` um.
- **Testwelt**: Reproduzierbar per Skript angelegte Welt mit festen Testdaten und Testbenutzern (siehe T-002).
- **MCP Inspector**: Offizielles Entwicklerwerkzeug zum manuellen Testen von MCP-Servern inkl. OAuth-Ablauf.
- **Audit-Log**: Protokoll der Werkzeugaufrufe mit Metadaten, ohne Inhalte (siehe T-009).

### MCP-Werkzeuge (Umfang dieses Plans)

Alle Werkzeuge sind nur lesend, erfordern den Scope `worlds:read` und liefern ausschließlich Daten, die die Rechteschicht für den angemeldeten Benutzer freigibt. Tagebucheinträge und Chat-Nachrichten liefert keines von ihnen.

| Werkzeug | Eingabe | Ausgabe |
|---|---|---|
| `welten_auflisten` | – | Alle Welten, in denen der Benutzer Mitglied ist: ID, Name, eigene Rolle, Name und ID aller eigenen in diese Welt mitgebrachten Charaktere (nicht archivierte Teilnahmen). |
| `suchen` | `welt_id`, `suchbegriff`, optional `art` (artikel / quest / charakter / pin / universum), optional `limit` (Standard 20, maximal 50) | Treffer mit Art, ID, Titel, Vorlagentyp und einem Textauszug von maximal 300 Zeichen. |
| `inhalt_lesen` | `welt_id`, `art` (artikel / quest / charakter / pin / universum), `id` | Vollständiger Inhalt als Markdown (Rich-Text aus TipTap-JSON umgewandelt, Erwähnungen als `@Titel`). Artikel: Titel, Vorlagentyp, Vorlagenfelder, Text. Quest: Titel, Status, beteiligte Charaktere, Beschreibung. Charakter: Charakterbogen (Klasse, Attribute, Übungsbonus, Fertigkeiten mit Übungsgrad, Attribut und berechnetem Gesamtbonus, Fähigkeiten mit Attribut und Modifikator, Persönlichkeitsmerkmale, Ideale, Bindungen, Makel, Bio), ohne Bildanhänge und ohne Tagebuch. Pin: Titel, Pin-Typ, Karte, Beschreibung. Universum: Name, Beschreibung, Karten (ID und Name). Jeweils mit Kennzeichnung, ob der Inhalt `nur Spielleitung` ist. |
| `relationen_abrufen` | `welt_id`, `art`, `id`, optional `tiefe` (1 oder 2, Standard 1) | Ein- und ausgehende Relationen mit Herkunft (Erwähnung, Vorlagenfeld inkl. Feldname, Beteiligung, manuell inkl. Bezeichnung bzw. Gegenbezeichnung) sowie Art, ID und Titel des jeweils anderen Inhalts. |
| `quests_auflisten` | `welt_id`, optional `status` | Quests mit ID, Titel, Status und beteiligten Charakteren. |
| `karte_lesen` | `welt_id`, optional `karte_id` | Ohne `karte_id`: alle Universen der Welt mit ihren Karten (Universum-ID und -Name, Karten-ID und -Name). Mit `karte_id`: alle Pins mit Pin-Typ, Titel, verknüpften Inhalten (aus Erwähnungen und manuellen Relationen: Art, ID, Titel) und relativer Position sowie alle Charakter-Marker mit Charaktername, Besitzer und relativer Position. |

## Relevante Normen

Zum Zeitpunkt der Planerstellung existieren sie noch nicht. Sie werden durch Plan `001` (T-013) und den MVP-Funktionsplan angelegt und sind vor Beginn zu lesen:
- `.ai/architecture.md`
- `.ai/conventions.md`
- `.ai/architecture/README.md`
- `.ai/architecture/datenmodell-fachlich.md` (fachliches Datenmodell, liegt bereits vor)
- `.ai/architecture/datenmodell.md`
- `.ai/decisions/001-backend.md` (enthält die Bewertung der MCP-Tauglichkeit des gewählten Backends)

## Globale Abhängigkeiten

- **Plan `001` abgeschlossen** mit Ergebnis „Go“ (`.ai/architecture.md`).
- **MVP-Funktionsplan abgeschlossen**: Welten, Artikel mit Vorlagen und Relationen, Karten mit Pins, Quests, Charaktere und die Rechteschicht sind produktiv vorhanden. Falls sich die Planreihenfolge ändert, muss dieser Plan überarbeitet werden, bevor er umgesetzt wird.
- Produktiv- und Staging-Umgebung auf Coolify mit HTTPS (aus Plan `001`, T-007).
- Discord-Login (aus Plan `001`, T-008).
- Ein Claude-Konto mit Custom-Connector-Unterstützung für die Tests in T-010.

## Aufgaben

### T-001: MCP-Architektur entscheiden (ADR-005)
- [ ] Beschreibung: Die Architektur des MCP-Servers als `.ai/decisions/005-mcp-server.md` festhalten. Zu entscheiden und zu begründen sind:
  1. **MCP-SDK**: offizielles MCP-SDK für die Backend-Sprache aus ADR-001, mit Version.
  2. **Betriebsart**: zustandsloser Streamable-HTTP-Endpunkt `/mcp` im bestehenden Backend oder eigener Container. Standard ist „im bestehenden Backend“; eine Abweichung ist zu begründen.
  3. **OAuth-Umsetzung**: fertige Bibliothek bzw. Plugin des Auth-Systems aus ADR-001 oder Eigenbau. Aufgelistet wird, welche der Anforderungen aus T-003 die gewählte Lösung abdeckt und welche selbst gebaut werden müssen.
  4. **Scope-Modell**: `worlds:read` jetzt, `worlds:write` später. Beschrieben wird, wie Werkzeuge ihren benötigten Scope deklarieren.
  5. **Anbindung an die Rechteschicht**: Wie erhält ein Werkzeug den Benutzerkontext aus dem Token, und wie wird sichergestellt, dass es ausschließlich über die Rechteschicht auf Daten zugreift?
  6. **Umwandlung TipTap-JSON → Markdown** für `inhalt_lesen`.
  7. **Grundlagen für den späteren Schreib-Plan** (D1, D6): Scope `worlds:write`, neue Inhalte starten immer mit `nur ich`, kein Löschwerkzeug, Audit-Log vermerkt die Herkunft „MCP“, Umwandlung Markdown → TipTap-JSON inkl. Erwähnungen als Anforderung benannt. Nur festhalten, nicht bauen.
  8. **Schalter** (D2, D3): wo `MCP_ENABLED` und die Welt-Freigabe geprüft werden, sodass kein Werkzeug die Prüfung umgehen kann.

  Zusätzlich die **aktuellen Anforderungen der Claude-Clients** an Remote-Connectors anhand der offiziellen Dokumentation von Anthropic und der MCP-Spezifikation prüfen und mit Quellenlink und Abrufdatum dokumentieren: unterstützte Spezifikationsversion, DCR oder manuell eingetragene Client-ID, Callback-URL(s) von claude.ai und Claude Code, Anforderungen an die Metadaten-Endpunkte.
- Abhängigkeiten: keine innerhalb dieses Plans (siehe Globale Abhängigkeiten)
- Abnahmekriterium: ADR-005 existiert, beantwortet die Punkte 1–8 jeweils mit genau einer Entscheidung und Begründung und enthält den Abschnitt „Anforderungen der Claude-Clients“ mit mindestens einem Quellenlink samt Abrufdatum. Punkt 3 enthält eine Tabelle „Anforderung aus T-003 → abgedeckt durch Bibliothek / Eigenbau“.

### T-002: Testwelt-Skript
- [ ] Beschreibung: Ein Skript (Pfad gemäß `.ai/conventions.md`) erstellen, das auf einer leeren Staging- oder lokalen Datenbank reproduzierbar eine Testwelt anlegt:
  - 4 Testbenutzer: 1 Game Master (Ersteller der Testwelt), 1 Master, Player A, Player B
  - 1 zweite Welt, in der nur Player B Mitglied ist
  - 5 Artikel mit verschiedenen Vorlagentypen, davon 1 mit Status `nur Spielleitung`. Darunter ein Artikel „Burg Rabenstein“ mit mindestens 3 Relationen (mindestens eine per Erwähnung, eine per Vorlagenfeld und eine manuelle mit Bezeichnung und Gegenbezeichnung) und einer Relation über 2 Stufen.
  - 2 veröffentlichte Quests mit unterschiedlichem Status, davon eine mit einem beteiligten Charakter
  - 2 Universen mit je 1 Karte; das zweite Universum hat den Status `nur Spielleitung`. Die Karte des ersten Universums hat 4 veröffentlichte Pins, davon 2 mit Erwähnungen in der Beschreibung, und einen Charakter-Marker für den Charakter von Player A.
  - 1 Charakter von Player A, in die Testwelt mitgebracht, mit je einem Tagebucheintrag `privat` und `mit Spielleitung geteilt`, die jeweils das eindeutige Wort `GEHEIMTEST` enthalten
  - 1 Chat-Nachricht mit dem eindeutigen Wort `CHATTEST`
  - 1 zusätzlicher Artikel des Masters mit Status `nur ich` (D5)
  - MCP-Freigabe (T-012): Testwelt an, zweite Welt aus; sobald T-012 umgesetzt ist

  Für jeden Testbenutzer lässt sich eine Sitzung erzeugen, ohne dass ein echter Discord-Login nötig ist. Das ist nur in Staging und lokal möglich, niemals in Produktion.
- Abhängigkeiten: keine
- Abnahmekriterium: Zweimaliges Ausführen auf einer leeren Datenbank erzeugt jeweils denselben Datenbestand (gleiche Anzahl Datensätze je Entität). Das Skript bricht mit einer Fehlermeldung ab, wenn es gegen die Produktivumgebung ausgeführt wird (erkennbar an einer Umgebungsvariable). Die Anmeldung als Testbenutzer ohne Discord ist in Produktion nachweislich nicht möglich.

### T-003: OAuth-Autorisierungsserver
- [ ] Beschreibung: WorldCraft als OAuth-2.1-Autorisierungsserver für den MCP-Endpunkt einrichten, umgesetzt gemäß ADR-005. Anforderungen:
  1. `/.well-known/oauth-protected-resource` (RFC 9728) verweist auf den Autorisierungsserver.
  2. `/.well-known/oauth-authorization-server` (RFC 8414) listet alle Endpunkte, den Scope `worlds:read`, `S256` als einzige PKCE-Methode und die unterstützten Grant-Types `authorization_code` und `refresh_token`.
  3. **DCR** (RFC 7591): Es werden nur Redirect-URIs mit `https://` oder `http://localhost` bzw. `http://127.0.0.1` akzeptiert.
  4. **Autorisierungsendpunkt**: Ist der Benutzer nicht angemeldet, wird er zum bestehenden Discord-Login und danach zurück in den OAuth-Ablauf geleitet. PKCE ist Pflicht. Der Parameter `resource` wird ausgewertet.
  5. **Zustimmungsseite**: zeigt den vom Client angegebenen Namen mit dem Hinweis, dass dieser Name vom Client selbst stammt, sowie die Redirect-Domain, den Umfang in Klartext („Lesezugriff auf deine Welten; Tagebücher und Chat sind ausgeschlossen“) und die Schaltflächen „Erlauben“ und „Ablehnen“.
  6. **Token-Endpunkt**: Zugriffstoken mit 1 Stunde Laufzeit, an die Ressource `/mcp` gebunden (Audience). Refresh-Token mit 30 Tagen Laufzeit, das bei jeder Nutzung durch ein neues ersetzt wird (Rotation). Tokens werden nur als Hash gespeichert.
  7. Ist der Benutzer aus allen Welten ausgetreten bzw. entfernt worden (alle Mitgliedschaften archiviert) oder sein Konto gelöscht, schlagen Token-Erneuerungen fehl.
- Abhängigkeiten: T-001
- Abnahmekriterium: (1) Beide Metadaten-Endpunkte liefern gültiges JSON mit den geforderten Feldern. (2) Mit dem MCP Inspector lässt sich der komplette Ablauf DCR → Discord-Login → Zustimmung → Token → Refresh auf Staging durchspielen. (3) Automatisierte Tests belegen: Eine Anfrage ohne PKCE oder mit der Methode `plain` wird abgelehnt. Eine DCR mit der Redirect-URI `http://evil.example` wird abgelehnt. Ein bereits benutztes Refresh-Token wird abgelehnt. Ein Autorisierungscode ist nur einmal einlösbar. „Ablehnen“ auf der Zustimmungsseite liefert dem Client den Fehler `access_denied`. (4) In der Datenbank liegt kein Token im Klartext.

### T-004: Verbundene Anwendungen verwalten
- [ ] Beschreibung: In den Kontoeinstellungen der App eine Seite „Verbundene Anwendungen“ bauen. Sie listet jede erteilte Zustimmung mit Client-Name, Redirect-Domain, Datum der Zustimmung und Zeitpunkt der letzten Nutzung. „Zugriff widerrufen“ macht alle Tokens dieser Zustimmung sofort ungültig.
- Abhängigkeiten: T-003
- Abnahmekriterium: Nach der Verbindung über den MCP Inspector erscheint der Eintrag auf der Seite. Nach „Zugriff widerrufen“ wird der nächste Aufruf von `/mcp` mit dem bisherigen Zugriffstoken mit HTTP 401 abgelehnt, und auch das Refresh-Token ist ungültig. Ein Benutzer sieht nur seine eigenen Zustimmungen.

### T-005: MCP-Endpunkt mit Token-Prüfung
- [ ] Beschreibung: Den Endpunkt `/mcp` mit dem SDK aus ADR-005 bereitstellen. Jede Anfrage durchläuft eine Token-Prüfung: Signatur bzw. Gültigkeit, Ablaufzeit, Audience = `/mcp`, Scope, nicht widerrufen. Daraus wird der Benutzerkontext für die Werkzeuge erzeugt. Ohne gültiges Token wird HTTP 401 mit `WWW-Authenticate`-Header zurückgegeben, der auf die Protected Resource Metadata verweist. Der Server meldet sich mit dem Namen `WorldCraft` und der App-Version. Noch ohne fachliche Werkzeuge; zum Test dient ein Werkzeug `whoami`, das nur in Staging registriert ist und den Anzeigenamen des Benutzers liefert.
- Abhängigkeiten: T-001, T-003
- Abnahmekriterium: (1) `curl` ohne Token auf `/mcp` liefert 401 mit korrektem `WWW-Authenticate`-Header. (2) Ein abgelaufenes Token, ein Token mit fremder Audience und ein widerrufenes Token liefern jeweils 401. (3) Im MCP Inspector liefert `whoami` nach der Anmeldung als Player A den Namen von Player A. (4) In Produktion ist `whoami` nicht in der Werkzeugliste enthalten.

### T-012: Hauptschalter und Welt-Freigabe
- [ ] Beschreibung: D2 und D3 umsetzen.
  1. **Hauptschalter:** `MCP_ENABLED` in der Env-Validierung aufnehmen (Standard aus) und in `.ai/infrastructure/deployment.md` dokumentieren. Ist er aus, liefern `/mcp`, die OAuth-Endpunkte aus T-003 und beide Metadaten-Dokumente HTTP 404.
  2. **Welt-Freigabe:** Neues Feld an der Welt (z. B. `worlds.mcp_enabled boolean not null default false`, Migration setzt bestehende Welten auf `false`). Schalter „Claude-Zugriff (MCP)“ in der Weltverwaltung (`/w/[worldId]/menu`), nur für den Game Master, mit Hinweis, dass freigegebene Inhalte an Anthropic übertragen werden. Änderung nur über die Rechteschicht (Game Master, sonst 403).
  3. **Verhalten bei gesperrter Welt:** `welten_auflisten` führt die Welt weiter auf (ID, Name, eigene Rolle) mit der Kennzeichnung „MCP für diese Welt nicht freigegeben“, ohne Charaktere. Alle anderen Werkzeuge liefern für diese Welt den Werkzeugfehler „MCP ist für diese Welt nicht freigegeben“ und keine Inhalte.
  4. Normen: `datenmodell-fachlich.md` (Welt-Eigenschaft und Rechte), `datenmodell.md` (Spalte), `features.md`.
- Abhängigkeiten: T-001, T-005
- Abnahmekriterium: (1) Mit `MCP_ENABLED` aus liefern `/mcp`, `/.well-known/oauth-protected-resource` und `/.well-known/oauth-authorization-server` jeweils 404 (automatisierter Test). (2) Eine neu angelegte Welt und jede Bestandswelt nach der Migration haben die Freigabe aus. (3) Master und Player sehen den Schalter nicht; ein `PATCH` durch sie liefert 403. (4) Bei gesperrter Welt liefert jedes Werkzeug außer `welten_auflisten` den Fehler aus Punkt 3; nach dem Freigeben liefern sie Inhalte ohne neue Anmeldung. (5) Die Testwelt aus T-002 ist freigegeben, die zweite Welt nicht, und T-008 prüft beide Fälle.

### T-006: Werkzeuge `welten_auflisten`, `suchen`, `inhalt_lesen`
- [ ] Beschreibung: Die drei Werkzeuge gemäß der Tabelle *MCP-Werkzeuge* umsetzen. Eingaben werden per Schema validiert; bei ungültiger Eingabe gibt es einen verständlichen Werkzeugfehler statt eines Serverfehlers. Alle Datenzugriffe laufen über die Rechteschicht. Die Beschreibungen der Werkzeuge erklären Claude auf Deutsch, wann das Werkzeug zu nutzen ist und dass zuerst `welten_auflisten` aufgerufen werden sollte, wenn keine `welt_id` bekannt ist. Antworten über 20.000 Zeichen werden gekürzt und enthalten dann den Hinweis „gekürzt“.
- Abhängigkeiten: T-002, T-005, T-012
- Abnahmekriterium: Automatisierte Tests gegen die Testwelt: (1) `welten_auflisten` liefert für Player B zwei Welten, für Player A eine. (2) `suchen` mit „Rabenstein“ findet den Artikel „Burg Rabenstein“. (3) `inhalt_lesen` für „Burg Rabenstein“ liefert Markdown mit Titel, Vorlagenfeldern und Text, ohne JSON-Reste. (4) Eine ungültige `welt_id` oder eine Welt ohne Mitgliedschaft liefert einen Werkzeugfehler „Welt nicht gefunden“, ohne zu verraten, ob die Welt existiert. (5) `limit: 500` wird abgelehnt oder auf 50 begrenzt. (6) D7: Weltname statt ID funktioniert (auch in anderer Groß-/Kleinschreibung); bei genau einer freigegebenen Welt funktioniert `suchen` ohne Welt-Parameter; bei zwei freigegebenen Welten ohne Welt-Parameter kommt ein Werkzeugfehler mit beiden Welten.

### T-007: Werkzeuge `relationen_abrufen`, `quests_auflisten`, `karte_lesen`
- [ ] Beschreibung: Die drei Werkzeuge gemäß der Tabelle *MCP-Werkzeuge* umsetzen, mit denselben Regeln wie in T-006 (Schema-Validierung, Rechteschicht, Beschreibungen, Kürzung). Bei `relationen_abrufen` mit `tiefe: 2` werden Relationen zu Inhalten, die der Benutzer nicht sehen darf, vollständig weggelassen, einschließlich der Relationen, die nur über einen solchen Inhalt erreichbar sind.
- Abhängigkeiten: T-002, T-005, T-012
- Abnahmekriterium: Automatisierte Tests gegen die Testwelt: (1) `relationen_abrufen` für „Burg Rabenstein“ liefert genau die im Testwelt-Skript angelegten Relationen mit korrekter Herkunft, korrektem Feldnamen und bei der manuellen Relation der korrekten Bezeichnung (aus Sicht des Ziels die Gegenbezeichnung). (2) Mit `tiefe: 2` erscheint die Relation über 2 Stufen. (3) `quests_auflisten` mit Statusfilter liefert nur Quests dieses Status. (4) `karte_lesen` ohne `karte_id` liefert für den Game Master beide Universen mit je einer Karte, für Player A nur das erste. Mit der `karte_id` des ersten Universums liefert es die 4 Pins mit korrekten Pin-Typen und verknüpften Inhalten sowie den Charakter-Marker von Player A.

### T-008: Rechte- und Ausschlusstests
- [ ] Beschreibung: Eine automatisierte Testsuite schreiben, die jedes der sechs Werkzeuge mit jedem der vier Testbenutzer aufruft und gegen die Rechtematrix aus Plan `001` sowie die Abgrenzung dieses Plans prüft.
- Abhängigkeiten: T-006, T-007
- Abnahmekriterium: Die Suite läuft in der CI bzw. lokal per einem Befehl und ist grün. Sie belegt mindestens:
  - Die Wörter `GEHEIMTEST` und `CHATTEST` tauchen in **keiner** Antwort eines Werkzeugs auf, für keinen Benutzer, auch nicht für Player A.
  - Der Artikel mit Status `nur Spielleitung` erscheint für Game Master und Master in `suchen`, `inhalt_lesen` und `relationen_abrufen`, für beide Player in keinem Werkzeug, auch nicht als Relation.
  - Player A erhält keine Inhalte der zweiten Welt.
  - Ein `nur ich`-Inhalt des Masters erscheint für den Master, aber in keinem Werkzeug für den Game Master oder die Player, auch nicht als Relation (D5).
  - In einer Welt ohne MCP-Freigabe liefert kein Werkzeug Inhalte (D3).
  - Ein Token mit anderem Scope als `worlds:read` erhält bei jedem Werkzeug einen Autorisierungsfehler.

### T-009: Aufruflimit & Audit-Log
- [ ] Beschreibung: Ein Aufruflimit von 60 Werkzeugaufrufen pro Minute und Benutzer einführen; bei Überschreitung wird HTTP 429 mit `Retry-After` zurückgegeben. Ein Audit-Log schreibt pro Aufruf: Zeitpunkt, Benutzer-ID, Client-ID, Werkzeugname, `welt_id`, Dauer in ms und Ergebnis (ok / Fehlercode). Es enthält **keine** Suchbegriffe und keine Inhalte. Einträge, die älter als 30 Tage sind, werden täglich automatisch gelöscht.
- Abhängigkeiten: T-005
- Abnahmekriterium: (1) Ein Test mit 61 Aufrufen innerhalb einer Minute erhält beim 61. Aufruf HTTP 429 mit `Retry-After`. (2) Nach einem Aufruf von `suchen` mit dem Begriff „Rabenstein“ existiert ein Audit-Eintrag mit allen genannten Feldern, und das Wort „Rabenstein“ kommt im Audit-Log nicht vor. (3) Ein künstlich auf 31 Tage zurückdatierter Eintrag ist nach dem Lauf des Löschjobs entfernt.

### T-010: Ende-zu-Ende-Test mit Claude & Anleitung
- [ ] Beschreibung: Den MCP-Server auf Staging mit echten Claude-Clients verbinden und testen. Anschließend eine Anleitung für Benutzer als Hilfeseite in der App schreiben. Die Seite erklärt: Voraussetzungen (Claude-Konto mit Custom Connectors), das Hinzufügen in claude.ai bzw. der Desktop-App und in Claude Code, welche Daten Claude sehen kann und welche nicht (Tagebücher und Chat ausgeschlossen), sowie das Widerrufen des Zugriffs.
- Abhängigkeiten: T-004, T-008, T-009, T-012
- Abnahmekriterium: Als Player A verbunden, getestet in claude.ai **und** in Claude Code, beantwortet Claude die folgenden drei Fragen korrekt anhand der Testwelt. Das jeweilige Protokoll mit den aufgerufenen Werkzeugen wird in `.ai/infrastructure/mcp-e2e-test.md` festgehalten:
  1. „Welche Inhalte sind mit Burg Rabenstein verknüpft?“ – alle Relationen der Tiefe 1 werden genannt.
  2. „Welche Quests sind gerade aktiv?“ – genau die aktiven Quests.
  3. „Was steht in meinem Tagebuch?“ – Claude antwortet, dass es darauf keinen Zugriff hat, und nennt keinen Tagebuchinhalt.

  Die Hilfeseite ist in der App verlinkt und enthält alle genannten Punkte.

### T-011: Produktivschaltung & Normen
- [ ] Beschreibung: Den MCP-Server in Produktion freischalten und die Architektur in `.ai/architecture/mcp.md` dokumentieren: Überblick über Komponenten und OAuth-Ablauf (Mermaid-Sequenzdiagramm), Token-Laufzeiten, Aufruflimit, Audit-Log. Dazu eine Checkliste „Neues MCP-Werkzeug hinzufügen“ (Scope deklarieren, nur über die Rechteschicht zugreifen, Aufnahme in die Suite aus T-008, Ausschlussregeln beachten). `.ai/conventions.md` verweist auf diese Checkliste.
- Abhängigkeiten: T-010
- Abnahmekriterium: `https://<produktivdomain>/mcp` lässt sich in claude.ai verbinden, und `welten_auflisten` liefert die echten Welten des verbundenen Benutzers. `.ai/architecture/mcp.md` existiert mit allen genannten Inhalten, und das Sequenzdiagramm wird in einer Markdown-Vorschau fehlerfrei gerendert. `.ai/conventions.md` enthält den Verweis auf die Checkliste.
