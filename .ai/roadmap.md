# Roadmap

Reihenfolge der Pläne für WorldCraft. Jeder Plan liegt unter `.ai/feature-tasks/` und wird mit der unten beschriebenen Arbeitsweise umgesetzt. Status wird hier nachgezogen, sobald ein Plan abgeschlossen ist.

## Übersicht

| # | Plan | Ziel | Status |
|---|---|---|---|
| 1 | [`001` MVP-Umfang & Infrastruktur](feature-tasks/001-mvp-infrastruktur.md) | Infrastruktur gewählt und als ADRs festgehalten, riskante Funktionen als Spikes lokal und auf Produktion bewiesen, Datenmodell und Projektnormen stehen | ✅ abgeschlossen (2026-09-22) |
| 2 | [`003` MVP-Funktionen](feature-tasks/003-mvp-funktionen.md) | Spikes zur produktiven App ausbauen: Welten, Universen, Mitglieder, Artikel mit Vorlagen, Relationen, Quests, Charaktere, Tagebuch, Karten, Chat, Suche. Design-Referenz: [`spikes/ui-prototype/index.html`](../spikes/ui-prototype/index.html) | ✅ abgeschlossen (2026-09-23) |
| 3 | [`004` Quest-Kapitel, Notizblock, Owner-Sichtbarkeit](feature-tasks/004-quest-kapitel-und-owner-sichtbarkeit.md) | Dreistufige Sichtbarkeit mit Owner; Quest-Kapitel; gemeinsamer Quest-Notizblock | ✅ abgeschlossen (2026-09-23) |
| 4 | [`007` Chat-Verbesserungen](feature-tasks/007-chat-verbesserungen.md) | Eigene Nachrichten rechts, statische Avatare, Bearbeiten/Kopieren/Lösch-Bestätigung, Thread umbenennen, gemerkter Aufklapp-Zustand | ✅ abgeschlossen (2026-09-23) |
| 5 | [`008` Würfel-Sheet wie im Chat-Spike](feature-tasks/008-wuerfel-sheet-wie-spike.md) | Würfel-Sheet an den Chat-Spike angleichen (mehrere Terme, Bonus, Ergebnisfeld); Chat-Zeile unverändert | ✅ abgeschlossen (2026-09-23) |
| 6 | [`005` Monster (Bestiarium)](feature-tasks/005-monster-bestiarium.md) | Monster als eigener Inhaltstyp mit vollem Charakterblatt, Monster-Feldern und einem Bild; vollwertig in Relationen, Erwähnungen und Suche; Titelbild beim Anlegen von Artikeln | ✅ abgeschlossen (2026-09-23) |
| 7 | [`006` Monster-Marker, Stecknadeln, Kartenfilter](feature-tasks/006-karten-marker-und-filter.md) | Monster auf Karten, Charakter- und Monster-Marker als Stecknadel mit Spitze auf der Position, Kartenfilter für Charaktere, Monster und Pin-Typen | ✅ abgeschlossen (2026-09-24) |
| 8 | [`002` MCP-Server für Claude](feature-tasks/002-mcp-server.md) | Nur lesender Remote-MCP-Server mit OAuth, nutzt die Daten- und Rechteschicht aus `003`/`004` | ⏭ als Nächstes: Abgleich nach 004–006, dann Plan-Review |

Die Nummern der Pläne geben die Reihenfolge ihrer Entstehung an, nicht die Reihenfolge der Umsetzung: `004` vor `002` (R4); `005` vor `006` (006 setzt Monster voraus); `002` nach `006`, damit der MCP-Server Monster und Monster-Marker mit abdeckt (Abgleiche in `004` T-012, `005` T-011 und nach `006`).

Offene Ideen außerhalb dieser Pläne stehen in [`backlog.md`](backlog.md).

## Nächste Schritte (Stand 2026-09-24)

Alle Pläne außer `002` sind abgeschlossen und mit Version `0.1.4` auf Produktion. Reihenfolge der offenen Arbeit:

| # | Schritt | Plan | Werkzeug | Voraussetzung | Wer |
|---|---|---|---|---|---|
| 1 | CR-009 aus Review 005 beheben (404-Text in `src/lib/map/repository.ts` wieder über `MONSTER_NOT_FOUND`), danach `/review-check 005` | 005 | Fix, `/review-check` | – | Claude |
| 2 | Gezieltes Code-Review für die von Review 006 nicht abgedeckten Änderungen: Charakter-Platziermodus (Rechte, Hotkeys, Abgleich mit K10/K12) und Umbau der Kartenleiste; Findings umsetzen, Review-Check | 006 | `/code-review`, `/review-check` | – | Claude + Projektinhaber (Entscheidungen) |
| 3 | Prod-Smoketest für den Stand `0.1.4`: Quest-Kapitel und Notizblock, dreistufige Sichtbarkeit („nur ich“), Bestiarium mit Bild, Monster-Marker und Kartenfilter, Chat-Nachtrag N1–N3, Würfel-Inline-Eingabe; Ergebnis als eigener Abschnitt in `infrastructure/smoketest.md` | 004–008 | Browser auf Prod | – | Projektinhaber |
| 4 | ✅ erledigt (2026-09-24): Abgleich Plan 002 nach Plan 006 in `architecture.md` (Unterpunkt „nach Plan 006“, P6-1 bis P6-6, 4 offene Fragen): `karte_lesen` und Monster-Marker, Filter `art` um Monster | 002 | Doku | – | Claude |
| 5 | Offene Fragen aus den Abgleichen nach 004, 005 und 006 beantworten (u. a. `owner_only` über MCP, Kapitel, Notizblock, Monster in Suche und Lesen, Charakterblatt, Sichtbarkeit, Monster-Marker in `karte_lesen`, Testwelt) und Plan 002 prüfen | 002 | `/plan-review 002` | 4 ✅ | Claude + Projektinhaber |
| 6 | Plan 002 umsetzen (Remote-MCP-Server mit OAuth, nur lesend) | 002 | `/plan-run 002` | 5 | Claude |
| 7 | Code-Review 002, Findings umsetzen, Review-Check | 002 | `/code-review 002`, `/review-check 002` | 6 | Claude + Projektinhaber |
| 8 | Push-Freigabe und Prod-Smoketest für den MCP-Server (Anmeldung aus Claude, Rechte je Rolle) | 002 | Push nach Freigabe | 7 | Projektinhaber |
| 9 | Backlog-Einträge vom 2026-09-24 sichten (Monster-Marker-Sheet vertiefen, versteckte Verweise kryptisch darstellen, Fähigkeiten mit Angriffs-/Wirkungsart taggen) und entscheiden, ob daraus ein Plan `009` wird | – | `/plan-create` | – | Projektinhaber |

Die Schritte 1–4 hängen nicht voneinander ab und können parallel laufen. Schritt 9 kann jederzeit dazwischen erfolgen.

## Hinweise je Plan

- **`001`:** Alle Aufgaben erledigt, Smoketest auf Produktion dokumentiert in [`infrastructure/smoketest.md`](infrastructure/smoketest.md). Ein Code-Review liegt vor (`code-review-001-mvp-infrastruktur-2026-09-22.md`). Die Findings des Code Reviews werden im Rahmen von 003 umgesetzt und nur innerhalb von Plan 003 auf das Code Review referenziert.
- **`003`:** Plan-Review abgeschlossen, UI-Prototyp am 2026-09-22 freigegeben. Alle Aufgaben erledigt (2026-09-23); T-017 Prod-Smoke nach Push `cca6fbe` bestanden, Spike-Cleanup auf Prod ohne Treffer.
- **`004`:** ✅ abgeschlossen (2026-09-23). Dreistufige Sichtbarkeit, Quest-Kapitel, Quest-Notizblock. Plan `002` kann starten (nach T-012-Abgleich).
- **`007`:** Abgeschlossen (2026-09-23). Chat-UX: Ausrichtung, Avatare, Bearbeiten, Lösch-Bestätigung, Thread-Umbenennen, Aufklapp-Zustand; Nachtrag N1–N3 nach Smoketest (Absätze ohne Hintergrund, Aufklapp-Zustand per Cookie, Zeilen-Hervorhebung). Code-Review `code-review-007-chat-verbesserungen-2026-09-23.md`: alle Findings behoben (CR-013 verworfen), Review-Check 2026-09-23. Smoketest C7.1–C7.12 bestanden. Deploy mit dem nächsten freigegebenen Push.
- **`008`:** Abgeschlossen (2026-09-23). Würfel-Sheet nach Chat-Spike (Commit `b5d28e8`); Darstellung im Chatverlauf bleibt wie in der App; Nachtrag N1: Anzahl und Bonus inline editierbar. Smoketest WS.1–WS.7 bestanden. Code-Review `code-review-008-wuerfel-sheet-wie-spike-2026-09-23.md`: alle Findings behoben (eines verworfen), Review-Check 2026-09-23.
- **`005`:** ✅ abgeschlossen (2026-09-23). Monster/Bestiarium, Titelbild beim Anlegen; Smoketest B5.1–B5.7 lokal; T-011 MCP-Abgleich in `architecture.md`. Plan `006` kann Schema/API starten. Code-Review `code-review-005-monster-bestiarium-2026-09-24.md`: 14 Findings behoben, CR-009 nach Review-Check wieder offen (Regression durch Plan 006).
- **`006`:** ✅ abgeschlossen (2026-09-24). Monster-Marker, Stecknadel-Darstellung, Kartenfilter, Hotkeys `P`/`M`, Monster-Marker kopieren; Smoketest lokal bestanden. Code-Review `code-review-006-karten-marker-und-filter-2026-09-24.md`: alle 16 Findings behoben, Review-Check 2026-09-24. Nicht abgedeckt und noch ungeprüft: Charakter-Platziermodus und Umbau der Kartenleiste (siehe *Nächste Schritte*). Ausgeliefert mit Version `0.1.4`.
- **`002`:** Vor dem Start mit dem Stand nach `004`, `005` und `006` abgleichen und `/plan-review` ausführen (siehe *Nächste Schritte*). Abgleiche nach `004` (T-012), `005` (T-011) und `006` (2026-09-24) stehen in `architecture.md` unter *Abgleich Plan 002*, dort sind 11 Fragen offen (3 + 4 + 4). Zusätzlich weiter der Abgleich aus `003` T-018.

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
