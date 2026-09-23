# Roadmap

Reihenfolge der Pläne für WorldCraft. Jeder Plan liegt unter `.ai/feature-tasks/` und wird mit der unten beschriebenen Arbeitsweise umgesetzt. Status wird hier nachgezogen, sobald ein Plan abgeschlossen ist.

## Übersicht

| # | Plan | Ziel | Status |
|---|---|---|---|
| 1 | [`001` MVP-Umfang & Infrastruktur](feature-tasks/001-mvp-infrastruktur.md) | Infrastruktur gewählt und als ADRs festgehalten, riskante Funktionen als Spikes lokal und auf Produktion bewiesen, Datenmodell und Projektnormen stehen | ✅ abgeschlossen (2026-09-22) |
| 2 | [`003` MVP-Funktionen](feature-tasks/003-mvp-funktionen.md) | Spikes zur produktiven App ausbauen: Welten, Universen, Mitglieder, Artikel mit Vorlagen, Relationen, Quests, Charaktere, Tagebuch, Karten, Chat, Suche. Design-Referenz: [`spikes/ui-prototype/index.html`](../spikes/ui-prototype/index.html) | ✅ Kern abgeschlossen (2026-09-23); T-017 Prod-Smoke offen (Push-Freigabe) |
| 3 | [`004` Quest-Kapitel, Notizblock, Owner-Sichtbarkeit](feature-tasks/004-quest-kapitel-und-owner-sichtbarkeit.md) | Dreistufige Sichtbarkeit mit Owner; Quest-Kapitel; gemeinsamer Quest-Notizblock | ✅ abgeschlossen (2026-09-23) |
| 4 | [`007` Chat-Verbesserungen](feature-tasks/007-chat-verbesserungen.md) | Eigene Nachrichten rechts, statische Avatare, Bearbeiten/Kopieren/Lösch-Bestätigung, Thread umbenennen, gemerkter Aufklapp-Zustand | ✅ abgeschlossen (2026-09-23) |
| 5 | [`008` Würfel-Sheet wie im Chat-Spike](feature-tasks/008-wuerfel-sheet-wie-spike.md) | Würfel-Sheet an den Chat-Spike angleichen (mehrere Terme, Bonus, Ergebnisfeld); Chat-Zeile unverändert | ⏭ in Umsetzung |
| 6 | [`002` MCP-Server für Claude](feature-tasks/002-mcp-server.md) | Nur lesender Remote-MCP-Server mit OAuth, nutzt die Daten- und Rechteschicht aus `003`/`004` | ⏳ geplant, startet nach `004` |

Die Nummern der Pläne geben die Reihenfolge ihrer Entstehung an, nicht die Reihenfolge der Umsetzung: `004` vor `002` (R4); `007` und `008` können parallel zu `004`–`006` laufen; `002` hängt von der Rechteschicht ab.

Offene Ideen außerhalb dieser Pläne stehen in [`backlog.md`](backlog.md).

## Hinweise je Plan

- **`001`:** Alle Aufgaben erledigt, Smoketest auf Produktion dokumentiert in [`infrastructure/smoketest.md`](infrastructure/smoketest.md). Ein Code-Review liegt vor (`code-review-001-mvp-infrastruktur-2026-09-22.md`). Die Findings des Code Reviews werden im Rahmen von 003 umgesetzt und nur innerhalb von Plan 003 auf das Code Review referenziert.
- **`003`:** Plan-Review abgeschlossen, UI-Prototyp am 2026-09-22 freigegeben. Kern MVP (T-001–T-016, T-018, T-019) erledigt; T-017 wartet auf Push-Freigabe für Prod-Smoke.
- **`004`:** ✅ abgeschlossen (2026-09-23). Dreistufige Sichtbarkeit, Quest-Kapitel, Quest-Notizblock. Plan `002` kann starten (nach T-012-Abgleich).
- **`007`:** Abgeschlossen (2026-09-23). Chat-UX: Ausrichtung, Avatare, Bearbeiten, Lösch-Bestätigung, Thread-Umbenennen, Aufklapp-Zustand; Nachtrag N1–N3 nach Smoketest (Absätze ohne Hintergrund, Aufklapp-Zustand per Cookie, Zeilen-Hervorhebung). Code-Review `code-review-007-chat-verbesserungen-2026-09-23.md`: alle Findings behoben (CR-013 verworfen), Review-Check 2026-09-23. Smoketest C7.1–C7.12 bestanden. Deploy mit dem nächsten freigegebenen Push.
- **`008`:** Plan-Review abgeschlossen (2026-09-23). Würfel-Sheet nach Chat-Spike (Commit `b5d28e8`); Darstellung im Chatverlauf bleibt wie in der App. Unabhängig von `004`–`007`, berührt aber dieselben Chat-Dateien wie `007`.
- **`002`:** Vor dem Start mit T-012 aus `004` abgleichen (Abgleich Plan 002 nach dreistufiger Sichtbarkeit/Owner/Kapitel/Notizblock, R4) und bei Bedarf erneut `/plan-review` ausführen. Zusätzlich weiter der Abgleich aus `003` T-018 in `architecture.md`.

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
- **Features-Katalog (verbindlich):** Jede Aufgabe mit Feature-Wirkung aktualisiert [`.ai/features.md`](features.md); Details in [conventions.md](conventions.md) § Features-Katalog. Bei `/plan-run` mitprüfen.
- **Commits:** nach jeder abgeschlossenen Aufgabe ein Commit mit Task-ID in der Nachricht, vorher laufen die Tests.
- **Push:** nie automatisch. Ein Push auf `main` deployt über GHCR und Coolify auf `worldcraft.lagolago.at` und passiert nur nach ausdrücklicher Freigabe des Projektinhabers.
