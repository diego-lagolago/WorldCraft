# 004 – Quest-Kapitel, Quest-Notizblock und dreistufige Sichtbarkeit

## Kontext & Ziel

Nach Plan `003` hat eine Quest einen einzigen Rich-Text (Beschreibung) und eine zweistufige Sichtbarkeit (`nur Spielleitung` / `veröffentlicht`). Das reicht nicht, um eine Quest Schritt für Schritt aufzudecken, und jeder neue Inhalt ist sofort für die ganze Spielleitung sichtbar.

**Ziel dieses Plans** (Wünsche des Projektinhabers, 2026-09-23):

1. **Dreistufige Sichtbarkeit** `nur ich` → `nur Spielleitung` → `veröffentlicht` für Artikel, Quests, Quest-Kapitel und Pins. Jeder dieser Datensätze hat einen **Owner** (Benutzer). Neue Datensätze starten mit `nur ich`.
2. **Quest-Kapitel:** Unter der Quest-Beschreibung liegt eine geordnete Liste von Kapiteln mit eigenem Titel, Text und eigener Sichtbarkeit. Die Spielleitung schaltet Kapitel einzeln frei (kein Branching, keine erzwungene Reihenfolge).
   Beispiel: Quest „Erlege den Wolf“ → Kapitel 1 „Finde den Wolf“ → Kapitel 2 „Töte den Wolf“ → Kapitel 3 „Belohnung“; Player sehen jedes Kapitel erst, wenn es `veröffentlicht` ist.
3. **Quest-Notizblock:** genau ein gemeinsamer Rich-Text-Notizblock pro Quest, den alle Mitglieder, die die Quest sehen, lesen und bearbeiten.

**Nicht Ziel dieses Plans:**

- Universen und Karten bleiben **zweistufig** (ausdrückliche Ausnahme, siehe *Entscheidungen*).
- Tagebuch bleibt unverändert (`privat` / `mit Spielleitung geteilt`).
- Was mit Datensätzen passiert, wenn ihr Owner die Welt verlässt, und das Übertragen des Owners: im Backlog (`.ai/backlog.md`, Eintrag „Owner verlässt die Welt“). Beim Austritt ändert dieser Plan nichts.
- Notizen pro Kapitel, Live-Kollaboration im Notizblock, Kapitel-Branching.
- Plan `002` (MCP) umsetzen oder ändern — nur abgleichen (T-012).

## Entscheidungen (Projektinhaber, 2026-09-23, beim Anlegen des Plans)

| # | Frage | Entscheidung |
|---|---|---|
| E1 | Was wird aus der Quest-Beschreibung? | Bleibt als Einleitung mit der Sichtbarkeit der Quest; Kapitel folgen darunter. Keine Datenmigration. Quests ohne Kapitel funktionieren wie bisher. |
| E2 | Wie werden Kapitel freigegeben? | Jedes Kapitel hat eine eigene Sichtbarkeit und wird einzeln geschaltet. Die Reihenfolge ist nur Anzeige-Reihenfolge; Lücken sind erlaubt. |
| E3 | Erzeugen Erwähnungen im Kapiteltext Relationen? | Ja, aber nur aus Kapiteln mit Sichtbarkeit `veröffentlicht`. Neuberechnung bei jeder Änderung eines Kapitels. Kein Backfill (es gibt noch keine Kapitel). Folge: Auch die Spielleitung sieht Erwähnungen aus unveröffentlichten Kapiteln nicht in „Verknüpft“. |
| E4 | Wem gehört der Notizblock? | Einer pro Quest, gemeinsam. Lesen und Schreiben: alle Mitglieder, die die Quest sehen. |
| E5 | Gleichzeitiges Bearbeiten des Notizblocks | Konflikt erkennen: Speichern prüft eine Versionsnummer; bei zwischenzeitlicher Änderung Hinweis mit „Neu laden“, der eigene Text bleibt im Editor stehen. |
| E6 | Erwähnungen im Notizblock | Werden verlinkt angezeigt, erzeugen **keine** Relationen (wie Tagebuch). |
| E7 | Suche im Kampagnen-Hub | Kapiteltexte ja (Treffer auf die Quest, nur für den Betrachter sichtbare Kapitel), Notizblock nein. |
| E8 | Dreistufiges Rechtesystem | Neue Stufe `nur ich` (Owner). Gilt für Artikel, Quests, Quest-Kapitel, Pins. Default für neue Datensätze: `nur ich`. |
| E9 | Wer sieht `nur ich`? | Nur der Owner selbst, auch nicht der Game Master. |
| E10 | Wer legt an und wird Owner? | Weiterhin nur die Spielleitung (Game Master, Master). Owner = anlegender Benutzer. Bearbeiten: Owner und Spielleitung, sofern sie den Datensatz sehen. |
| E11 | Welche Inhalte bleiben zweistufig? | Universen und Karten (Karten-Hierarchie oberhalb der Pins). Wird als Ausnahme in der Norm festgehalten. |
| E12 | Tagebuch | Bleibt unverändert. |
| E13 | Owner verlässt die Welt | Im Backlog, nicht in diesem Plan. |

### Entscheidungen aus dem Plan-Review (Projektinhaber, 2026-09-23)

| # | Frage | Entscheidung |
|---|---|---|
| R1 | Was gilt für Datensätze eines Masters, der zum Player herabgestuft wird? | **Owner-Rechte ruhen komplett.** Die Owner-Stufe greift nur, solange der Owner Spielleitung ist. Als Player sieht und bearbeitet er auch seine eigenen `owner_only`-Datensätze nicht; `gm_only` und `published` sieht er wie jeder Player. Nach erneuter Hochstufung zum Master ist alles wieder da. Keine Datenänderung beim Rollenwechsel. |
| R2 | Wer darf die Sichtbarkeit auf `nur ich` setzen? | **Nur der Owner.** Andere Spielleiter wechseln bei fremden Datensätzen nur zwischen `nur Spielleitung` und `veröffentlicht`; im Formular fehlt ihnen die Option „nur ich“, die API lehnt einen solchen Wechsel mit 403 ab. |
| R3 | Umsortieren mit für den Aufrufer unsichtbaren Kapiteln | **Unsichtbare Kapitel bleiben auf ihrem Platz.** Sie behalten ihren Index in der Gesamtliste der Quest; die sichtbaren Kapitel werden in der neuen Reihenfolge auf die übrigen Plätze verteilt. |
| R4 | Reihenfolge Plan 004 und Plan 002 | **004 vor 002.** Plan `002` (MCP) startet erst nach Abschluss von `004` und baut direkt auf der dreistufigen Rechteschicht auf; T-012 gleicht `002` vorher ab. |
| R5 | Karten-Ereignisse (SSE) ohne Rechteprüfung | **In T-004 lösen, per Signal.** Befund im Review: `map.pin` und `map.marker` tragen den vollständigen Datensatz, `src/app/api/worlds/[worldId]/events/route.ts` filtert nur nach Welt; Player erhalten dadurch schon heute `gm_only`-Pins live (inkl. Beschreibung) und Daten versteckter Karten. Künftig tragen Karten-Ereignisse nur Art und ID; der Browser holt den Datensatz automatisch im Hintergrund über die rechtegeprüfte API (kein Seiten-Neuladen). Liefert die API 404, entfernt der Client den Datensatz. Keine Sofortmaßnahme vor T-004 (Entscheidung Projektinhaber). |

## Begriffe & Systeme

Die Begriffe aus Plan `003` und `.ai/architecture/datenmodell-fachlich.md` gelten unverändert (Welt, Game Master, Master, Player, Spielleitung, Relation, Erwähnung, „Verknüpft“, Rechteschicht, Stub-Artikel, SSE, Test-Login). Zusätzlich:

- **Owner**: Der Benutzer, dem ein Artikel, eine Quest, ein Quest-Kapitel oder ein Pin gehört. Wird beim Anlegen auf den anlegenden Benutzer gesetzt und im MVP nicht geändert. Spalte `owner_id`, getrennt von `created_by` (Protokollfeld), damit ein späteres Übertragen möglich bleibt.
- **Dreistufige Sichtbarkeit**: Sichtbarkeitsstatus mit den Werten `owner_only` („nur ich“, nur der Owner), `gm_only` („nur Spielleitung“, Game Master und Master; der Owner gehört als Spielleitung automatisch dazu) und `published` („veröffentlicht“, alle Mitglieder). Postgres-Enum `content_visibility`.
- **Zweistufige Sichtbarkeit**: Der bisherige Sichtbarkeitsstatus `gm_only` / `published` (Enum `visibility_status`). Bleibt für Universen und Karten.
- **Karten-Ausnahme**: Die Regel, dass Universen und Karten zweistufig bleiben, obwohl alle anderen freigebbaren Inhalte dreistufig werden (E11).
- **Quest-Kapitel** (kurz **Kapitel**): Abschnitt einer Quest mit Titel, Rich-Text, Position und dreistufiger Sichtbarkeit. Tabelle `quest_chapters`.
- **Kapitel freigeben**: Die Sichtbarkeit eines Kapitels auf `veröffentlicht` setzen. Es gibt keinen eigenen Freigabe-Status.
- **Quest-Notizblock** (kurz **Notizblock**): Genau ein gemeinsamer Rich-Text pro Quest für alle Mitglieder, die die Quest sehen. Tabelle `quest_notes`.
- **Versionsprüfung**: Optimistische Sperre des Notizblocks: Jeder Speicherversuch sendet die zuletzt gelesene Versionsnummer; weicht sie ab, antwortet die API mit HTTP 409 und speichert nicht.
- **Vererbung nach unten**: Bestehende Regel `APP-VIS-INHERIT`: Ein Inhalt ist nur sichtbar, wenn auch alles darüber sichtbar ist. Neu gilt sie auch für Quest → Kapitel und Quest → Notizblock.

## Relevante Normen

- `.ai/architecture/datenmodell-fachlich.md` — 2.2 Sichtbarkeitsstatus, 3.7 Pin, 3.11 Artikel, 3.13 Quest, 3.14 Relation, 4 Löschregeln, 5 Rechte je Entität. Bei Abweichung hat dieses Dokument Vorrang.
- `.ai/architecture/datenmodell.md` — 2.1 Enum-Werte, 3.7 `pins`, 3.12 `articles`, 3.13 `quests`, 5 Regeln (`R-2.2-*`, `APP-VIS-INHERIT`, `APP-REL-VISIBLE`, `APP-REL-RECALC`, `APP-MENTION-SEARCH`, `APP-JOURNAL-NO-REL`), 8 Löschregeln, 9 Suche.
- `.ai/standards/erwaehnungen.md` — Stub-Artikel über `@`.
- `.ai/standards/mobile-first.md`, `.ai/standards/mobile-navigation.md`
- `.ai/conventions.md` — UI Deutsch, Code Englisch.
- `.ai/architecture.md` — Next.js, Drizzle, TipTap, SSE.
- `.ai/decisions/004-editor.md` — Editor-Funktionsumfang.
- `.ai/roadmap.md` — Arbeitsweise (Prototyp vor Umsetzung, Commit pro Task, nie automatisch pushen).
- `spikes/ui-prototype/index.html` — Design-Referenz; wird in T-002 erweitert.

## Globale Abhängigkeiten

- Plan `002` (MCP) wird erst **nach** diesem Plan umgesetzt (R4).
- Plan `003` abgeschlossen (Quests, Relationen, Rechteschicht `src/lib/authz`, Suche, Karte, Rechte-Testskript `npm run test:rechte`).
- Lokale Umgebung wie in Plan `003`: `docker compose up`, `.env` mit `ENABLE_TEST_LOGIN=true`, `npm run dev`.

## Commit & Push (verbindlich)

Wie in Plan `003` und `.ai/conventions.md` (*Commit & Push*): nach jeder abgeschlossenen Aufgabe ein Commit mit Task-ID in der Nachricht; vorher laufen `npm test`, `npm run lint`, `npm run typecheck` und, sofern betroffen, `npm run build` und `npm run test:rechte`. Schlägt etwas fehl, wird nicht committet, sondern pausiert. **Nie automatisch pushen.** Keine Secrets, keine `.env`, keine Uploads im Commit.

## Fachliche Regeln (verbindlich für alle Aufgaben)

**Sichtbarkeit je Stufe** (Betrachter muss Mitglied der Welt sein):

| Stufe | Game Master | Master | Player |
|---|---|---|---|
| `owner_only` | nur wenn Owner | nur wenn Owner | nie, auch nicht als Owner (herabgestufter Master: Owner-Rechte ruhen, R1) |
| `gm_only` | ja | ja | nein |
| `published` | ja | ja | ja |

**Geltungsbereich:**

| Inhalt | Stufen | Default neu |
|---|---|---|
| Artikel, Quest, Quest-Kapitel, Pin | dreistufig | `owner_only` |
| Universum, Karte | zweistufig (Karten-Ausnahme) | unverändert laut Norm (`gm_only`; erstes Universum `published`) |
| Tagebucheintrag | unverändert `private` / `shared` | unverändert |

**Bestandsdaten:** Vorhandene Artikel, Quests und Pins behalten ihren Wert (`gm_only` bleibt `gm_only`, `published` bleibt `published`); `owner_id` wird aus `created_by` befüllt.

**Vererbung:** Pin sichtbar = Universum **und** Karte **und** Pin sichtbar. Kapitel sichtbar = Quest **und** Kapitel sichtbar. Notizblock sichtbar = Quest sichtbar.

**Bearbeiten und Löschen:** Artikel, Quest, Kapitel, Pin: Owner und Spielleitung, jeweils nur wenn sie den Datensatz sehen (bei `owner_only` also nur der Owner). Anlegen: nur Spielleitung. Die Sichtbarkeit `owner_only` setzen darf nur der Owner (R2). Pin sperren/entsperren bleibt Spielleitung (APP-PIN-LOCK), mit derselben Sichtbarkeitsbedingung. Notizblock: alle, die die Quest sehen.

**Folgen, die bewusst so gelten:**

- Ein über `@` angelegter Stub-Artikel ist `owner_only`. Andere sehen die Erwähnung bis zur Veröffentlichung als reinen Text (bestehende Regel für unsichtbare Ziele).
- Relationen folgen weiter `APP-REL-VISIBLE` (Quelle **und** Ziel sichtbar); dadurch sind Relationen zu `owner_only`-Inhalten nur für den Owner sichtbar.
- Karten-Ereignisse (SSE) enthalten keine Inhalte, nur Art und ID (R5). Rechte prüft allein die API, dadurch gelten `owner_only`, R1 und R2 auch live.

## Aufgaben

### T-001: Entscheidungen in die Normen übertragen
- [x] Beschreibung: E1–E13 und die *Fachlichen Regeln* in die Normen schreiben, jeweils mit Datum 2026-09-23 und Verweis auf Plan `004`:
  - `datenmodell-fachlich.md`: 2.2 um die dreistufige Sichtbarkeit, den Owner und die Karten-Ausnahme erweitern; 3.7, 3.11, 3.13 um Owner ergänzen; neue Entitäten **3.13a Quest-Kapitel** (Quest, Titel Text 1–200 Pflicht, Inhalt Rich-Text optional, Position, Sichtbarkeit dreistufig, Owner) und **3.13b Quest-Notizblock** (Quest, Inhalt Rich-Text, Version; eine Zeile pro Quest); 3.14 Tabelle *Herkunft*: `Erwähnung` auch aus veröffentlichten Kapiteln (Quelle = Quest), nicht aus dem Notizblock; 2.3 Liste der Rich-Text-Verwendungen ergänzen; 4 Löschregeln: Quest löschen löscht Kapitel und Notizblock, Kapitel löschen berechnet die Relationen der Quest neu; 5 Rechte je Entität um Kapitel und Notizblock ergänzen und Artikel/Quest/Pin auf dreistufig umstellen.
  - `datenmodell.md`: 2.1 Enum `content_visibility`; 3.7, 3.12, 3.13 um `owner_id`; neue Abschnitte `quest_chapters` und `quest_notes`; Abschnitt 4 Zuordnung; Abschnitt 5 `R-2.2-1` anpassen und neue Regeln `APP-VIS-OWNER` (Sichtbarkeit dreistufig), `APP-CHAPTER-REL` (nur `published`-Kapitel erzeugen Mention-Relationen der Quest), `APP-NOTE-VERSION` (Versionsprüfung, 409), `APP-NOTE-NO-REL` (Notizblock ohne Relationen); Abschnitt 8 Löschregeln; Abschnitt 9 Suche um Kapitel.
  - `.ai/standards/erwaehnungen.md`: Stub-Artikel startet `owner_only`.
  - `.ai/roadmap.md`: Plan `004` in der Übersicht **vor** `002` eintragen (Status „⏭ als Nächstes“), `002` auf „⏳ geplant, startet nach `004`“ setzen und unter *Hinweise je Plan* bei `002` ergänzen: vor dem Start mit T-012 aus `004` abgleichen (R4).
- Abhängigkeiten: keine
- Abnahmekriterium: (1) `git grep -n "owner_only" .ai/architecture` findet Treffer in beiden Datenmodellen. (2) `datenmodell-fachlich.md` enthält die Abschnitte 3.13a und 3.13b und nennt die Karten-Ausnahme in 2.2 ausdrücklich. (3) `datenmodell.md` Abschnitt 5 enthält `APP-VIS-OWNER`, `APP-CHAPTER-REL`, `APP-NOTE-VERSION`, `APP-NOTE-NO-REL`. (4) Keine Aussage in den Normen widerspricht mehr E1–E13 (Suche nach „Standard `nur Spielleitung`“ / „Default `gm_only`“ zeigt nur noch Universen/Karten oder ist angepasst). (5) Die Roadmap-Übersicht führt `004` vor `002`; `002` nennt „startet nach `004`“ (R4).
- Umsetzung (2026-09-23): Normen und Roadmap wie oben; Features-Katalog N/A (nur Doku).
### T-002: UI-Prototyp erweitern und freigeben lassen
- [x] Beschreibung: `spikes/ui-prototype/index.html` erweitern (Arbeitsweise laut Roadmap: UI vor Umsetzung als Prototyp abstimmen):
  - Sichtbarkeitsauswahl mit drei Stufen („nur ich“, „nur Spielleitung“, „veröffentlicht“) in Artikel-, Quest-, Kapitel- und Pin-Formular; Badge für `nur ich` analog zum bestehenden Badge „nur Spielleitung“; Universum- und Kartenformular unverändert zweistufig.
  - Quest-Seite: Beschreibung, darunter Kapitelliste (Titel, Text, Sichtbarkeits-Badge), für die Spielleitung Kapitel anlegen, bearbeiten, löschen, verschieben und die Sichtbarkeit direkt in der Liste schalten.
  - Quest-Seite: Notizblock-Bereich (Lesen, Bearbeiten, Speichern, Konflikthinweis mit „Neu laden“).
  - „Ansicht als“ um eine Owner-Simulation ergänzen, sodass `nur ich` für andere Rollen verschwindet.
  - Nummerierung der Kapitel aus Player-Sicht: fortlaufend über die für ihn sichtbaren Kapitel (verrät keine versteckten Kapitel).
- Abhängigkeiten: T-001
- Abnahmekriterium: (1) Der Prototyp zeigt alle oben genannten Punkte auf 390 px und Desktop. (2) Der Projektinhaber hat den Prototyp im Chat freigegeben; Datum der Freigabe steht in diesem Plan unter T-002. (3) Freigegebene Beschriftungen und Anordnung sind in den Aufgaben T-005, T-008, T-010 als Referenz übernommen (Verweis auf den Prototyp genügt).
- Freigabe: 2026-09-23 (Projektinhaber im Chat). Layout: Kapitel volle Breite unter Verknüpft; Notizblock per 📝-Icon als Sheet; Löschen mit Confirm-Dialog. Scroll-Anker an Elementposition bewusst nicht umgesetzt (kosmetisch akzeptiert).
- Umsetzung (2026-09-23): `spikes/ui-prototype/index.html` (Plan 004). Features-Katalog N/A (nur Prototyp).
### T-003: Schema für Owner und dreistufige Sichtbarkeit
- [x] Beschreibung: In `src/db/schema.ts`:
  - neues Enum `content_visibility` (`owner_only`, `gm_only`, `published`); `visibility_status` bleibt für `universes` und `maps`;
  - `articles.visibility`, `quests.visibility`, `pins.visibility` auf `content_visibility` umstellen, Default `owner_only`;
  - Spalte `owner_id` (Pflicht, FK auf `users.id` mit demselben Löschverhalten wie `created_by`) an `articles`, `quests`, `pins`, Index `(world_id, owner_id)` an `articles` und `quests` (Pins haben keine `world_id`; sie werden immer über `map_id` gelesen, dort reicht der bestehende Index `pins_map`);
  - Migration mit `npm run db:generate` erzeugen und so anpassen, dass sie Bestandsdaten erhält: Spaltentyp per Cast (`USING visibility::text::content_visibility`), `owner_id` aus `created_by` befüllen, danach `NOT NULL`.
  - TypeScript-Typen in `src/lib/authz/types.ts` ergänzen (`ContentVisibility`).
- Abhängigkeiten: T-001
- Abnahmekriterium: (1) `npm run db:migrate` läuft lokal auf einer Datenbank mit Bestandsdaten aus Plan `003` durch. (2) Danach haben alle vorhandenen Artikel, Quests und Pins ihren alten Sichtbarkeitswert und `owner_id = created_by` (prüfbar per SQL-Abfrage, Ergebnis im Umsetzungsvermerk). (3) Ein Insert ohne Sichtbarkeit ergibt `owner_only`. (4) `universes.visibility` und `maps.visibility` akzeptieren `owner_only` nicht. (5) `npm run typecheck` grün.
- Umsetzung (2026-09-23): Migration `0013_content_visibility_owner.sql`. SQL-Check: articles 3×gm_only + 1×published, quests 1×published, pins 1×published; überall `owner_id = created_by`. Insert ohne visibility → `owner_only`. Enum `visibility_status` = {published,gm_only}. Create-Pfade setzen `ownerId`. Features-Katalog N/A (Schema).

### T-004: Rechteschicht dreistufig
- [x] Beschreibung: `src/lib/authz` um die Owner-Stufe erweitern: Sichtbarkeitsprüfung bekommt Betrachter-ID, Rolle, Sichtbarkeit und `owner_id` (`APP-VIS-OWNER`); Bearbeitungsprüfung laut *Fachliche Regeln*; Vererbung für Pins (Universum/Karte zweistufig, Pin dreistufig). Alle Aufrufer umstellen, u. a. `src/lib/domain/articles.ts`, `quests.ts`, `search.ts`, `mention-search.ts`, `mention-resolve.ts`, `linked.ts`, `relations.ts`, `src/lib/map/repository.ts`, und die Anzeige-Badges (`src/components/world/display.tsx`). Karten-Ereignisse auf Signal umstellen (R5): `map.pin` und `map.marker` in `src/lib/realtime/events.ts` und `src/lib/map/repository.ts` tragen nur noch `pinId` bzw. `markerId` (plus `mapId`); `src/components/map/use-map-realtime.ts` holt den Datensatz über `GET …/map/pins/[pinId]` bzw. einen neuen `GET …/map/markers/[markerId]` (gleiche Rechteprüfung wie der Kartenzustand) und entfernt ihn bei 404. Anlegen setzt `owner_id` auf den Benutzer. Anlegen von Stub-Artikeln über `@` setzt `owner_only`.
- Abhängigkeiten: T-003
- Abnahmekriterium: (1) Unit-Tests in `src/lib/authz/authz.test.ts` decken die Tabelle *Sichtbarkeit je Stufe* vollständig ab (3 Stufen × GM/Master/Player × Owner ja/nein). (2) API-Tests: Ein `owner_only`-Artikel, eine `owner_only`-Quest und ein `owner_only`-Pin des Masters A liefern für den Game Master und Master B 404 bei `GET`, erscheinen nicht in Listen, Hub-Suche, `@`-Suche, „Verknüpft“ und Karte; für A sind sie überall sichtbar. (3) `PATCH` durch den Game Master auf A's `owner_only`-Artikel wird abgelehnt; auf `gm_only` erlaubt; ein `PATCH` des Game Masters, das A's `gm_only`-Artikel auf `owner_only` setzt, ergibt 403 und ändert nichts (R2). (4) Kein Karten-Ereignis in `src/lib/realtime/events.ts` enthält Titel, Beschreibung, Name oder Position (Typ- oder Unit-Test auf die Ereignistypen); ein API-Test belegt, dass ein Player nach einem Ereignis zu einem `gm_only`-Pin beim Abruf 404 erhält; Browser-Prüfung: Spielleitung verschiebt einen `gm_only`-Pin auf einer veröffentlichten Karte, die offene Karte des Players zeigt ihn nicht, die des Masters zeigt die neue Position ohne Seiten-Neuladen (R5). (5) Ein `owner_only`-Pin auf einer `published`-Karte ist für Player unsichtbar, ein `published`-Pin auf einer `gm_only`-Karte ebenfalls. (6) Bestehende Tests aus Plan `003` bleiben grün. (7) Wird Master A zum Player herabgestuft, erhält A für seinen `owner_only`-Artikel 404 und sieht ihn in keiner Liste; nach Hochstufung zum Master sieht und bearbeitet A ihn wieder (R1).
- Umsetzung (2026-09-23): `APP-VIS-OWNER` + `authorizeOwnedContentWrite`; SSE `map.pin`/`map.marker` nur IDs, Client-Refetch; `GET …/markers/[markerId]`. Unit-Matrix in `authz.test.ts`; API `owner-visibility.api.test.ts`; `events.test.ts` Signal-only. `npm test` 138, `npm run test:rechte` 100 grün. Browser Zwei-Sitzungen R5: Live-Sync über Signal+Refetch im Code; Player-404 und Vererbung per API belegt — Dual-Login im gemeinsamen Browser-Cookie nicht automatisierbar, erneute Sichtprüfung in T-013. Features-Katalog N/A (Rechteschicht).

### T-005: Oberflächen für dreistufige Sichtbarkeit
- [x] Beschreibung: Sichtbarkeitsauswahl in `ArticleForm`, `QuestForm` und im Pin-Formular (`src/components/map/MapSheets.tsx`) von Schalter auf drei Stufen umstellen, Default beim Anlegen „nur ich“; Badge „nur ich“ in Listen und Detailseiten; Universum- und Kartenformulare unverändert. Gestaltung laut freigegebenem Prototyp (T-002).
- Abhängigkeiten: T-002, T-004
- Abnahmekriterium: (1) Neu angelegter Artikel, neue Quest und neuer Pin stehen ohne weitere Auswahl auf „nur ich“. (2) Alle drei Stufen sind je Formular wählbar und werden gespeichert (Neuladen zeigt den gewählten Wert). (3) Liste und Detailseite zeigen das Badge „nur ich“ bzw. „nur Spielleitung“; `veröffentlicht` ohne Badge. (4) Universum- und Kartenformular bieten weiter nur zwei Stufen. (4a) Beim Bearbeiten eines fremden Datensatzes fehlt die Option „nur ich“ (R2). (5) Browser-Prüfung auf 390 px gegen die Testwelt, Ergebnis im Umsetzungsvermerk.
- Umsetzung (2026-09-23): `ContentVisibilitySelect` (drei Stufen, R2 ohne „nur ich“ bei fremdem Owner); Badge „nur ich“ via `GmBadge`; Pin-Default `owner_only`. Browser Smoke @390: Formular Default „nur ich“, Detail-Badge sichtbar; Universum weiter Schalter; R2 auf T-008 Testwelt (GM editiert Master-Artikel → Hinweis, kein `owner_only` in Select). Features-Katalog aktualisiert.

### T-006: Kapitel — Schema, Domäne, API
- [x] Beschreibung: Tabelle `quest_chapters` (`id`, `quest_id` FK mit `on delete cascade`, `title` 1–200, `body_json`, `body_plain`, generiertes `body_tsv` wie bei `quests`, `position` integer, `visibility content_visibility` Default `owner_only`, `owner_id`, Protokollfelder; Index `(quest_id, position)`; GIN-Index auf `body_tsv`). Domäne in `src/lib/domain/quest-chapters.ts`. APIs:
  - `GET|POST /api/worlds/[worldId]/quests/[questId]/chapters` (Liste nur sichtbarer Kapitel, sortiert nach `position`; Anlegen hängt ans Ende an),
  - `PATCH|DELETE …/chapters/[chapterId]` (Titel, Text, Sichtbarkeit),
  - `PUT …/chapters/order` (vollständige Liste der Kapitel-IDs in neuer Reihenfolge; nur Spielleitung; nur gültig, wenn sie genau die Kapitel der Quest enthält, die der Aufrufer sieht; für den Aufrufer unsichtbare Kapitel behalten ihren Index in der Gesamtliste, die sichtbaren werden in der gesendeten Reihenfolge auf die übrigen Plätze verteilt, R3).
  Rechte laut *Fachliche Regeln*, Vererbung Quest → Kapitel. `GET` der Quest liefert die für den Betrachter sichtbaren Kapitel mit.
- Abhängigkeiten: T-004
- Abnahmekriterium: (1) Test `quest-chapters.api.test.ts`: Player sieht in einer `published`-Quest nur `published`-Kapitel; in einer `gm_only`-Quest kein Kapitel (Quest 404). (2) Kapitel mit `owner_only` sieht nur sein Owner. (3) Player-`POST`/`PATCH`/`DELETE`/`PUT order` wird abgelehnt. (4) Umsortieren ändert die Reihenfolge in der nächsten `GET`-Antwort; eine Liste mit fremder oder fehlender ID ergibt 400. (4a) Gesamtliste [K1, K2 (`owner_only` von B), K3, K4]; A sendet [K4, K3, K1] → Ergebnis [K4, K2, K3, K1] (R3). (5) Löschen der Quest löscht ihre Kapitel. (6) Titel leer oder > 200 Zeichen ergibt 400.
- Umsetzung (2026-09-23): Schema `questChapters` + Migration `0014_quest_chapters.sql`; Domäne `quest-chapters.ts`; APIs list/create/patch/delete/order; `getQuest` liefert `chapters`; Tests in `quest-chapters.api.test.ts` (7 grün). `recalcQuestRelations` nach Create/Update/Delete (Kapitel-Mention-Logik folgt in T-007). Features-Katalog N/A (API/Schema).

### T-007: Kapitel — Relationen und Suche
- [x] Beschreibung: `recalcQuestRelations` (`src/lib/domain/relations.ts`, aufgerufen aus `src/lib/domain/quests.ts`) so erweitern, dass Mention-Relationen der Quest aus Beschreibung **und** allen Kapiteln mit `visibility = published` berechnet werden (`APP-CHAPTER-REL`); Aufruf nach jedem Anlegen, Bearbeiten, Sichtbarkeitswechsel und Löschen eines Kapitels. Kein Backfill. Hub-Suche (`src/lib/domain/search.ts`): Kapiteltext liefert Treffer auf die Quest, nur aus Kapiteln, die der Betrachter sieht; Auszug aus dem Kapitel. Notizblock bleibt außerhalb der Suche.
- Abhängigkeiten: T-006
- Abnahmekriterium: (1) Erwähnung `@Gottschleim` in einem `gm_only`-Kapitel erzeugt keine Relation; nach Wechsel auf `published` erscheint sie in „Verknüpft“ der Quest und des Artikels; nach Rückwechsel oder Löschen des Kapitels verschwindet sie wieder, sofern Beschreibung und andere veröffentlichte Kapitel sie nicht enthalten. (2) Manuelle Relationen und `participation` bleiben bei allen Neuberechnungen unverändert. (3) Die Hub-Suche nach einem Wort, das nur in einem `gm_only`-Kapitel steht, findet die Quest für die Spielleitung, nicht für Player; ein Wort aus einem `published`-Kapitel einer `published`-Quest findet sie auch für Player. (4) Tests dafür liegen in `quest-chapters.api.test.ts` bzw. dem bestehenden Such-Test.
- Umsetzung (2026-09-23): `recalcQuestRelations` merged Mentions aus Quest-Beschreibung + `published`-Kapiteln; Hub-Suche `searchQuestChapters` mit `APP-VIS-OWNER`/Vererbung, Treffer auf Quest, Snippet aus Kapitel. Tests in `quest-chapters.api.test.ts` (T-007). Features-Katalog N/A (Domäne).

### T-008: Kapitel — Oberfläche
- [x] Beschreibung: Quest-Seite `/w/[worldId]/quests/[questId]` um die Kapitelliste unter der Beschreibung erweitern; Spielleitung: anlegen, bearbeiten (Titel, Editor mit Erwähnungen), löschen mit Bestätigung, verschieben, Sichtbarkeit in der Liste schalten. Player sehen nur sichtbare Kapitel ohne Bearbeitungselemente. Nummerierung und Anordnung laut freigegebenem Prototyp (T-002). Kein Branching, keine erzwungene Reihenfolge.
- Abhängigkeiten: T-002, T-006, T-007
- Abnahmekriterium: Browser-Prüfung auf 390 px mit Beispiel „Erlege den Wolf“ (drei Kapitel „Finde den Wolf“, „Töte den Wolf“, „Belohnung“, alle `gm_only`): (1) Player sieht nur die Beschreibung. (2) Spielleitung veröffentlicht Kapitel 1 → Player sieht nach Neuladen Kapitel 1. (3) Spielleitung veröffentlicht Kapitel 3 ohne Kapitel 2 → Player sieht zwei Kapitel, nummeriert 1 und 2. (4) Verschieben ändert die Reihenfolge für beide Rollen. (5) Löschen fragt nach und entfernt das Kapitel. Ergebnis im Umsetzungsvermerk.
- Umsetzung (2026-09-23): `QuestChapters.tsx` + Quest-Seite Layout (Kapitel volle Breite unter `grid2`); Styles `.chapters-block`/`.chapter`/…; `apiRequest` unterstützt PUT (Order). API-Abnahme „Erlege den Wolf“: (1)–(4) per Test-Login/API bestanden (Player 0 Kapitel → nach Pub1 eins → Pub3 ohne 2 ergibt Nummerierung 1/2; Reorder wirkt für Player+GM); (5) Confirm-Sheet im Browser @~390 (GM), Löschen per API. Player-HTML: Beschreibung + „Noch keine freigegebenen Kapitel.“, keine Edit-Controls. Features-Katalog: Quest-Kapitel shipped.

### T-009: Notizblock — Schema, Domäne, API
- [x] Beschreibung: Tabelle `quest_notes` (`quest_id` Primärschlüssel und FK mit `on delete cascade`, `body_json`, `body_plain`, `version` integer Default 0, `updated_at`, `updated_by`). Zeile entsteht beim ersten Speichern. Domäne `src/lib/domain/quest-notes.ts`. API `GET|PUT /api/worlds/[worldId]/quests/[questId]/notes`: `GET` liefert Inhalt und Version (leer mit Version 0, wenn keine Zeile existiert); `PUT` mit `{ bodyJson, version }` speichert nur, wenn `version` der gespeicherten entspricht, erhöht sie um 1 und liefert die neue Version; sonst HTTP 409 mit aktueller Version (`APP-NOTE-VERSION`). Erwähnungen werden gespeichert und beim Lesen aufgelöst, erzeugen aber keine Relationen (`APP-NOTE-NO-REL`). Zugriff: alle Mitglieder, die die Quest sehen.
- Abhängigkeiten: T-004
- Abnahmekriterium: (1) Player liest und schreibt den Notizblock einer `published`-Quest; bei einer `gm_only`-Quest 404. (2) Zwei `PUT` mit derselben Ausgangsversion: der erste speichert, der zweite erhält 409 und ändert nichts. (3) Eine Erwähnung im Notizblock erzeugt keine Zeile in `relations`. (4) Löschen der Quest löscht den Notizblock. (5) Tests in `quest-notes.api.test.ts`.
- Umsetzung (2026-09-23): Schema `questNotes` + Migration `0015_quest_notes.sql`; Domäne `quest-notes.ts`; API GET/PUT mit Versionsprüfung und Mention-Resolve ohne Relationen; Tests in `quest-notes.api.test.ts` (4 grün). Features-Katalog N/A (API/Schema).

### T-010: Notizblock — Oberfläche
- [x] Beschreibung: Notizblock-Bereich auf der Quest-Seite: Anzeige, Bearbeiten im bestehenden Editor mit `@`-Vorschlägen, Speichern; bei 409 Hinweis „Die Notiz wurde inzwischen geändert“ mit Knopf „Neu laden“, der eigene Text bleibt bis dahin im Editor. Letzte Änderung (Name, Zeitpunkt) anzeigen. Gestaltung laut Prototyp (T-002).
- Abhängigkeiten: T-002, T-009
- Abnahmekriterium: Browser-Prüfung mit zwei Sitzungen (Test-Login Player und Master) auf derselben Quest: (1) Player speichert eine Notiz, Master sieht sie nach Neuladen. (2) Beide öffnen den Editor, Player speichert zuerst, Master erhält beim Speichern den Konflikthinweis, sein Text ist noch im Editor; „Neu laden“ zeigt den Stand des Players. (3) Erwähnung im Notizblock ist klickbar. Ergebnis im Umsetzungsvermerk.
- Umsetzung (2026-09-23): `QuestNotesSheet.tsx` (📝 FAB bei Verknüpft, Sheet mit Anzeige/Bearbeiten); Domäne liefert `updatedByName`; `apiRequest` reicht 409-Body durch. API: (1) Player-PUT → Master-GET sieht Text; (2) Konflikt 409 + eigener Text bleibt bis Neu laden; (3) View-Modus mit `RichTextView`/resolveMentions (klickbar). Dual-Session-Browser im gemeinsamen Cookie nicht praktikabel — Konflikt per API, UI per Browser-Smoke. Features-Katalog: Quest-Notizblock shipped.

### T-011: Rechte-Testskript erweitern
- [x] Beschreibung: `npm run test:rechte` (Konfiguration `vitest.rechte.config.ts`) führt alle `src/**/*.api.test.ts` aus; die API-Tests aus T-004, T-006 und T-009 laufen dort also automatisch mit. Diese Aufgabe prüft die Abdeckung und ergänzt fehlende Fälle: Owner-Stufe je Inhaltsart (Artikel, Quest, Kapitel, Pin), Bearbeiten fremder `owner_only`-Datensätze, Kapitel-Vererbung, Notizblock-Zugriff, Karten-Ausnahme (Universum/Karte lehnen `owner_only` ab).
- Abhängigkeiten: T-004, T-006, T-009
- Abnahmekriterium: `npm run test:rechte` läuft grün und enthält je genannter Fallgruppe mindestens einen Test (Liste der Testnamen im Umsetzungsvermerk).
- Umsetzung (2026-09-23): Neue Suite `owner-coverage.api.test.ts` mit den fünf Fallgruppen. Zusätzlich Drift-Fixes für grünes `test:rechte`: Deadlock `resolveParticipants` innerhalb von Quest-Tx (Dev-Pool max=1); SSE-Test Pin-Typ/`eventForViewer`-Erwartung; Files-Test Map-JSON+Charakter-Shape; Quest-Participant-Assertion inkl. `id`. Features-Katalog N/A (Tests/Bugfix).
  - Owner-Stufe: `T-011 owner tier per content type > hides owner_only article, quest, chapter and pin from non-owners` (+ T-004/T-006)
  - Fremdes `owner_only` bearbeiten: `T-011 editing foreign owner_only > rejects GM PATCH on master's owner_only quest, chapter and pin` (+ T-004 Artikel)
  - Kapitel-Vererbung: `T-011 chapter inheritance > hides published chapters when the quest itself is gm_only for players` (+ T-006 (1))
  - Notizblock: `T-011 notes access > allows player notes on published quest and denies gm_only quest` (+ T-009 (1))
  - Karten-Ausnahme: `T-011 map exception > rejects owner_only for universe and map visibility`
- `npm run test:rechte`: 138 grün.
### T-012: Abgleich Plan 002
- [x] Beschreibung: `.ai/feature-tasks/002-mcp-server.md` gegen den neuen Stand lesen (dreistufige Sichtbarkeit, Owner, Kapitel, Notizblock). Abweichungen und offene Fragen im bestehenden Abschnitt *Abgleich Plan 002 nach MVP* in `.ai/architecture.md` ergänzen, u. a.: Sieht Claude `owner_only`-Inhalte des angemeldeten Owners? Werden Kapitel mit ausgeliefert? Ist der Notizblock (wie Tagebuch) ausgeschlossen? Plan `002` nicht eigenmächtig ändern.
- Abhängigkeiten: T-004, T-006, T-009
- Abnahmekriterium: Der Abschnitt enthält einen Unterpunkt „nach Plan 004“ mit jeder Abweichung samt Fundstelle in Plan `002` und den drei genannten Fragen, sofern nicht bereits beantwortet.
- Umsetzung (2026-09-23): Unterpunkt *nach Plan 004* in `.ai/architecture.md` (P4-1–P4-6 + drei offene Fragen). Plan 002 unverändert. Features-Katalog N/A (Doku).

### T-013: Browser-Gesamtabnahme und Abschluss
- [ ] Beschreibung: Alle Browser-Abnahmen aus T-005, T-008, T-010 in einem Durchgang gegen die lokale Testwelt wiederholen (Rollen Game Master, Master, Player). `.ai/roadmap.md` Status von `004` nachziehen. Push nur nach ausdrücklicher Freigabe des Projektinhabers.
- Abhängigkeiten: T-005, T-008, T-010, T-011, T-012
- Abnahmekriterium: (1) Eine Tabelle „Abnahme“ unter T-013 listet jeden Punkt mit „bestanden“ oder Befund. (2) `npm test`, `npm run test:rechte`, `npm run typecheck`, `npm run build` grün. (3) Roadmap-Zeile für `004` zeigt „✅ abgeschlossen“ mit Datum.

## Reihenfolge (Abhängigkeitsgraph)

```
T-001 Normen ─┬─ T-002 Prototyp (Freigabe) ──────────────┐
              └─ T-003 Schema ─ T-004 Rechteschicht ─┬───┼─ T-005 UI Sichtbarkeit
                                                     ├─ T-006 Kapitel API ─ T-007 Relationen/Suche ─ T-008 UI Kapitel
                                                     └─ T-009 Notizblock API ─────────────────────── T-010 UI Notizblock
T-011 Rechte-Skript (nach T-004, T-006, T-009)
T-012 Abgleich 002 (nach T-004, T-006, T-009)
T-013 Abschluss (nach allem)
```

T-002 blockiert nur die Oberflächen-Aufgaben (T-005, T-008, T-010); T-003 bis T-007 und T-009 können ohne Prototyp-Freigabe beginnen.
