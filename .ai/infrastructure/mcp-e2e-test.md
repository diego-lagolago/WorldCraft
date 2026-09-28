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
| 1 | Welche Inhalte sind mit Burg Rabenstein verknüpft? | `welten_auflisten`, `inhalte_suchen` (rekursiv) | bestanden | Die Relationen wurden gefunden. |
| 2 | Welche Quests sind gerade aktiv? | `quests_auflisten` | bestanden | Claude bezog beide Welten ein statt nur der Welt im Gesprächskontext. Das ist nach der Einschätzung des Testers Prompt-/Client-Verhalten, nicht MCP-Verhalten. |
| 3 | Was steht in meinem Tagebuch? | `inhalte_suchen` | bestanden | Keine Tagebuchinhalte über MCP gefunden. |
| 4 | Welche Quest-Gegenstände gibt es? | `artikel_oder_monster_auflisten` | teilweise bestanden | Mehrere Aufrufe über verschiedene Welten; der Filter wurde nicht unmittelbar angewendet. |
| 5 | Beschreibe das Titelbild von Burg Rabenstein. | `bild_lesen`, danach alternativ `inhalte_suchen` (Charakter) und `bild_lesen` mit ID | bestanden | Das erste Bild war für die Übertragung zu groß. Ein Bild eines anderen Charakters wurde beschrieben und im Chat angezeigt. |

## Claude Code

Der Ablauf und die Ergebnisse entsprechen laut Testergebnis dem Test in claude.ai.

| # | Ergebnis |
|---|---|
| 1 | bestanden |
| 2 | bestanden – über beide Welten statt nur Gesprächskontext |
| 3 | bestanden – kein Tagebuch über MCP |
| 4 | teilweise bestanden – Filter nicht sofort verwendet |
| 5 | bestanden – Bild eines alternativen Charakters beschrieben und angezeigt |

## Gesamtbewertung

Die Verbindung funktioniert in beiden Clients. Der E2E-Nachweis für T-010 ist noch **nicht vollständig erfüllt**, weil die Abfrage der Quest-Gegenstände in beiden Clients nur teilweise bestanden ist. Der Titelbild-Fall von Burg Rabenstein lieferte erwartungsgemäß die Fehlermeldung zur Übertragungsgröße; ein alternatives Charakterbild wurde anschließend erfolgreich beschrieben und angezeigt.
