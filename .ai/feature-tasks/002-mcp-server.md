# 002 – MCP-Server für Claude

## Kontext & Ziel

WorldCraft-Benutzer sollen Claude mit ihrem **eigenen Claude-Abo** Fragen zu ihrer Welt stellen können, etwa: „Welche Personen und Quests hängen mit Burg Rabenstein zusammen?“ oder „Welche offenen Quests gibt es gerade?“. Dafür stellt WorldCraft einen **Remote-MCP-Server** bereit. Jeder Benutzer bindet ihn in claude.ai, in der Claude-Desktop-App oder in Claude Code als **Custom Connector** ein und meldet sich dabei mit seinem WorldCraft-Konto (Discord-Login) an.

**Ziel dieses Plans:** ein produktiv nutzbarer, **nur lesender** MCP-Server mit acht Werkzeugen, sicherer Anmeldung per OAuth und strikter Anwendung der Rechtematrix. Claude darf nie mehr sehen als der angemeldete Benutzer in der App.

**Umsetzungszeitpunkt:** Dieser Plan wird **nach** dem MVP-Funktionsplan umgesetzt (siehe Globale Abhängigkeiten). Die MCP-Werkzeuge nutzen die dort gebaute Daten- und Rechteschicht und bauen keine eigene.

### Abgrenzung

- **Nur lesend.** Schreibende Werkzeuge (z. B. „lege aus diesem Gespräch einen Artikel an“) sind nicht Teil dieses Plans. Architektur und Scope-Modell (T-001) müssen sie aber später ohne Umbau ermöglichen.
- **Tagebucheinträge und Geheimnisse sind über MCP vollständig ausgeschlossen**, unabhängig von Rolle, Besitz und Sichtbarkeit des Eintrags, also auch die eigenen. Hintergrund: Alles, was ein KI-Client liest, wird an dessen Anbieter übertragen (bei Claude an Anthropic).
- **Chat-Nachrichten** sind über MCP nicht abrufbar.
- **Vollständige Ausschlussliste:** siehe D9. **Offener Endpunkt:** Jeder MCP-Client kann sich verbinden, sofern der Benutzer zustimmt (D8); „Claude“ steht in diesem Plan stellvertretend für jeden solchen Client.
- **Kein KI-Chat innerhalb der App** (bleibt im Backlog, siehe Plan `001`).
- **Freischaltung in zwei Stufen** (D2, D3): Der MCP-Server ist nur erreichbar, wenn der Hauptschalter an ist, und liefert Inhalte einer Welt nur, wenn deren Game Master MCP für diese Welt freigegeben hat.

## Entscheidungen (Projektinhaber, 2026-09-25)

| # | Frage | Entscheidung |
|---|---|---|
| D1 | Lesen, Schreiben, Löschen | **Plan `002` bleibt nur lesend.** Schreiben folgt als eigener Plan, sobald Lesen auf Produktion wie erwartet funktioniert; ADR-005 legt die Grundlagen dafür schon fest (T-001 Punkt 7), damit kein Umbau nötig wird. **Löschen über MCP gibt es nie.** Der Schreib-Plan umfasst auch **Bilder hochladen** (Konzept: einmaliger Upload-Link statt Base64 im Werkzeugaufruf, siehe Backlog „MCP: Schreiben“). Schreibrechte über MCP entsprechen später genau denen in der App (Players etwa nur Notizblock und eigener Charakter); die Lesefunktionen bleiben für alle Rollen unverändert. |
| D2 | Hauptschalter | Umgebungsvariable `MCP_ENABLED` (Standard: aus). Ist sie nicht `true`, antworten `/mcp`, alle OAuth-Endpunkte aus T-003 und beide `/.well-known/…`-Metadaten mit HTTP 404. Abschalten ohne neuen Code-Stand, nur per Umgebungsvariable und Neustart in Coolify. |
| D3 | Freigabe pro Welt | Schalter **an/aus** pro Welt, setzbar nur vom Game Master. **Standard aus**, für neue und bestehende Welten. Keine Abstufung nach Rolle oder Bereich. |
| D4 | Ausschlüsse | **Feste Ausschlussliste im Code**, nicht pro Welt konfigurierbar. Fest ausgeschlossen: Tagebuch und Chat (siehe oben). Weitere Einträge werden zusammen mit dem Umfang der Werkzeuge im Plan-Review festgelegt. |
| D5 | `nur ich`-Inhalte (`owner_only`) | **Keine Zusatzsperre.** MCP liefert, was die Rechteschicht dem angemeldeten Benutzer auch in der App zeigt, also die eigenen `nur ich`-Inhalte, solange er Spielleitung ist. Pflicht: Benutzer A sieht die `nur ich`-Inhalte von Benutzer B über kein Werkzeug, auch nicht als Game Master (Nachweis in T-008). |
| D6 | Per MCP angelegte Inhalte (für den späteren Schreib-Plan) | Durch D5 erledigt: Was Claude für den Benutzer anlegt, gehört ihm, startet mit `nur ich` und bleibt für ihn über MCP les- und bearbeitbar. Veröffentlichen bleibt eine bewusste Handlung des Benutzers. |
| D7 | Welt-Angabe bei mehreren Welten (2026-09-25) | (1) Der Welt-Parameter aller Werkzeuge nimmt eine **ID oder den Weltnamen** an (ohne Groß-/Kleinschreibung); bei mehrdeutigem oder unbekanntem Namen gibt es einen Werkzeugfehler mit der Liste der passenden freigegebenen Welten (Name, ID). (2) Hat der Benutzer genau **eine** freigegebene Welt, ist der Welt-Parameter optional und diese Welt gilt. (3) Die Werkzeugbeschreibungen bitten Claude, bei mehreren freigegebenen Welten ohne genannte Welt nachzufragen, statt in allen zu suchen. **Keine** weltübergreifende Suche. Parametername `welt` (D14). |
| D8 | Offener Endpunkt oder nur Claude? | **Offen (Option A).** DCR bleibt wie in T-003 (jede `https`-Redirect-URI sowie `localhost`/`127.0.0.1`). Jeder MCP-Client (Claude, ChatGPT, andere) kann sich verbinden; die Schranke ist Anmeldung und Zustimmung des Benutzers. Folge: Texte auf Welt-Schalter, Zustimmungsseite und Hilfeseite sprechen vom „verbundenen KI-Anbieter“, nicht nur von Anthropic; die Zustimmungsseite hebt die Redirect-Domain deutlich hervor (Schutz gegen Clients, die sich fälschlich „Claude“ nennen). |
| D9 | Ausschlussliste (konkretisiert D4) | Über **kein** Werkzeug abrufbar: **X1** Tagebuch (alle Einträge, auch eigene/geteilte); **X2** Chat und Würfel; **X3** Einladungslinks; **X4** Bild-URLs, Datei-IDs und Dateien außer Bildern; Bilder nur über `bild_lesen` (D15); **X5** Pin-**Positionen** (`pos_x`/`pos_y`) – Pins selbst sind als Text lesbar (D10); **X6** Charakter-Marker; **X7** Monster-Marker; **X8** Kartenbild und alle Koordinaten; **X9** Schreiben, Ändern, Löschen (D1); **X10** verbundene Anwendungen und Audit-Log; **X11** Kontodaten anderer Mitglieder (E-Mail, Discord-ID, Avatar). Damit entfallen die offenen Fragen 1–3 aus dem Abgleich nach Plan `006`. |
| D10 | Werkzeugumfang (Tabelle *MCP-Werkzeuge*) | (1) **Pins als reiner Text**: Titel, Pin-Typ, Beschreibung, Karte und Universum (Name, ID); ohne Position; Relationen von und zu Pins bleiben erhalten. (2) `karte_lesen` heißt **`universen_auflisten`** und liefert nur Universen mit Beschreibung und ihren Karten (ID, Name); kein `karte_id`, keine Pins, keine Marker. (3) **V1** `welten_auflisten` nennt andere Mitglieder nur mit Anzeigename und Rolle. **V2** `welten_auflisten` liefert die Weltbeschreibung. **V3** Auswahlwerte in Vorlagen- und Monsterfeldern als **deutsche Labels** wie in der App (beantwortet Frage 1 nach Plan `009`). **V4** Quest-Kapitel sind Teil der Quest in `inhalt_lesen` (nur sichtbare, mit Status); Treffer in Kapiteltexten erscheinen in `suchen` als Treffer auf die Quest; keine eigenen Kapitel-Objekte (beantwortet Frage 2 nach `004` und die Frage nach `010`). **V5** Quest-Notizblock ist Teil der Quest in `inhalt_lesen`, lesbar für alle, die die Quest sehen; nicht in `suchen` (beantwortet Frage 3 nach `004`). **V6** Monster als eigene Art `monster` in `suchen`, `inhalt_lesen`, `relationen_abrufen` mit vollem Charakterblatt; Sichtbarkeit über die Rechteschicht (beantwortet Fragen 1, 3, 4 nach `005`). |
| D11 | Filter nach Monster-Art und Vorlagentyp | **Ja** (beantwortet Frage 2 nach `005`). Neues Werkzeug **`inhalte_auflisten`** als Gegenstück zu Glossar und Bestiarium der App: Liste ohne Suchbegriff mit optionalen Filtern `vorlagentyp` (Artikel), `monster_art` (Monster) und `quest_gegenstand` (D12). Nutzt `listArticles` bzw. `listMonsters` aus der Domänenschicht. |
| D12 | Quest-Gegenstand (Vorlage `item`, Feld `quest`, Ja/Nein, ad hoc ergänzt 2026-09-25) | `inhalt_lesen` gibt bei Gegenständen „Quest-Gegenstand: Ja/Nein“ aus (nicht gespeichert = Nein). `inhalte_auflisten` kennt den Filter `quest_gegenstand: true` und kennzeichnet Quest-Gegenstände in der Liste. `suchen` bleibt ohne Feldwerte (wie P9-3). |
| D13 | Discord-Allowlist als eigentliche Schranke (2026-09-25) | Die Freigabe erfolgt über den **Benutzer**, nicht über den Client (ergänzt D8): Nur Discord-IDs aus `ALLOWED_DISCORD_IDS` (`isDiscordIdAllowed` in `src/lib/env.ts`) erhalten ein Token. Die Allowlist wird **bei jedem Schritt erneut geprüft**, nicht nur beim Discord-Login: Autorisierung/Zustimmung, Token-Ausgabe, jede Token-Erneuerung und jede Anfrage an `/mcp`. Wird eine ID aus der Liste entfernt, ist ihr Zugriff über MCP spätestens mit der nächsten Anfrage beendet (Refresh schlägt fehl, `/mcp` liefert 401), ohne dass Tokens manuell widerrufen werden müssen. |
| D14 | Parameternamen (2026-09-25) | **Deutsch** (beantwortet Rückfrage 2 aus dem Abgleich nach Plan `001` und M2): Parameter `welt`, `suchbegriff`, `art`, `id`, `tiefe`, `status`, `vorlagentyp`, `monster_art`, `quest_gegenstand`, `limit`, `bild_nr`; Werte für `art`: `artikel` / `quest` / `charakter` / `pin` / `monster` / `universum` (bei `bild_lesen` zusätzlich `welt` / `karte`); `vorlagentyp`: `person` / `ort` / `organisation` / `gegenstand` / `rasse` / `ohne`; `status`: `offen` / `aktiv` / `abgeschlossen` / `gescheitert`; `monster_art`: deutsche Labels der App. Die MCP-Schicht bildet sie auf die englischen DB-Schlüssel ab (eine Abbildungstabelle pro Enum, mit Test auf Vollständigkeit). |
| D15 | Bilder lesen (2026-09-25) | Neues Werkzeug **`bild_lesen`** (T-013), X4 wird entsprechend gelockert: Bilder sind **nur** über dieses Werkzeug abrufbar, nie als URL oder Datei-ID. Das Bild wird als MCP-Bildinhalt (Base64 + Dateityp) im Ergebnis geliefert, serverseitig verkleinert. Rechte wie bei der Auslieferung in der App (Bild nur, wenn der zugehörige Inhalt sichtbar ist). Kartenbilder werden **ohne** Pins und Marker geliefert (X5–X8 bleiben). `inhalt_lesen` nennt nur, ob bzw. wie viele Bilder vorhanden sind. Hochladen von Bildern gehört in den späteren Schreib-Plan (D1). |

## Begriffe & Systeme

- **MCP (Model Context Protocol)**: Offenes Protokoll, über das Claude Werkzeuge externer Anwendungen aufruft.
- **Remote-MCP-Server**: MCP-Server, der per HTTPS erreichbar ist. Transport: **Streamable HTTP** (ein HTTP-Endpunkt, der JSON-RPC-Nachrichten per POST annimmt). Hier unter dem Pfad `/mcp` der Produktivdomain `worldcraft.lagolago.at` bzw. lokal unter `http://localhost:3000/mcp`. Ein Staging gibt es nicht.
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
| `welten_auflisten` | – | Alle Welten, in denen der Benutzer Mitglied ist: ID, Name, Beschreibung, eigene Rolle, MCP-Freigabe (D3), Name und ID aller eigenen in diese Welt mitgebrachten Charaktere (nicht archivierte Teilnahmen) sowie die anderen Mitglieder mit Anzeigename und Rolle. Bei nicht freigegebener Welt nur ID, Name, eigene Rolle und Kennzeichnung (T-012). |
| `suchen` | `welt` (D7), `suchbegriff`, optional `art` (artikel / quest / charakter / pin / monster / universum), optional `limit` (Standard 20, maximal 50) | Treffer mit Art, ID, Titel, Vorlagentyp und einem Textauszug von maximal 300 Zeichen. Treffer in Kapiteltexten zeigen auf die Quest; Notizblock und Tagebuch werden nicht durchsucht. |
| `inhalte_auflisten` | `welt`, `art` (artikel / monster), optional `vorlagentyp` (nur artikel), optional `monster_art` (nur monster), optional `quest_gegenstand` (nur Vorlagentyp Gegenstand), optional `limit` (Standard 50, maximal 200) | Liste mit ID, Titel, Vorlagentyp bzw. Monster-Art, Seltenheit (Gegenstand, Monster), Boss (Monster) und Kennzeichnung Quest-Gegenstand. Ungültige Filterkombination (z. B. `monster_art` bei `art: artikel`) → Werkzeugfehler. |
| `inhalt_lesen` | `welt`, `art` (artikel / quest / charakter / pin / monster / universum), `id` | Vollständiger Inhalt als Markdown (Rich-Text aus TipTap-JSON umgewandelt, Erwähnungen als `@Titel`, Auswahlwerte als deutsche Labels). **Artikel:** Titel, Vorlagentyp, Vorlagenfelder (bei Gegenständen inkl. Quest-Gegenstand Ja/Nein), Text. **Quest:** Titel, Status, beteiligte Charaktere, Beschreibung, sichtbare Kapitel in Reihenfolge mit Titel, Status und Text, Notizblock. **Charakter:** Charakterbogen (Klasse, Attribute, Übungsbonus, Fertigkeiten mit Übungsgrad, Attribut und berechnetem Gesamtbonus, Fähigkeiten mit Attribut und Modifikator, Persönlichkeitsmerkmale, Ideale, Bindungen, Makel, Bio), ohne Bilder und ohne Tagebuch. **Monster:** Charakterblatt wie Charakter plus Art, Seltenheit, Boss, Gefahrenstufe, Größe, Lebensraum, Bio; ohne Bild. **Pin:** Titel, Pin-Typ, Karte und Universum (Name, ID), Beschreibung; ohne Position. **Universum:** Name, Beschreibung, Karten (ID und Name). Jeweils mit Sichtbarkeitskennzeichnung (`nur ich` / `nur Spielleitung` / `veröffentlicht`) und dem Hinweis, ob bzw. wie viele Bilder per `bild_lesen` abrufbar sind. |
| `relationen_abrufen` | `welt`, `art`, `id`, optional `tiefe` (1 oder 2, Standard 1) | Ein- und ausgehende Relationen mit Herkunft (Erwähnung, Vorlagenfeld inkl. Feldname, Beteiligung, Lebensraum, manuell inkl. Bezeichnung bzw. Gegenbezeichnung) sowie Art, ID und Titel des jeweils anderen Inhalts (alle Arten inkl. Pin und Monster). |
| `quests_auflisten` | `welt`, optional `status` | Quests mit ID, Titel, Status und beteiligten Charakteren. Der Statusfilter bezieht sich auf den Quest-Status, nicht auf Kapitel. |
| `bild_lesen` | `welt`, `art` (welt / artikel / charakter / monster / karte), `id`, optional `bild_nr` (nur Charakter-Bildanhänge, Standard: Profilbild) | Das Bild als MCP-Bildinhalt (verkleinert, siehe T-013) plus eine Textzeile mit Art, Titel und ggf. Bildunterschrift. Kartenbild ohne Pins/Marker. Nicht vorhandenes oder nicht sichtbares Bild → Werkzeugfehler „Bild nicht gefunden“. |
| `universen_auflisten` | `welt` | Alle für den Benutzer sichtbaren Universen der Welt mit ID, Name, Beschreibung und ihren sichtbaren Karten (ID, Name). Keine Pins, keine Marker, keine Koordinaten, kein Kartenbild (D9). |

Parameternamen und Werte: siehe D14.

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
- Produktivumgebung auf Coolify mit HTTPS (aus Plan `001`, T-007) und die lokale Entwicklungsumgebung. Ein Staging gibt es nicht (`.ai/infrastructure/deployment.md`).
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
  9. **Bildinhalte** (D15): ob claude.ai, die Desktop-App und Claude Code Bildinhalte in Werkzeug-Ergebnissen an das Modell weitergeben, empfohlene Maximalgröße, Ergebnis mit Quelle dokumentieren.

  Zusätzlich die **aktuellen Anforderungen der Claude-Clients** an Remote-Connectors anhand der offiziellen Dokumentation von Anthropic und der MCP-Spezifikation prüfen und mit Quellenlink und Abrufdatum dokumentieren: unterstützte Spezifikationsversion, DCR oder manuell eingetragene Client-ID, Callback-URL(s) von claude.ai und Claude Code, Anforderungen an die Metadaten-Endpunkte.
- Abhängigkeiten: keine innerhalb dieses Plans (siehe Globale Abhängigkeiten)
- Abnahmekriterium: ADR-005 existiert, beantwortet die Punkte 1–9 jeweils mit genau einer Entscheidung und Begründung und enthält den Abschnitt „Anforderungen der Claude-Clients“ mit mindestens einem Quellenlink samt Abrufdatum. Punkt 3 enthält eine Tabelle „Anforderung aus T-003 → abgedeckt durch Bibliothek / Eigenbau“.

### T-002: Testwelt-Skript
- [ ] Beschreibung: Ein Skript (Pfad gemäß `.ai/conventions.md`) erstellen, das auf einer leeren lokalen Datenbank reproduzierbar eine Testwelt anlegt:
  - 4 Testbenutzer: 1 Game Master (Ersteller der Testwelt), 1 Master, Player A, Player B
  - 1 zweite Welt, in der nur Player B Mitglied ist
  - 6 Artikel: je einer der Vorlagentypen Person, Ort, Organisation, Gegenstand, Rasse sowie einer ohne Vorlage; davon 1 mit Status `nur Spielleitung`. Der Gegenstand ist ein Quest-Gegenstand (D12); die Person verweist über das Feld `race` auf die Rasse (Relation mit Herkunft Vorlagenfeld). Der Ort hat ein Titelbild, der `nur Spielleitung`-Artikel ebenfalls (für `bild_lesen`, T-013). Darunter ein Artikel „Burg Rabenstein“ mit mindestens 3 Relationen (mindestens eine per Erwähnung, eine per Vorlagenfeld und eine manuelle mit Bezeichnung und Gegenbezeichnung) und einer Relation über 2 Stufen.
  - 2 veröffentlichte Quests mit unterschiedlichem Status, davon eine mit einem beteiligten Charakter
  - 2 Universen mit je 1 Karte; das zweite Universum hat den Status `nur Spielleitung`. Die Karte des ersten Universums hat 4 veröffentlichte Pins, davon 2 mit Erwähnungen in der Beschreibung, und einen Charakter-Marker für den Charakter von Player A (der Marker dient nur dem Nachweis, dass er in keinem Werkzeug erscheint, D9).
  - 3 Monster zweier Monster-Arten, davon 1 `nur Spielleitung`, eines mit Lebensraum-Verweis auf einen Ort-Artikel; 1 Monster-Marker auf der Karte des ersten Universums (Nachweis D9)
  - 1 weiterer Gegenstand-Artikel ohne Quest-Gegenstand (D12)
  - An der Quest mit beteiligtem Charakter: 2 Kapitel mit unterschiedlichem Status (1 veröffentlicht, 1 `nur Spielleitung`) und ein Notizblock-Text
  - 1 Charakter von Player A, in die Testwelt mitgebracht, mit je einem Tagebucheintrag `privat` und `mit Spielleitung geteilt`, die jeweils das eindeutige Wort `GEHEIMTEST` enthalten
  - 1 Chat-Nachricht mit dem eindeutigen Wort `CHATTEST`
  - 1 zusätzlicher Artikel des Masters mit Status `nur ich` (D5)
  - MCP-Freigabe (T-012): Testwelt an, zweite Welt aus; sobald T-012 umgesetzt ist

  Für jeden Testbenutzer lässt sich eine Sitzung erzeugen, ohne dass ein echter Discord-Login nötig ist. Das ist nur lokal möglich (bestehender Test-Login mit `ENABLE_TEST_LOGIN`), niemals in Produktion.
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
  8. **Allowlist (D13):** Autorisierungsendpunkt, Zustimmung, Token-Ausgabe und Token-Erneuerung prüfen `isDiscordIdAllowed` für die Discord-ID des Benutzers; bei Fehlschlag gibt es kein Token bzw. den OAuth-Fehler `access_denied` (Autorisierung) oder `invalid_grant` (Erneuerung).
- Abhängigkeiten: T-001
- Abnahmekriterium: (1) Beide Metadaten-Endpunkte liefern gültiges JSON mit den geforderten Feldern. (2) Mit dem MCP Inspector lässt sich der komplette Ablauf DCR → Discord-Login → Zustimmung → Token → Refresh lokal durchspielen. (3) Automatisierte Tests belegen: Eine Anfrage ohne PKCE oder mit der Methode `plain` wird abgelehnt. Eine DCR mit der Redirect-URI `http://evil.example` wird abgelehnt. Ein bereits benutztes Refresh-Token wird abgelehnt. Ein Autorisierungscode ist nur einmal einlösbar. „Ablehnen“ auf der Zustimmungsseite liefert dem Client den Fehler `access_denied`. (4) In der Datenbank liegt kein Token im Klartext. (5) D13: Ein Benutzer, dessen Discord-ID nicht auf der Allowlist steht, erhält weder über den Autorisierungsablauf ein Token noch über ein zuvor ausgestelltes Refresh-Token ein neues (Test: ID nach Ausstellung aus `ALLOWED_DISCORD_IDS` entfernen).

### T-004: Verbundene Anwendungen verwalten
- [ ] Beschreibung: In den Kontoeinstellungen der App eine Seite „Verbundene Anwendungen“ bauen. Sie listet jede erteilte Zustimmung mit Client-Name, Redirect-Domain, Datum der Zustimmung und Zeitpunkt der letzten Nutzung. „Zugriff widerrufen“ macht alle Tokens dieser Zustimmung sofort ungültig.
- Abhängigkeiten: T-003
- Abnahmekriterium: Nach der Verbindung über den MCP Inspector erscheint der Eintrag auf der Seite. Nach „Zugriff widerrufen“ wird der nächste Aufruf von `/mcp` mit dem bisherigen Zugriffstoken mit HTTP 401 abgelehnt, und auch das Refresh-Token ist ungültig. Ein Benutzer sieht nur seine eigenen Zustimmungen.

### T-005: MCP-Endpunkt mit Token-Prüfung
- [ ] Beschreibung: Den Endpunkt `/mcp` mit dem SDK aus ADR-005 bereitstellen. Jede Anfrage durchläuft eine Token-Prüfung: Signatur bzw. Gültigkeit, Ablaufzeit, Audience = `/mcp`, Scope, nicht widerrufen. Daraus wird der Benutzerkontext für die Werkzeuge erzeugt. Ohne gültiges Token wird HTTP 401 mit `WWW-Authenticate`-Header zurückgegeben, der auf die Protected Resource Metadata verweist. Der Server meldet sich mit dem Namen `WorldCraft` und der App-Version. Noch ohne fachliche Werkzeuge; zum Test dient ein Werkzeug `whoami`, das nur registriert ist, wenn `APP_ENV` nicht `production` ist, und den Anzeigenamen des Benutzers liefert.
- Abhängigkeiten: T-001, T-003
- Abnahmekriterium: (1) `curl` ohne Token auf `/mcp` liefert 401 mit korrektem `WWW-Authenticate`-Header. (2) Ein abgelaufenes Token, ein Token mit fremder Audience, ein widerrufenes Token und ein gültiges Token eines Benutzers, dessen Discord-ID inzwischen nicht mehr auf der Allowlist steht (D13), liefern jeweils 401. (3) Im MCP Inspector liefert `whoami` nach der Anmeldung als Player A den Namen von Player A. (4) In Produktion ist `whoami` nicht in der Werkzeugliste enthalten.

### T-012: Hauptschalter und Welt-Freigabe
- [ ] Beschreibung: D2 und D3 umsetzen.
  1. **Hauptschalter:** `MCP_ENABLED` in der Env-Validierung aufnehmen (Standard aus) und in `.ai/infrastructure/deployment.md` dokumentieren. Ist er aus, liefern `/mcp`, die OAuth-Endpunkte aus T-003 und beide Metadaten-Dokumente HTTP 404.
  2. **Welt-Freigabe:** Neues Feld an der Welt (z. B. `worlds.mcp_enabled boolean not null default false`, Migration setzt bestehende Welten auf `false`). Schalter „Claude-Zugriff (MCP)“ in der Weltverwaltung (`/w/[worldId]/menu`), nur für den Game Master, mit Hinweis, dass freigegebene Inhalte an den Anbieter des jeweils verbundenen KI-Clients (z. B. Anthropic) übertragen werden. Änderung nur über die Rechteschicht (Game Master, sonst 403).
  3. **Verhalten bei gesperrter Welt:** `welten_auflisten` führt die Welt weiter auf (ID, Name, eigene Rolle) mit der Kennzeichnung „MCP für diese Welt nicht freigegeben“, ohne Charaktere. Alle anderen Werkzeuge liefern für diese Welt den Werkzeugfehler „MCP ist für diese Welt nicht freigegeben“ und keine Inhalte.
  4. Normen: `datenmodell-fachlich.md` (Welt-Eigenschaft und Rechte), `datenmodell.md` (Spalte), `features.md`.
- Abhängigkeiten: T-001, T-005
- Abnahmekriterium: (1) Mit `MCP_ENABLED` aus liefern `/mcp`, `/.well-known/oauth-protected-resource` und `/.well-known/oauth-authorization-server` jeweils 404 (automatisierter Test). (2) Eine neu angelegte Welt und jede Bestandswelt nach der Migration haben die Freigabe aus. (3) Master und Player sehen den Schalter nicht; ein `PATCH` durch sie liefert 403. (4) Bei gesperrter Welt liefert jedes Werkzeug außer `welten_auflisten` den Fehler aus Punkt 3; nach dem Freigeben liefern sie Inhalte ohne neue Anmeldung. (5) Die Testwelt aus T-002 ist freigegeben, die zweite Welt nicht, und T-008 prüft beide Fälle.

### T-006: Werkzeuge `welten_auflisten`, `suchen`, `inhalte_auflisten`, `inhalt_lesen`
- [ ] Beschreibung: Die drei Werkzeuge gemäß der Tabelle *MCP-Werkzeuge* umsetzen. Eingaben werden per Schema validiert; bei ungültiger Eingabe gibt es einen verständlichen Werkzeugfehler statt eines Serverfehlers. Alle Datenzugriffe laufen über die Rechteschicht. Die Beschreibungen der Werkzeuge erklären Claude auf Deutsch, wann das Werkzeug zu nutzen ist und dass zuerst `welten_auflisten` aufgerufen werden sollte, wenn keine `welt_id` bekannt ist. Antworten über 20.000 Zeichen werden gekürzt und enthalten dann den Hinweis „gekürzt“.
- Abhängigkeiten: T-002, T-005, T-012
- Abnahmekriterium: Automatisierte Tests gegen die Testwelt: (1) `welten_auflisten` liefert für Player B zwei Welten, für Player A eine. (2) `suchen` mit „Rabenstein“ findet den Artikel „Burg Rabenstein“. (3) `inhalt_lesen` für „Burg Rabenstein“ liefert Markdown mit Titel, Vorlagenfeldern und Text, ohne JSON-Reste. (4) Eine ungültige `welt_id` oder eine Welt ohne Mitgliedschaft liefert einen Werkzeugfehler „Welt nicht gefunden“, ohne zu verraten, ob die Welt existiert. (5) `limit: 500` wird abgelehnt oder auf 50 begrenzt. (6) D7: Weltname statt ID funktioniert (auch in anderer Groß-/Kleinschreibung); bei genau einer freigegebenen Welt funktioniert `suchen` ohne Welt-Parameter; bei zwei freigegebenen Welten ohne Welt-Parameter kommt ein Werkzeugfehler mit beiden Welten. (7) `inhalte_auflisten` mit `monster_art` liefert nur Monster dieser Art; mit `vorlagentyp: gegenstand` und `quest_gegenstand: true` nur den Quest-Gegenstand; `inhalt_lesen` der Quest zeigt für Player A nur das veröffentlichte Kapitel samt Status und den Notizblock; `inhalt_lesen` eines Pins enthält Karte und Universum, aber keine Koordinaten.

### T-007: Werkzeuge `relationen_abrufen`, `quests_auflisten`, `universen_auflisten`
- [ ] Beschreibung: Die drei Werkzeuge gemäß der Tabelle *MCP-Werkzeuge* umsetzen, mit denselben Regeln wie in T-006 (Schema-Validierung, Rechteschicht, Beschreibungen, Kürzung). Bei `relationen_abrufen` mit `tiefe: 2` werden Relationen zu Inhalten, die der Benutzer nicht sehen darf, vollständig weggelassen, einschließlich der Relationen, die nur über einen solchen Inhalt erreichbar sind.
- Abhängigkeiten: T-002, T-005, T-012
- Abnahmekriterium: Automatisierte Tests gegen die Testwelt: (1) `relationen_abrufen` für „Burg Rabenstein“ liefert genau die im Testwelt-Skript angelegten Relationen mit korrekter Herkunft, korrektem Feldnamen und bei der manuellen Relation der korrekten Bezeichnung (aus Sicht des Ziels die Gegenbezeichnung). (2) Mit `tiefe: 2` erscheint die Relation über 2 Stufen. (3) `quests_auflisten` mit Statusfilter liefert nur Quests dieses Status. (4) `universen_auflisten` liefert für den Game Master beide Universen mit je einer Karte, für Player A nur das erste; die Antwort enthält weder Pins noch Marker noch Koordinaten.

### T-013: Werkzeug `bild_lesen`
- [ ] Beschreibung: `bild_lesen` gemäß Tabelle *MCP-Werkzeuge* und D15 umsetzen. Quellen: Weltbild (`worlds.title_image_id`), Artikel-Titelbild (`articles.title_image_id`), Charakter-Profilbild und -Bildanhänge (`characters.portrait_id`, `character_images`, `bild_nr` nach `sort_order`), Monster-Profilbild (`monsters.portrait_id`), Kartenbild (`maps.image_id`). Sichtbarkeit wie die Dateiauslieferung der App (CR-003, `/api/files/…`) über die Rechteschicht; keine eigene Prüfung. Verkleinerung mit `sharp` auf höchstens 1568 px an der langen Kante (bzw. den in T-001 Punkt 9 ermittelten Wert), Ausgabe als JPEG oder WebP, höchstens 1 MB nach Kodierung. Kein Zwischenspeichern der verkleinerten Bilder auf der Platte. Audit-Log wie andere Werkzeuge (ohne Bilddaten).
- Abhängigkeiten: T-001, T-002, T-005, T-012
- Abnahmekriterium: Automatisierte Tests gegen die Testwelt: (1) `bild_lesen` für das Titelbild des Ort-Artikels liefert einen Bildinhalt mit Dateityp JPEG oder WebP, lange Kante ≤ 1568 px, Größe ≤ 1 MB. (2) Das Titelbild des `nur Spielleitung`-Artikels erhält der Game Master, Player A erhält „Bild nicht gefunden“. (3) Das Kartenbild des `nur Spielleitung`-Universums erhält Player A nicht. (4) Keine Antwort enthält einen Pfad, eine Datei-ID oder eine URL. (5) Ein 20-MB-Kartenbild wird ohne Zeitüberschreitung (< 5 s lokal) verkleinert ausgeliefert.

### T-008: Rechte- und Ausschlusstests
- [ ] Beschreibung: Eine automatisierte Testsuite schreiben, die jedes der acht Werkzeuge mit jedem der vier Testbenutzer aufruft und gegen die Rechtematrix aus Plan `001` sowie die Abgrenzung dieses Plans prüft.
- Abhängigkeiten: T-006, T-007, T-013
- Abnahmekriterium: Die Suite läuft in der CI bzw. lokal per einem Befehl und ist grün. Sie belegt mindestens:
  - Die Wörter `GEHEIMTEST` und `CHATTEST` tauchen in **keiner** Antwort eines Werkzeugs auf, für keinen Benutzer, auch nicht für Player A.
  - Der Artikel mit Status `nur Spielleitung` erscheint für Game Master und Master in `suchen`, `inhalt_lesen` und `relationen_abrufen`, für beide Player in keinem Werkzeug, auch nicht als Relation.
  - Player A erhält keine Inhalte der zweiten Welt.
  - Ein `nur ich`-Inhalt des Masters erscheint für den Master, aber in keinem Werkzeug für den Game Master oder die Player, auch nicht als Relation (D5).
  - In einer Welt ohne MCP-Freigabe liefert kein Werkzeug Inhalte (D3).
  - Keine Antwort eines Werkzeugs enthält Koordinaten (`pos_x`/`pos_y`), Charakter- oder Monster-Marker, Bild-URLs, Datei-IDs, Einladungs-Token oder E-Mail-Adressen (D9).
  - Ein Token mit anderem Scope als `worlds:read` erhält bei jedem Werkzeug einen Autorisierungsfehler.

### T-009: Aufruflimit & Audit-Log
- [ ] Beschreibung: Ein Aufruflimit von 60 Werkzeugaufrufen pro Minute und Benutzer einführen; bei Überschreitung wird HTTP 429 mit `Retry-After` zurückgegeben. Ein Audit-Log schreibt pro Aufruf: Zeitpunkt, Benutzer-ID, Client-ID, Werkzeugname, `welt_id`, Dauer in ms und Ergebnis (ok / Fehlercode). Es enthält **keine** Suchbegriffe und keine Inhalte. Einträge, die älter als 30 Tage sind, werden täglich automatisch gelöscht.
- Abhängigkeiten: T-005
- Abnahmekriterium: (1) Ein Test mit 61 Aufrufen innerhalb einer Minute erhält beim 61. Aufruf HTTP 429 mit `Retry-After`. (2) Nach einem Aufruf von `suchen` mit dem Begriff „Rabenstein“ existiert ein Audit-Eintrag mit allen genannten Feldern, und das Wort „Rabenstein“ kommt im Audit-Log nicht vor. (3) Ein künstlich auf 31 Tage zurückdatierter Eintrag ist nach dem Lauf des Löschjobs entfernt.

### T-010: Ende-zu-Ende-Test mit Claude & Anleitung
- [ ] Beschreibung: Den MCP-Server mit echten Claude-Clients verbinden und testen. **Umgebung offen** (siehe Roadmap): Produktion mit einer Demowelt oder die lokale Instanz über einen HTTPS-Tunnel, denn claude.ai erreicht `localhost` nicht. Anschließend eine Anleitung für Benutzer als Hilfeseite in der App schreiben. Die Seite erklärt: Voraussetzungen (Claude-Konto mit Custom Connectors), das Hinzufügen in claude.ai bzw. der Desktop-App und in Claude Code, welche Daten Claude sehen kann und welche nicht (Tagebücher und Chat ausgeschlossen), sowie das Widerrufen des Zugriffs.
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
