# 011 – MCP: Schreibend

## Kontext & Ziel

Plan `002` baut einen **nur lesenden** Remote-MCP-Server (acht Werkzeuge, OAuth, Rechteschicht, Ausschlussliste, Hauptschalter, Welt-Freigabe). Dort ist festgelegt (D1), dass Schreiben als eigener Plan folgt, sobald das Lesen auf Produktion wie erwartet funktioniert. Dieser Plan ist dieser Folgeplan.

**Ziel dieses Plans:** Ein verbundener KI-Client (z. B. Claude) kann für den angemeldeten Benutzer Inhalte einer Welt **anlegen und ändern**, und zwar in denselben Bereichen, die er lesen kann, mit Ausnahme der hier gesperrten. Dabei gelten genau die Schreibrechte der App. **Gelöscht wird nie.** Neues startet mit `nur ich`. Bestehende Inhalte ändert der Client nur nach **ausdrücklicher Bestätigung** durch den Benutzer, mit Ausnahme leerer Artikel. Bilder werden über einen einmaligen Upload-Link hochgeladen.

Beispiele, die nach diesem Plan funktionieren:
- „Leg aus unserer Sitzung einen Artikel über Gräfin Mirelda an.“ Es entsteht ein `nur ich`-Artikel mit Erwähnungen. Unbekannte Namen werden wie in der App zu Stub-Artikeln.
- „Ergänze im Notizblock der Quest, was wir heute herausgefunden haben.“ Claude zeigt die Ergänzung, du bestätigst, und sie wird angehängt.
- „Setz Kapitel 3 auf abgeschlossen und veröffentliche es.“ Beide Schritte laufen nur mit Vorschau und Bestätigung.
- „Lade dieses Bild als Titelbild für Burg Rabenstein hoch.“ Claude erzeugt einen Upload-Link. Claude Code lädt selbst hoch, in claude.ai öffnest du den Link.

### Abgrenzung

- **Kein Löschen**, über kein Werkzeug (Plan `002` D1). Auch Relationen, Kapitel und Bilder werden nicht entfernt.
- **Nicht schreibbar:** Pins, Charakter-Marker, Monster-Marker, Karten und Kartenbilder (S2); **Charaktere** samt Bogen, Bio und Bildern (S3); Tagebuch und Chat (Plan `002` D9 X1/X2); Mitglieder, Rollen und Einladungslinks.
- **Keine Einstellungen**: Welt-Freigabe, Hauptschalter und verbundene Anwendungen bleiben der App vorbehalten.
- **Kein eigener Plan für Schreiben ohne Rechte:** Was ein Benutzer in der App nicht darf, darf er über MCP auch nicht. Ein Player kann damit praktisch nur den Notizblock sichtbarer Quests schreiben.
- Alle Ausschlüsse und Regeln aus Plan `002` (D1–D17) gelten weiter, soweit dieser Plan sie nicht ausdrücklich erweitert.

## Entscheidungen (Projektinhaber, 2026-09-25, beim Anlegen des Plans)

| # | Frage | Entscheidung |
|---|---|---|
| S1 | Scope | **Eigener Scope `worlds:write`**, getrennt von `worlds:read`. Schreibbar sind dieselben Bereiche wie lesbar (Plan `002`, Tabelle *MCP-Werkzeuge*), abzüglich S2/S3. Ein Benutzer kann einen Client weiterhin nur lesend verbinden. Die Zustimmungsseite zeigt „Lesen und Schreiben“, wenn `worlds:write` angefragt wird. |
| S2 | Pins | **Nicht schreibbar.** Pins sind über MCP nur Text ohne Koordinaten; Anlegen, Ändern und Relationen mit Pin als Quelle oder Ziel sind gesperrt. Ebenso Charakter- und Monster-Marker, Karten und Kartenbilder. |
| S3 | Charaktere | **Nicht schreibbar, Sperre analog zu Pins.** Kein Anlegen, kein Ändern von Bogen oder Bio, keine Bilder, keine Relationen mit Charakter als Quelle oder Ziel. **Ausnahme:** Quest-Beteiligte (Charakter-IDs an einer Quest) dürfen gesetzt werden, weil dabei die Quest geändert wird, nicht der Charakter. |
| S4 | Sichtbarkeit | **Nur auf ausdrücklichen Wunsch** über das Werkzeug `sichtbarkeit_setzen`, mit denselben Rechten wie in der App (u. a. `nur ich` setzt nur der Owner). Jede Sichtbarkeitsänderung braucht die Bestätigung nach S5. |
| S5 | Überschreibschutz | (1) **Stand-Prüfung:** Jede Änderung schickt den `stand` des zuletzt gelesenen Inhalts mit; weicht er ab, wird sie abgelehnt. (2) **Modus** für Rich-Text: `anhaengen` (Standard) oder `ersetzen`. (3) **Ausdrückliche Bestätigung** für jede Änderung an bestehendem Inhalt und jede Sichtbarkeitsänderung: Das Werkzeug liefert zuerst eine Änderungsvorschau und ein Bestätigungs-Token; erst `aenderung_bestaetigen` führt sie aus. **Ausnahme:** Änderungen an **leeren Artikeln** brauchen keine Bestätigung (Stand-Prüfung gilt trotzdem). |
| S6 | Welt-Freigabe | **An/aus gilt für beides.** Ist MCP für eine Welt freigegeben (Plan `002` D3), darf jeder Client mit `worlds:write` dort im Rahmen der Rechte des Benutzers schreiben. Kein eigener Schreib-Schalter. |
| S7 | Unbekannte Erwähnungen | **Stub-Artikel wie in der App**: Eine Erwähnung ohne passenden Inhalt legt einen leeren Artikel an (Owner = Benutzer, `nur ich`), sofern der Benutzer Artikel anlegen darf; sonst schlägt der Aufruf mit der Liste der unbekannten Erwähnungen fehl. Stubs werden in der Werkzeugantwort aufgeführt. Mehrdeutige Erwähnungen (mehrere sichtbare Treffer mit gleichem Titel) legen nichts an, sondern schlagen mit der Trefferliste fehl. |
| S8 | Neue Inhalte | Starten immer mit `nur ich` (Plan `002` D6), auch wenn der Aufruf etwas anderes verlangt. Owner ist der angemeldete Benutzer. |
| S9 | Bild-Upload | Übernommen aus Plan `002` D17: **einmaliger Upload-Link** statt Base64 im Werkzeugaufruf. Der Endpunkt bedient zwei Arten von Aufrufern: Menschen im Browser (`GET` zeigt eine Upload-Seite) und Programme/Agents (`POST` mit `multipart/form-data` **ohne Cookie**, Antwort JSON). Die Berechtigung steckt allein im Link. Ob ein Agent selbstständig hochlädt, hängt danach nur von seinen Fähigkeiten ab (Datei plus Netzwerkzugang, z. B. Claude Code per `curl -F`); sonst gibt er dem Benutzer den Link. Ziele: Welt-Titelbild, Artikel-Titelbild, Monster-Profilbild. Ersetzt der Upload ein vorhandenes Bild, braucht die Link-Erzeugung die Bestätigung nach S5. |

## Begriffe & Systeme

Begriffe aus Plan `002` gelten (MCP, Remote-MCP-Server, Werkzeug, OAuth, Scope, Zustimmungsseite, Rechteschicht, Testwelt, Demowelt, Audit-Log, Hauptschalter, Welt-Freigabe, Ausschlussliste X1–X11). Zusätzlich:

- **`worlds:write`**: OAuth-Scope für alle schreibenden Werkzeuge dieses Plans. Ein Token kann `worlds:read`, `worlds:write` oder beide tragen; die lesenden Werkzeuge aus Plan `002` verlangen weiter nur `worlds:read`.
- **Schreibwerkzeug**: MCP-Werkzeug dieses Plans. Deklariert `worlds:write` und die MCP-Werkzeug-Annotation `readOnlyHint: false`; Werkzeuge mit Bestätigungspflicht zusätzlich `destructiveHint: true`, damit Clients vor dem Ausführen nachfragen können.
- **Stand**: Opakes Token, das `inhalt_lesen` (Plan `002`) für jeden Inhalt ausgibt und jede Änderung mitschicken muss. Technisch aus `updated_at` des Datensatzes abgeleitet, beim Quest-Notizblock aus dessen bestehender `version`. Abweichender Stand → Werkzeugfehler „Inhalt wurde inzwischen geändert, bitte neu lesen“.
- **Modus**: Wie ein Rich-Text-Feld geändert wird. `anhaengen` (Standard) fügt den neuen Text als neue Absätze ans Ende an; `ersetzen` ersetzt den Text vollständig.
- **Bestätigungspflicht**: Jede Änderung an bestehendem Inhalt und jede Sichtbarkeitsänderung wird nicht sofort ausgeführt. Das Werkzeug liefert eine **Änderungsvorschau** und ein **Bestätigungs-Token**; ausgeführt wird erst mit `aenderung_bestaetigen`.
- **Änderungsvorschau**: Textuelle Zusammenfassung dessen, was sich ändert: betroffener Inhalt (Art, Titel), geänderte Felder mit altem und neuem Wert, bei Rich-Text der anzuhängende Text bzw. „ersetzt N Zeichen durch M Zeichen“ mit Anfang des neuen Textes, bei Sichtbarkeit alter → neuer Wert, neu entstehende Stubs.
- **Bestätigungs-Token**: Zufälliger Wert, in der Datenbank nur als Hash gespeichert, gebunden an Benutzer, OAuth-Client, Ziel (Art, ID), Stand und Hash der Änderung; 10 Minuten gültig, einmal einlösbar.
- **Leerer Artikel**: Artikel, dessen Text keinen Inhalt außer Leerzeichen hat und bei dem kein Vorlagenfeld gesetzt ist, geprüft beim Aufruf (z. B. ein Stub). Titeländerungen an einem leeren Artikel zählen ebenfalls als bestätigungsfrei.
- **Stub-Artikel**: Wie in der App (`createArticleStub` in `src/lib/domain/articles.ts`): Artikel ohne Vorlage und ohne Inhalt, der über eine Erwähnung entsteht. Stubs sind immer Artikel, nie Monster oder Quests.
- **Erwähnungssyntax (Markdown)**: `@[Titel](art:id)` für eine Erwähnung mit bekanntem Ziel (`art` nach Plan `002` D14, z. B. `@[Burg Rabenstein](artikel:a-52e0…)`); `@[Titel]` ohne Ziel wird über den Titel aufgelöst (exakt, ohne Groß-/Kleinschreibung, unter den für den Benutzer sichtbaren und erwähnbaren Inhalten), sonst S7. Dieselbe Syntax gibt `inhalt_lesen` aus (Plan `002` D18), damit Gelesenes unverändert zurückgeschrieben werden kann.
- **Markdown → TipTap**: Umwandlung von Markdown in TipTap-JSON, beschränkt auf die in ADR-004 erlaubten Formatierungen (Überschriften 2/3, fett, kursiv, unterstrichen, durchgestrichen, Aufzählung, nummerierte Liste, Zitat, Trennlinie, externer Link, Erwähnung). Das Ergebnis läuft immer durch `sanitizeRichDoc`. Nicht Erlaubtes (z. B. Bilder, Tabellen, Code) wird wie beim Einfügen in der App verworfen; der übrige Text bleibt.
- **Upload-Ticket / Upload-Link**: Einmaliger Datensatz, gebunden an Benutzer, Welt und Ziel (Art, ID, Bildart), 15 Minuten gültig, einmal einlösbar, nur als Hash gespeichert. Der Upload-Link enthält das Ticket im Pfad, z. B. `https://worldcraft.lagolago.at/upload/<ticket>`.
- **Herkunft MCP**: Kennzeichnung im Audit-Log, dass ein Datensatz über MCP angelegt oder geändert wurde, mit Werkzeug, Client-ID, Ziel-Art und Ziel-ID.

### Schreibwerkzeuge (Umfang dieses Plans)

Alle Werkzeuge verlangen `worlds:write`, laufen über die Rechteschicht, prüfen Hauptschalter, Welt-Freigabe (S6) und Allowlist (Plan `002` D13) und nutzen den Welt-Parameter nach Plan `002` D7/D14. Parameternamen und Werte sind deutsch (Plan `002` D14).

| Werkzeug | Eingabe | Wirkung / Ausgabe | Bestätigung |
|---|---|---|---|
| `inhalt_anlegen` | `welt`, `art` (artikel / quest / kapitel / monster / universum), `felder` (je Art, siehe unten) | Legt den Inhalt mit `nur ich` an (S8). Ausgabe: Art, ID, Titel, Stand, Sichtbarkeit, neu angelegte Stubs. | nein |
| `inhalt_aendern` | `welt`, `art` (artikel / quest / kapitel / notizblock / monster / universum / welt), `id` (bei `notizblock` die Quest-ID), `stand`, `felder` (nur zu ändernde), optional `modus` (anhaengen / ersetzen, Standard anhaengen) | Bei leerem Artikel: sofort ausgeführt, Ausgabe wie `inhalt_anlegen`. Sonst: Änderungsvorschau und Bestätigungs-Token, nichts wird geändert. | ja, außer leerer Artikel |
| `relation_anlegen` | `welt`, `quelle` (art, id), `ziel` (art, id), `bezeichnung`, optional `gegenbezeichnung` | Manuelle Relation wie in der App (nur Spielleitung). Quelle und Ziel: artikel / quest / monster / universum; nie pin oder charakter (S2/S3). | nein |
| `sichtbarkeit_setzen` | `welt`, `art` (artikel / quest / kapitel / monster / universum), `id`, `stand`, `sichtbarkeit` (nur ich / nur Spielleitung / veröffentlicht; bei universum nur die letzten beiden) | Änderungsvorschau und Bestätigungs-Token. Werkzeugbeschreibung: nur auf ausdrückliche Anweisung des Benutzers verwenden. | immer |
| `aenderung_bestaetigen` | `token` | Führt die bestätigte Änderung aus, nachdem Stand, Rechte, Schalter und Allowlist erneut geprüft wurden. Ausgabe: Ergebnis wie `inhalt_aendern` bzw. der Upload-Link. | – |
| `bild_hochladen` | `welt`, `ziel` (welt / artikel / monster), `id` | Liefert einen Upload-Link (S9) mit Gültigkeit und Hinweis zur Nutzung (Browser oder `curl -F "datei=@<pfad>" <link>`). Hat das Ziel schon ein Bild: zuerst Vorschau und Bestätigungs-Token. | nur beim Ersetzen |

**Felder je Art** (Anlegen; beim Ändern dieselben Felder, jeweils optional):

- **artikel**: `titel`, `vorlagentyp` (person / ort / organisation / gegenstand / rasse / ohne), `vorlagenfelder` (Schlüssel = deutsches Label bzw. Feldschlüssel laut Registry, Werte als deutsche Labels; Verweise in Erwähnungssyntax; Ja/Nein-Felder wie Quest-Gegenstand als `true`/`false`), `text` (Markdown). Der Vorlagentyp ist beim Ändern wie in der App wechselbar (tolerante Übernahme passender Felder).
- **quest**: `titel`, `status` (offen / aktiv / abgeschlossen / gescheitert), `beschreibung` (Markdown), `beteiligte` (Liste von Charakter-IDs in die Welt mitgebrachter Charaktere).
- **kapitel**: `quest_id` (nur beim Anlegen), `titel`, `status`, `text` (Markdown), optional `position` (1…n; Standard: ans Ende).
- **notizblock** (nur Ändern): `text` (Markdown). Schreiben dürfen alle, die die Quest sehen; Erwähnungen erzeugen keine Relationen (wie in der App).
- **monster**: `name`, `monster_art`, `seltenheit`, `boss`, `gefahr`, `groesse`, `lebensraum` (Verweise auf Ort-Artikel in Erwähnungssyntax), `charakterblatt` (Attribute, Übungsbonus, Fertigkeiten mit Übungsgrad, Fähigkeiten, Persönlichkeit; Struktur wie die App-API), `bio` (Markdown mit Erwähnungen).
- **universum**: `name`, `beschreibung` (Markdown).
- **welt** (nur Ändern, nur Game Master): `name`, `beschreibung` (Markdown **ohne** Erwähnungen, wie in der App).

## Relevante Normen

- `.ai/feature-tasks/002-mcp-server.md` — Entscheidungen D1–D18, Werkzeuge, Ausschlussliste D9, Testwelt T-002, Demowelt T-014.
- `.ai/decisions/005-mcp-server.md` (entsteht in Plan `002` T-001) — SDK, OAuth, Scope-Modell, Anbindung an die Rechteschicht, Grundlagen für Schreiben (Punkt 7).
- `.ai/architecture/mcp.md` (entsteht in Plan `002` T-011) — Checkliste „Neues MCP-Werkzeug hinzufügen“.
- `.ai/architecture/datenmodell-fachlich.md` — 2.2 Sichtbarkeit, 2.3 Rich-Text, 2.4 Erwähnungen, 3.x Entitäten, 5 Rechte je Entität.
- `.ai/architecture/datenmodell.md` — Tabellen, Vorlagen-Registry, Regeln `APP-*`.
- `.ai/decisions/004-editor.md` — erlaubte Formatierungen, `sanitizeRichDoc`.
- `.ai/standards/erwaehnungen.md` — Erwähnungen, Stub-Artikel.
- `.ai/conventions.md` — UI Deutsch, Code Englisch; Tests und `npm run lint` vor jedem Commit.
- `.ai/infrastructure/deployment.md` — Umgebungsvariablen, Upload-Volume.
- `.ai/roadmap.md` — Arbeitsweise (Commit pro Task, nie automatisch pushen).

## Globale Abhängigkeiten

- **Plan `002` abgeschlossen und auf Produktion**, und das Lesen funktioniert dort wie erwartet (Plan `002` D1). Insbesondere: ADR-005, OAuth-Autorisierungsserver, `/mcp` mit Token-Prüfung, Hauptschalter und Welt-Freigabe, Audit-Log und Aufruflimit, Testwelt und Demowelt-Skript, TipTap → Markdown.
- **Plan `002` D18** umgesetzt: `inhalt_lesen` gibt Erwähnungen in der Erwähnungssyntax und für jeden Inhalt den Stand aus.
- Domänenfunktionen der App zum Anlegen und Ändern (`src/lib/domain/*`, u. a. `createArticle`, `updateArticle`, `createArticleStub`, `createQuest`, `updateQuest`, Kapitel, Notizblock, Monster, Universen, Relationen, Welt) sowie der bestehende Datei-Upload (`src/app/api/files/route.ts`).

## Aufgaben

### T-001: Schreibarchitektur entscheiden (ADR-005 fortschreiben)
- [ ] Beschreibung: ADR-005 um einen Abschnitt „Schreiben“ ergänzen (oder ADR-006 anlegen, falls ADR-005 dadurch unübersichtlich wird; Entscheidung im ADR begründen). Festzuhalten, jeweils mit genau einer Entscheidung und Begründung:
  1. **Scope `worlds:write`** (S1): Deklaration an den Werkzeugen, Anzeige auf der Zustimmungsseite, Verhalten bei bestehenden Zustimmungen nur mit `worlds:read` (erneute Zustimmung nötig, keine stille Erweiterung).
  2. **Bestätigungsablauf** (S5): Tabelle für Bestätigungs-Tokens, Bindung (Benutzer, Client, Ziel, Stand, Änderungs-Hash), 10 Minuten Gültigkeit, einmalige Einlösung, Aufräumen abgelaufener Tokens.
  3. **Client-Unterstützung für Nachfragen**: anhand der aktuellen Dokumentation (Quellenlink mit Abrufdatum) prüfen, ob claude.ai, die Desktop-App und Claude Code die Werkzeug-Annotationen `destructiveHint`/`readOnlyHint` für Rückfragen nutzen und ob sie MCP-Elicitation (Rückfrage des Servers an den Benutzer) unterstützen. Entscheiden, ob Elicitation **zusätzlich** zum Bestätigungs-Token genutzt wird, wo verfügbar. Das Bestätigungs-Token bleibt in jedem Fall Pflicht.
  4. **Markdown → TipTap**: Bibliothek oder Eigenbau, Abbildung der erlaubten Formatierungen, Auflösung der Erwähnungssyntax, Anbindung an `sanitizeRichDoc`.
  5. **Stand**: Ableitung aus `updated_at` bzw. Notizblock-`version`, Format (opak), Prüfung atomar mit dem Schreiben (kein Zeitfenster zwischen Prüfung und Update).
  6. **Upload-Tickets und Upload-Endpunkt** (S9): Tabelle, Pfad, Schutz gegen Missbrauch (Größen- und Typprüfung wie `src/app/api/files/route.ts`, kein CSRF-Risiko, weil ohne Cookie, Aufruflimit).
  7. **Audit-Log**: Erweiterung um Ziel-Art, Ziel-ID, „bestätigt ja/nein“ und Herkunft MCP, weiterhin ohne Inhalte.
- Abhängigkeiten: keine innerhalb dieses Plans (siehe Globale Abhängigkeiten)
- Abnahmekriterium: Das ADR enthält die Punkte 1–7 mit je genau einer Entscheidung und Begründung; Punkt 3 enthält mindestens einen Quellenlink mit Abrufdatum und eine Tabelle „Client → Annotationen / Elicitation unterstützt ja/nein“.

### T-002: Markdown → TipTap mit Erwähnungen
- [ ] Beschreibung: Umwandlung nach *Begriffe* als reine Funktion in `src/lib/editor/` (bzw. laut ADR). Eingabe: Markdown, Modus „mit Erwähnungen“ / „ohne Erwähnungen“. Ausgabe: TipTap-JSON plus Liste der aufzulösenden Erwähnungen. Die Auflösung (`@[Titel](art:id)` prüfen, `@[Titel]` über den Titel suchen, S7 Stubs) geschieht in einer eigenen Funktion mit Benutzerkontext über die Rechteschicht. Rundreise mit der Umwandlung TipTap → Markdown aus Plan `002` sicherstellen.
- Abhängigkeiten: T-001
- Abnahmekriterium: Unit-Tests: (1) Jede erlaubte Formatierung aus ADR-004 wird korrekt umgewandelt. (2) Bilder, Tabellen und Codeblöcke werden verworfen, der übrige Text bleibt. (3) Rundreise: Für jeden Rich-Text der Testwelt ergibt TipTap → Markdown → TipTap ein nach `sanitizeRichDoc` identisches Dokument. (4) `@[Titel](artikel:<id>)` eines unsichtbaren Artikels schlägt fehl, ohne zu verraten, ob er existiert. (5) `@[Neuer Name]` legt für die Spielleitung einen Stub an und liefert ihn in der Stub-Liste; für einen Player schlägt es fehl. (6) Zwei sichtbare Artikel gleichen Titels → Fehler mit beiden Treffern. (7) Im Modus „ohne Erwähnungen“ (Weltbeschreibung) wird jede Erwähnung abgelehnt.

### T-003: Scope `worlds:write` im OAuth-Autorisierungsserver
- [ ] Beschreibung: Scope nach T-001 Punkt 1 einführen: Metadaten (`scopes_supported`), Zustimmungsseite („Lesen und Schreiben auf deine Welten; Tagebücher, Chat, Karten, Pins und Charaktere sind vom Schreiben ausgeschlossen; gelöscht wird nie“), Seite „Verbundene Anwendungen“ zeigt die erteilten Scopes, Token-Prüfung am `/mcp`-Endpunkt je Werkzeug.
- Abhängigkeiten: T-001
- Abnahmekriterium: (1) `/.well-known/oauth-authorization-server` listet `worlds:read` und `worlds:write`. (2) Ein Token nur mit `worlds:read` erhält bei jedem Schreibwerkzeug einen Autorisierungsfehler, bei den Lesewerkzeugen nicht. (3) Ein Token nur mit `worlds:write` erhält bei den Lesewerkzeugen einen Autorisierungsfehler. (4) Eine bestehende Zustimmung nur für `worlds:read` wird bei Anfrage von `worlds:write` nicht still erweitert, sondern zeigt die Zustimmungsseite erneut. (5) „Verbundene Anwendungen“ zeigt die Scopes je Zustimmung.

### T-004: Bestätigungsablauf und `aenderung_bestaetigen`
- [ ] Beschreibung: Tabelle und Logik für Bestätigungs-Tokens nach T-001 Punkt 2; gemeinsame Hilfsfunktion, mit der Schreibwerkzeuge eine Änderung als „vorzumerken“ beschreiben (Ziel, Stand, Änderung) und eine Änderungsvorschau plus Token zurückgeben; Werkzeug `aenderung_bestaetigen`, das Token prüft, alle Prüfungen erneut ausführt (Rechte, Schalter, Allowlist, Stand) und die vorgemerkte Änderung ausführt. Täglicher Aufräumlauf für abgelaufene Tokens (wie Audit-Log-Löschjob aus Plan `002` T-009).
- Abhängigkeiten: T-001, T-003
- Abnahmekriterium: Automatisierte Tests: (1) Ein Token ist genau einmal einlösbar. (2) Nach 10 Minuten ist es ungültig. (3) Ein Token eines anderen Benutzers oder Clients wird abgelehnt. (4) Hat sich der Stand zwischen Vorschau und Bestätigung geändert, wird nichts geändert, und der Fehler fordert zum Neulesen auf. (5) Verliert der Benutzer zwischen Vorschau und Bestätigung das Recht (z. B. Rolle Player statt Master, Welt-Freigabe aus, ID nicht mehr auf der Allowlist), wird nichts geändert. (6) In der Datenbank liegt kein Token im Klartext.

### T-005: Werkzeug `inhalt_anlegen`
- [ ] Beschreibung: Werkzeug nach Tabelle *Schreibwerkzeuge* für artikel, quest, kapitel, monster, universum. Felder per Schema validieren (Werte nach Plan `002` D14 auf DB-Schlüssel abbilden); Rich-Text über T-002; Anlegen ausschließlich über die Domänenfunktionen der App; Sichtbarkeit immer `nur ich` (S8), eine übergebene Sichtbarkeit wird ignoriert und in der Antwort erwähnt. Werkzeugbeschreibung auf Deutsch: wann nutzen, dass neue Inhalte nur für den Benutzer sichtbar starten, Erwähnungssyntax.
- Abhängigkeiten: T-002, T-003
- Abnahmekriterium: Automatisierte Tests gegen die Testwelt (Plan `002` T-002): (1) Der Game Master legt je Art einen Inhalt an; alle sind `nur ich`, Owner ist der Game Master, und sie erscheinen in `inhalt_lesen` für ihn, nicht für den Master. (2) Ein Artikel mit Vorlage Person und Verweis `race` erzeugt die Relation mit Herkunft Vorlagenfeld. (3) Ein Text mit `@[Gräfin Mirelda]` ohne passenden Artikel legt einen Stub an und nennt ihn in der Antwort. (4) Ein Player erhält bei jeder Art einen Rechtefehler. (5) `art: pin` und `art: charakter` werden vom Schema abgelehnt. (6) Ein Kapitel an einer für den Benutzer unsichtbaren Quest schlägt mit „nicht gefunden“ fehl.

### T-006: Werkzeug `inhalt_aendern`
- [ ] Beschreibung: Werkzeug nach Tabelle *Schreibwerkzeuge* für artikel, quest, kapitel, notizblock, monster, universum, welt. Stand-Prüfung, Modus `anhaengen`/`ersetzen` für Rich-Text-Felder, leerer Artikel nach *Begriffe* → sofort ausführen, sonst Vorschau und Token über T-004. Notizblock nutzt die bestehende Versionsprüfung aus `src/lib/domain/quest-notes.ts`. Welt nur für den Game Master, Beschreibung ohne Erwähnungen. `inhalt_lesen` aus Plan `002` liefert den Stand (D18).
- Abhängigkeiten: T-002, T-004
- Abnahmekriterium: Automatisierte Tests: (1) Änderung an einem nicht leeren Artikel ändert nichts, sondern liefert Vorschau (alter/neuer Wert der geänderten Felder) und Token; nach `aenderung_bestaetigen` ist sie ausgeführt. (2) Änderung an einem Stub-Artikel wird ohne Bestätigung sofort ausgeführt. (3) `modus` fehlt → Text wird angehängt, bestehender Text bleibt vollständig erhalten. (4) Veralteter Stand → Fehler, nichts geändert. (5) Ein Player kann den Notizblock einer sichtbaren Quest nach Bestätigung ergänzen, aber weder Quest noch Kapitel ändern. (6) Master ändert die Weltbeschreibung → Rechtefehler; Game Master mit Erwähnung darin → Fehler. (7) Ein `nur ich`-Artikel eines anderen Benutzers ist auch für den Game Master „nicht gefunden“.

### T-007: Werkzeuge `relation_anlegen` und `sichtbarkeit_setzen`
- [ ] Beschreibung: Beide Werkzeuge nach Tabelle *Schreibwerkzeuge*. `relation_anlegen` über die Domänenfunktion für manuelle Relationen (nur Spielleitung, Quelle und Ziel müssen sichtbar sein; pin und charakter gesperrt). `sichtbarkeit_setzen` immer über T-004, Rechte wie in der App (`nur ich` nur Owner; Universen zweistufig). Beschreibung von `sichtbarkeit_setzen`: nur auf ausdrückliche Anweisung des Benutzers verwenden und vorher die Folgen nennen (wer den Inhalt danach sieht).
- Abhängigkeiten: T-004, T-005
- Abnahmekriterium: Automatisierte Tests: (1) Manuelle Relation Artikel → Quest mit Bezeichnung und Gegenbezeichnung erscheint in `relationen_abrufen` beider Seiten. (2) Relation mit `pin` oder `charakter` als Quelle oder Ziel → Schema-Fehler. (3) Player → Rechtefehler. (4) `sichtbarkeit_setzen` ändert ohne Bestätigung nichts; nach Bestätigung ist der Inhalt veröffentlicht und für Player A sichtbar. (5) Master setzt einen fremden Artikel auf `nur ich` → Rechtefehler. (6) Universum auf `nur ich` → Schema-Fehler.

### T-008: Upload-Link und `bild_hochladen`
- [ ] Beschreibung: Upload-Tickets nach T-001 Punkt 6; Werkzeug `bild_hochladen` nach Tabelle *Schreibwerkzeuge* (Ziele welt, artikel, monster; Ersetzen nur nach Bestätigung über T-004); Endpunkt unter dem Upload-Link mit zwei Arten von Aufrufern (S9): `GET` liefert eine schlichte, mobilfreundliche Upload-Seite (Ziel, Ablaufzeit, Dateiauswahl, Hinweis auf erlaubte Typen und Größen); `POST` mit `multipart/form-data` ohne Cookie speichert die Datei über dieselbe Prüfung wie `src/app/api/files/route.ts` und setzt sie als Bild des Ziels; Antwort JSON für Programme, Erfolgsseite für den Browser. Beim Einlösen erneut prüfen: Ticket gültig, Rechte, Welt-Freigabe, Hauptschalter, Allowlist.
- Abhängigkeiten: T-004
- Abnahmekriterium: Automatisierte Tests: (1) `bild_hochladen` für einen Artikel ohne Titelbild liefert sofort einen Link; `curl -F "datei=@bild.png" <link>` setzt das Titelbild und antwortet mit JSON. (2) Der Link ist nach einmaliger Nutzung und nach 15 Minuten ungültig (404 ohne Hinweis, ob er je existierte). (3) Ein vorhandenes Titelbild wird erst nach Bestätigung ersetzt. (4) Falscher Dateityp oder zu große Datei → 400 mit verständlicher Meldung, Ticket bleibt bis zum Ablauf nutzbar. (5) `ziel: karte` oder `ziel: charakter` → Schema-Fehler. (6) Manuell: Link im Handy-Browser öffnen, Bild wählen, hochladen → Titelbild in der App sichtbar.

### T-009: Audit-Log und Aufruflimit für Schreiben
- [ ] Beschreibung: Audit-Log aus Plan `002` T-009 nach T-001 Punkt 7 erweitern (Ziel-Art, Ziel-ID, bestätigt ja/nein, Herkunft MCP) für alle Schreibwerkzeuge, `aenderung_bestaetigen` und das Einlösen von Upload-Links; weiterhin **ohne** Inhalte, Titel oder Suchbegriffe. Schreibwerkzeuge zählen in dasselbe Aufruflimit (60 pro Minute und Benutzer); Upload-Einlösungen zusätzlich höchstens 10 pro Minute und Ticket-Besitzer.
- Abhängigkeiten: T-005, T-006, T-007, T-008
- Abnahmekriterium: (1) Nach Anlegen, Vorschau, Bestätigung und Upload existiert je ein Audit-Eintrag mit den genannten Feldern. (2) Der Titel und Text der angelegten Inhalte kommen im Audit-Log nicht vor. (3) Der 11. Upload innerhalb einer Minute erhält 429 mit `Retry-After`.

### T-010: Testwelt, Rechte- und Ausschlusstests
- [ ] Beschreibung: Testwelt (Plan `002` T-002) um einen leeren Stub-Artikel und einen Artikel mit Text ergänzen, falls nicht vorhanden. Testsuite nach dem Muster von Plan `002` T-008: jedes Schreibwerkzeug mit jedem der vier Testbenutzer, gegen die Rechtematrix (`datenmodell-fachlich.md` §5) und diesen Plan.
- Abhängigkeiten: T-005, T-006, T-007, T-008
- Abnahmekriterium: Die Suite läuft lokal mit einem Befehl und ist grün. Sie belegt mindestens: (1) Kein Werkzeug löscht etwas (Anzahl der Datensätze je Tabelle sinkt über die gesamte Suite nie). (2) Pins, Charaktere, Charakter- und Monster-Marker, Karten, Tagebuch, Chat, Mitglieder und Einladungen bleiben nach der Suite unverändert (Vergleich von Prüfsummen vorher/nachher). (3) Jede Änderung an bestehendem, nicht leerem Inhalt und jede Sichtbarkeitsänderung ist ohne `aenderung_bestaetigen` wirkungslos. (4) Alle neu angelegten Inhalte sind `nur ich`. (5) In einer Welt ohne MCP-Freigabe schreibt kein Werkzeug. (6) Ein Token ohne `worlds:write` schreibt nicht.

### T-011: Ende-zu-Ende-Test und Hilfeseite
- [ ] Beschreibung: Auf Produktion mit der Demowelt (Plan `002` T-014, D16) als Projektinhaber in claude.ai **und** Claude Code testen. Die Hilfeseite aus Plan `002` T-010 um Schreiben ergänzen: was Claude anlegen und ändern darf und was nicht, warum Änderungen eine Bestätigung brauchen, dass neue Inhalte `nur ich` starten, wie der Upload-Link funktioniert (selbstständig mit Claude Code, im Browser bei claude.ai), dass nie etwas gelöscht wird.
- Abhängigkeiten: T-009, T-010
- Abnahmekriterium: Protokoll in `.ai/infrastructure/mcp-e2e-test.md` (neuer Abschnitt „Schreiben“) für beide Clients: (1) „Leg einen Artikel über Gräfin Mirelda an, sie ist mit der Gilde der Raben verfeindet.“ → Artikel `nur ich` mit Erwähnung, ggf. Stub, in der App sichtbar. (2) „Ergänze im Notizblock der Quest …“ → Claude zeigt die Vorschau und führt erst nach deiner Bestätigung aus. (3) „Veröffentliche den Artikel.“ → nur nach Bestätigung. (4) „Lösche den Artikel.“ → Claude erklärt, dass es nicht löschen kann. (5) „Lade `rabenstein.png` als Titelbild hoch.“ → in Claude Code selbstständig per Upload-Link; in claude.ai Link, Upload im Browser. Die Hilfeseite enthält alle genannten Punkte.

### T-012: Normen und Features-Katalog
- [ ] Beschreibung: `.ai/architecture/mcp.md` um Schreiben ergänzen (Bestätigungsablauf als Mermaid-Sequenzdiagramm, Upload-Link, Scopes); Checkliste „Neues MCP-Werkzeug hinzufügen“ um Schreibregeln erweitern (Scope, Bestätigungspflicht, kein Löschen, `nur ich`, Audit); `.ai/architecture/datenmodell.md` um die Tabellen für Bestätigungs-Tokens und Upload-Tickets; `.ai/features.md` um die Schreibwerkzeuge; `.ai/roadmap.md` Status.
- Abhängigkeiten: T-011
- Abnahmekriterium: Die genannten Dokumente enthalten die Inhalte; das Sequenzdiagramm rendert in einer Markdown-Vorschau fehlerfrei; `features.md` führt die sechs Schreibwerkzeuge mit Status.
