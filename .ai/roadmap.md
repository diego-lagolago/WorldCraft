# Roadmap

Reihenfolge der Pläne für WorldCraft. Jeder Plan liegt unter `.ai/feature-tasks/` und wird mit der unten beschriebenen Arbeitsweise umgesetzt. Status wird hier nachgezogen, sobald ein Plan abgeschlossen ist.

## Übersicht

| # | Plan | Ziel | Status |
|---|---|---|---|
| 1 | [`001` MVP-Umfang & Infrastruktur](feature-tasks/001-mvp-infrastruktur.md) | Infrastruktur gewählt und als ADRs festgehalten, riskante Funktionen als Spikes lokal und auf Produktion bewiesen, Datenmodell und Projektnormen stehen | ✅ abgeschlossen (2026-09-22) |
| 2 | [`003` MVP-Funktionen](feature-tasks/003-mvp-funktionen.md) | Spikes zur produktiven App ausbauen: Welten, Universen, Mitglieder, Artikel mit Vorlagen, Relationen, Quests, Charaktere, Tagebuch, Karten, Chat, Suche. Design-Referenz: [`spikes/ui-prototype/index.html`](../spikes/ui-prototype/index.html) | ⏭ als Nächstes |
| 3 | [`002` MCP-Server für Claude](feature-tasks/002-mcp-server.md) | Nur lesender Remote-MCP-Server mit OAuth, nutzt die Daten- und Rechteschicht aus `003` | ⏳ geplant, startet nach `003` |

Die Nummern der Pläne geben die Reihenfolge ihrer Entstehung an, nicht die Reihenfolge der Umsetzung: `002` hängt von der Rechteschicht aus `003` ab und kommt deshalb danach.

Offene Ideen außerhalb dieser Pläne stehen in [`backlog.md`](backlog.md).

## Hinweise je Plan

- **`001`:** Alle Aufgaben erledigt, Smoketest auf Produktion dokumentiert in [`infrastructure/smoketest.md`](infrastructure/smoketest.md). Ein Code-Review liegt vor (`code-review-001-mvp-infrastruktur-2026-09-22.md`). Die Findings des Code Reviews werden im Rahmen von 003 umgesetzt und nur innerhalb von Plan 003 auf das Code Review referenziert.
- **`003`:** Plan-Review abgeschlossen, UI-Prototyp am 2026-09-22 freigegeben. Start mit `/plan-run 003` bei T-001.
- **`002`:** Vor dem Start mit T-018 aus `003` abgleichen (Abgleich Plan 002) und bei Bedarf erneut `/plan-review` ausführen.

## Arbeitsweise

Jeder Plan durchläuft dieselbe Kette:

1. **`/plan-create`** — Plan mit Begriffen, stabilen Task-IDs, Abhängigkeiten und prüfbaren Abnahmekriterien anlegen.
2. **`/plan-review`** — Plan auf Kaltstarttauglichkeit prüfen; offene Entscheidungen klärt der Projektinhaber im Chat.
3. **`/plan-run`** — Aufgaben nacheinander umsetzen, unter Einhaltung der Normen im `.ai`-Ordner; bei Fehlern oder Entscheidungen pausieren und nachfragen.
4. **`/code-review`** — erledigte Aufgaben prüfen; Ergebnis als `code-review-<plan>-<datum>.md`.
5. **`/review-check`** — Review gegen den aktuellen Code abgleichen und Findings nachführen.

Weitere Regeln, die für alle Pläne gelten:

- **Entscheidungen** des Projektinhabers werden mit Datum im Plan und in den betroffenen Normen festgehalten (Datenmodelle, Standards, ADRs), nicht nur im Chat.
- **UI-Entwürfe** werden vor der Umsetzung als klickbarer Prototyp unter `spikes/` abgestimmt und nach Freigabe im Plan als Design-Referenz verankert.
- **Commits:** nach jeder abgeschlossenen Aufgabe ein Commit mit Task-ID in der Nachricht, vorher laufen die Tests.
- **Push:** nie automatisch. Ein Push auf `main` deployt über GHCR und Coolify auf `worldcraft.lagolago.at` und passiert nur nach ausdrücklicher Freigabe des Projektinhabers.
