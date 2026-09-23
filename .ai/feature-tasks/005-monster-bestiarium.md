# 005 – Monster (Bestiarium) und Titelbild beim Anlegen

## Kontext & Ziel

Die Spielleitung will neben Charakteren auch Monster auf Karten setzen (Phase 2, eigener Plan). Dafür braucht es zuerst Monster als eigenen Inhaltstyp einer Welt. Ein Monster hat ein Charakterblatt wie ein Charakter, dazu monsterspezifische Felder und genau ein Bild.

**Ziel dieses Plans** (Wünsche des Projektinhabers, 2026-09-23):

1. **Monster** als eigener Bereich („Bestiarium“) im Kampagnen-Hub, **keine** Artikel.
2. Monster haben das **vollständige Charakterblatt** (wie Charakter, Fachmodell 3.8) plus Art, Seltenheit, Legendär, Gefahrenstufe, Größe, Lebensraum.
3. **Genau ein Bild pro Monster** (Profilbild), hochladbar schon beim Anlegen. Es dient in Phase 2 als Marker-Bild.
4. Monster sind **vollwertig im Relationen-System**: `@`-Erwähnungen in der Bio erzeugen Relationen, Monster sind selbst per `@` erwähnbar und erscheinen in Suche und „Verknüpft“.
5. **Artikel-Titelbild beim Anlegen:** Das Titelbild eines Artikels lässt sich schon im Anlege-Formular wählen, nicht erst nach dem Anlegen.

**Nicht Ziel dieses Plans:**

- Monster auf Karten, Stecknadel-Pins für Charaktere/Monster, Kartenfilter → Plan Phase 2 (Karten-Marker).
- Mehrere Bilder / Bildanhänge pro Monster.
- Kampfwerte, die auch Charaktere nicht haben (Trefferpunkte, Rüstungsklasse usw., OF-08).
- Chat- und Würfel-Änderungen (Phasen 3 und 4, eigene Pläne).
- Plan `002` (MCP) umsetzen oder ändern; nur Abgleich in `.ai/architecture.md` (T-011, PR3).

## Entscheidungen (Projektinhaber, 2026-09-23, beim Anlegen des Plans)

| # | Frage | Entscheidung |
|---|---|---|
| M1 | Sind Monster Artikel mit Vorlage „Monster“? | **Nein.** Eigener Bereich/Inhaltstyp mit eigenem Charakterblatt. |
| M2 | Welche Teile des Charakterblatts? | **Komplett wie Charakter** (Fachmodell 3.8): Klasse, Attribute, Übungsbonus, Fertigkeiten, Fähigkeiten, Persönlichkeitsmerkmale, Ideale, Bindungen, Makel, Bio. Statt Bildanhängen genau ein Profilbild. |
| M3 | Zusätzliche Felder | Art, Seltenheit, Legendär, Gefahrenstufe, Größe, Lebensraum (Werte siehe *Begriffe*). |
| M4 | Wer legt an, wer sieht? | **Wie Artikel:** Nur die Spielleitung legt an; Owner = anlegender Benutzer; dreistufige Sichtbarkeit nach Plan `004` (Standard `nur ich`); Bearbeiten und Löschen durch Owner und Spielleitung, sofern sie das Monster sehen (E10, R1, R2 aus Plan `004` gelten sinngemäß). |
| M5 | Einbindung in Relationen | **Vollwertig:** Bio-Erwähnungen erzeugen Relationen (Monster sind an eine Welt gebunden, anders als Charaktere); Monster sind per `@` erwähnbar, in Suche und „Verknüpft“ sichtbar; der Lebensraum erzeugt eine Relation zum Ort. |
| M6 | Ort in der Navigation | Kampagnen-Hub, eigene Sektion **„Bestiarium“** **über** dem Glossar, Filter-Chips nach Art. *(Bei Prototyp-Freigabe 2026-09-23 geändert: zuvor „unter dem Glossar“.)* |
| M7 | Artikel-Titelbild | Das bestehende Titelbild bleibt die „ein Bild pro Artikel“-Regel; neu ist nur der Upload im Anlege-Formular. |

## Entscheidungen aus dem Plan-Review (2026-09-23)

| # | Frage | Entscheidung |
|---|---|---|
| PR1 | Wie kommen Monster in `relations` (Exclusive-FK-Muster, `datenmodell.md` Abschnitt 7, Variante A)? | **Spalten ergänzen:** `source_monster_id` und `target_monster_id` (FK `monsters`, `ON DELETE CASCADE`); generierte Spalten `source_id`/`target_id` (`COALESCE`), CHECK „genau eine FK passend zu `*_kind`“ und Unique-Index um Monster erweitern. Keine eigene Tabelle, kein Umbau des Musters. |
| PR2 | Muss Plan `004` vollständig abgeschlossen sein? | **Nein.** Voraussetzung sind `004` T-001 bis T-010; T-011 bis T-013 aus `004` dürfen parallel laufen. |
| PR3 | Darf T-011 Plan `002` direkt ändern? | **Nein.** Wie `004` T-012: Eintrag mit offenen Fragen in `.ai/architecture.md` (*Abgleich Plan 002 nach MVP*); `002` bleibt unverändert. |
| PR4 | Suchspalten und Owner-Regel für `monsters`? | **Wie Charakter/Artikel:** Trigram-Index auf `name` (`@`-Suche), generiertes `bio_tsv` mit GIN-Index (Volltext über Name und Bio). `owner_id` wie bei Artikeln (anlegender Benutzer, Löschverhalten wie `created_by`, nicht änderbar, Index `(world_id, owner_id)`). Kein `name_tsv`. |
| PR5 | Schutz des Profilbilds vor der Garbage Collection? | `monsters.portraitId` in `FILE_REFERENCE_COLUMNS` aufnehmen (T-006) und testen, dass das aktuelle Bild einen GC-Lauf übersteht. |
| PR6 | Wo sitzt das Bestiarium, wie verhalten sich die Filter? | Eigene Komponente `MonsterList` **vor** `ArticleList` (Glossar) auf der Hub-Seite *(Prototyp-Freigabe 2026-09-23: über dem Glossar; zuvor „nach“)*. `?template=` und `?kind=` bleiben unabhängig erhalten; gemeinsamer Link-Helper, `ArticleList` wird umgestellt. |

## Begriffe & Systeme

Die Begriffe aus Plan `003`, Plan `004` und `.ai/architecture/datenmodell-fachlich.md` gelten unverändert (Welt, Spielleitung, Player, Owner, dreistufige Sichtbarkeit, Relation, Erwähnung, „Verknüpft“, Rechteschicht `src/lib/authz`, Kampagnen-Hub, Glossar). Zusätzlich:

- **Monster**: Datensatz einer Welt mit Charakterblatt, monsterspezifischen Feldern, Profilbild, Owner und dreistufiger Sichtbarkeit. Tabelle `monsters`, Inhaltsart `monster` im Enum `content_kind`.
- **Bestiarium**: Die Liste aller für den Betrachter sichtbaren Monster einer Welt im Kampagnen-Hub, Route `/w/[worldId]/monsters`. Die Detailansicht liegt unter `/w/[worldId]/monsters/[monsterId]`, das Formular unter `…/new` bzw. `…/[monsterId]/edit`.
- **Charakterblatt**: Die Felder aus Fachmodell 3.8 ohne Besitzer, Bildanhänge und Welt-Teilnahme; Rechenregeln in `src/lib/characters/sheet.ts`.
- **Art** (`monster_kind`): Auswahl `beast` Bestie, `undead` Untoter, `demon` Dämon, `dragon` Drache, `humanoid` Humanoid, `construct` Konstrukt, `aberration` Aberration, `plant` Pflanze, `magical` Magisch, `other` sonstiges. Pflicht, Standard `other`.
- **Seltenheit** (`monster_rarity`): `common` Common (grau), `uncommon` Uncommon (grün), `rare` Rare (blau), `epic` Epic (lila), `legendary` Legendary (orange). Pflicht, Standard `common`. Anzeige als farbige **Pill** (Labels englisch, wie vom Projektinhaber vorgegeben).
- **Legendär** (Abschnitt „Besonderheiten“): Checkbox, Spalte `is_legendary boolean`, Standard `false`. Unabhängig von der Seltenheit.
- **Gefahrenstufe** (`monster_danger`): `harmless` Harmlos, `dangerous` Gefährlich, `deadly` Tödlich, `devastating` Verheerend, `divine` Göttlich, `apocalyptic` Apokalyptisch. Pflicht, Standard `harmless`.
- **Größe** (`monster_size`): `tiny` Winzig, `small` Klein, `medium` Durchschnitt (Hinweistext „ca. 1,50 m Schulterhöhe“), `large` Groß, `gigantic` Gigantisch. Pflicht, Standard `medium`.
- **Lebensraum**: Optionaler Verweis auf einen Artikel derselben Welt mit Vorlage `place` (Ort). Spalte `habitat_article_id` FK `articles` ON DELETE SET NULL. Erzeugt eine Relation Monster → Ort mit `origin = template_field`, `template_field_key = 'habitat'`.
- **Profilbild (Monster)**: Genau ein Bild (JPG/PNG/WebP, max. 10 MB), Spalte `portrait_id` FK `files` ON DELETE SET NULL, neue Bildart `monster_portrait` in `src/lib/files`. Ohne Bild: Platzhalter mit Initialen (wie Charakter).
- **Titelbild beim Anlegen**: Im Anlege-Formular gewählte Bilddatei wird im Browser gehalten und nach erfolgreichem `POST` mit der neuen ID hochgeladen; erst danach Navigation zur Detailansicht.

## Relevante Normen

- `.ai/architecture/datenmodell-fachlich.md` — 2.2 Sichtbarkeit, 3.8 Charakter (Blatt), 3.11 Artikel, 3.14 Relation, 4 Löschregeln, 5 Rechte je Entität. Bei Abweichung hat dieses Dokument Vorrang.
- `.ai/architecture/datenmodell.md` — 2.1 Enum-Werte, 2.2 Dateien, 3.8 `characters` inkl. 3.8.1/3.8.2 JSONB, 3.12 `articles`, 3.15 `relations`, 5 Regeln, 7 Polymorphe Inhaltsverweise, 8 Löschregeln, 9 Suche.
- `.ai/standards/erwaehnungen.md` — Erwähnungen und Stub-Artikel.
- `.ai/standards/mobile-first.md`, `.ai/standards/mobile-navigation.md`
- `.ai/conventions.md` — UI Deutsch, Code Englisch; `npm run lint` vor jedem Commit.
- `.ai/architecture.md` — Next.js, Drizzle, TipTap, SSE.
- `.ai/roadmap.md` — Arbeitsweise (Prototyp vor Umsetzung, Commit pro Task, nie automatisch pushen).
- `spikes/ui-prototype/index.html` — Design-Referenz; wird in T-002 erweitert.

## Globale Abhängigkeiten

- **Plan `004` T-001 bis T-010 erledigt** (dreistufige Sichtbarkeit, `owner_id`, Rechteschicht mit Owner-Stufe, UI, Kapitel). Dieser Plan setzt darauf auf und startet erst danach. Die restlichen Aufgaben aus `004` (T-011 Rechte-Abdeckung, T-012 Abgleich Plan 002, T-013 Abschlussprüfung) dürfen parallel laufen; bei gleichzeitigen Änderungen an `src/app/api/rechte-matrix.api.test.ts` zuerst den aktuellen Stand holen (PR2).
- Plan `003` abgeschlossen (Charakterblatt, Relationen, Suche, Datei-Upload `src/lib/files`, Rechte-Testskript `npm run test:rechte`).
- Plan Phase 2 (Karten-Marker für Monster, Stecknadel-Pins, Kartenfilter) baut auf diesem Plan auf.
- Lokale Umgebung wie in Plan `003`: `docker compose up`, `.env` mit `ENABLE_TEST_LOGIN=true`, `npm run dev`.

## Aufgaben

### T-001: Normen und Roadmap nachziehen
- [x] Beschreibung: Entscheidungen M1–M7 in die Normen übernehmen: `datenmodell-fachlich.md` neuer Abschnitt „Monster“ (Eigenschaften, Regeln, Rechte, Löschregeln), `content_kind` + `monster` in 2.x; `datenmodell.md` neue Tabelle `monsters` (Blatt-Spalten wie `characters`, plus `world_id`, `owner_id` wie bei Artikeln — anlegender Benutzer, Löschverhalten wie `created_by`, kein `TRIG-CHAR-OWNER-IMMUTABLE`, nicht änderbar über API/UI, Index `(world_id, owner_id)` —, `visibility content_visibility` Default `owner_only`, `kind`, `rarity`, `is_legendary`, `danger`, `size`, `habitat_article_id`, `portrait_id`, `bio_json`/`bio_plain`, generiertes `bio_tsv` aus `bio_plain` mit GIN-Index und Trigram-Index auf `name`, beides wie bei `characters` (PR4)), neue Enums in 2.1, `relations` um `source_monster_id`/`target_monster_id` samt `COALESCE`, CHECK und Unique-Index (PR1), Relationen-Regel für `habitat`, Löschregeln (Monster löschen → Relationen von/zu ihm entfallen; Ort-Artikel löschen → `habitat_article_id` NULL + Relation entfällt; Welt löschen → Monster kaskadieren), Suche (Monster in Erwähnungs- und Volltextsuche). `roadmap.md`: Plan `005` in die Übersicht nach `004` eintragen.
- Abhängigkeiten: keine
- Abnahmekriterium: Beide Datenmodell-Dokumente enthalten den Abschnitt Monster mit allen Feldern aus *Begriffe* und einen Verweis auf M1–M7 mit Datum 2026-09-23; `roadmap.md` listet `005`; kein Widerspruch zu 3.8 (Charakter) — Unterschiede (Welt-Bindung, Erwähnungen in der Bio erlaubt, nur ein Bild) sind explizit genannt.

### T-002: Prototyp erweitern
- [x] Beschreibung: In `spikes/ui-prototype/index.html` ergänzen: Sektion „Bestiarium“ im Kampagnen-Hub **über** dem Glossar mit Filter-Chips nach Art; Listeneintrag mit Profilbild/Initialen, Name, Seltenheits-Pill, Legendär-Kennzeichen, Sichtbarkeits-Badge; Detailansicht mit Monster-Kopf (Art, Größe, Gefahrenstufe, Lebensraum-Link) und dem Charakterblatt; Formular mit allen Feldern inkl. Bildwahl beim Anlegen. Dem Projektinhaber zeigen, bevor T-008 beginnt.
- Abhängigkeiten: T-001
- Abnahmekriterium: Prototyp zeigt Liste, Detail und Formular mobil (375 px) und Desktop ohne horizontales Scrollen; die fünf Seltenheitsfarben sind unterscheidbar; Projektinhaber hat den Prototyp im Chat freigegeben (Freigabe mit Datum im Plan vermerkt).
- **Freigabe:** 2026-09-23 — Projektinhaber: Bestiarium über Glossar; Rest OK.

### T-003: Charakterblatt wiederverwendbar machen
- [ ] Beschreibung: Validierung (Zod) und Anzeige des Blatts so schneiden, dass Charakter und Monster dieselben Bausteine nutzen: Schemas für Attribute, Fertigkeiten, Fähigkeiten, Übungsbonus und die Textfelder in `src/lib/characters/sheet.ts` als eigenständige Exporte (z. B. `sheetSchema`); Anzeige- und Bearbeitungs-Teile aus `CharacterSheetView.tsx` / `CharacterForm.tsx` in eine gemeinsame Komponente (z. B. `src/components/sheet/`) ziehen. Charakter-Verhalten bleibt unverändert.
- Abhängigkeiten: keine
- Abnahmekriterium: `src/lib/characters/sheet.test.ts` und alle bestehenden Tests grün; Charakter anlegen, Blatt bearbeiten und ansehen funktioniert wie vorher (manuell geprüft); die gemeinsame Komponente hat keine Abhängigkeit auf Charakter-spezifische Felder (Besitzer, Teilnahme, Bildanhänge).

### T-004: Schema und Migration
- [ ] Beschreibung: In `src/db/schema.ts` Tabelle `monsters` und Enums `monster_kind`, `monster_rarity`, `monster_danger`, `monster_size` nach T-001 anlegen; `content_kind` um `monster` erweitern; Checks wie bei `characters` (Attribute 1–30, Übungsbonus 0–10, `jsonb_typeof` = `array`, Textlängen); Indizes für `world_id`, `(world_id, owner_id)`, Trigram auf `name` und GIN auf `bio_tsv` (generiert aus `bio_plain`, wie `characters.bio_tsv`, PR4). `relations` nach PR1 erweitern: Spalten `source_monster_id`/`target_monster_id` (FK `monsters`, `ON DELETE CASCADE`), generierte Spalten `source_id`/`target_id` entfernen und mit Monster im `COALESCE` neu anlegen (generierte Spalten lassen sich nicht ändern; abhängige Indizes mit neu anlegen), CHECK „genau eine FK passend zum Kind“ und Unique-Index nachziehen. Migration mit `drizzle-kit generate` erzeugen, Enum-Erweiterung ggf. von Hand ergänzen.
- Abhängigkeiten: T-001
- Abnahmekriterium: `npm run db:migrate` (bzw. das im Projekt übliche Migrationskommando) läuft auf leerer und auf bestehender lokaler DB fehlerfrei; ein Insert mit Attribut 31 oder `skills = '{}'` scheitert am Check; `src/db/triggers.integration.test.ts` bleibt grün; eine Relation mit `source_kind = 'monster'` und gesetzter `source_monster_id` lässt sich anlegen, eine mit `source_kind = 'monster'` und gesetzter `source_article_id` scheitert am CHECK; bestehende Relationen behalten nach der Migration ihre `source_id`/`target_id`.

### T-005: Domain, Rechte und API
- [ ] Beschreibung: `src/lib/domain/monsters.ts` (Liste mit Filter nach Art, Detail, Anlegen, Ändern, Löschen) und Routen unter `src/app/api/worlds/[worldId]/monsters/` (`GET`/`POST`, `[monsterId]`: `GET`/`PATCH`/`DELETE`). Rechte über `src/lib/authz` wie Artikel (M4): Anlegen nur Spielleitung, Owner = Anleger, Standard `owner_only`, Sichtbarkeit `owner_only` nur durch Owner setzbar (403 sonst), Player sehen nur `published`, unsichtbare Monster → 404. Lebensraum nur auf sichtbaren Ort-Artikel derselben Welt (sonst 422). `PATCH` akzeptiert `removePortrait: true`.
- Abhängigkeiten: T-003, T-004
- Abnahmekriterium: API-Tests (`monsters.api.test.ts`) decken ab: Anlegen als Player → 403; Owner-only-Monster für anderen Master → 404; Player sieht nur `published`; Lebensraum auf Nicht-Ort → 422; Blatt-Validierung (31 Fertigkeiten → 422). `src/app/api/rechte-matrix.api.test.ts` um Zeilen für `monster` erweitert und grün; `npm run test:rechte` grün.

### T-006: Profilbild
- [ ] Beschreibung: Bildart `monster_portrait` in `src/lib/files` (`attach.ts`, `authorize.ts`, `gc.ts`, Pfade) analog `article_title`: max. 10 MB, JPG/PNG/WebP, ersetzt ein vorhandenes Bild, altes Bild wird von der Garbage Collection erfasst — dafür `monsters.portraitId` in `FILE_REFERENCE_COLUMNS` (`src/db/schema.ts`) aufnehmen (PR5); Upload nur für Benutzer, die das Monster bearbeiten dürfen. Auslieferung nur an Benutzer, die das Monster sehen.
- Abhängigkeiten: T-005
- Abnahmekriterium: Tests in `src/lib/files/files.test.ts` bzw. API-Test: Upload durch Player → 403; zweiter Upload ersetzt das erste Bild (genau ein `portrait_id`, altes File nach GC entfernt); das aktuelle Profilbild bleibt nach einem GC-Lauf erhalten (`src/lib/files/gc.test.ts`); Bild eines `owner_only`-Monsters liefert anderen Benutzern 404.

### T-007: Relationen, Erwähnungen, Suche
- [ ] Beschreibung: Monster als Inhaltsart überall einbinden, wo Artikel/Quests vorkommen: Bio-Erwähnungen erzeugen Relationen (Neuberechnung bei jeder Änderung, `APP-REL-RECALC`), Lebensraum erzeugt/entfernt die `habitat`-Relation; `@`-Erwähnungssuche (`src/lib/domain/mention-search.ts`) und Volltextsuche (`src/lib/domain/search.ts`, `src/lib/search.ts`) liefern sichtbare Monster (Volltext über Name und Bio, Auszug aus der Bio, PR4); „Verknüpft“ (`src/lib/domain/linked.ts`, `LinkedPanel.tsx`) und `src/lib/content-href.ts` kennen `monster`; Editor-Mentions (`src/lib/editor/mentions.ts`, `src/components/editor/mention-api.ts`) rendern Monster-Links. Monster sind **nicht** als Stub per `@` neu anlegbar (Stub-Artikel bleiben Artikel).
- Abhängigkeiten: T-005
- Abnahmekriterium: Tests: `@wolf` findet das Monster „Schattenwolf“ für die Spielleitung, nicht für Player solange `gm_only`; Erwähnung eines Artikels in der Monster-Bio erscheint im „Verknüpft“ beider Seiten; Lebensraum setzen/entfernen erzeugt/löscht genau eine Relation; Monster löschen entfernt alle seine Relationen; Volltextsuche nach einem Wort, das nur in der Monster-Bio steht, findet das Monster für Berechtigte; `linked.test.ts`, `mentions.test.ts`, `search.test.ts` erweitert und grün.

### T-008: Bestiarium-UI
- [ ] Beschreibung: Nach freigegebenem Prototyp (T-002): Sektion „Bestiarium“ im Kampagnen-Hub (`src/app/w/[worldId]/page.tsx`) als eigene Komponente `MonsterList` **direkt vor** `<ArticleList …/>` (das Glossar ist die Komponente `src/components/articles/ArticleList.tsx`) mit „+ Monster“ (nur Spielleitung) und Filter-Chips nach Art (`?kind=`). Glossar-Filter (`?template=`) und Bestiarium-Filter (`?kind=`) bleiben unabhängig voneinander erhalten (PR6): ein kleiner Helper baut Chip-Links so, dass nur der eigene Parameter gesetzt bzw. entfernt wird; `ArticleList` wird auf diesen Helper umgestellt; Seiten `monsters/new`, `monsters/[monsterId]`, `monsters/[monsterId]/edit` unter `src/app/w/[worldId]/`; Komponenten unter `src/components/monsters/` (Liste, Seltenheits-Pill, Detail, Formular mit gemeinsamem Blatt aus T-003, RichText-Bio mit `@`, Lebensraum-Auswahl aus sichtbaren Ort-Artikeln, Bild wählen/entfernen). Bildwahl im Anlege-Formular nach dem Muster *Titelbild beim Anlegen*. Navigation: `activeNavTab` ordnet `/monsters` dem Tab „Kampagne“ zu.
- Abhängigkeiten: T-002, T-005, T-006, T-007
- Abnahmekriterium: Manuell als Game Master und als Player (Test-Login) geprüft: Monster mit Bild anlegen in einem Schritt; Liste filtert nach Art; Glossar-Filter und Bestiarium-Filter lassen sich kombinieren (z. B. `?template=place&kind=dragon`), „Alle“ in einer Sektion entfernt nur deren Parameter; Pill-Farben wie in *Begriffe*; Player sieht „+ Monster“ und Bearbeiten nicht und nur veröffentlichte Monster; mobil (375 px) ohne horizontales Scrollen; `npm run lint` und `npm run build` grün.

### T-009: Artikel-Titelbild beim Anlegen
- [ ] Beschreibung: In `src/components/articles/ArticleForm.tsx` die Titelbild-Zeile auch ohne `article` anzeigen; gewählte Datei im State halten (mit Vorschau und „Entfernen“), nach erfolgreichem `POST` `uploadImage({ kind: "article_title", targetId: <neue ID> })` aufrufen, danach zur Detailansicht navigieren. Scheitert der Upload, ist der Artikel trotzdem angelegt: Navigation zur Bearbeiten-Seite des neuen Artikels mit Fehlermeldung „Artikel angelegt, Titelbild konnte nicht hochgeladen werden.“ Hinweistext „Das Titelbild lässt sich nach dem Anlegen hochladen.“ entfällt. Das Muster als kleinen Hook/Helper so bauen, dass T-008 es wiederverwendet.
- Abhängigkeiten: keine
- Abnahmekriterium: Manuell: Neuer Artikel mit Bild → Detailansicht zeigt das Bild sofort; Upload einer 11-MB-Datei beim Anlegen → Artikel existiert, Bearbeiten-Seite zeigt die Fehlermeldung; Anlegen ohne Bild funktioniert unverändert; `npm run lint` grün.

### T-010: Smoketest und Abschlussprüfung
- [ ] Beschreibung: `.ai/infrastructure/smoketest.md` um Abschnitt „Bestiarium“ (Monster anlegen mit Bild, filtern, erwähnen, Sichtbarkeit wechseln, löschen) und einen Punkt zum Artikel-Titelbild beim Anlegen ergänzen; vollständige Testsuite laufen lassen.
- Abhängigkeiten: T-008, T-009
- Abnahmekriterium: Neue Smoketest-Punkte lokal einmal durchlaufen und abgehakt; `npm test`, `npm run test:rechte`, `npm run lint`, `npm run build` grün.

### T-011: Abgleich mit Plan 002 (MCP)
- [ ] Beschreibung: Im Abschnitt *Abgleich Plan 002 nach MVP* in `.ai/architecture.md` ergänzen (PR3): `monster` ist eine neue lesbare Inhaltsart (Plan `005`); offene Fragen für das spätere Review von `002`: Liefern Such- und Lese-Werkzeuge Monster? Filter nach Art? Wird das Charakterblatt mit ausgeliefert? Gilt die dreistufige Sichtbarkeit wie bei Artikeln? `.ai/feature-tasks/002-mcp-server.md` wird **nicht** geändert (Regel aus Plan `004` T-012). Keine Umsetzung von `002`.
- Abhängigkeiten: T-001
- Abnahmekriterium: `.ai/architecture.md` enthält im Abschnitt *Abgleich Plan 002 nach MVP* einen datierten Eintrag (2026-09-23 oder Umsetzungsdatum) zu Monster mit Verweis auf Plan `005` und den offenen Fragen; `git diff` zeigt keine Änderung an `002-mcp-server.md`.
