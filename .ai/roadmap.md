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
| 8 | [`009` Neue Vorlagenfelder und Vorlage „Rasse“](feature-tasks/009-vorlagenfelder-und-rasse.md) | Neue Auswahlwerte/-felder für Person, Ort, Organisation, Gegenstand (u. a. Gefahrenstufe, Ruf, Größe, Seltenheit als Pill); Vorlage „Rasse“ mit Verweis Person → Rasse | ✅ abgeschlossen (2026-09-24) |
| 9 | [`010` Status für Quest-Kapitel](feature-tasks/010-kapitel-status.md) | Kapitel bekommen den Quest-Status (offen/aktiv/abgeschlossen/gescheitert); Inline-Feld der Kapitelzeile wird Status, Sichtbarkeit nur noch im Bearbeitendialog | ✅ abgeschlossen (2026-09-24) |
| 10 | [`002` MCP-Server für Claude](feature-tasks/002-mcp-server.md) | Nur lesender Remote-MCP-Server mit OAuth, nutzt die Daten- und Rechteschicht aus `003`/`004` | ✅ abgeschlossen (2026-09-28); Lesen auf Produktion |
| 11 | [`011` MCP: Schreibend](feature-tasks/011-mcp-schreibend.md) | Schreibende MCP-Werkzeuge mit eigenem Scope `worlds:write`, Bestätigungspflicht für Änderungen, `nur ich` für Neues, kein Löschen, Bild-Upload per einmaligem Link | ✅ abgeschlossen (2026-09-30, E2E-Lauf 2 bestanden) |
| 12 | [`012` Release v1.0](feature-tasks/012-v1-release.md) | Feldkatalog, strikte MCP-Eingaben, verständliche Fehler sowie Delta-Vorschau und Quittung für Schreibvorgänge | ✅ abgeschlossen (2026-09-30, Version `1.0.0` ausgeliefert; `1.0.1` mit Relation-Bestätigung lokal, Push offen) |

Die Nummern der Pläne geben die Reihenfolge ihrer Entstehung an, nicht die Reihenfolge der Umsetzung: `004` vor `002` (R4); `005` vor `006` (006 setzt Monster voraus); `002` nach `006`, damit der MCP-Server Monster und Monster-Marker mit abdeckt (Abgleiche in `004` T-012, `005` T-011 und nach `006`); `009` und `010` vor `002` (Entscheidung Projektinhaber 2026-09-24), damit der MCP-Server die neuen Vorlagenfelder, die Vorlage „Rasse“ und den Kapitel-Status gleich mit abdeckt (Abgleiche in `009` T-005 und `010` T-004).

Offene Ideen außerhalb dieser Pläne stehen in [`backlog.md`](backlog.md).

## Nächste Schritte (Stand 2026-09-29)

Plan `002` ist abgeschlossen, Plan `011` ist mit Version `0.1.11` auf Produktion (E2E-Lauf 1 durchgeführt). Offen sind Code-Review und E2E-Abschluss von `011` sowie Plan `012` (Release v1.0). Reihenfolge der offenen Arbeit:

| # | Schritt | Plan | Werkzeug | Voraussetzung | Wer |
|---|---|---|---|---|---|
| 1 | ✅ CR-009 aus Review 005 beheben (404-Text in `src/lib/map/repository.ts` wieder über `MONSTER_NOT_FOUND`), danach `/review-check 005` | 005 | Fix, `/review-check` | – | Claude |
| 2 | ✅ Gezieltes Code-Review für die von Review 006 nicht abgedeckten Änderungen: Charakter-Platziermodus (Rechte, Hotkeys, Abgleich mit K10/K12) und Umbau der Kartenleiste; Findings umsetzen, Review-Check | 006 | `/code-review`, `/review-check` | – | Claude + Projektinhaber (Entscheidungen) |
| 3 | ✅ Prod-Smoketest für den Stand `0.1.4`: Quest-Kapitel und Notizblock, dreistufige Sichtbarkeit („nur ich“), Bestiarium mit Bild, Monster-Marker und Kartenfilter, Chat-Nachtrag N1–N3, Würfel-Inline-Eingabe; Ergebnis als eigener Abschnitt in `infrastructure/smoketest.md` | 004–008 | Browser auf Prod | – | Projektinhaber |
| 4 | ✅ erledigt (2026-09-24): Abgleich Plan 002 nach Plan 006 in `architecture.md` (Unterpunkt „nach Plan 006“, P6-1 bis P6-6, 4 offene Fragen): `karte_lesen` und Monster-Marker, Filter `art` um Monster | 002 | Doku | – | Claude |
| 5 | ✅ erledigt (2026-09-24): Plan 009 prüfen (Vorlagenfelder, Vorlage „Rasse“); 4 Findings geklärt (K6 Organisationsgröße „101+“, Pill-Position und `rarity` nur in `listArticles` in T-004, K7 Reihenfolge) | 009 | `/plan-review 009` | – | Claude + Projektinhaber |
| 6 | ✅ erledigt (2026-09-24): Plan 009 umgesetzt, MCP-Abgleich nach 009 dokumentiert und lokaler Smoketest S9.1–S9.8 bestanden | 009 | `/plan-run 009` | 5 | Claude |
| 7 | ✅ erledigt (2026-09-25): Code-Review 009 (7 Findings behoben, Review-Checks 2026-09-25) | 009 | `/code-review 009`, `/review-check 009` | 6 | Claude + Projektinhaber |
| 8 | ✅ erledigt (2026-09-24): Plan 010 prüfen (Kapitel-Status) | 010 | `/plan-review 010` | – | Claude + Projektinhaber |
| 9 | ✅ erledigt (2026-09-24): Plan 010 umgesetzt, Migration `0023` lokal angewendet, MCP-Abgleich und Smoketest S10.1–S10.5 bestanden | 010 | `/plan-run 010` | 8; nach 6 (keine technische Abhängigkeit, nur Reihenfolge) | Claude |
| 10 | ✅ erledigt (2026-09-25): Code-Review 010 (4 Findings behoben, 1 verworfen); Review-Check laut Projektinhaber erledigt, im Review-Dokument ohne eigenen Abschnitt | 010 | `/code-review 010`, `/review-check 010` | 9 | Claude + Projektinhaber |
| 11 | ✅ erledigt (2026-09-25): Push als Version `0.1.5` (`aa90bda`), Migration `0023` auf Prod, Prod-Smoketest P5.1–P5.7 bestanden | 009, 010 | Push nach Freigabe | 7, 10 | Projektinhaber |
| 12 | ✅ erledigt (2026-09-25): Plan-Review 002; Entscheidungen D1–D18 plus D19–D22 aus dem Review (Testdaten für Relationen, Aufruflimit/Löschjob, Produktion vor Code-Review, `npm run test:mcp`), offene Fragen aus den Abgleichen in `architecture.md` als beantwortet markiert | 002 | `/plan-review 002` | 4 ✅, 6, 9 | Claude + Projektinhaber |
| 13 | ✅ erledigt (2026-09-28): Plan 002 umsetzen (Remote-MCP-Server mit OAuth, nur lesend), lokal: T-001–T-009, T-012, T-013, T-014 Abnahmen (1)–(4) | 002 | `/plan-run 002` | 12 | Claude |
| 14 | ✅ erledigt (2026-09-28): Push nach Freigabe (D21), `MCP_ENABLED=true` auf Prod dauerhaft; Demowelt auf Prod (T-014 (5)), Ende-zu-Ende-Test mit Claude (T-010), Abschluss & Normen (T-011) | 002 | Push nach Freigabe, `/plan-run 002` | 13 | Projektinhaber + Claude |
| 15 | ✅ erledigt (2026-09-28): Code-Review 002 auf dem aktiven Prod-Stand, Findings umsetzen (inkl. MCP-Fehler), Review-Check, Fix-Push nach Freigabe | 002 | `/code-review 002`, `/review-check 002` | 14 | Claude + Projektinhaber |
| 16 | ✅ erledigt (2026-09-27): Plan 011 (MCP: Schreibend) prüfen; Stand nach 002 auf Produktion abgleichen | 011 | `/plan-review 011` | 15, Lesen auf Prod läuft wie erwartet | Claude + Projektinhaber |
| 17 | ✅ erledigt (2026-09-29): Plan 011 umsetzen (T-001–T-010, T-012, T-013; ausgeliefert mit `0.1.10`/`0.1.11`) | 011 | `/plan-run 011` | 16 | Claude |
| 18 | ✅ erledigt (2026-09-30): Code-Review 011, Findings umsetzen, Review-Check — läuft nach den Fixes aus Plan `012` als dessen T-011 (Plan-Review 012, F3) | 011 | `/code-review 011`, `/review-check 011` | 17, 20 | Claude + Projektinhaber |
| 19 | ✅ erledigt (2026-09-30): Push-Freigabe und Ende-zu-Ende-Test Schreiben auf Prod (Plan 011 T-011) — Push erfolgt, E2E-Lauf 1 in claude.ai am 2026-09-29 (4 bestanden, 1 teilweise); E2E-Lauf 2 folgt als Plan `012` T-013 | 011 | Push nach Freigabe | 18 | Projektinhaber |
| 20 | ✅ erledigt (2026-09-30): Plan 012 (Release v1.0) umsetzen: E2E-Findings (Feldnamen, still ignorierte Felder, Delta im Chat), Feldkatalog, strikte Schemas, Vorschau und Quittung; T-001–T-010 | 012 | `/plan-run 012` | 19 (E2E-Lauf 1) | Claude |
| 21 | ✅ erledigt (2026-09-30): Code-Reviews 011 und 012 (Plan 012 T-011), jeweils `/plan-review` und `/plan-run` der Findings, `/review-check`; danach Version `1.0.0`, Push nach Freigabe und E2E-Lauf 2 (T-012, T-013) | 011, 012 | `/code-review`, `/plan-review`, `/plan-run`, `/review-check` | 20 | Claude + Projektinhaber |
| 22 | Backlog-Einträge vom 2026-09-24 sichten (Monster-Marker-Sheet vertiefen, versteckte Verweise kryptisch darstellen, Fähigkeiten mit Angriffs-/Wirkungsart taggen, Kategorien in Tagebüchern, Threads archivieren) und entscheiden, ob daraus ein Plan `013` wird | – | `/plan-create` | 21 | Projektinhaber |

Die Schritte 5 und 8 (Plan-Reviews) können parallel laufen. Schritt 22 folgt nach dem Release v1.0 (Plan `012` E3).

**Stand 2026-09-24:** Schritte 1–4 erledigt (Review 005 CR-009 behoben, Review 006 um CR-017–CR-025 ergänzt und abgearbeitet, Prod-Smoketest `0.1.4` bestanden, Abgleich 002 nach 006). Die Fixes aus Schritt 1 und 2 sind lokal und gehen mit dem nächsten Push raus. Plan `009` ist lokal abgeschlossen; Plan `010` ist ebenfalls lokal abgeschlossen (Migration `0023` angewendet, S10.1–S10.5 bestanden).

## Hinweise je Plan

- **`001`:** Alle Aufgaben erledigt, Smoketest auf Produktion dokumentiert in [`infrastructure/smoketest.md`](infrastructure/smoketest.md). Ein Code-Review liegt vor (`code-review-001-mvp-infrastruktur-2026-09-22.md`). Die Findings des Code Reviews werden im Rahmen von 003 umgesetzt und nur innerhalb von Plan 003 auf das Code Review referenziert.
- **`003`:** Plan-Review abgeschlossen, UI-Prototyp am 2026-09-22 freigegeben. Alle Aufgaben erledigt (2026-09-23); T-017 Prod-Smoke nach Push `cca6fbe` bestanden, Spike-Cleanup auf Prod ohne Treffer.
- **`004`:** ✅ abgeschlossen (2026-09-23). Dreistufige Sichtbarkeit, Quest-Kapitel, Quest-Notizblock. Plan `002` kann starten (nach T-012-Abgleich).
- **`007`:** Abgeschlossen (2026-09-23). Chat-UX: Ausrichtung, Avatare, Bearbeiten, Lösch-Bestätigung, Thread-Umbenennen, Aufklapp-Zustand; Nachtrag N1–N3 nach Smoketest (Absätze ohne Hintergrund, Aufklapp-Zustand per Cookie, Zeilen-Hervorhebung). Code-Review `code-review-007-chat-verbesserungen-2026-09-23.md`: alle Findings behoben (CR-013 verworfen), Review-Check 2026-09-23. Smoketest C7.1–C7.12 bestanden. Deploy mit dem nächsten freigegebenen Push.
- **`008`:** Abgeschlossen (2026-09-23). Würfel-Sheet nach Chat-Spike (Commit `b5d28e8`); Darstellung im Chatverlauf bleibt wie in der App; Nachtrag N1: Anzahl und Bonus inline editierbar. Smoketest WS.1–WS.7 bestanden. Code-Review `code-review-008-wuerfel-sheet-wie-spike-2026-09-23.md`: alle Findings behoben (eines verworfen), Review-Check 2026-09-23.
- **`005`:** ✅ abgeschlossen (2026-09-23). Monster/Bestiarium, Titelbild beim Anlegen; Smoketest B5.1–B5.7 lokal; T-011 MCP-Abgleich in `architecture.md`. Plan `006` kann Schema/API starten. Code-Review `code-review-005-monster-bestiarium-2026-09-24.md`: 14 Findings behoben, CR-009 nach Review-Check wieder offen (Regression durch Plan 006).
- **`006`:** ✅ abgeschlossen (2026-09-24). Monster-Marker, Stecknadel-Darstellung, Kartenfilter, Hotkeys `P`/`M`, Monster-Marker kopieren, Charakter-Platziermodus (K13, ohne Taste); Smoketest lokal bestanden. Code-Review `code-review-006-karten-marker-und-filter-2026-09-24.md`: CR-001–CR-025 behoben (CR-017–CR-025 aus dem Nachtrag-Review zu Charaktermodus und Kartenleiste), Review-Checks 2026-09-24. Ausgeliefert mit Version `0.1.4`, Fixes aus dem Nachtrag folgen mit dem nächsten Push.
- **`009`:** ✅ abgeschlossen (2026-09-24). Neue Auswahlwerte und -felder für Person, Ort, Organisation und Gegenstand, Vorlage „Rasse“ mit Verweis Person → Rasse; keine Migration. MCP-Abgleich nach `009` in `architecture.md`; lokaler Smoketest S9.1–S9.8 bestanden.
- **`010`:** ✅ abgeschlossen (2026-09-24). Kapitel-Status wie bei Quests, Inline-Feld der Kapitelzeile ist Status, Sichtbarkeit nur noch im Bearbeitendialog. Migration `0023` lokal angewendet; MCP-Abgleich in `architecture.md` und Smoketest S10.1–S10.5 bestanden. Code-Review `code-review-010-kapitel-status-2026-09-24.md`: 4 Findings behoben, 1 verworfen.
- **`002`:** ✅ abgeschlossen (2026-09-28). Remote-MCP-Server nur lesend auf Produktion; OAuth, acht Lesewerkzeuge, Demowelt, E2E mit akzeptierten Abweichungen. Historie der Abgleiche steht in `architecture.md` unter *Abgleich Plan 002*.
- **`011`:** ⏳ in Umsetzung. T-001–T-010 und T-013 lokal erledigt (Schreibwerkzeuge, Bestätigung, Upload-Link, Audit, Testwelt-Suite); T-011: Hilfeseite und E2E-Protokollvorlage fertig, E2E-Lauf auf Produktion ausstehend; T-012 Normen/Katalog nachgezogen.
- **`012`:** ⏳ in Umsetzung. E2E-Findings aus Lauf 1 (claude.ai, 2026-09-29) werden vor Release `1.0.0` abgearbeitet.

Bild-Upload verbessern: Drag & Drop, Drop-Zone und überarbeitete Upload-Oberfläche für die Upload-Seite des MCP-Upload-Links (`011` S9) — eigener Plan, noch nicht angelegt.

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
