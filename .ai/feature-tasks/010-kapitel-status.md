# 010 – Status für Quest-Kapitel

## Kontext & Ziel

Quests haben einen Status (offen, aktiv, abgeschlossen, gescheitert), ihre Kapitel (Plan `004`) aber nicht. Wunsch des Projektinhabers vom 2026-09-24: **Kapitel bekommen denselben Status wie Quests.**

Die Sichtbarkeit eines Kapitels lässt sich heute an zwei Stellen ändern: im Inline-Auswahlfeld der Kapitelzeile und im Bearbeitendialog. Das Inline-Feld zeigt künftig den **Status**. Die Sichtbarkeit wird nur noch im Bearbeitendialog geändert. So verschwindet die doppelte Bedienung, und der frei gewordene Platz bekommt die neue Funktion.

**Einordnung (Plan-Review 2026-09-24):** `010` wird **vor** `/plan-review 002` (Roadmap *Nächste Schritte*, Schritt 5) umgesetzt, damit das Review von Plan `002` den Kapitel-Status aus T-004 gleich mit berücksichtigt. Beim Umsetzen die Tabelle *Nächste Schritte* in `.ai/roadmap.md` um einen Schritt für `010` vor Schritt 5 ergänzen.

**Nicht Ziel dieses Plans:**

- Abhängigkeiten zwischen Kapitel- und Quest-Status, z. B. „Quest abgeschlossen, wenn alle Kapitel abgeschlossen sind“. Beide Status bleiben unabhängig.
- Filtern oder Sortieren von Kapiteln nach Status.
- Änderungen am Quest-Status selbst.

## Entscheidungen (Projektinhaber, 2026-09-24, beim Anlegen des Plans)

| # | Frage | Entscheidung |
|---|---|---|
| K1 | Welche Werte hat der Kapitel-Status? | **Dieselben vier wie die Quest**: `open` offen, `active` aktiv, `completed` abgeschlossen, `failed` gescheitert. Wiederverwendung von `QUEST_STATUSES` / `QUEST_STATUS_LABEL` (`src/lib/quests/status.ts`) und des Datenbank-Enums `quest_status`. |
| K2 | Was zeigt das Inline-Auswahlfeld der Kapitelzeile? | **Den Status** statt der Sichtbarkeit (nur Spielleitung, wie heute). Die Sichtbarkeit wird ausschließlich im Bearbeitendialog geändert; dort gibt es das Feld schon. Das Sichtbarkeits-Badge bleibt in der Kapitelzeile als reine Anzeige. |

## Annahmen (beim Anlegen gesetzt, in `/plan-review` am 2026-09-24 vom Projektinhaber bestätigt)

| # | Annahme | Status |
|---|---|---|
| A1 | Neue Kapitel starten mit `open`. Bestehende Kapitel erhalten per Migration `open`. | ✅ bestätigt |
| A2 | Player sehen den Status jedes für sie sichtbaren Kapitels als Badge in der Kapitelzeile, im selben Stil wie der Quest-Status (`.badge.st-*` in `src/app/globals.css`). Die Spielleitung sieht statt des Badges das Auswahlfeld. | ✅ bestätigt |
| A3 | Status ändern darf, wer das Kapitel heute bearbeiten darf (dieselbe Rechteprüfung wie beim PATCH von Titel, Text oder Sichtbarkeit: `loadWritableChapter` in `src/lib/domain/quest-chapters.ts`, also Spielleitung = GM und Master, die das Kapitel sehen). | ✅ bestätigt |
| A4 | Anlegen- und Bearbeitendialog bekommen **kein** Statusfeld; der Status wird nur inline geändert. | ✅ bestätigt |
| A5 | Eine Statusänderung löst keine Neuberechnung der Relationen aus, denn `APP-CHAPTER-REL` hängt nur von der Sichtbarkeit ab. Im Code: `needsMentionRecalc` prüft nur `body` und `visibility`; `status` kommt dort **nicht** hinzu. | ✅ bestätigt (im Review am Code geprüft) |

## Begriffe & Systeme

Begriffe aus Plan `004` und `.ai/architecture/datenmodell-fachlich.md` gelten (Quest, Quest-Kapitel, dreistufige Sichtbarkeit, Owner, Spielleitung, Player). Zusätzlich:

- **Quest-Status**: `QUEST_STATUSES` und `QUEST_STATUS_LABEL` in `src/lib/quests/status.ts`, Datenbank-Enum `quest_status` (`src/db/schema.ts`), Spalte `quests.status`.
- **Kapitel-Status**: neue Spalte `quest_chapters.status` vom Typ `quest_status`, `NOT NULL DEFAULT 'open'`.
- **Kapitelzeile**: Kopfzeile eines Kapitels in `src/components/quests/QuestChapters.tsx` (`.ch-h` mit Nummer, Titel, Sichtbarkeits-Badge und bei Spielleitung `.ch-actions`).
- **Inline-Auswahlfeld**: das heutige `ContentVisibilitySelect compact` in `.ch-actions`, künftig eine Status-Auswahl.
- **Bearbeitendialog**: `ChapterEditSheet` in `QuestChapters.tsx` mit Titel, Sichtbarkeit (`ContentVisibilitySelect`, `id="chapter-visibility"`) und Text.
- **Kapitel-Domain / -API**: `src/lib/domain/quest-chapters.ts` (`chapterCreateSchema`, Patch-Schema, `ChapterSummary`, Laden über `listVisibleChaptersForQuest`), Routen unter `src/app/api/worlds/[worldId]/quests/[questId]/chapters/`.

## Relevante Normen

- `.ai/architecture/datenmodell.md` — 3.13a `quest_chapters`, `APP-CHAPTER-REL`, Änderungsvermerke am Dokumentanfang.
- `.ai/architecture/datenmodell-fachlich.md` — 3.13a Quest-Kapitel.
- `.ai/features.md` — Zeile „Quest-Kapitel“.
- `.ai/architecture.md` — Abschnitt *Abgleich Plan 002* (MCP liest Kapitel).
- `.ai/standards/mobile-first.md` — Kapitelzeile muss auf dem Telefon bedienbar bleiben.
- `.ai/conventions.md` — UI Deutsch, Code Englisch; `npm run lint` vor jedem Commit; Features-Katalog.
- `.ai/roadmap.md` — Arbeitsweise (Commit pro Task mit Task-ID, nie automatisch pushen).

## Aufgaben

### T-001: Normen nachziehen
- [x] Beschreibung: In `.ai/architecture/datenmodell.md` 3.13a die Spalte `status` (`quest_status`, `NOT NULL DEFAULT 'open'`) ergänzen und am Dokumentanfang einen Änderungsvermerk „2026-09-24 (Plan `010`)“ setzen. In `.ai/architecture/datenmodell-fachlich.md` 3.13a das Attribut „Status“ mit den vier Werten eintragen; dazu vermerken, dass es unabhängig vom Quest-Status ist und keine Relationen beeinflusst (A5). In `.ai/features.md` die Zeile „Quest-Kapitel“ um den Status und die Bedienung (Status inline, Sichtbarkeit nur im Dialog) ergänzen und dabei auf Plan `010` verweisen.
- Abhängigkeiten: keine
- Abnahmekriterium: Beide Datenmodell-Dokumente nennen `status` an Kapiteln mit den vier Werten und dem Standard `open`. `features.md` beschreibt die neue Bedienung und verweist auf `010`.

### T-002: Spalte, Migration und Domain
- [x] Beschreibung: In `src/db/schema.ts` `questChapters.status` als `questStatus("status").default("open").notNull()` ergänzen. Die Migration `src/db/migrations/0023_quest_chapter_status.sql` nach `.ai/conventions.md` (Abschnitt Migrationen) **von Hand** schreiben: `ALTER TABLE quest_chapters ADD COLUMN status quest_status NOT NULL DEFAULT 'open';` (der Default füllt bestehende Zeilen). `npm run db:generate` höchstens als Entwurfshilfe, die generierte Datei danach löschen; das Drizzle-Journal bleibt unverändert. Angewendet wird mit `npm run db:migrate` (`scripts/migrate.mjs`). In `src/lib/domain/quest-chapters.ts` `status` in `ChapterSummary`, das Laden und das Patch-Schema aufnehmen (`z.enum(QUEST_STATUSES)`, optional). Anlegen setzt `status` nicht (A1, A4). Ein PATCH, der nur `status` enthält, ist gültig, ändert `updated_*` und berechnet keine Relationen neu (A5). Die Rechteprüfung bleibt wie beim übrigen PATCH (A3). `QuestChapterView` in `QuestChapters.tsx` um `status` erweitern. Tests in `src/app/api/worlds/[worldId]/quests/[questId]/chapters/quest-chapters.api.test.ts` ergänzen.
- Abhängigkeiten: keine
- Abnahmekriterium: (1) Die Migration läuft auf der lokalen Datenbank; bestehende Kapitel haben danach `status = 'open'`. (2) Ein neu angelegtes Kapitel hat `open`. (3) `PATCH { status: "completed" }` durch die Spielleitung liefert 200 und das Kapitel mit `completed`. (4) `PATCH { status: "done" }` liefert 400. (5) `PATCH { status }` durch einen Player liefert dieselbe Ablehnung wie ein Player-PATCH der Sichtbarkeit heute. (6) Die Relationen der Quest sind nach einem reinen Status-PATCH unverändert. `npm test`, `npm run lint` und `npm run test:rechte` grün (Letzteres bei laufendem `npm run dev` und migrierter lokaler Datenbank, denn `*.api.test.ts` ist von `npm test` ausgeschlossen und läuft nur über `vitest.rechte.config.ts`).

### T-003: Kapitelzeile – Status inline, Sichtbarkeit nur im Dialog
- [x] Beschreibung: In `QuestChapters.tsx` das `ContentVisibilitySelect` in `.ch-actions` durch eine kompakte Status-Auswahl ersetzen (Optionen aus `QUEST_STATUSES` mit `QUEST_STATUS_LABEL`, `aria-label` „Status von <Titel>“, während `pending` deaktiviert). Bei Änderung ein PATCH mit `{ status }`, danach wie heute `router.refresh()`. Die Funktion `onVisibilityChange` entfällt. Das Sichtbarkeits-Badge bleibt in der Zeile. Für Nicht-Spielleitung zeigt die Zeile den Status als Badge `badge st-<status>` (A2). Der Bearbeitendialog bleibt unverändert und ist damit der einzige Ort, um die Sichtbarkeit zu ändern. Die Status-Auswahl ist eine neue kleine Komponente `src/components/quests/QuestStatusSelect.tsx` (Props `value: QuestStatus`, `onChange`, `ariaLabel`, `disabled`), ein `<select>` mit demselben Inline-Style wie der `compact`-Zweig von `ContentVisibilitySelect` (`src/components/world/VisibilitySelect.tsx`: `width: "auto", padding: "6px 8px", fontSize: 12`), damit die Zeile auf dem Telefon nicht breiter wird. `ContentVisibilitySelect` selbst bleibt unverändert (Entscheidung im Plan-Review 2026-09-24).
- Abhängigkeiten: T-002
- Abnahmekriterium: (1) Die Spielleitung sieht in jeder Kapitelzeile eine Status-Auswahl mit „offen/aktiv/abgeschlossen/gescheitert“. Eine Änderung bleibt nach dem Neuladen erhalten. (2) In der Kapitelzeile gibt es kein Sichtbarkeits-Auswahlfeld mehr; das Sichtbarkeits-Badge ist weiter sichtbar. (3) Die Sichtbarkeit lässt sich über „Bearbeiten“ ändern, und das Badge zeigt den neuen Wert. (4) Ein Player sieht je Kapitel das Status-Badge und kein Auswahlfeld. (5) Bei 375 px Breite passen Nummer, Titel, Badges und Aktionen ohne horizontales Scrollen. `npm run lint` grün.

### T-004: Abgleich Plan 002 (MCP)
- [x] Beschreibung: In `.ai/architecture.md` unter *Abgleich Plan 002* einen Unterpunkt „nach Plan 010“ ergänzen: Kapitel haben einen `status` mit denselben Werten wie Quests. Für die MCP-Werkzeuge in `.ai/feature-tasks/002-mcp-server.md` prüfen: `inhalt_lesen` für Quests (liefert es Kapitel? Wenn ja, mit Status; die Frage, ob Kapitel überhaupt ausgeliefert werden, ist aus dem Abgleich nach Plan `004` offen und wird hier nur verknüpft, nicht entschieden), `quests_auflisten` (Statusfilter bleibt auf den Quest-Status beschränkt) und die Testwelt in T-002 von Plan `002` (Kapitel mit unterschiedlichem Status?).
- Abhängigkeiten: T-002
- Abnahmekriterium: `architecture.md` enthält den Unterpunkt „nach Plan 010“. Für `inhalt_lesen`, `quests_auflisten` und die Testwelt ist je Stelle „keine Anpassung nötig“ mit Begründung oder eine offene Frage bzw. Anpassung vermerkt. Die Verknüpfung zur offenen Kapitel-Frage aus dem Abgleich nach `004` ist gesetzt. Die Roadmap-Zeile zu Plan `002` (*Hinweise je Plan*) nennt den Abgleich nach `010`.

### T-005: Lokaler Smoketest und Abschluss
- [ ] Beschreibung: Lokal mit `npm run dev` prüfen und das Ergebnis mit Datum als Abschnitt „Plan 010“ in `.ai/infrastructure/smoketest.md` festhalten. Danach Plan und Roadmap auf „abgeschlossen“ setzen.
  - S10.1: Die Spielleitung setzt den Status eines Kapitels auf „aktiv“. Das bleibt nach dem Neuladen erhalten.
  - S10.2: Die Spielleitung ändert die Sichtbarkeit eines Kapitels über „Bearbeiten“ auf „veröffentlicht“. Das Badge wechselt.
  - S10.3: Ein Player sieht beim veröffentlichten Kapitel das Badge „aktiv“ und kann es nicht ändern.
  - S10.4: Bestehende Kapitel zeigen nach der Migration „offen“.
  - S10.5: Die Kapitelzeile ist bei 375 px Breite bedienbar.
- Abhängigkeiten: T-001, T-002, T-003, T-004
- Abnahmekriterium: S10.1–S10.5 in `smoketest.md` als bestanden dokumentiert, alle Aufgaben dieses Plans abgehakt, Roadmap-Zeile `010` auf „✅ abgeschlossen“ mit Datum. Kein Push ohne Freigabe; auf Produktion läuft die Migration mit dem nächsten freigegebenen Deploy.
