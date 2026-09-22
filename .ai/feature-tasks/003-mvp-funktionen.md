# 003 – MVP-Funktionen (Spike → produktive App)

## Kontext & Ziel

Plan `001` hat die Infrastruktur gewählt, per Spikes bewiesen und als Go festgehalten. Die App ist heute ein **Grundgerüst plus Spike-Seiten** (`/spike/karte`, `/spike/chat`) und eine **Rechte-API** (`/api/spike/rechte`) auf einem Teil des technischen Schemas. Es gibt noch keine bedienbare Welt-App.

**Ziel dieses Plans:** die Funktionen **F1–F10** aus Plan `001` als eine Mobile-First-App ausliefern. Die Spikes werden nicht parallel weiterbetrieben, sondern **in Produktcode überführt** (Editor, Karte, Chat, Rechteschicht) und danach entfernt.

Am Ende steht:

1. eine angemeldete App mit Shell (Bottom-Bar laut `.ai/standards/mobile-navigation.md`),
2. Welten, Universen, Mitglieder, Einladungen, Artikel mit Vorlagen und Erwähnungen, Relationen, Quests, Charaktere, Tagebuch, Karten mit Pins/Markern und Gruppenchat,
3. dieselbe Rechteschicht für UI und HTTP, die Plan `002` (MCP) später wiederverwendet,
4. aktualisierte Projektnormen (Ordnerstruktur ohne Spike-Pfade).

**Nicht Ziel dieses Plans:**

- MCP-Server (Plan `002`, danach),
- alles in Plan `001` unter *Abgrenzung → Backlog* und in `.ai/backlog.md` (u. a. Karten-Zoom-Feinschliff, KI-Chat in der App, Backup, Bilder im Artikeltext, Kampfwerte),
- Spike-Daten migrieren (`spike_*` ist Testdata, kein Produktivbestand).

### Ausgangslage (Stand nach Plan 001)

Bereits vorhanden und **wiederzuverwenden**, nicht neu zu erfinden:

| Vorhanden | Wird im MVP |
|---|---|
| Discord-Login, Test-Login, Session | bleibt |
| `src/spike/rechte` (Authz + HTTP + `npm run test:rechte`) | nach `src/lib/authz` und Produkt-APIs |
| Drizzle-Tabellen für Welten, Mitgliedschaften, Universen, Karten, Pins, Charaktere, Artikel, Relationen, Tagebuch (Plan `001` T-011) | vervollständigen, Lücken schließen |
| Leaflet-Karte, Pins, Marker, SSE nach Drop | an `maps` / `pins` / `character_markers` und Weltkontext hängen |
| Chat-Composer, Markdown, serverseitige Würfel, SSE | an echte Welten hängen |
| TipTap-Spike `spikes/editor/` | in die Next-App ziehen |

Bekannte **Schema-Lücken** gegenüber `.ai/architecture/datenmodell.md` (Plan `001` T-011 hat nicht alles gebaut):

- Tabellen `quests`, `quest_participants`, `character_images` fehlen.
- Charakter-Attribute `attr_str` … `attr_cha` fehlen.
- Relationen haben keine Quest-FKs (`source_quest_id` / `target_quest_id`), obwohl `content_kind` `quest` enthält.
- Produkt-`chat_messages` fehlt (nur `spike_chat_*`).
- Such-Indizes (`pg_trgm`, `*_tsv`) fehlen.
- Stub-Artikel: `first_edited_at` (oder gleichwertiges Flag) laut `.ai/standards/erwaehnungen.md` fehlt noch im technischen Modell.

### Abgrenzung gegenüber den Spikes

| Spike-Verhalten | MVP |
|---|---|
| `/spike/karte`, `/spike/chat` | nach Cutover **entfernen** (kein Dauer-Redirect nötig) |
| `/api/spike/*` | durch Produkt-APIs ersetzen, danach entfernen |
| Pin-Sperre (`locked` am Spike-Pin) | übernehmen, sperren und entsperren **nur Spielleitung** (Fachmodell 3.7 und Rechte je Entität, ergänzt am 2026-09-22 mit Freigabe des Projektinhabers; Code-Review CR-020) |
| Karten-Filter / Teilen aus Spike-UX | **nicht** übernehmen, sofern nicht F2/F5 (Deep-Link auf Pin bleibt) |
| Chat-Kanäle und Threads | übernehmen und ausbauen: volle Kanalverwaltung, Threads eingerückt mit Chevron (siehe *Chat-Produktmodell*) |

## Begriffe & Systeme

Die Begriffe aus Plan `001` und dem fachlichen Datenmodell gelten unverändert (Welt, Universum, Game Master, Master, Player, Spielleitung, Mitbringen, Pin-Typen, Relation, Erwähnung, Sichtbarkeitsstatus, Test-Login, SSE). Zusätzlich:

- **Produkt-App**: Die bedienbare Oberfläche unter authentifizierten Routen, nicht die Spike-Seiten.
- **App-Shell**: Gemeinsames Chrome nach dem Login: Bottom-Bar (Handy) bzw. dieselbe Vierzahl auf Desktop, Weltkontext, Versionsbadge.
- **Weltkontext**: Die aktuell geöffnete Welt. Karte, Chat, Artikel, Quests, Mitglieder und Tagebuch dieser Welt hängen daran.
- **Universumskontext**: Das aktuell gewählte Universum der Welt (für die Karten-Ansicht). Fallback: erstes für den Benutzer sichtbares Universum.
- **Rechteschicht**: Serverseitige TypeScript-Funktionen, die für einen Benutzer und eine Aktion erlauben oder ablehnen. Eine Schicht für HTTP, UI-Loader und später MCP. Keine Rechte nur in der Oberfläche.
- **Vorlagen-Registry**: TypeScript-Modul mit den MVP-Vorlagentypen. Keine Benutzervorlagen. Neue Typen = Codeänderung, keine Migration.
- **Stub-Artikel**: Über `@` angelegter Artikel ohne erste echte Bearbeitung. Erwähnung **rot**, bis `first_edited_at` gesetzt ist (erstes Speichern mit Text oder Vorlagenfeld, siehe T-009); danach **blau**. Norm: `.ai/standards/erwaehnungen.md`.
- **Cutover**: Zeitpunkt, ab dem Spike-Routen und `spike_*`-Tabellen entfernt sind und nur noch Produktpfade existieren.
- **Onboarding**: Angemeldeter Benutzer ohne aktive Weltmitgliedschaft: Welt anlegen oder per Einladungslink beitreten.

## Relevante Normen

- `.ai/architecture/datenmodell-fachlich.md` — fachliche Entitäten, Regeln, Löschregeln, Rechte; bei Abweichung hat dieses Dokument Vorrang.
- `.ai/architecture/datenmodell.md` — technisches Schema (Tabellen, Constraints, APP-*-Regeln, Suche, Relationen).
- `.ai/tech-stack.md` — Next.js, Drizzle, Better Auth, Leaflet, TipTap, SSE, Coolify/GHCR.
- `.ai/conventions.md` — Sprache UI Deutsch / Code Englisch, Secrets, Test-Login nie in Produktion.
- `.ai/architecture/README.md` — Komponenten und Datenfluss.
- `.ai/standards/mobile-first.md` — Handy ~390 px zuerst.
- `.ai/standards/mobile-navigation.md` — Bottom-Bar: Kampagne, Karte, Chat, Menü; nur Chat überschreibt.
- `.ai/standards/erwaehnungen.md` — `@`-Suche, Stub-Artikel, Query nur `@`→Caret.
- `.ai/decisions/001-backend.md` … `004-editor.md`
- `.ai/infrastructure/deployment.md` — Prod `worldcraft.lagolago.at`, kein Staging, Test-Login nur lokal.
- Plan `001` (F1–F10, Rechtematrix) und Plan `002` (nur als Abnehmer der Rechteschicht, nicht umsetzen).
- `spikes/ui-prototype/index.html` — verbindliche Design-Referenz für alle Oberflächen dieses Plans (siehe *Design-Referenz*).
- `.ai/code-review-001-mvp-infrastruktur-2026-09-22.md` — Findings CR-001 bis CR-023 mit Empfehlung, Abnahmekriterium und Abhängigkeiten. Vor jeder Aufgabe die in ihrer Zeile *Code-Review* genannten Findings lesen (siehe *Code-Review zu Plan 001*).

## Design-Referenz (UI-Prototyp)

**Freigegeben durch den Projektinhaber am 2026-09-22.** Der klickbare Prototyp `spikes/ui-prototype/index.html` zeigt Aufbau, Anordnung und Bedienung der Oberflächen dieses Plans. Er ist eine einzelne HTML-Datei ohne Build und ohne Server-Anbindung; öffnen per Doppelklick oder `python3 -m http.server` im Ordner. Unter 768 px Breite zeigt er den Handy-Modus mit Bottom-Bar, darüber die Seitenleiste mit denselben vier Zielen. Oben rechts simuliert „Ansicht als“ die Rollen Game Master, Master und Player.

Verbindlich übernommen werden:

- **Layout und Anordnung** je Ansicht: Kampagnen-Hub (Welten, Universen, Artikel mit Vorlagen-Filter, Quests, Live-Suche), Artikel (Titelbild, Vorlagenfelder, Text; rechts „Verknüpft“), Editor mit Toolbar und `@`-Vorschlagsliste, Quest, Universum, Karte (Universums-Chips oben, Zoom-Knöpfe und „+“ unten rechts, Pin-Popup als Bottom-Sheet bzw. Dialog), Chat (Kanalliste mit eingerückten Threads und Chevron, Composer mit „+“, Würfel, Eingabe, Senden; Würfelfenster), Menü, Tagebuch.
- **Charakterbogen und Bearbeiten-Seite**: links Attribute, Fertigkeiten, direkt darunter Fähigkeiten, dann Persönlichkeit/Ideale/Bindungen/Makel und Bio; rechts Bilder und darunter „Verknüpft“. Fertigkeiten zeigen Name, Attribut mit Modifikator, Übungsgrad und rechts den Gesamtbonus; der Übungsbonus erscheint nur im Bearbeiten-Formular. Fähigkeiten zeigen Text, Attribut und den Modifikator. Listen werden per „+“ erweitert und per ✕ gekürzt.
- **Beschriftungen**: Artikel tragen kein Tag „Artikel“, nur den Vorlagentyp (ohne Vorlage kein Tag). Stub-Erwähnungen rot, bearbeitete blau, unsichtbare als reiner Text.
- **Interaktionen**: Tagebuch-Sichtbarkeit per Tipp auf die Pill mit Bestätigungsdialog; Chat-Kanalverwaltung nur im Chat (nicht im Menü); Nachrichten, die einen Thread eröffnen, sowie Würfe sind nicht löschbar.

Nicht verbindlich sind: Testdaten, Farben im Detail, die Emoji-Symbole (Platzhalter, Icons entstehen während des Baus), die simulierte Rechte-Logik, Toast-Texte und die interne Umsetzung (Vanilla-JS). **Bei Widerspruch gilt der Text dieses Plans und der Normen**; ein erkannter Widerspruch wird gemeldet, nicht still aufgelöst. Änderungen an der Oberfläche während der Umsetzung werden im Prototyp nachgezogen, wenn der Projektinhaber sie freigibt.

## Globale Abhängigkeiten

- Plan `001` mit Einschätzung **Go** (liegt vor).
- Laufende lokale Umgebung: `docker compose up`, `.env` mit `ENABLE_TEST_LOGIN=true`, `npm run dev`.
- Produktion: Coolify + GHCR wie in `deployment.md`; Discord-App mit Redirects lokal und Prod.
- Keine neuen Secrets vorgesehen. Falls doch welche nötig werden: nur in `.env.example` als Namen, Werte nur lokal / in Coolify, nie im Chat.

## Commit & Push (verbindlich)

**Entscheidung Projektinhaber 2026-09-22 (Plan-Review):**

- Nach **jeder** abgeschlossenen Aufgabe committet `/plan-run` den Stand (ein Commit pro Task, Task-ID in der Commit-Nachricht, z. B. `T-007: Welten, Universen, Mitglieder`). Vorher laufen `npm test` und, sofern betroffen, der Build; schlägt etwas fehl, wird nicht committet, sondern pausiert.
- **Nie automatisch pushen.** Ein Push auf `main` löst über GHCR und Coolify ein Deploy auf `worldcraft.lagolago.at` aus. Gepusht wird nur nach ausdrücklicher Freigabe des Projektinhabers im Chat, jeweils für den dann vorliegenden Stand.
- Keine Secrets, keine `.env`, keine Uploads (`data/uploads/`) im Commit.

## Informationsarchitektur (verbindlich)

Nach dem Login gilt die Shell. **Handy:** angeheftete Bottom-Bar mit den vier Einträgen. **Desktop:** dieselben vier Ziele als dauerhaft sichtbare Leiste (nicht Hover-only); konkrete Anordnung (oben oder Seite) in T-006, solange Mobile-First am 390-px-Layout zuerst gebaut wird.

| Tab | Label | Inhalt |
|---|---|---|
| 1 | **Kampagne** | Welt wechseln/anlegen; Universen der aktuellen Welt; Artikel- und Quest-Listen; Suche in der Welt |
| 2 | **Karte** | Karte des Universumskontexts; Pins und Charakter-Marker |
| 3 | **Chat** | Chat der aktuellen Welt; Bottom-Bar vom Composer verdeckt |
| 4 | **Menü** | Mitglieder und Rollen, Einladungslinks (nur GM), Welt-Einstellungen, Charaktere der Welt, eigene Charaktere (weltunabhängig), Mitbringen, Tagebuch der aktuellen Welt, Abmelden |

**Routen** (HTTP-Pfade englisch, UI deutsch):

| Pfad | Zweck |
|---|---|
| `/` | Abgemeldet: Login. Angemeldet ohne Welt: Onboarding. Sonst Redirect auf letzte Welt. |
| `/invite/[code]` | Beitritt (angemeldet); archivierte Mitgliedschaft reaktivieren |
| `/w/[worldId]` | Kampagnen-Hub |
| `/w/[worldId]/articles/[articleId]` | Artikel (Ansicht/Bearbeiten laut Rolle) |
| `/w/[worldId]/quests/[questId]` | Quest |
| `/w/[worldId]/universes/[universeId]` | Universum (Beschreibung, Karten-Einstieg) |
| `/w/[worldId]/map` | Karte; Query `universe` (Universumskontext), `pin` (Deep-Link, zentrieren + hervorheben) |
| `/w/[worldId]/chat` | Chat |
| `/w/[worldId]/menu` | Menü der Welt |
| `/w/[worldId]/characters` | alle in diese Welt mitgebrachten (nicht archivierten) Charaktere; Einstieg aus dem Menü |
| `/w/[worldId]/characters/[characterId]` | Charakterbogen im Weltkontext inkl. „Verknüpft“; sichtbar für alle Mitglieder, solange die Teilnahme nicht archiviert ist; Besitzer sieht zusätzlich „Bearbeiten“ (→ `/characters/[characterId]`). Ziel für Links aus Marker, „Verknüpft“ und Quest-Beteiligten |
| `/w/[worldId]/journal/[characterId]` | Tagebuch eines eigenen mitgebrachten Charakters in dieser Welt |
| `/characters` | eigene Charaktere (weltunabhängig) |
| `/characters/[characterId]` | eigenen Charakterbogen bearbeiten; nur Besitzer, sonst 404 |

Letzte Welt und letztes Universum: `localStorage` (gerätelokal reicht im MVP). Ungültige IDs → Onboarding bzw. erstes sichtbares Universum.

Icons der Bottom-Bar: **Während des Baus definieren** (Norm sagt ausdrücklich „Icons … während der Shell-Umsetzung“). Labels und Reihenfolge sind fest.

Sichtbarkeit `nur Spielleitung` in der UI: Player sehen den Inhalt nicht (kein grauer Platzhalter). Spielleitung sieht eine klare Kennzeichnung.

## Vorlagen (festgelegt)

**Entscheidung Projektinhaber 2026-09-22 (Plan-Review):** Vier Typen wie unten (Person, Ort, Organisation, Gegenstand) plus „ohne Vorlage“, inklusive Verweisfeldern.

Vorlagentypen im Code, Schlüssel englisch, Labels deutsch. Zusätzlich immer `none` / „ohne Vorlage“ (keine Felder).

### `person` — Person

| Schlüssel | Bezeichnung | Feldart | Erlaubte Ziele |
|---|---|---|---|
| `aliases` | Andere Namen | Text | — |
| `occupation` | Beruf / Rolle | Text | — |
| `status` | Status | Auswahl: `alive` lebendig, `dead` tot, `missing` verschollen, `unknown` unbekannt | — |
| `location` | Aufenthaltsort | Verweis | Artikel `place` |
| `organization` | Organisation | Verweis | Artikel `organization` |

### `place` — Ort

| Schlüssel | Bezeichnung | Feldart | Erlaubte Ziele |
|---|---|---|---|
| `kind` | Art | Auswahl: `city` Stadt, `village` Dorf, `building` Gebäude, `region` Region, `dungeon` Dungeon, `wilderness` Wildnis, `plane` Ebene, `other` sonstiges | — |
| `ruler` | Herrscher | Verweis | Artikel `person` |
| `parent` | Übergeordneter Ort | Verweis | Artikel `place` |

### `organization` — Organisation

| Schlüssel | Bezeichnung | Feldart | Erlaubte Ziele |
|---|---|---|---|
| `kind` | Art | Auswahl: `guild` Gilde, `religion` Religion, `house` Adelshaus, `company` Freie Kompanie, `state` Staat, `cult` Kult, `other` sonstiges | — |
| `leader` | Anführer | Verweis | Artikel `person` |
| `seat` | Sitz | Verweis | Artikel `place` |

### `item` — Gegenstand

| Schlüssel | Bezeichnung | Feldart | Erlaubte Ziele |
|---|---|---|---|
| `kind` | Art | Auswahl: `weapon` Waffe, `armor` Rüstung, `artifact` Artefakt, `relic` Relikt, `mundane` alltäglich, `other` sonstiges | — |
| `owner` | Besitzer | Verweis | Artikel `person` oder Charakter |

Keine weiteren Typen im MVP (Kreatur, Fraktion extra, …). Ergänzung später nur in der Registry.

## Chat-Produktmodell (festgelegt)

**Entscheidung Projektinhaber 2026-09-22 (Plan-Review): volle Kanalverwaltung im MVP (Option C).** Das weicht bewusst vom Fachmodell ab (3.16: eine Nachrichtenliste pro Welt; Abschnitt 6: „Chat-Kanäle“ nicht im MVP). Der Backlog-Punkt „Chat: Channel-Verwaltung & Thread-UX“ in `.ai/backlog.md` wird damit in diesen Plan gezogen. Die Abweichung wird in T-001 in `datenmodell.md` (Abschnitt 3.17 und Abschnitt 13) dokumentiert. Das Fachmodell selbst bleibt unangetastet, bis der Projektinhaber es freigibt.

Modell:

- Eine Welt hat **einen oder mehrere Kanäle**. Beim Anlegen einer Welt entsteht automatisch der Kanal „Allgemein“.
- **Kanalverwaltung:** anlegen, umbenennen, Reihenfolge ändern, löschen. Rechte und Löschverhalten: siehe unten (*Kanalrechte*).
- **Threads:** Jeder Thread gehört zu genau einem Kanal (Hauptchat). Er wird über `+` → „Thread starten“ im Composer angelegt (wie im Spike, mit Eltern-Post im Kanal).
- Jede Nachricht gehört zu genau einem Kanal und optional zu einem Thread (`thread_id` leer = Hauptstrom des Kanals).
- **Kanalliste (verbindliche UI):** Kanäle (Hauptchats) stehen untereinander. Threads erscheinen **eingerückt unter ihrem Kanal**. Jeder Kanal mit mindestens einem Thread hat einen **Chevron**, der die Threads in der Liste auf- und zuklappt. Ein Tipp auf einen Kanal oder Thread öffnet dessen Nachrichtenstrom. Mobile-First: Die Liste ist bei ~390 px einhändig bedienbar, das Chevron ist ein eigenes Touch-Ziel (nicht Hover-only).
- Fachregeln bleiben: Autor = Benutzer, kein Bearbeiten, Löschen durch Autor bzw. Spielleitung, Würfelwürfe unlöschbar, Würfel nur serverseitig, max. 2000 Zeichen, SSE, letzte 50 Nachrichten plus Pagination je Strom.
- Spike-Tabellen nicht an Ort und Stelle umbenennen: neue Produkt-Tabellen `chat_channels`, `chat_threads`, `chat_messages`; die Spike-Tabellen werden in T-016 entfernt.

**Kanalrechte und Löschen (Entscheidung Projektinhaber 2026-09-22, Plan-Review):**

| Aktion | Game Master | Master | Player |
|---|:-:|:-:|:-:|
| Kanal anlegen, umbenennen, Reihenfolge ändern, archivieren, wiederherstellen | ✅ | ✅ | – |
| Kanäle und Threads sehen, darin lesen und schreiben, würfeln | ✅ | ✅ | ✅ |
| Thread starten | ✅ | ✅ | ✅ |

- **„Löschen“ eines Kanals = archivieren** (`archived_at`). Der Kanal verschwindet für alle aus der Liste. Nachrichten, Threads und Würfelwürfe bleiben gespeichert, damit gilt weiterhin „Würfelwürfe kann niemand löschen“. Die Spielleitung sieht archivierte Kanäle in einem eigenen Bereich und kann sie wiederherstellen.
- Der **letzte aktive Kanal** einer Welt kann nicht archiviert werden.
- Kanalname: Pflicht, max. 80 Zeichen (wie im Spike), eindeutig unter den aktiven Kanälen der Welt.
- Threads werden im MVP nicht einzeln archiviert oder gelöscht (nur zusammen mit ihrem Kanal ausgeblendet).

## Code-Review zu Plan 001 (verbindlich)

**Entscheidung Projektinhaber 2026-09-22:** Die Findings aus [`.ai/code-review-001-mvp-infrastruktur-2026-09-22.md`](../code-review-001-mvp-infrastruktur-2026-09-22.md) werden im Rahmen dieses Plans umgesetzt. Nur dieser Plan referenziert das Review; andere Pläne und Normen verweisen nicht darauf.

Regeln:

- Jedes Finding gehört zu den Aufgaben in der Tabelle. Jede Aufgabe nennt ihre Findings zusätzlich in der Zeile *Code-Review*. Maßgeblich für Empfehlung, Abnahmekriterium und Abhängigkeiten ist das Review-Dokument in der Fassung nach dem Plan-Review vom 2026-09-22 (Abschnitte *Umsetzungsrahmen* und *Abhängigkeiten & Reihenfolge*). Die Aufgabe ist erst abgeschlossen, wenn zusätzlich zu ihren eigenen Abnahmekriterien die **Abnahmekriterien der zugeordneten Findings** (im Review-Dokument unter „Findings im Detail“) erfüllt sind.
- Betrifft ein Finding Spike-Code, der in dieser Aufgabe ins Produkt übernommen wird, wird es im Produktcode behoben, nicht im Spike.
- Nach Abschluss einer Aufgabe wird die Status-Spalte im Review-Dokument nachgeführt (`/review-check` oder von Hand) und im selben Commit mitcommittet.
- Bei Abschluss dieses Plans hat kein Finding mehr den Status `offen`.
- Ist ein Finding mehreren Aufgaben zugeordnet, erfüllt jede Aufgabe das Abnahmekriterium für ihren Teil. Den Status `behoben` bekommt das Finding erst mit der letzten zugeordneten Aufgabe.
- Abnahmekriterien, die „genau eine Implementierung in `src/`“ verlangen (CR-012, CR-013), gelten bis T-016 für den Produktcode **ohne** `src/spike/`. T-016 prüft sie endgültig für ganz `src/`.

| Finding | Schwere | Aufgabe | Hinweis |
|---|---|---|---|
| CR-001 | kritisch | T-001 (Teil 1: Allowlist), T-016 (Teile 2 und 3: entfernen, Daten bereinigen) | Allowlist `ALLOWED_DISCORD_IDS`, fail closed in Produktion; kein Feature-Flag. Wirksam erst nach freigegebenem Push |
| CR-002 | kritisch | T-001 | Test-Runner Vitest. `npm test` muss grün sein, sonst kann kein Task committet werden |
| CR-003 | mittel | T-006 | |
| CR-004 | mittel | T-010 | Trigger `TRIG-REL-SAME-WORLD` entsteht in T-002 (siehe CR-018) |
| CR-005 | mittel | T-003 (Helfer und Regel), T-007 bis T-014 (anwenden) | T-003 liefert `parseJsonBody`/`parseUuid` und die Regel; jede Aufgabe, die APIs baut, wendet sie an: ungültige UUID/JSON → 400/404, nie 500 |
| CR-006 | mittel | T-012 (Chat), T-013 (Karte) | Resync nach Reconnect im gemeinsamen Realtime-Modul aus T-012; T-013 nutzt es und weist es für Pins und Marker nach |
| CR-007 | mittel | T-012 | Realtime bleibt In-Process; Norm „genau eine App-Replica“ in `architecture/README.md` und `deployment.md` |
| CR-008 | mittel | T-007 (Austritt, Einladung, Welt anlegen), T-012 (Thread mit Eröffnungsnachricht), T-013 (Kartenbild ersetzen) | Jeweils dort, wo der mehrstufige Schreibvorgang als Produktcode entsteht |
| CR-009 | mittel | T-001 | Direkt im Spike-Code, damit `tsc` in der CI ab T-001 grün ist |
| CR-010 | mittel | T-001 | CI prüft `npm test`, `tsc` und `eslint` vor dem Image-Build |
| CR-011 | mittel | T-007 (Teilnahmen archivieren), T-010 (Relationen), T-013 (Karten, Pins, Marker) | Keine DB-Query in Schleifen über Datensätze |
| CR-012 | mittel | T-012 (Realtime-Bus, SSE-Route, Sitzungsprüfung, `escapeHtml`), T-013 (Pin-Typen, Positionsformat), Endprüfung T-016 | Ein gemeinsamer Realtime-Bus und eine SSE-Route für Chat und Karte |
| CR-013 | mittel | T-003 (Authz-Helfer, typisierte Patches), T-013 (Marker-Autorisierung), Endprüfung T-016 | |
| CR-014 | niedrig | T-012, T-013 | |
| CR-015 | niedrig | T-001 (ESLint-Fehler), T-012, T-013 (Struktur) | ESLint ab T-001 grün; Hooks und Komponenten-Schnitt beim Übernehmen von Chat und Karte |
| CR-016 | niedrig | T-004 | |
| CR-017 | niedrig | T-006 | |
| CR-018 | niedrig | T-002 | Alle 8 `TRIG-*`, je mit Integrationstest |
| CR-019 | niedrig | T-008 (Teile b, c), T-015 (Teil a: Persistenz-Snapshot) | Ein Snapshot-Nachfolger in T-015 liefert keinen Klartext von `privat`-Einträgen |
| CR-020 | niedrig | T-002 (Spalte), T-013 (Rechte, UI) | Pin-Sperre wird übernommen, nur Spielleitung; Fachmodell 3.7 am 2026-09-22 ergänzt |
| CR-021 | niedrig | T-002 (Schema), T-012 | Würfe pro Term gespeichert und gruppiert angezeigt, z. B. `1d20-1d4 → [15] − [3] = 12` |
| CR-022 | niedrig | T-005 | |
| CR-023 | niedrig | T-007 | `sort_order` für Universen; übrige Konstanten jeweils in der Aufgabe, die den Code übernimmt |

## Aufgaben

### T-001: Entscheidungen in die Normen übertragen
- [ ] Beschreibung: Die im Plan-Review getroffenen Entscheidungen (Abschnitte *Vorlagen (festgelegt)* und *Chat-Produktmodell (festgelegt)*) in die Normdokumente übertragen:
  - `.ai/architecture/datenmodell.md` Abschnitt 3.17: Tabellen `chat_channels` (`world_id`, `name`, `sort_order`, `archived_at`, Protokollfelder), `chat_threads` (`channel_id`, `title`, `created_from_message_id`, Protokollfelder) und an `chat_messages` die Spalten `channel_id` (Pflicht), `thread_id` (optional), `opens_thread_id` (optional, eindeutig). `world_id` an `chat_messages` bleibt.
  - `.ai/architecture/datenmodell.md` Abschnitt 6: die vier Vorlagentypen mit Schlüsseln und Feldern.
  - `.ai/architecture/datenmodell.md` Abschnitt 13: Abweichung „Chat-Kanäle im MVP“ gegenüber Fachmodell 3.16 und Abschnitt 6, mit Datum und Verweis auf diesen Plan.
  - `.ai/backlog.md`: Eintrag „Chat: Channel-Verwaltung & Thread-UX“ als in Plan `003` übernommen kennzeichnen.
  - Das fachliche Datenmodell wird **nicht** geändert (eingefroren ohne Freigabe). Ausnahme: die Pin-Sperre (3.7), vom Projektinhaber am 2026-09-22 freigegeben und bereits eingetragen.
  Zusätzlich diese Code-Review-Findings umsetzen (siehe *Code-Review zu Plan 001*):
  - CR-001 Teil 1: Discord-Allowlist `ALLOWED_DISCORD_IDS`, fail closed in Produktion. Damit sind die Spike-Endpunkte für fremde Konten geschlossen.
  - CR-002: Test-Runner auf Vitest umstellen, `npm test` grün.
  - CR-009: Typfehler in `src/spike/chat/composer-dom.ts:67` beheben.
  - CR-015, nur der ESLint-Fehler in `src/spike/karte/KarteBoard.tsx:151`. Der Strukturteil folgt in T-012/T-013.
  - CR-010: CI-Job `verify` (`npm test`, `tsc --noEmit`, `eslint`) vor dem Image-Build.
  CR-009 und der ESLint-Fehler werden ausnahmsweise **direkt im Spike-Code** behoben, weil CR-010 sonst ab T-001 rot wäre. Alle übrigen Findings werden im Produktcode behoben. Sie stehen hier, weil ohne grüne Tests kein Task committet werden kann und CR-001 kritisch ist.
- Code-Review: CR-001 (Teil 1), CR-002, CR-009, CR-010, CR-015 (nur ESLint-Fehler). Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: keine
- Abnahmekriterium: Die vier genannten Nachträge existieren. `datenmodell.md` enthält keine Aussage mehr, die Kanäle für den MVP ausschließt, ohne auf die Abweichung in Abschnitt 13 zu verweisen. Die Abnahmekriterien von CR-001 (Teil 1: Allowlist), CR-002, CR-009 und CR-010 aus dem Review-Dokument sind erfüllt, und `npx eslint .` meldet 0 Fehler. `npx tsc --noEmit` meldet ebenfalls 0 Fehler.

### T-002: Produktschema vervollständigen
- [ ] Beschreibung: Drizzle-Schema und Migration(en) an `.ai/architecture/datenmodell.md` angleichen, inklusive T-001-Nachtrag. Mindestens:
  - `quests`, `quest_participants`, `character_images`;
  - `attr_str` … `attr_cha` an `characters`;
  - Relationen: Quest-FKs, `CHK-REL-SHAPE` (genau eine Source-/Target-FK passend zum Kind), generated `source_id`/`target_id`, `UQ-REL`;
  - Produkt-Chat-Tabellen `chat_channels`, `chat_threads`, `chat_messages` laut T-001 (inkl. `archived_at` am Kanal und partiellem Unique auf Kanalnamen aktiver Kanäle je Welt);
  - `articles.first_edited_at` (nullable; gesetzt = keine Stub-Darstellung mehr) — kurzer Nachtrag in `datenmodell.md` 3.12, Fachmodell unangetastet;
  - Such-Infrastruktur laut `datenmodell.md` Abschnitt 9 (`pg_trgm`, generated `*_tsv` wo vorgesehen) und Indizes laut Abschnitt 11;
  - fehlende Triggers/Checks aus `datenmodell.md` Abschnitt 5, soweit Plan `001` T-011 sie noch nicht gebaut hat (`UQ-ONE-GM` existiert bereits), darunter **alle 8** `TRIG-*`-Trigger mit je einem Integrationstest gegen die lokale PostgreSQL (Code-Review CR-018);
  - `pins.locked boolean NOT NULL DEFAULT false` (Pin-Sperre, `datenmodell.md` 3.7, CR-020);
  - an `chat_messages` die Würfe **pro Term** (z. B. `dice_terms jsonb`) statt einer flachen Werteliste, passend zum Würfelformat aus CR-021.
  Spike-Tabellen bleiben bis T-016. Keine Migration von `spike_*`-Zeilen.
- Code-Review: CR-018, CR-020 (Spalte), CR-021 (Schema). Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-001
- Abnahmekriterium: (1) Jede in `datenmodell.md` Abschnitt 3 genannte Tabelle existiert in `src/db/schema.ts` (plus T-001-Chat-Nachtrag). (2) `npm run db:generate` bzw. die gewählte Migrationsstrecke erzeugt eine anwendbare Migration; `npm run db:migrate` läuft lokal durch. (3) Relationen können Quelle und Ziel `quest` speichern (prüfbar per Insert in einem Test oder Drizzle-Studio). (4) `git grep` findet kein Secret.

### T-003: Rechteschicht aus dem Spike heben
- [ ] Beschreibung: `src/spike/rechte/authz.ts` (und zugehörige Typen) nach `src/lib/authz/` verschieben bzw. als Produktmodul etablieren. Alle neuen Produkt-APIs nutzen **nur** diese Schicht plus die APP-*-Regeln. Spike-HTTP darf sie bis T-015 noch aufrufen, soll aber keinen zweiten, abweichenden Rechtepfad aufbauen. `conventions.md`-Regel „Neue Rechtefälle zuerst in der gemeinsamen Schicht + Test“ gilt ab dieser Aufgabe.
- Code-Review: CR-005 (Helfer und Regel), CR-013 (Authz-Helfer, typisierte Patches). Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-002
- Abnahmekriterium: (1) Produktcode unter `src/app` und `src/lib` importiert Authz nicht aus `src/spike/`. (2) Bestehende Unit-Tests der Sichtbarkeitsregeln (`src/spike/rechte/authz.test.ts` oder deren neues Ziel) sind grün unter `npm test`. (3) `npm run test:rechte` bleibt grün, solange die Spike-API noch existiert (T-015 stellt um).

### T-004: Datei-Uploads über `files`
- [ ] Beschreibung: Hochladen, Ausliefern und Löschen über Tabelle `files` und `FILE_STORAGE_PATH`. MIME nur JPG/PNG/WebP. Limits: Kartenbild 20 MB, alle anderen Bilder 10 MB. Breite/Höhe beim Kartenbild speichern. Anbindung für Welt-Titelbild, Kartenbild, Artikel-Titelbild, Charakter-Profilbild und Charakter-Bildanhänge (max. 10). Ersetzen des Kartenbilds ändert nur `maps.image_id`; Pins/Marker bleiben über relative Position.
- Code-Review: CR-016. Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-002
- Abnahmekriterium: (1) Ein erlaubtes Bild landet als Zeile in `files` plus Datei auf dem Volume; die App kann es authentifiziert ausliefern. (2) Falsches MIME oder Überschreiten des Limits wird mit verständlicher deutscher Fehlermeldung abgelehnt, keine Datei bleibt liegen. (3) 11. Bildanhang am Charakter wird abgelehnt. (4) Player können keine Welt-/Karten-/Artikelbilder schreiben.

### T-005: TipTap-Editor in die App
- [ ] Beschreibung: Den Editor aus `spikes/editor/` in die Next-App übernehmen (`src/components/editor/` oder gleichwertig, nicht unter `src/spike/`). Funktionsumfang unverändert laut Plan `001` *Artikel-Editor* und ADR-004: nur OSS-Erweiterungen. Erwähnungssuche über eine Produkt-API der Welt (vollständige Suchlogik mit allen Inhaltsarten liefert T-009; bis dahin behandelt die API leere oder teilweise Bestände korrekt). Stub-Anlage laut `.ai/standards/erwaehnungen.md`. Modus ohne Erwähnungen für die Weltbeschreibung. Einfügen: Bilder/Tabellen verwerfen. Speichern: TipTap-JSON + Klartext. Relationen aus Mentions berechnet T-010; der Editor liefert die Verweisliste (Art + ID).
- Code-Review: CR-022. Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-002, T-003
- Abnahmekriterium: (1) Dieselben Abnahmekriterien wie Plan `001` T-005 (2)–(6), aber in der Next-App gegen eine Testwelt, nicht gegen `spikes/editor` allein. (2) `@Tore von Wer` mit Caret mitten im Satz sucht nur bis zur Marke. (3) Ohne Treffer erscheint „Neuen Artikel anlegen“; nach Bestätigen existiert ein Artikel, die Erwähnung ist rot bis zur ersten Bearbeitung. (4) `spikes/editor` darf bis T-016 liegen bleiben, wird aber nicht mehr die produktive Oberfläche.

### T-006: App-Shell, Login-Flow, Navigation
- [ ] Beschreibung: Shell gemäß *Informationsarchitektur* bauen. Mobile-First ~390 px, große Touch-Ziele. Chat-Route verdeckt die Bottom-Bar durch den Composer. Abgemeldet nur Login (Discord, lokal zusätzlich Test-Login). Angemeldet: Onboarding oder Welt-Redirect. Versionsbadge bleibt global. Spike-Links auf der Startseite entfernen, sobald die Shell die Einstiege ersetzt (spätestens T-016). Shell und alle Oberflächen aus T-006 bis T-014 folgen der *Design-Referenz* `spikes/ui-prototype/index.html`; Umbruch Handy/Desktop bei 768 px wie im Prototyp.
- Code-Review: CR-003, CR-017. Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-003
- **UI:** `.ai/standards/mobile-first.md`, `.ai/standards/mobile-navigation.md`.
- Während des Baus definieren: konkrete Icons der vier Tabs (Begründung: Norm verweist die Ikonografie auf die Shell-Umsetzung). Nicht offen: Labels, Reihenfolge, Routen-Tabelle oben.
- Abnahmekriterium: (1) Bei 390 px Breite sind die vier Tabs einhändig erreichbar und beschriftet. (2) Wechsel Kampagne → Karte → Chat → Menü ändert die Ansicht ohne Neuladen der Session; der Weltkontext bleibt. (3) Im Chat ist die Bottom-Bar vom Composer verdeckt; auf Karte/Menü/Kampagne nicht. (4) Desktop zeigt dieselben vier Ziele ohne Hover-only. (5) Unangemeldeter Aufruf von `/w/…` landet beim Login.

### T-007: Welten, Universen, Mitglieder, Einladungen (F1, F6)
- [ ] Beschreibung: Oberflächen und APIs für: Welt anlegen (Name, optionale Beschreibung ohne `@`, optionales Titelbild); automatisch Mitgliedschaft Game Master und Universum „Hauptuniversum“ (`veröffentlicht`); weitere Universen (Name eindeutig in der Welt, Beschreibung mit Erwähnungen, Reihenfolge, Sichtbarkeit); Welt bearbeiten / löschen nur GM; Mitgliederliste; Player ↔ Master nur GM; Entfernen nur GM; Austreten jedes Mitglieds außer GM (archivieren); Einladungslink 1 Tag / 7 Tage / unbegrenzt, widerrufen, Beitritt inkl. Reaktivierung. Letztes Universum nicht löschbar. Standard-Sichtbarkeit neuer Universen `nur Spielleitung` außer dem ersten.
- Code-Review: CR-005 (anwenden), CR-008 (Austritt, Einladung, Welt anlegen), CR-011 (Teilnahmen archivieren), CR-023. Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-004, T-005, T-006
- Abnahmekriterium: (0) Beim Anlegen einer Welt entstehen Game-Master-Mitgliedschaft, „Hauptuniversum“ und Chat-Kanal „Allgemein“ in einer Transaktion. (1) Ersteller ist Game Master; ein zweiter Game Master wird abgelehnt. (2) Gültiger Link macht den Benutzer zum Player; widerrufener oder abgelaufener Link wird abgelehnt. (3) Master kann weder einladen noch Rollen ändern noch die Welt löschen. (4) Austritt archiviert Mitgliedschaft, löscht keine Inhalte; erneuter Beitritt reaktiviert als Player. (5) Player sieht ein `gm_only`-Universum nicht. (6) Fälle sind um automatisierte Requests (Test-Login) ergänzt oder in das Rechte-Skript aufgenommen — vollständig spätestens T-015.

### T-008: Charaktere, Mitbringen, Tagebuch (F8, F9)
- [ ] Beschreibung: Charakterbogen ohne Kampfwerte laut Fachmodell 3.8: Name, Profilbild, Klasse Freitext, sechs Attribute 1–30 mit angezeigtem Modifikator, eigene Fertigkeiten als Liste laut `datenmodell.md` 3.8.1 (Freitext-Name, Übungsgrad, skalierendes Attribut; Hinzufügen per „+“, Entfernen per Zeile; neuer Charakter startet leer; höchstens 30; Name pro Charakter eindeutig ohne Beachtung von Groß-/Kleinschreibung; Anzeige des Gesamtbonus laut `datenmodell.md` 3.8.1: Modifikator + −4 (untalentiert) / −2 (ungeübt) / +Übungsbonus (geübt) / +2 × Übungsbonus (Expertise)), Übungsbonus 0–10 (Standard 2), eigene Fähigkeiten als Liste laut `datenmodell.md` 3.8.2 (Freitext bis 120 Zeichen und skalierendes Attribut, kein Übungsbonus; Hinzufügen per „+“; Start leer; höchstens 30; Text eindeutig; Anzeige nur mit Attributsmodifikator) — dazu Migration, die `characters_skills_object` durch `CHECK (jsonb_typeof(skills) = 'array')` mit Default `[]` ersetzt und `proficiency_bonus` sowie `abilities` (`CHECK (jsonb_typeof(abilities) = 'array')`, Default `[]`) ergänzt, Persönlichkeit/Ideale/Bindungen/Makel, Bio mit Editor (Erwähnungen → Relationen in T-010), bis zu 10 Bildanhänge. Nur der Besitzer schreibt. Mitbringen in eine Welt, in der der Benutzer Mitglied ist; mehrere Charaktere gleichzeitig; kein Aktiv-Schalter. Tagebuch pro Charakter und Welt: Titel optional, Inhalt Pflicht, Sichtbarkeit `privat` / `mit Spielleitung geteilt`. Die Sichtbarkeit eines bestehenden Eintrags wechselt der Besitzer per Tipp auf die Sichtbarkeits-Pill; gespeichert wird erst nach Bestätigung in einem Dialog, in beide Richtungen (Entscheidung Projektinhaber 2026-09-22). Der Dialog weist darauf hin, dass bereits Gelesenes nicht zurückgenommen werden kann. Für Game Master und Master ist die Pill nur Anzeige. Einträge erzeugen **keine** Relationen. Mitglieder sehen mitgebrachte (nicht archivierte) Charakterbögen.
- Code-Review: CR-005 (anwenden), CR-019 (Teile b, c). Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-007
- Abnahmekriterium: (1) Player A legt zwei Charaktere an, bringt beide in dieselbe Welt; Player B sieht beide Bögen, nicht aber private Tagebucheinträge. (2) Game Master und Master sehen nur `geteilt`-Einträge, keine `privat`. (3) Tagebuch ohne Mitbringen in diese Welt wird abgelehnt. (4) Attribut 0 oder 31 wird abgelehnt. (4a) Neuer Charakter hat keine Fertigkeiten; eine 31. Fertigkeit, ein leerer Name oder ein doppelter Name („Reiten“ / „reiten“) wird abgelehnt; bei Geschicklichkeit 17 (+3) und Übungsbonus 2 zeigt der Bogen „Reiten“ als untalentiert −1, ungeübt +1, geübt +5, Expertise +7; Übungsbonus 11 wird abgelehnt. (4b) Neuer Charakter hat keine Fähigkeiten; eine Fähigkeit „Wolf rufen“ mit Charisma 9 zeigt −1, unabhängig vom Übungsbonus; eine 31. Fähigkeit, leerer oder doppelter Text wird abgelehnt. (4c) Tipp auf die Pill eines eigenen Eintrags öffnet einen Bestätigungsdialog; Abbrechen ändert nichts, Bestätigen wechselt `privat` ↔ `mit Spielleitung geteilt`. Ein Sichtbarkeitswechsel eines fremden Eintrags per API wird abgelehnt. (5) UI auf ~390 px bedienbar (Bogen scrollbar, keine Hover-only-Aktionen). (6) Player B öffnet `/w/[worldId]/characters/[id]` eines Charakters von Player A und sieht den vollständigen Bogen ohne „Bearbeiten“; `/characters/[id]` desselben Charakters liefert B 404. (7) Nach dem Austritt von Player A liefert die weltbezogene Route für die anderen 404, und der Charakter fehlt in `/w/[worldId]/characters`.

### T-009: Artikel und Vorlagen (F2, F3)
- [ ] Beschreibung: Artikel anlegen/bearbeiten/löschen (Spielleitung): Titel, Vorlagentyp laut T-001, Vorlagenfelder, Titelbild, Inhalt (Editor), Sichtbarkeit Default `gm_only`. Vorlagentyp wechseln verwirft unpassende Felder nach Warnung. Player sehen nur `published` (und nur wenn sie die Welt sehen). Liste im Tab Kampagne, filterbar nach Vorlagentyp. Stub aus T-005 wird hier zur echten Seite: `first_edited_at` wird beim ersten Speichern gesetzt, bei dem `body_plain` nicht leer ist **oder** mindestens ein Vorlagenfeld einen Wert hat (Entscheidung Projektinhaber 2026-09-22, Plan-Review). Umbenennen, Titelbild oder Sichtbarkeitswechsel allein setzen es nicht. Einmal gesetzt, bleibt es gesetzt. Erwähnungssuche über Artikel, Charaktere (mitgebracht) und Universen — Teilwort, case-insensitive, Kategorie, max. 10, Sortierung laut Fachmodell 2.4. Die Suche ist so gebaut, dass T-011 Quests nur als weitere Quelle ergänzt.
- Code-Review: CR-005 (anwenden). Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-001, T-005, T-007, T-008
- Abnahmekriterium: (1) Jeder in T-001 freigegebene Vorlagentyp ist anlegbar; `none` hat keine Extrafelder. (2) Verweis-Feld akzeptiert nur erlaubte Ziele. (3) Die Erwähnungssuche findet Artikel, mitgebrachte Charaktere und Universen: Mit den Testdaten „Gottschleim“ (Artikel), „Schleimtal“ (Universum) und einem mitgebrachten Charakter „Schleimi“ liefert `@schleim` alle drei, jeweils mit Kategorie, Treffer am Wortanfang vor Treffern mitten im Wort. Quest-Treffer prüft T-011. (4) Player erhält `GET` eines `gm_only`-Artikels als 404/403, nicht als Inhalt. (5) Ein über `@` angelegter Stub bleibt rot, wenn nur Titel oder Sichtbarkeit gespeichert werden; nach dem ersten Speichern mit Text oder Vorlagenfeld ist die Erwähnung blau und bleibt es auch, wenn der Text später geleert wird.

### T-010: Relationen und Bereich „Verknüpft“
- [ ] Beschreibung: Relationen als Querschnittsmodul (`APP-REL-RECALC`), erweiterbar je Inhaltsart. **In dieser Aufgabe angebunden:** Artikel (Erwähnungen und Vorlagenfelder), Charakter-Bio (Erwähnungen), Universumsbeschreibung (Erwähnungen). **Quests** (`mention`, `participation`) bindet T-011 an, **Pins** (`mention`) bindet T-013 an. Beim Speichern werden die ausgehenden automatischen Relationen der Quelle neu berechnet; manuelle bleiben unberührt. Manuelle Relationen sind zwischen allen fünf Inhaltsarten zulässig, sobald die jeweilige Art existiert. Manuelle Relationen: nur Spielleitung, Bezeichnung Pflicht, optionale Gegenbezeichnung, Vorschläge bereits verwendeter Bezeichnungen der Welt. Sichtbarkeit: nur wenn Quelle **und** Ziel sichtbar. UI „Verknüpft“ laut Fachmodell 2.5 als wiederverwendbare Komponente; in dieser Aufgabe auf Artikel, Charakter und Universum eingebaut, auf Quest in T-011 und auf Pin in T-013. Klick auf einen verknüpften Pin öffnet `/w/…/map?pin=` (Nachweis in T-013). Erwähnung in der Anzeige: aktueller Titel als Link; unsichtbares/gelöschtes Ziel = letzter bekannter Titel als Text.
- Code-Review: CR-004, CR-005 (anwenden), CR-011 (Relationen). Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-009
- Abnahmekriterium: (1) Speichern eines Artikels mit `@` erzeugt genau die Mention-Relationen, manuelle bleiben. (2) Relation published↔`gm_only` ist für Player unsichtbar, für Spielleitung sichtbar. (3) Manuelle Relation Player-POST wird abgelehnt. (4) „Verknüpft“ gruppiert nach Pins / Artikeln (nach Vorlagentyp) / Quests / Charakteren / Universen; leere Gruppen werden nicht angezeigt. (5) Ein Vorlagen-Verweisfeld (z. B. Ort → Herrscher) erzeugt eine Relation `template_field` mit Feldschlüssel; Leeren des Felds entfernt sie. (6) Eine manuelle Relation mit Bezeichnung und Gegenbezeichnung erscheint bei der Quelle mit der Bezeichnung und beim Ziel mit der Gegenbezeichnung.

### T-011: Quests (F7)
- [ ] Beschreibung: Quests anlegen/bearbeiten/löschen (Spielleitung): Titel, Beschreibung mit Erwähnungen, Status offen/aktiv/abgeschlossen/gescheitert (Default offen), beteiligte mitgebrachte Charaktere (Namens-Snapshot), Sichtbarkeit Default `gm_only`. Kein Feld Auftraggeber. Quests an das Relationsmodul aus T-010 anbinden: Erwähnungen in der Beschreibung erzeugen `mention`, Beteiligungen erzeugen `participation`. „Verknüpft“ auf der Quest-Seite einbauen. Quest-Titel als weitere Quelle in die Erwähnungssuche aus T-009 aufnehmen.
- Code-Review: CR-005 (anwenden). Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-008, T-009, T-010
- Abnahmekriterium: (1) Player sieht `gm_only`-Quests nicht. (2) Beteiligung eines nicht mitgebrachten Charakters wird abgelehnt. (3) Nach Löschen des Charakters bleibt der festgehaltene Name in der Quest ohne Link. (4) `@schleim` liefert Artikel „Gottschleim“ und Quest „Töte den Gottschleim“ mit Kategorie. (5) Eine Quest mit Beteiligung und einer Erwähnung zeigt beide Relationen in „Verknüpft“; der beteiligte Charakter zeigt die Quest ebenfalls.

### T-012: Chat der Welt (F10)
- [ ] Beschreibung: Chat-Spike in die Route `/w/[worldId]/chat` überführen und laut *Chat-Produktmodell (festgelegt)* ausbauen: Composer, Würfel-Sheet, SSE, serverseitige Würfel, `/roll` nur als versteckter API-Pfad für Tests, Schalter „Im Chat posten“, Löschregeln für Nachrichten. Kanalliste mit eingerückten Threads und Chevron zum Auf- und Zuklappen. Kanalverwaltung (anlegen, umbenennen, Reihenfolge, archivieren, wiederherstellen) für die Spielleitung. Beim Anlegen einer Welt (T-007) entsteht der Kanal „Allgemein“; T-012 ergänzt das, falls T-007 es noch nicht tut. Nachrichten unter Benutzername/Avatar. Der Backlog-Punkt zur Kanalverwaltung ist damit erledigt.
- Code-Review: CR-005 (anwenden), CR-006 (Chat), CR-007, CR-008 (Thread mit Eröffnungsnachricht), CR-012 (Realtime-Bus, SSE-Route, Sitzungsprüfung, `escapeHtml`), CR-014, CR-015 (Struktur), CR-021. Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-001, T-002, T-003, T-007
- **UI:** Phone-first; Composer verdeckt Bottom-Bar; Chevron als eigenes Touch-Ziel.
- Abnahmekriterium: (1) Nachricht von Benutzer A erscheint bei Benutzer B im selben Kanal bzw. Thread derselben Welt in ≤ 1 s. (2) Ein Benutzer in einer anderen Welt sieht sie nicht. (3) Würfel: `/roll 2d6+3` bzw. Sheet erzeugt Server-Werte; `2d7` liefert eine Fehlermeldung ohne Wurf; ein vom Client vorgegebenes Ergebnis wird ignoriert. (4) Der Autor löscht eigene Textnachrichten, die Spielleitung fremde; Würfelwürfe kann niemand löschen. (5) Nach einem Reload sind die letzten 50 Nachrichten des aktuellen Stroms sichtbar. (6) Nicht-Mitglieder erhalten 403. (7) Master legt einen Kanal an, benennt ihn um und ändert die Reihenfolge; Player erhält dafür 403. (8) Threads erscheinen eingerückt unter ihrem Kanal; das Chevron klappt sie auf und zu; ein Kanal ohne Threads zeigt kein Chevron. (9) Archivieren blendet den Kanal für alle aus; seine Nachrichten und Würfe bleiben in der Datenbank; Wiederherstellen macht ihn wieder sichtbar. (10) Der letzte aktive Kanal lässt sich nicht archivieren. (11) Zwei aktive Kanäle mit gleichem Namen in einer Welt werden abgelehnt.

### T-013: Karten, Pins, Charakter-Marker (F4, F5)
- [ ] Beschreibung: Karten-Spike an Produkt-`maps`/`pins`/`character_markers` hängen. Eine Karte pro Universum in der Anwendungslogik (Schema erlaubt mehr). Upload 8000×6000 möglich. Zoom/Pan, 12 Pin-Typen mit Icons, Titel Pflicht, Beschreibung Rich-Text mit Erwähnungen (T-005), Sichtbarkeit, Drag Drop, Sync **nach Drop** per SSE an andere Mitglieder der Welt. Charakter-Marker: Profilbild+Name, platzieren/verschieben/entfernen durch Besitzer oder Spielleitung, Player nur eigene. Deep-Link `?pin=`. Sichtbarkeitsvererbung Universum → Karte → Pin/Marker. Pin-Sperre laut Fachmodell 3.7 übernehmen: sperren und entsperren nur Spielleitung; ein gesperrter Pin lässt sich nicht verschieben, bearbeiten oder löschen (409), nur entsperren (CR-020). Zoom-Feinschliff bleibt Backlog.
- Code-Review: CR-005 (anwenden), CR-006 (Karte), CR-008 (Kartenbild ersetzen), CR-011 (Karten, Pins, Marker), CR-012 (Pin-Typen, Positionsformat), CR-013 (Marker-Autorisierung), CR-014, CR-015 (Struktur), CR-020. Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-004, T-005, T-007, T-008, T-010, T-012 (gemeinsames Realtime-Modul, CR-012)
- **UI:** Phone-first, große Touch-Ziele; Plus zum Platzieren wie im Spike-Umbau, sofern es Mobile-First dient.
- Abnahmekriterium: Plan `001` T-009 (1)–(7), bezogen auf eine echte Welt und zwei Test-Login-Benutzer derselben Welt, plus: (8) Player sieht Pins einer `gm_only`-Karte oder eines `gm_only`-Universums nicht, auch wenn der Pin `published` ist. (9) Player A verschiebt eigenen Marker, nicht den von B; Master beide. (10) Zweiter Marker desselben Charakters auf derselben Karte wird abgelehnt. (11) Pins sind an das Relationsmodul aus T-010 angebunden: Erwähnungen in der Pinbeschreibung erzeugen Relationen, das Pin-Popup zeigt „Verknüpft“. (12) Ein Klick auf einen verknüpften Pin im Bereich „Verknüpft“ eines Artikels öffnet `/w/…/map?pin=` zentriert und gezoomt auf den Pin und hebt ihn hervor. (13) Player erhält beim Sperren oder Entsperren 403; Master sperrt einen Pin; Verschieben, Bearbeiten und Löschen des gesperrten Pins liefern 409, auch für die Spielleitung, bis entsperrt wird; Mitglieder sehen das Schloss-Symbol.

### T-014: Suche im Kampagnen-Hub
- [ ] Beschreibung: Suchfeld im Kampagnen-Hub: Volltext über Klartext der für den Benutzer sichtbaren Artikel, Quests, Universen, Pins, mitgebrachten Charaktere (Tagebuch **nicht** in dieser Suche, analog MCP-Abgrenzung und Geheimnis-Schutz). Treffer mit Art, Titel, Vorlagentyp, Auszug max. 300 Zeichen. Suche beim Tippen ab 2 Zeichen mit ca. 300 ms Verzögerung; Standard 20 Treffer, per Parameter `limit` höchstens 50 (Entscheidung Projektinhaber 2026-09-22, Plan-Review; entspricht MCP `suchen` in Plan `002`, damit die API dort wiederverwendet werden kann). Optionaler Filter nach Art. Technik laut `datenmodell.md` Abschnitt 9.
- Code-Review: CR-005 (anwenden). Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-009, T-011, T-013
- Abnahmekriterium: (1) Suche findet sichtbaren Artikeltitel und einen Klartext-Treffer im Inhalt. (2) `gm_only`-Artikel erscheint nicht bei Player, wohl bei Master. (3) Tagebucheintrag erscheint nicht. (4) Eine Eingabe mit weniger als 2 Zeichen löst keine Anfrage aus und zeigt keine Fehlerseite. (5) Ohne `limit` kommen höchstens 20 Treffer, `limit=100` wird auf 50 begrenzt.

### T-015: Rechte-Testskript auf Produkt-APIs
- [ ] Beschreibung: `npm run test:rechte` (oder Nachfolger) gegen die **Produkt-APIs** richten, nicht mehr gegen `/api/spike/rechte`. Dieselben Fälle wie Plan `001` T-011, plus Vorlagen-Verweis und Stub nur soweit sie Rechte berühren. Spike-Rechte-HTTP danach ungenutzt.
- Code-Review: CR-019 (Teil a: Persistenz-Snapshot). Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-007, T-008, T-009, T-010, T-011, T-012, T-013
- Abnahmekriterium: (1) Skript ist lokal mit Test-Login wiederholbar und deckt alle Punkte aus dem Abnahmekriterium von Plan `001` T-011. (2) Es ruft keine `/api/spike/`-Pfade mehr auf. (3) Produktion bleibt ohne Test-Login (404 / Guard unverändert).

### T-016: Spike-Abbau und Normen
- [ ] Beschreibung: Routen `/spike/*` und `/api/spike/*` entfernen. Tabellen `spike_*` und Enum `spike_pin_type` per Migration droppen. Code unter `src/spike/` und `spikes/editor/` entfernen (der Editor lebt ab T-005 in der App; die Historie bleibt in Git). `spikes/ui-prototype/` bleibt als Design-Referenz erhalten und wird nicht entfernt. `conventions.md`, `architecture/README.md`, `tech-stack.md` (Spike-Zeilen) aktualisieren. Test-Includes in `vitest.config.ts` an die neuen Pfade anpassen. Zusätzlich CR-001 Teile 2 und 3: Spike-Code entfernen und Spike-Daten aus den Produktivtabellen per `scripts/cleanup-spike-data.sql` bereinigen (Welten `Rechte-Spike*` samt Kaskade, `files` mit `storage_key LIKE 'spike/%'`). Vor der Ausführung auf Produktion zeigt ein Dry-Run die betroffenen Zeilen, und der Projektinhaber bestätigt im Chat.
- Code-Review: CR-001 (Teile 2 und 3), Endprüfung CR-012 und CR-013 für ganz `src/`. Deren Abnahmekriterien gehören zur Abnahme dieser Aufgabe (siehe *Code-Review zu Plan 001*).
- Abhängigkeiten: T-015
- Abnahmekriterium: (1) `GET /spike/karte` und `GET /spike/chat` sind 404. (2) `npm test` und `npm run test:rechte` grün. (3) `conventions.md` beschreibt die Produkt-Ordnerstruktur ohne Spike als Normalfall. (4) Keine toten Imports auf gelöschte Spike-Module. (5) Abnahmekriterium von CR-001 Teile 2 und 3 erfüllt: `git ls-files src | grep -i spike` ist leer; in Produktion gibt es keine `spike_*`-Tabellen, keine Welten `Rechte-Spike*` und keine `files`-Zeilen mit `storage_key LIKE 'spike/%'`.

### T-017: Smoketest auf Produktion
- [ ] Beschreibung: Stand nach T-016 auf `main` pushen, **erst nach ausdrücklicher Freigabe** laut *Commit & Push*. Coolify pullt GHCR. Protokoll in `.ai/infrastructure/smoketest.md` um einen Abschnitt **MVP F1–F10** ergänzen (bestanden / nicht bestanden / N/A). Test-Login nur lokal. Prod: echter Discord-Login.
- Abhängigkeiten: T-016
- **Stopp (Freigabe erforderlich):** `/plan-run` pausiert vor dem Push und nennt die Commits seit dem letzten Push. Gepusht wird erst nach „Push freigegeben“ o. ä. im Chat.
- **UI:** Phone-first ~390 px stichprobenartig (Shell, Karte, Chat, Editor).
- 👤 Manuelle Schritte (Projektinhaber):
  - Discord-Login auf `worldcraft.lagolago.at`.
  - Optional zweites Discord-Konto für Chat- und Pin-Realtime.
  - Welt anlegen, Kartenbild hochladen, eine Nachricht senden — oder dem Agenten bestätigen, dass der Durchgang passt.
- Abnahmekriterium: Protokollabschnitt existiert. Auf Prod per HTTPS: Login, Welt öffnen, Artikel mit Erwähnung speichern, Karte mit Pin, Chat-Nachricht. Rechte-Skript lokal bestanden. `ENABLE_TEST_LOGIN` in Coolify weiterhin unset.

### T-018: Abgleich Plan 002
- [ ] Beschreibung: Plan `.ai/feature-tasks/002-mcp-server.md` gegen den **tatsächlichen** Stand nach T-016 lesen (Rechteschicht-Pfad, Routen, Tabellennamen, Chat-/Staging-Formulierungen, MCP-Parameternamen). Abweichungen als Liste in `.ai/tech-stack.md` unter einem neuen Unterabschnitt *Abgleich Plan 002 nach MVP* festhalten. Plan `002` nicht eigenmächtig ändern.
- Abhängigkeiten: T-016
- Abnahmekriterium: Der Abschnitt existiert und listet jede Abweichung mit Fundstelle in Plan `002` oder vermerkt „keine neuen Abweichungen gegenüber dem Abgleich aus Plan 001 T-013“. Offene Fragen aus Plan 001 (Staging-Texte, deutsche vs. englische MCP-Parameter) werden wiederholt, falls noch unbeantwortet.

## Reihenfolge (Abhängigkeitsgraph)

```text
T-001 Freigabe
  └─ T-002 Schema
        ├─ T-003 Authz
        │     └─ T-006 Shell
        ├─ T-004 Uploads
        └─ T-005 Editor
              T-004 + T-005 + T-006 → T-007 Welten
                                         ├─ T-008 Charaktere/Tagebuch
                                         ├─ T-012 Chat + Kanalverwaltung
                                         └─ T-009 Artikel → T-010 Relationen → T-011 Quests
                                              T-007+T-008+T-010+T-012 → T-013 Karte
                                              T-009+T-011+T-013 → T-014 Suche
                                              T-007…T-013 → T-015 Rechte-Skript
                                                              └─ T-016 Cutover
                                                                    ├─ T-017 Smoketest
                                                                    └─ T-018 Abgleich 002
```

T-012 (Chat) kann parallel zu T-008/T-009 laufen, sobald T-007 steht. T-013 (Karte) wartet auf T-012, weil es dessen gemeinsames Realtime-Modul nutzt (CR-012).

## Abschluss dieses Plans

Danach ist der MVP funktionsfähig und alle Findings aus dem Code-Review zu Plan 001 sind erledigt (siehe *Code-Review zu Plan 001*). Nächster Plan laut Reihenfolge: **`002` MCP-Server**. Optional `/code-review` für 003 vor dem Start von 002.
