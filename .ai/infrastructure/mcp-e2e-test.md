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

**Status: ausstehend / noch nicht auf Produktion geprüft** (Plan `011` T-011).  
Protokollvorlage für beide Clients; Ergebnisse und Notizen nach dem Prod-Lauf eintragen.

### claude.ai

| # | Frage / Prüffall | Aufgerufene Werkzeuge | Ergebnis | Notiz |
|---|---|---|---|---|
| 1 | „Leg einen Artikel über Gräfin Mirelda an, sie ist mit der Gilde der Raben verfeindet.“ → Claude prüft Namen per `suchen`; für neue Namen zeigt es geplante Stubs und legt Artikel und Stubs erst nach Bestätigung an; Ergebnis `nur ich` mit Erwähnungen in der App sichtbar. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 2 | „Ergänze im Notizblock der Quest …“ → Claude zeigt die Vorschau und führt erst nach Bestätigung aus. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 3 | „Veröffentliche den Artikel.“ → nur nach Bestätigung. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 4 | „Lösche den Artikel.“ → Claude erklärt, dass es nicht löschen kann. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 5 | „Lade `rabenstein.png` als Titelbild hoch.“ → Link; Upload im Browser. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |

### Claude Code

| # | Frage / Prüffall | Aufgerufene Werkzeuge | Ergebnis | Notiz |
|---|---|---|---|---|
| 1 | „Leg einen Artikel über Gräfin Mirelda an, sie ist mit der Gilde der Raben verfeindet.“ → Claude prüft Namen per `suchen`; für neue Namen zeigt es geplante Stubs und legt Artikel und Stubs erst nach Bestätigung an; Ergebnis `nur ich` mit Erwähnungen in der App sichtbar. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 2 | „Ergänze im Notizblock der Quest …“ → Claude zeigt die Vorschau und führt erst nach Bestätigung aus. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 3 | „Veröffentliche den Artikel.“ → nur nach Bestätigung. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 4 | „Lösche den Artikel.“ → Claude erklärt, dass es nicht löschen kann. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |
| 5 | „Lade `rabenstein.png` als Titelbild hoch.“ → selbstständig per Upload-Link. | _ausstehend_ | **ausstehend / noch nicht auf Produktion geprüft** | |

### Gesamtbewertung (Schreiben)

**ausstehend / noch nicht auf Produktion geprüft.**
