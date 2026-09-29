# MCP E2E-Test – Produktion

**Datum:** 2026-09-28
**Produktionsadresse:** `https://worldcraft.lagolago.at/mcp`
**Demowelt:** `MCP-Demo`

Keine Zugangsdaten, Sitzungs-Cookies oder Tokens sind in diesem Protokoll enthalten.

## Demowelt-Erstellung

Die Demowelt `MCP-Demo` wurde vor diesem E2E-Test erfolgreich auf Produktion erstellt und ist die Grundlage der folgenden Prüfungen.

## claude.ai

| # | Frage / Prüffall | Aufgerufene Werkzeuge | Ergebnis | Notiz |
|---|---|---|---|---|
| 1 | Welche Inhalte sind mit Burg Rabenstein verknüpft? | `welten_auflisten`, `suchen` (rekursiv) | bestanden mit Abweichung | `relationen_abrufen` wurde nicht aufgerufen; Vollständigkeit der Relationen der Tiefe 1 nicht belegt. Abweichung akzeptiert (CR-003). |
| 2 | Welche Quests sind gerade aktiv? | `quests_auflisten` | bestanden mit Abweichung | Claude nannte Quests beider Welten statt nur der Demowelt. Abweichung akzeptiert (CR-003). |
| 3 | Was steht in meinem Tagebuch? | `suchen` | bestanden | Keine Tagebuchinhalte über MCP gefunden. |
| 4 | Welche Quest-Gegenstände gibt es? | `inhalte_auflisten` | bestanden | Der erste Aufruf verwendete direkt die Filter `art: artikel`, `vorlagentyp: gegenstand` und `quest_gegenstand: true` und lieferte genau den Quest-Gegenstand der Demowelt. |
| 5 | Beschreibe das Titelbild von Burg Rabenstein. | `bild_lesen`, danach alternativ `suchen` (Charakter) und `bild_lesen` mit ID | nicht bestanden – akzeptiert | Das Titelbild der Demowelt ist ein beschädigtes PNG (`vipspng: libpng read error`), `bild_lesen` meldete fälschlich „Bild zu groß für die Ausgabe.“ (Fehlerklassifizierung: CR-001). Die Demowelt wird bewusst nicht repariert (CR-002 verworfen). Ersatzweise wurde ein Charakterbild erfolgreich beschrieben. |

## Claude Code

Der Ablauf und die Ergebnisse entsprechen laut Testergebnis dem Test in claude.ai.

| # | Aufgerufene Werkzeuge | Ergebnis | Notiz |
|---|---|---|---|
| 1 | `welten_auflisten`, `suchen` (rekursiv) | bestanden mit Abweichung | `relationen_abrufen` wurde nicht aufgerufen; Vollständigkeit der Relationen der Tiefe 1 nicht belegt. Abweichung akzeptiert (CR-003). |
| 2 | `quests_auflisten` | bestanden mit Abweichung | Claude nannte Quests beider Welten statt nur der Demowelt. Abweichung akzeptiert (CR-003). |
| 3 | `suchen` | bestanden | Keine Tagebuchinhalte über MCP gefunden. |
| 4 | `inhalte_auflisten` | bestanden | Der erste Aufruf verwendete direkt die Filter `art: artikel`, `vorlagentyp: gegenstand` und `quest_gegenstand: true` und lieferte genau den Quest-Gegenstand der Demowelt. |
| 5 | `bild_lesen`, danach alternativ `suchen` (Charakter) und `bild_lesen` mit ID | nicht bestanden – akzeptiert | Das Titelbild der Demowelt ist ein beschädigtes PNG (`vipspng: libpng read error`), `bild_lesen` meldete fälschlich „Bild zu groß für die Ausgabe.“ (Fehlerklassifizierung: CR-001). Die Demowelt wird bewusst nicht repariert (CR-002 verworfen). Ersatzweise wurde ein Charakterbild erfolgreich beschrieben. |

## Gesamtbewertung (Lesen)

Die Verbindung funktioniert in beiden Clients. Die Gesamtbewertung lautet: **bestanden mit akzeptierten Abweichungen (Fälle 1, 2, 5)**. Details stehen in den jeweiligen Fällen.

## Schreiben

**Status: E2E-Lauf 1 in claude.ai am 2026-09-29 durchgeführt; Claude Code ausstehend** (Plan `011` T-011, Nacharbeit in Plan `012`).
Protokollvorlage für beide Clients; Ergebnisse und Notizen nach dem Prod-Lauf eintragen.

### claude.ai

| # | Frage / Prüffall | Aufgerufene Werkzeuge | Ergebnis | Notiz |
|---|---|---|---|---|
| 1 | „Leg einen Artikel über Gräfin Mirelda an, sie ist mit der Gilde der Raben verfeindet.“ → Claude prüft Namen per `suchen`; für neue Namen zeigt es geplante Stubs und legt Artikel und Stubs erst nach Bestätigung an; Ergebnis `nur ich` mit Erwähnungen in der App sichtbar. | `welten_auflisten` → `suchen` → Rückfrage zur Welt und zum Anlageort der Gilde → `inhalt_lesen` → `inhalt_anlegen` → `relation_anlegen` → `sichtbarkeit_setzen` | **bestanden** | Artikel und Gilde angelegt, Relation erstellt und Sichtbarkeit auf `nur ich` gesetzt. |
| 2 | „Ergänze im Notizblock der Quest …“ → Claude zeigt die Vorschau und führt erst nach Bestätigung aus. | `inhalt_aendern` (zuerst mit `felder.inhalt`, dann mit `felder.text`) → `aenderung_bestaetigen` | **teilweise bestanden** | (A) Der erste Versuch mit `felder.inhalt` scheiterte; `felder.text` funktionierte. (B) Die Bestätigung wurde mit Token angefragt, ohne dass der Chat zeigte, was sich ändert und was vorher stand. Nacharbeit: Plan `012` T-004, T-005 und T-007. |
| 3 | „Veröffentliche den Artikel.“ → nur nach Bestätigung. | `sichtbarkeit_setzen` → `aenderung_bestaetigen` → `inhalt_lesen` | **bestanden** | Sichtbarkeit erfolgreich gesetzt und anschließend gelesen. |
| 4 | „Lösche den Artikel.“ → Claude erklärt, dass es nicht löschen kann. | kein Schreibwerkzeug aufgerufen | **bestanden** | Claude hat das Löschen abgelehnt. |
| 5 | „Lade `rabenstein.png` als Titelbild hoch.“ → Link; Upload im Browser. | `bild_hochladen` | **bestanden** | Upload-Link im Browser geöffnet; für den aktuellen Umfang ausreichend. Verbesserungen folgen als Roadmap-Eintrag. |
| F-Seltenheit | Seltenheit eines Gegenstand-Artikels setzen. | `inhalt_aendern` mit `seltenheit` bzw. `vorlagendaten.seltenheit` | **fehlgeschlagen** | Die Werte wurden still nicht gespeichert bzw. die Anfrage schlug allgemein fehl. Korrekt wäre `felder: { vorlagenfelder: { "Seltenheit": "Gewöhnlich" } }`; dieser Schlüssel war für Claude nicht erkennbar. Nacharbeit: Plan `012`. |
| 6 | „Lege ein Kapitel mit Status aktiv an Position 1 an und ändere es direkt danach mit dem gemeldeten Stand.“ → Die Änderungsvorschau erscheint ohne Stand-Fehler. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |

### Claude Code

| # | Frage / Prüffall | Aufgerufene Werkzeuge | Ergebnis | Notiz |
|---|---|---|---|---|
| 1 | „Leg einen Artikel über Gräfin Mirelda an, sie ist mit der Gilde der Raben verfeindet.“ → Claude prüft Namen per `suchen`; für neue Namen zeigt es geplante Stubs und legt Artikel und Stubs erst nach Bestätigung an; Ergebnis `nur ich` mit Erwähnungen in der App sichtbar. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 2 | „Ergänze im Notizblock der Quest …“ → Claude zeigt die Vorschau und führt erst nach Bestätigung aus. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 3 | „Veröffentliche den Artikel.“ → nur nach Bestätigung. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 4 | „Lösche den Artikel.“ → Claude erklärt, dass es nicht löschen kann. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 5 | „Lade `rabenstein.png` als Titelbild hoch.“ → selbstständig per Upload-Link. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 6 | „Lege ein Kapitel mit Status aktiv an Position 1 an und ändere es direkt danach mit dem gemeldeten Stand.“ → Die Änderungsvorschau erscheint ohne Stand-Fehler. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |

### Gesamtbewertung (Schreiben)

**Lauf 1 (claude.ai, 2026-09-29): 4 bestanden, 1 teilweise; Nacharbeit in Plan `012`.** Claude Code ist weiterhin ausstehend.
