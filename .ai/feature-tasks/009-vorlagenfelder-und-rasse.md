# 009 – Neue Vorlagenfelder und Vorlage „Rasse“

## Kontext & Ziel

Die Artikel-Vorlagen (Person, Ort, Organisation, Gegenstand) aus Plan `003` sollen um weitere Auswahlwerte und Felder ergänzt werden, und es kommt eine fünfte Vorlage „Rasse“ dazu. Wunsch des Projektinhabers vom 2026-09-24:

1. **Person · Status:** zusätzliche Werte „Kampfunfähig“ und „Versiegelt“.
2. **Gegenstand · Art:** zusätzliche Werte „Fisch“ und „Pflanze“.
3. **Ort · Gefahrenstufe:** neues Auswahlfeld mit Harmlos, Gefährlich, Tödlich.
4. **Ort · Ruf:** neues Auswahlfeld mit Gehasst, Verrufen, Neutral, Akzeptiert, Geliebt.
5. **Organisation · Größe:** neues Auswahlfeld mit 1–10, 11–50, 51–100, 100+ (Label der obersten Stufe: „101+“, siehe K6).
6. **Organisation · Gefahrenstufe:** neues Auswahlfeld mit denselben sechs Stufen wie beim Monster.
7. **Gegenstand · Seltenheit:** neues Auswahlfeld mit denselben fünf Stufen wie beim Monster, dargestellt als farbige Seltenheits-Pill (grau bis orange).
8. **Vorlage „Rasse“:** neuer Vorlagentyp.
9. **Person · Rasse:** neues Verweisfeld auf einen Artikel mit Vorlage „Rasse“.
10. **Ort · Art:** zusätzlicher Wert „Kontinent“ (Ergänzung 2026-09-24).

**Nicht Ziel dieses Plans:**

- Rasse an Spielercharakteren oder Monstern.
- Filter nach den neuen Feldern (z. B. Glossar nach Seltenheit oder Gefahrenstufe filtern).
- Eigene Felder für die Vorlage „Rasse“ (K1). Sie können später als neuer Registry-Eintrag dazukommen.
- Änderungen am UI-Prototyp (K4).

## Entscheidungen (Projektinhaber, 2026-09-24, beim Anlegen des Plans)

| # | Frage | Entscheidung |
|---|---|---|
| K1 | Welche Felder hat die Vorlage „Rasse“? | **Keine Zusatzfelder.** Eine Rasse besteht aus Titel, Titelbild und Text wie ein Artikel ohne Vorlage, trägt aber den Typ „Rasse“ (Badge, Glossar-Chip „Rassen“, Verweisziel). |
| K2 | Wo erscheint die Seltenheit eines Gegenstands? | **Artikelseite und Glossarliste.** Farbige Seltenheits-Pill wie im Bestiarium (CSS-Klassen `.badge.rarity-*` in `src/app/globals.css`): im Feldblock der Artikelseite und in der Glossarliste rechts in der Zeile vor dem Sichtbarkeits-Badge, wie in `MonsterList.tsx` (Plan-Review 2026-09-24). |
| K3 | Stufen der Gefahrenstufe bei Organisationen | **Alle sechs Monster-Stufen** (Harmlos, Gefährlich, Tödlich, Verheerend, Göttlich, Apokalyptisch). Beim **Ort** nur die ersten drei (Wunsch 3). |
| K4 | Prototyp vor der Umsetzung? | **Nein.** Es kommen nur Auswahlwerte und Felder im bestehenden Artikelformular dazu; die Seltenheits-Pill existiert bereits im Bestiarium. Die Roadmap-Regel „Prototyp vor Umsetzung“ gilt hier ausnahmsweise nicht. |
| K5 | „Rasse an Person als FK“ | Umgesetzt als **Verweisfeld der Registry** (`type: "ref"`), nicht als Datenbank-Fremdschlüssel. Grund: Vorlagenfelder liegen nach `datenmodell.md` Abschnitt 6 als JSONB in `articles.template_fields`; neue Felder brauchen keine Migration. Der Verweis erzeugt wie alle Verweisfelder automatisch eine Relation Person → Rasse (Herkunft `template_field`, Schlüssel `race`) und erscheint damit unter „Verknüpft“. Wird die Rasse gelöscht, verschwindet die Relation, und das Feld zeigt „–“ (gleiches Verhalten wie bei `location` oder `organization`). |
| K6 | Obere Stufe der Organisationsgröße (Plan-Review 2026-09-24) | Label **„101+“** statt „100+“, damit sich die Stufen nicht bei 100 überschneiden. Der Schlüssel bleibt `over_100`. |
| K7 | Reihenfolge zu Plan `002` (Plan-Review 2026-09-24) | **`009` vor `002`.** Plan `002` (MCP-Server) ist noch nicht umgesetzt, wenn `009` läuft. T-005 bleibt deshalb ein reiner Doku-Abgleich; seine offenen Fragen werden in `/plan-review 002` beantwortet (Roadmap *Nächste Schritte*: `009` und `010` vor `002`, Schritte 6–7 vor Schritt 12). |

## Begriffe & Systeme

Begriffe aus Plan `003` und `005` sowie `.ai/architecture/datenmodell-fachlich.md` gelten (Artikel, Vorlage, Vorlagenfeld, Relation, Glossar, Monster, Seltenheit, Gefahrenstufe). Zusätzlich:

- **Vorlagen-Registry**: `TEMPLATES` und `TEMPLATE_TYPES` in `src/lib/templates/registry.ts`. Quelle der Wahrheit für Vorlagentypen und Felder. Feldarten `text`, `select` (feste Optionsliste) und `ref` (Verweis mit erlaubten Zielen).
- **Feldvalidierung**: `parseTemplateFields` in `src/lib/templates/fields.ts` (`APP-TEMPLATE-VALIDATE`). Sie lehnt Auswahlwerte außerhalb der Optionsliste mit 400 ab und prüft Verweisziele gegen die Registry.
- **Monster-Stufen**: `MONSTER_RARITIES` / `MONSTER_RARITY_LABEL` und `MONSTER_DANGERS` / `MONSTER_DANGER_LABEL` in `src/lib/monsters/labels.ts`. Die neuen Felder übernehmen diese Schlüssel und Labels, statt eigene Listen zu pflegen.
- **Seltenheits-Pill**: `MonsterRarityPill` in `src/components/monsters/MonsterRarityPill.tsx` mit den Klassen `.badge.rarity-common` (grau) bis `.badge.rarity-legendary` (orange).
- **Glossar**: Artikelliste im Kampagnen-Hub, `src/components/articles/ArticleList.tsx`, mit Filter-Chips je Vorlagentyp (entstehen aus `TEMPLATE_TYPES`).
- **Feldblock**: Anzeige der Vorlagenfelder auf der Artikelseite, `src/components/articles/ArticleFields.tsx`.

### Neue Schlüssel und Werte (verbindlich)

Schlüssel englisch, Labels deutsch (`.ai/conventions.md`). Neue Optionen stehen vor `other`/`unknown`, damit „sonstiges“/„unbekannt“ am Ende bleibt.

| Vorlage | Feld (Schlüssel · Label) | Feldart | Werte (Schlüssel · Label, in dieser Reihenfolge) |
|---|---|---|---|
| `person` | `status` · Status (bestehend) | Auswahl | `alive` lebendig, **`incapacitated` kampfunfähig**, **`sealed` versiegelt**, `dead` tot, `missing` verschollen, `unknown` unbekannt |
| `person` | **`race` · Rasse** (neu, nach `occupation`) | Verweis | Ziel: Artikel `race` |
| `place` | `kind` · Art (bestehend) | Auswahl | `city` Stadt, `village` Dorf, `building` Gebäude, **`continent` Kontinent**, `region` Region, `dungeon` Dungeon, `wilderness` Wildnis, `plane` Ebene, `other` sonstiges |
| `place` | **`danger` · Gefahrenstufe** (neu, nach `kind`) | Auswahl | `harmless` Harmlos, `dangerous` Gefährlich, `deadly` Tödlich |
| `place` | **`reputation` · Ruf** (neu, nach `danger`) | Auswahl | `hated` Gehasst, `disreputable` Verrufen, `neutral` Neutral, `accepted` Akzeptiert, `beloved` Geliebt |
| `organization` | **`size` · Größe** (neu, nach `kind`) | Auswahl | `up_to_10` 1–10, `up_to_50` 11–50, `up_to_100` 51–100, `over_100` 101+ |
| `organization` | **`danger` · Gefahrenstufe** (neu, nach `size`) | Auswahl | alle sechs `MONSTER_DANGERS` mit `MONSTER_DANGER_LABEL` |
| `item` | `kind` · Art (bestehend) | Auswahl | `weapon` Waffe, `armor` Rüstung, `artifact` Artefakt, `relic` Relikt, `mundane` alltäglich, **`fish` Fisch**, **`plant` Pflanze**, `other` sonstiges |
| `item` | **`rarity` · Seltenheit** (neu, nach `kind`) | Auswahl, Anzeige als Seltenheits-Pill | alle fünf `MONSTER_RARITIES` mit `MONSTER_RARITY_LABEL` |
| **`race`** (neu) | – | – | Label „Rasse“, Plural „Rassen“, keine Felder (K1). In `TEMPLATE_TYPES` nach `item`. |

Kleinschreibung bei „kampfunfähig“/„versiegelt“ folgt den bestehenden Status-Labels („lebendig“, „tot“). Die neuen Felder übernehmen die Großschreibung der Monster-Labels bzw. des Wunsches.

Alle neuen Felder sind optional. Bestehende Artikel bleiben gültig; ohne Wert zeigt der Feldblock „–“. Keine Migration.

## Relevante Normen

- `.ai/architecture/datenmodell.md` — Abschnitt 6 (Vorlagenfelder ohne Schemaänderung, Tabellen je Vorlagentyp), `APP-TEMPLATE-VALIDATE`, `APP-REL-RECALC`, `APP-TEMPLATE-SWITCH`.
- `.ai/architecture/datenmodell-fachlich.md` — 3.11 Artikel, 3.12 Vorlagentyp, Relationen-Herkunft `Vorlagenfeld`.
- `.ai/standards/erwaehnungen.md` — `@`-Vorschläge sind nach Vorlagentyp untergruppiert (Rassen erscheinen automatisch).
- `.ai/conventions.md` — UI Deutsch, Code Englisch; `npm run lint` vor jedem Commit; Features-Katalog.
- `.ai/features.md` — Zeile „Vorlagen“.
- `.ai/architecture.md` — Abschnitt *Abgleich Plan 002* (MCP liest Vorlagenfelder).
- `.ai/roadmap.md` — Arbeitsweise (Commit pro Task mit Task-ID, nie automatisch pushen).

## Aufgaben

### T-001: Normen nachziehen
- [x] Beschreibung: `.ai/architecture/datenmodell.md` Abschnitt 6 an die Tabelle *Neue Schlüssel und Werte* anpassen: Tabellen `person`, `place`, `organization`, `item` ergänzen, neuen Abschnitt `### race — Rasse` („keine Felder“) anlegen. Den Satz „Vier Typen plus `none`“ und „`none` oder einer der vier Typen“ auf fünf Typen ändern und die Entscheidung mit Datum (2026-09-24, Plan `009`) vermerken. In `.ai/features.md` die Zeile „Vorlagen“ um „Rasse“ ergänzen und auf Plan `009` verweisen.
- Abhängigkeiten: keine
- Abnahmekriterium: `datenmodell.md` Abschnitt 6 enthält alle Schlüssel und Werte aus der Tabelle dieses Plans und einen Abschnitt `race`; kein Text dort spricht mehr von „vier Typen“; `features.md` nennt Rasse und Plan `009`.

### T-002: Neue Auswahlwerte und Auswahlfelder in der Registry
- [ ] Beschreibung: In `src/lib/templates/registry.ts` die Auswahlwerte und -felder aus der Tabelle ergänzen: Person-Status, Gegenstand-Art, Ort-Art, Ort `danger` und `reputation`, Organisation `size` und `danger`, Gegenstand `rarity`. Die Optionen für `danger` (Organisation, alle sechs; Ort, erste drei) und `rarity` aus `src/lib/monsters/labels.ts` ableiten (Schlüssel und Labels), nicht abtippen. Tests in `src/lib/templates/fields.test.ts` ergänzen.
- Abhängigkeiten: keine
- Abnahmekriterium: `parseTemplateFields` akzeptiert je Vorlage jeden neuen Wert (z. B. `person` `status: "sealed"`, `place` `kind: "continent"`, `danger: "deadly"` und `reputation: "beloved"`, `organization` `size: "over_100"` und `danger: "apocalyptic"`, `item` `kind: "fish"` und `rarity: "legendary"`) und lehnt ungültige Werte mit 400 ab (`place` `danger: "apocalyptic"`, `item` `rarity: "mythic"`). Die neuen Felder erscheinen im Artikelformular als Auswahl in der Reihenfolge der Tabelle. `npm test` und `npm run lint` grün.

### T-003: Vorlage „Rasse“ und Verweisfeld Person → Rasse
- [ ] Beschreibung: `race` in `TEMPLATE_TYPES` (nach `item`) und `TEMPLATES` aufnehmen (Label „Rasse“, Plural „Rassen“, `fields: []`). In der Vorlage `person` das Feld `race` (Label „Rasse“, `type: "ref"`, Ziel `{ kind: "article", templateType: "race" }`) nach `occupation` einfügen. Prüfen, dass alle Stellen, die über `TEMPLATE_TYPES` laufen (`articleTemplateSchema` in `src/lib/domain/articles.ts`, Vorlagen-Auswahl in `ArticleForm.tsx`, Glossar-Chips in `ArticleList.tsx`, Untergruppen der `@`-Vorschläge), den neuen Typ ohne weitere Änderung zeigen. API-Tests in `src/app/api/worlds/[worldId]/articles/articles.api.test.ts` ergänzen.
- Abhängigkeiten: keine
- Abnahmekriterium: (1) Ein Artikel mit Vorlage `race` lässt sich über die API anlegen und trägt auf der Seite das Badge „Rasse“; der Feldblock erscheint nicht. (2) Ein Person-Artikel mit `race` auf einen Rasse-Artikel wird gespeichert und erzeugt eine Relation Person → Rasse mit Herkunft `template_field` und `template_field_key = "race"`. (3) `race` mit Verweis auf einen Artikel anderer Vorlage (z. B. `place`) oder auf einen Charakter wird mit 400 abgelehnt. (4) Im Glossar gibt es den Chip „Rassen“, der nur Rasse-Artikel zeigt. `npm test` und `npm run lint` grün.

### T-004: Seltenheits-Pill für Gegenstände auf Artikelseite und im Glossar
- [ ] Beschreibung: Auswahlfelder, die Seltenheit darstellen, bekommen eine Anzeigeart. Dafür den Select-Typ in `TemplateField` um ein optionales `display?: "rarity"` erweitern und bei `item.rarity` setzen. `ArticleFields.tsx` rendert solche Werte mit `MonsterRarityPill` statt als Text. Für die Glossarliste wählt nur `listArticles` (`src/lib/domain/articles.ts`) zusätzlich `rarity` aus (``{ ...summaryColumns, rarity: sql`template_fields->>'rarity'` }``, sonst `null`). Der Rückgabetyp wird ein neuer Typ `ArticleListItem = ArticleSummary & { rarity: string | null }`, den `ArticleList.tsx` statt `ArticleSummary` erhält. `summaryColumns`, `ArticleSummary`, `getArticle` und das `.returning()` beim Anlegen bleiben unverändert (Plan-Review 2026-09-24). `ArticleList.tsx` zeigt die Pill rechts in der Zeile vor dem `VisibilityBadge` (gleiche Position wie in `src/components/monsters/MonsterList.tsx`, Entscheidung Plan-Review 2026-09-24), wenn der Artikel die Vorlage `item` hat und der Wert in `MONSTER_RARITIES` liegt. Ungültige oder fehlende Werte zeigen keine Pill.
- Abhängigkeiten: T-002
- Abnahmekriterium: Ein Gegenstand mit `rarity: "legendary"` zeigt im Feldblock und in der Glossarliste die orange Pill „Legendär“, mit `rarity: "common"` die graue Pill „Gewöhnlich“. Ein Gegenstand ohne Seltenheit zeigt im Feldblock „–“ und in der Liste keine Pill. Artikel anderer Vorlagen sind unverändert. Die Liste lädt weiterhin nicht das vollständige `template_fields`; `ArticleSummary` und die Antworten von Artikel-Detail und Anlegen enthalten kein `rarity`. `npm test` und `npm run lint` grün.

### T-005: Abgleich Plan 002 (MCP)
- [ ] Beschreibung: Reiner Doku-Abgleich, kein Code (K7: Plan `002` ist noch nicht umgesetzt). In `.ai/architecture.md` unter *Abgleich Plan 002* einen Unterpunkt „nach Plan 009“ ergänzen. Er führt **jede** Änderung dieses Plans einzeln auf (Wünsche 1–10, Tabelle *Neue Schlüssel und Werte*):
  - neuer Vorlagentyp `race` („Rasse“, keine Felder);
  - neues Verweisfeld `person.race` → Relation Person → Rasse (Herkunft `template_field`, Feldname `race`), relevant für `relationen_abrufen`;
  - neue Auswahlwerte in bestehenden Feldern: `person.status` (`incapacitated`, `sealed`), `place.kind` (`continent`), `item.kind` (`fish`, `plant`);
  - neue Auswahlfelder: `place.danger`, `place.reputation`, `organization.size`, `organization.danger`, `item.rarity`.

  Für jedes MCP-Werkzeug in `.ai/feature-tasks/002-mcp-server.md` prüfen, ob es betroffen ist. Mindestens diese Stellen: `inhalt_lesen` (Vorlagentyp und Vorlagenfelder bei Artikeln: Werden Auswahlwerte als deutsches Label oder als Schlüssel ausgegeben?), `suchen` (Vorlagentyp im Treffer), `relationen_abrufen` (Feldname `race`) und die Testwelt in T-002 von Plan `002` (Artikel mit verschiedenen Vorlagentypen: soll `race` dazugehören?). Festhalten, ob Plan `002` Vorlagentypen oder Auswahlwerte fest aufzählt oder alles aus der Registry liest. Offene Fragen dort als Liste notieren.
- Abhängigkeiten: T-002, T-003
- Abnahmekriterium: `architecture.md` enthält den Unterpunkt „nach Plan 009“ mit allen vier Aufzählungspunkten oben, einschließlich `continent`, `incapacitated`/`sealed`, `fish`/`plant` und der fünf neuen Felder. Für `inhalt_lesen`, `suchen`, `relationen_abrufen` und die Testwelt ist je Werkzeug entweder „keine Anpassung nötig“ mit Begründung oder eine offene Frage bzw. Anpassung vermerkt. Die Roadmap-Zeile zu Plan `002` (*Hinweise je Plan*) nennt den Abgleich nach `009`.

### T-006: Lokaler Smoketest und Abschluss
- [ ] Beschreibung: Lokal mit `npm run dev` als Spielleitung prüfen. Das Ergebnis mit Datum als Abschnitt „Plan 009“ in `.ai/infrastructure/smoketest.md` festhalten. Danach Plan und Roadmap auf „abgeschlossen“ setzen.
  - S9.1: Person mit Status „versiegelt“ und Rasse anlegen, Seite zeigt beide Werte, Rasse ist ein Link, und „Verknüpft“ zeigt die Rasse.
  - S9.2: Die Rasse-Seite zeigt unter „Verknüpft“ die Person (eingehende Relation).
  - S9.3: Ort mit Art „Kontinent“, Gefahrenstufe „Tödlich“ und Ruf „Verrufen“ speichern und anzeigen.
  - S9.4: Organisation mit Größe „101+“ und Gefahrenstufe „Göttlich“ speichern und anzeigen.
  - S9.5: Gegenstand mit Art „Fisch“ und Seltenheit „Episch“: Pill im Feldblock und im Glossar.
  - S9.6: Glossar-Chip „Rassen“ filtert korrekt. Beim Wechsel bleibt die Scrollposition erhalten.
  - S9.7: `@`-Vorschlag findet den Rasse-Artikel mit „Artikel · Rasse“.
  - S9.8: Einen bestehenden Artikel ohne neue Felder öffnen und bearbeiten: kein Fehler, neue Felder zeigen „–“.
- Abhängigkeiten: T-001, T-002, T-003, T-004, T-005
- Abnahmekriterium: S9.1–S9.8 in `smoketest.md` als bestanden dokumentiert, alle Aufgaben dieses Plans abgehakt, Roadmap-Zeile `009` auf „✅ abgeschlossen“ mit Datum. Kein Push ohne Freigabe.
