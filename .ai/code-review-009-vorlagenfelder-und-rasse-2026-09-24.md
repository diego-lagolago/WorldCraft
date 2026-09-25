# Code Review – Plan 009 (Vorlagenfelder und Vorlage „Rasse“)

**Baseline:** Commit `99f6f2aefc4474e50807e760ead3cf4f6e563dcf` (`test(009): Vorlagen-Smoketest abschließen`). Uncommittete Änderungen im Working Tree: `.ai/backlog.md`, `.ai/roadmap.md` (enthält u. a. die Roadmap-Anteile von T-005/T-006, siehe CR-007), neu `.ai/feature-tasks/010-kapitel-status.md`, `.claude/`.
**Geprüfte Task-Datei:** `.ai/feature-tasks/009-vorlagenfelder-und-rasse.md` (T-001 bis T-006, alle `[x]`).
**Plan-Review:** 2026-09-25 – Entscheidungen zu CR-001, CR-004, CR-005 eingetragen, CR-007 als behoben markiert. Seit der Baseline ist `b6a9429` (Merge Plan 010) auf `main`; er berührt keine Fundstelle von CR-001 bis CR-006.
**Geprüfter Umfang:** Commits `25a12d1..99f6f2a` – `src/lib/templates/registry.ts`, `src/lib/templates/fields.test.ts`, `src/lib/domain/articles.ts`, `src/components/articles/ArticleFields.tsx`, `src/components/articles/ArticleList.tsx`, `src/app/api/worlds/[worldId]/articles/articles.api.test.ts`, `.ai/architecture.md`, `.ai/architecture/datenmodell.md`, `.ai/features.md`, `.ai/infrastructure/smoketest.md`.

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Runtime-Risiken / Fehlerbehandlung | mittel | behoben | Vorlagenwechsel per API scheitert mit 400 am neuen gemeinsamen Schlüssel `danger`, statt unpassende Werte zu verwerfen |
| CR-002 | Duplizierung & Modularisierung | niedrig | behoben | Seltenheits-Prüfung `(MONSTER_RARITIES as readonly string[]).includes(...)` samt Cast doppelt in `ArticleFields` und `ArticleList` |
| CR-003 | Bad Practices | niedrig | behoben | `monsterDangerOptions.slice(0, 3)` – Magic Number, hängt stillschweigend an der Reihenfolge von `MONSTER_DANGERS` |
| CR-004 | Lesbarkeit & Wartbarkeit | niedrig | behoben | `rarity`-Projektion in `listArticles` als unqualifizierter SQL-String statt über die Drizzle-Spalte |
| CR-005 | Testabdeckung | niedrig | offen | Keine Tests für Pill-Darstellung (Feldblock/Glossar), Glossar-Filter `race` und einige neue Auswahlwerte |
| CR-006 | Lesbarkeit & Wartbarkeit (Doku) | niedrig | behoben | Widersprüchlicher Satz zu `suchen` in P9-3 des MCP-Abgleichs (`architecture.md`) |
| CR-007 | Aufgaben-Abgleich | niedrig | behoben | Roadmap-Anteile der Abnahmekriterien von T-005/T-006 liegen nur uncommittet im Working Tree |

---

## CR-001 – Vorlagenwechsel per API scheitert am gemeinsamen Schlüssel `danger`

- **Fundstelle:** `src/lib/domain/articles.ts`, `toPatch` (Zweig `input.templateFields !== undefined || input.templateType !== undefined`, ca. Z. 245–252) in Verbindung mit `parseTemplateFields` (`src/lib/templates/fields.ts`) und den neuen Feldern `place.danger` / `organization.danger` in `src/lib/templates/registry.ts`
- **Kategorie:** Runtime-Risiken / Fehlerbehandlung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-002
- **Beschreibung:** Wird bei einem PATCH nur `templateType` geändert, parst `toPatch` die **gespeicherten** Felder gegen die neue Vorlage. `parseTemplateFields` verwirft unbekannte Schlüssel, lehnt aber einen bekannten Schlüssel mit ungültigem Auswahlwert mit 400 ab. Plan 009 führt mit `danger` einen Schlüssel ein, der in `organization` (sechs Stufen) und `place` (drei Stufen) mit unterschiedlichen Optionslisten existiert. Beispiel: Organisation mit `danger: "divine"` → `PATCH { templateType: "place" }` liefert 400 „„Gefahrenstufe“ hat keinen gültigen Wert.“ statt den Wert gemäß `APP-TEMPLATE-SWITCH` („Anwendung verwirft nicht passende Schlüssel“, `datenmodell.md` 3.11 / R-3.11-1) zu verwerfen. Das UI-Formular ist nicht betroffen (es setzt die Felder beim Wechsel zurück), wohl aber jeder API-Client und künftig der MCP-Server. Dasselbe Muster bestand schon für `kind` (z. B. `item.kind = "weapon"` → `place`); 009 vergrößert die Angriffsfläche um `danger`.
- **Empfehlung (entschieden im Plan-Review 2026-09-25: tolerant verwerfen über eigene Funktion):** Neue Funktion `keepCompatibleFields(type: TemplateType, stored: unknown): StoredTemplateFields` in `src/lib/templates/fields.ts`. Sie geht wie `parseTemplateFields` über die Felder der neuen Vorlage, gibt aber nie einen Fehler zurück: Textwerte bleiben, wenn sie Text und nicht zu lang sind; Auswahlwerte bleiben nur, wenn sie in der Optionsliste der neuen Vorlage stehen; Verweise bleiben nur, wenn ihre Art (`article`/`character`) laut `targets` erlaubt ist; alles andere fällt weg. `parseTemplateFields` bleibt unverändert (kein Modus-Parameter). In `toPatch` (`src/lib/domain/articles.ts`) gilt: Ist `input.templateType` gesetzt und `input.templateFields` **nicht** gesetzt (reiner Vorlagenwechsel), werden die gespeicherten Felder mit `keepCompatibleFields` gefiltert. Verbleibende Artikel-Verweise, deren Ziel in der DB nicht (mehr) zum erlaubten Vorlagentyp passt oder nicht existiert, werden in diesem Fall ebenfalls verworfen statt mit 400 abgelehnt (Variante von `assertRefTargets`, die ungültige Refs entfernt statt `fail` zurückzugeben). Sind `templateFields` explizit übergeben, bleibt alles streng wie bisher (400).
- **Abnahmekriterium:** Ein API-Test in `articles.api.test.ts` legt eine Organisation mit `danger: "divine"` und `size: "over_100"` an, sendet `PATCH { templateType: "place" }` und erhält 200; der Artikel hat danach `templateType = "place"` und `templateFields` ohne `danger` und ohne `size`. Unit-Tests in `fields.test.ts` decken `keepCompatibleFields` ab: behält `kind: "other"` beim Wechsel `item` → `place`, verwirft `danger: "divine"` für `place`, verwirft einen `character`-Verweis in `person.race`, liefert für `race` ein leeres Objekt. `PATCH { templateType: "place", templateFields: { danger: "divine" } }` liefert weiterhin 400.

- **Status:** behoben – `keepCompatibleFields` und die DB-gestützte Filterung inkompatibler Verweisziele behandeln reine Vorlagenwechsel tolerant; explizit übermittelte Felder bleiben strikt. Unit- und API-Tests decken beide Pfade ab.
- **Review-Check 2026-09-25:** bestätigt: `keepCompatibleFields` (`src/lib/templates/fields.ts`) und `keepCompatibleRefTargets` (`src/lib/domain/articles.ts`) greifen nur beim reinen Vorlagenwechsel; explizite `templateFields` laufen weiter über `fieldsFrom` (streng). Unit-Tests und API-Test `CR-001: template switches` entsprechen dem Abnahmekriterium; `npm test` grün (API-Test nicht ausgeführt, s. Abschnitt Review-Check).

## CR-002 – Doppelte Seltenheits-Prüfung mit Cast

- **Fundstelle:** `src/components/articles/ArticleFields.tsx` (`formatValue`, Z. 17–18) und `src/components/articles/ArticleList.tsx` (Z. 56–61)
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004
- **Beschreibung:** Beide Komponenten prüfen mit `(MONSTER_RARITIES as readonly string[]).includes(value)` und casten danach `as MonsterRarity`. Für Monster-Arten gibt es dafür bereits den Type Guard `isMonsterKind` in `src/lib/monsters/labels.ts`; für Seltenheiten fehlt das Gegenstück, daher der doppelte Cast.
- **Empfehlung:** `export function isMonsterRarity(value: unknown): value is MonsterRarity` in `src/lib/monsters/labels.ts` ergänzen (analog `isMonsterKind`) und in beiden Komponenten verwenden; die `as`-Casts entfallen.
- **Abnahmekriterium:** `grep -rn "MONSTER_RARITIES as readonly" src/components` liefert keinen Treffer; `ArticleFields.tsx` und `ArticleList.tsx` enthalten kein `as MonsterRarity` mehr; `isMonsterRarity` hat einen Unit-Test; `npm test`, `npm run lint`, `npm run typecheck` grün.

- **Status:** behoben – `isMonsterRarity` zentralisiert die Prüfung; beide Komponenten verwenden den Guard ohne Cast. Unit-, Lint- und Typecheck-Prüfung sind grün.
- **Review-Check 2026-09-25:** bestätigt: `isMonsterRarity` in `labels.ts` mit `labels.test.ts`; keine `MONSTER_RARITIES as readonly`/`as MonsterRarity` mehr in `ArticleFields.tsx`/`ArticleList.tsx`.

## CR-003 – `slice(0, 3)` für die Ort-Gefahrenstufen

- **Fundstelle:** `src/lib/templates/registry.ts`, Feld `place.danger` (`options: monsterDangerOptions.slice(0, 3)`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-002
- **Beschreibung:** Die „ersten drei“ Stufen (K3) sind als Magic Number codiert und hängen an der Reihenfolge von `MONSTER_DANGERS`. Wird dort eine Stufe eingefügt oder umsortiert, ändert sich die Ort-Auswahl still, und gespeicherte Werte können ungültig werden – ohne dass ein Test oder Typfehler anschlägt.
- **Empfehlung:** Die erlaubten Schlüssel benennen, z. B. `const PLACE_DANGERS = ["harmless", "dangerous", "deadly"] as const satisfies readonly MonsterDanger[];` und daraus die Optionen mit `MONSTER_DANGER_LABEL` ableiten (Labels bleiben zentral, Schlüssel sind explizit und typgeprüft).
- **Abnahmekriterium:** `registry.ts` enthält kein `slice(0, 3)` mehr; die Ort-Optionen entstehen aus einer benannten, gegen `MonsterDanger` typgeprüften Schlüsselliste; der bestehende Test „`place` `danger: "apocalyptic"` → 400“ bleibt grün.

- **Status:** behoben – `PLACE_DANGERS` benennt die drei Ort-Stufen explizit und ist gegen `MonsterDanger` typgeprüft; die Registry leitet nur noch die Labels daraus ab.
- **Review-Check 2026-09-25:** bestätigt: `PLACE_DANGERS … satisfies readonly MonsterDanger[]`, kein `slice(0, 3)` mehr.

## CR-004 – Unqualifizierter SQL-String für `rarity`

- **Fundstelle:** `src/lib/domain/articles.ts`, `listArticles` (Z. 190: ``rarity: sql<string | null>`template_fields->>'rarity'` ``)
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004
- **Beschreibung:** Der Spaltenname steht als Freitext im SQL. Eine Umbenennung der Spalte im Drizzle-Schema oder ein späterer Join mit einer weiteren Tabelle, die `template_fields` hat, fällt weder dem Typecheck noch dem Linter auf. Zudem wird `rarity` für alle Vorlagentypen projiziert, obwohl nur `item` sie nutzt (die UI filtert zusätzlich auf `item`); auch die Monster-Formulare (`listArticles(..., "place")`) bekommen das Feld mit.
- **Empfehlung (entschieden im Plan-Review 2026-09-25: nur Spaltenreferenz):** Spalte über Drizzle referenzieren: ``sql<string | null>`${articles.templateFields}->>'rarity'` ``. Keine `CASE`-Einschränkung auf `item`; die Projektion bleibt für alle Vorlagentypen, und die `item`-Prüfung in `ArticleList.tsx` bleibt die einzige Stelle dieser Regel.
- **Abnahmekriterium:** In `listArticles` steht der Spaltenname `template_fields` nicht mehr als Freitext im SQL, sondern kommt aus `articles.templateFields`; der API-Test „T-009 (4): item rarity list projection“ bleibt grün.

- **Status:** behoben – die Rarity-Projektion interpoliert `articles.templateFields`; der umbenannte Plan-009-API-Test ist grün.
- **Review-Check 2026-09-25:** bestätigt: ``${articles.templateFields}->>'rarity'``.

## CR-005 – Lücken in der Testabdeckung

- **Fundstelle:** `src/components/articles/ArticleFields.tsx`, `src/components/articles/ArticleList.tsx` (keine Tests); `src/lib/templates/fields.test.ts`; `src/app/api/worlds/[worldId]/articles/articles.api.test.ts`
- **Kategorie:** Testabdeckung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-002, T-003, T-004
- **Beschreibung:** Die Pill-Logik (nur `item`, nur gültige Werte, „–“ ohne Wert, Fallback auf Label bei ungültigem Wert) ist nur über den manuellen Smoketest S9.5 abgesichert. Das Abnahmekriterium (4) von T-003 („Chip „Rassen“ zeigt nur Rasse-Artikel“) hat keinen automatisierten Test (`GET /articles?templateType=race`). In `fields.test.ts` fehlen positive Fälle für `incapacitated`, `plant` und negative Fälle für `reputation`/`size`. Die API-Test-Beschreibung „T-009 (3)/(4)“ referenziert Plan 003 T-009, nicht Plan 009 – das ist verwechselbar.
- **Empfehlung (entschieden im Plan-Review 2026-09-25):** (a) Komponententests mit `renderToStaticMarkup` aus `react-dom/server` in normalen `*.test.ts`-Dateien (Node-Umgebung, **keine** neue Abhängigkeit, keine Testing Library), neben den Komponenten: `src/components/articles/ArticleFields.test.ts` und `src/components/articles/ArticleList.test.ts`. Da `npm test` nur `*.test.ts` einsammelt, wird ohne JSX gerendert (`createElement(ArticleFields, {…})`). Geprüft wird der HTML-String. Fälle: `item` mit `rarity: "legendary"` → enthält `badge rarity-legendary` und „Legendär“; `item` mit `rarity: "common"` → `badge rarity-common` „Gewöhnlich“; `item` ohne `rarity` → keine `rarity-`-Klasse (Feldblock zeigt „–“); `place`-Zeile mit `rarity: "legendary"` in der Liste → keine Pill; ungültiger Wert `"mythic"` → keine Pill. Falls `next/link` beim statischen Rendern scheitert, wird es im Test per `vi.mock("next/link", …)` durch ein einfaches `<a>` ersetzt. (b) API-Test: `GET /articles?templateType=race` enthält den Rasse-Artikel und keinen Artikel anderer Vorlage. (c) `fields.test.ts` um `person.status: "incapacitated"`, `item.kind: "plant"` (akzeptiert) sowie `place.reputation: "adored"` und `organization.size: "huge"` (400) ergänzen. (d) In `articles.api.test.ts` die beiden in Plan 009 neu angelegten Blöcke umbenennen: `"T-009 (3): race articles and person references"` → `"Plan 009 T-003: race articles and person references"` und `"T-009 (4): item rarity list projection"` → `"Plan 009 T-004: item rarity list projection"` (der bestehende Block `"T-009 (4): visibility"` aus Plan 003 bleibt unverändert; heute gibt es „T-009 (4)“ doppelt). Eine projektweite Vereinheitlichung aller Pills/Badges über reine Helfer ist **nicht** Teil dieses Findings, sondern als Backlog-Eintrag „Pills/Badges projektweit standardisieren“ (`.ai/backlog.md`, 2026-09-25) festgehalten.
- **Abnahmekriterium:** `ArticleFields.test.ts` und `ArticleList.test.ts` existieren, nutzen `renderToStaticMarkup` und decken die Fälle aus (a) ab; `package.json` hat keine neue Abhängigkeit; `articles.api.test.ts` prüft den `race`-Filter und enthält die beiden umbenannten `describe`-Titel (kein doppeltes „T-009 (4)“ mehr); `fields.test.ts` deckt die Werte aus (c) ab. `npm test` grün, `npm run test:rechte` grün.

- **Status:** behoben – neue statische Komponententests decken Pill- und Fallback-Fälle ab; API- und Feldtests ergänzen Race-Filter bzw. Auswahlwerte. Keine Abhängigkeit wurde ergänzt; Unit- und Rechte-Suite sind grün.
- **Review-Check 2026-09-25:** Status zurück auf `offen` (Abnahmekriterium nur teilweise erfüllt). `ArticleFields.test.ts`, `labels.test.ts`, der `race`-Filter-Test, die umbenannten `describe`-Titel und die Werte aus (c) sind vorhanden und grün. `src/components/articles/ArticleList.test.ts` prüft aber nur die Negativfälle (`place` mit `legendary`, `item` mit `mythic`); es fehlen die in (a) geforderten Fälle `item` mit `rarity: "legendary"` → Zeile enthält `badge rarity-legendary` und „Legendär“ sowie `item` mit `rarity: null` → keine `rarity-`-Klasse. Ohne den Positivfall würde ein Test auch grün bleiben, wenn die Pill in der Liste nie gerendert wird. Die Rechte-Suite (`npm run test:rechte`) wurde im Review-Check nicht ausgeführt (braucht laufenden Dev-Server).
- **Review-Check 2026-09-25 (2. Durchgang):** weiterhin `offen` – `src/components/articles/ArticleList.test.ts` unverändert, die beiden Positivfälle (`item`/`legendary` → Pill, `item`/`null` → keine Pill) fehlen weiter.

## CR-006 – Widersprüchlicher Satz zu `suchen` in P9-3

- **Fundstelle:** `.ai/architecture.md`, Abschnitt *Abgleich Plan 002 → nach Plan 009*, Tabellenzeile P9-3
- **Kategorie:** Lesbarkeit & Wartbarkeit (Doku)
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005
- **Beschreibung:** „`suchen` bleibt betroffen, weil es den Vorlagentyp, nicht aber die Feldwerte, liefert“ – die Begründung spricht gegen eine Betroffenheit durch neue Auswahlwerte. T-005 verlangt je Werkzeug eindeutig „keine Anpassung nötig“ mit Begründung oder eine offene Frage; beim späteren `/plan-review 002` ist diese Zeile missverständlich.
- **Empfehlung:** Umformulieren, z. B.: „`suchen` ist nicht betroffen: Es liefert den Vorlagentyp, aber keine Feldwerte.“
- **Abnahmekriterium:** P9-3 enthält für `suchen` eine eindeutige Aussage („keine Anpassung nötig“ mit Begründung), ohne Widerspruch zwischen Aussage und Begründung.

- **Status:** behoben – P9-3 hält nun eindeutig fest, dass `suchen` nicht betroffen ist, weil es keine Feldwerte liefert.
- **Review-Check 2026-09-25:** bestätigt: P9-3 in `architecture.md` eindeutig formuliert.

## CR-007 – Roadmap-Anteile von T-005/T-006 nicht committet

- **Status:** behoben – erledigt durch Commit `b6a9429` (Merge `codex/010-kapitel-status`), festgestellt im Plan-Review 2026-09-25: `HEAD:.ai/roadmap.md` enthält „✅ abgeschlossen (2026-09-24)“ für `009` und im Hinweis zu `002` den Abgleich nach `009`.
- **Fundstelle:** `.ai/roadmap.md` (Working Tree, uncommittet); Commits `4dc8ded` (T-005) und `99f6f2a` (T-006)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005, T-006
- **Beschreibung:** Das Abnahmekriterium von T-005 verlangt, dass die Roadmap-Zeile zu Plan 002 (*Hinweise je Plan*) den Abgleich nach 009 nennt; T-006 verlangt die Roadmap-Zeile `009` auf „✅ abgeschlossen“ mit Datum. Im Baseline-Commit nennt der Hinweis zu `002` nur die Abgleiche nach 004–006; beide Änderungen existieren nur im uncommitteten Working Tree (vermischt mit den Änderungen für Plan 010). Die Roadmap-Regel „Commit pro Task mit Task-ID“ ist damit für diese Anteile nicht erfüllt.
- **Empfehlung:** Die Roadmap-Änderungen zu Plan 009 committen (ggf. gemeinsam mit den 010-Einträgen, dann mit klarer Commit-Nachricht, z. B. `docs(009): Roadmap-Abschluss und Hinweis 002 nachziehen`).
- **Abnahmekriterium:** `git show HEAD:.ai/roadmap.md` enthält die Zeile `009` mit „✅ abgeschlossen (2026-09-24)“ und im Hinweis zu `002` den Abgleich nach `009`; `git status` zeigt `.ai/roadmap.md` nicht mehr als geändert (bezogen auf diese Anteile).

---

## Prioritätenliste

1. **CR-001** – einziges Verhaltensproblem; vor Plan 002 (MCP) beheben, damit Vorlagenwechsel über jede Schnittstelle `APP-TEMPLATE-SWITCH` folgen.
2. ~~**CR-007**~~ – behoben durch `b6a9429`.
3. **CR-005** – Tests ergänzen (vor allem Komponententest der Pill per `renderToStaticMarkup` und `race`-Filter), idealerweise zusammen mit CR-002.
4. **CR-002**, **CR-003**, **CR-004** – kleine Aufräumarbeiten in Registry, Labels und Listenabfrage.
5. **CR-006** – Doku-Formulierung vor `/plan-review 002` glätten.

---

## Review-Check 2026-09-25

**Geprüfter Stand:** `HEAD` = `b6a9429` (Merge Plan 010) **plus uncommittete Änderungen** im Arbeitsverzeichnis (Fixes zu CR-001–CR-006: `src/lib/templates/{fields,registry}.ts`, `src/lib/domain/articles.ts`, `src/lib/monsters/labels.ts`, `src/components/articles/{ArticleFields,ArticleList}.tsx`, `.ai/architecture.md`, Tests). Die Fixes sind noch nicht committet. Der Merge `b6a9429` berührt keine Fundstelle dieses Reviews.

**Prüfungen:** `npm test` grün (49 Dateien, 253 Tests); `tsc --noEmit` ohne Fehler außerhalb der Next-generierten `PageProps`-Typen (fehlen im isolierten Worktree ohne `.next`); `eslint` auf `src/lib`, `src/components/articles`, `src/app/api/worlds` ohne Befund. `npm run test:rechte` (API-Tests inkl. `CR-001: template switches` und `race`-Filter) wurde **nicht** ausgeführt (braucht Dev-Server).

**Statusänderungen:**

- `behoben` bestätigt: CR-001, CR-002, CR-003, CR-004, CR-006, CR-007 (6)
- `behoben` → `offen`: CR-005 (1), Abnahmekriterium nur teilweise erfüllt (Positivfälle in `ArticleList.test.ts` fehlen)
- `drift`: 0
- Regressionen: 0

**Nicht abgedeckte Änderungen (ohne neue CR-ID):**

1. `src/lib/domain/articles.ts`, neue Funktion `keepCompatibleRefTargets` (ca. 55 Zeilen): Sie wiederholt nahezu vollständig die DB-Abfragen (Artikel der Welt, Charaktere mit aktiver Teilnahme) und die Zielprüfung aus `assertRefTargets`, nur mit „entfernen“ statt `fail`. Zwei Stellen müssen künftig dieselbe Verweisregel pflegen (DRY). Außerdem ruft die Prüfung `articlesById.get(ref.value.id)` dreimal hintereinander auf, statt den Wert einmal zu binden. Kandidat für einen gemeinsamen Helfer, der die Ziele einmal lädt und je Verweis „gültig/ungültig“ liefert; `assertRefTargets` und die tolerante Variante bauen dann darauf auf.
2. Verhaltensdetail CR-001: Der tolerante Pfad greift bei **jedem** PATCH mit `templateType` ohne `templateFields`, auch wenn der Typ gleich bleibt (der API-Test nutzt das bewusst, um verwaiste Verweise zu entfernen). Das ist mit `APP-TEMPLATE-SWITCH` vereinbar, aber nirgends dokumentiert; bei Bedarf in `datenmodell.md` (APP-TEMPLATE-SWITCH) einen Satz ergänzen.

**Empfehlung:** Kein vollständiger neuer `/code-review`-Lauf nötig. CR-005 fertigstellen (zwei Positivfälle in `ArticleList.test.ts`), `npm run test:rechte` mit laufendem Dev-Server ausführen und die Fixes committen. Die beiden nicht abgedeckten Punkte sind klein; bei Interesse per gezieltem `/code-review` auf `keepCompatibleRefTargets` als neue Findings erfassen.

## Review-Check 2026-09-25 (2. Durchgang)

**Geprüfter Stand:** `HEAD` = `b6a9429` plus uncommittete Änderungen im Arbeitsverzeichnis. Die 009-Fixes sind weiterhin nicht committet. Alle von diesem Review betroffenen Dateien (`registry.ts`, `fields.ts`, `fields.test.ts`, `articles.ts`, `labels.ts`, `ArticleFields.tsx`, `ArticleList.tsx`, `ArticleFields.test.ts`, `ArticleList.test.ts`, `articles.api.test.ts`, `architecture.md`) sind inhaltlich identisch mit dem Stand des ersten Review-Checks. Neu im Arbeitsverzeichnis sind nur Änderungen zu Plan 010 (Quests, `QuestStatusBadge.tsx`, `VisibilitySelect.tsx`), die nicht zu diesem Review gehören.

**Prüfungen:** `npm test` grün (49 Dateien, 253 Tests). `npm run test:rechte` weiterhin nicht ausgeführt (braucht Dev-Server).

**Statusänderungen:** keine. `behoben`: CR-001, CR-002, CR-003, CR-004, CR-006, CR-007 (6); `offen`: CR-005 (1); `drift`: 0; Regressionen: 0.

**Nicht abgedeckte Änderungen:** keine neuen; die beiden Punkte aus dem ersten Review-Check (Duplizierung `keepCompatibleRefTargets`/`assertRefTargets`, undokumentierter toleranter Pfad bei gleichbleibendem `templateType`) bestehen unverändert.

**Empfehlung:** Kein neuer `/code-review`-Lauf nötig. Zuerst CR-005 fertigstellen (zwei Positivfälle in `ArticleList.test.ts`), dann `npm run test:rechte` mit laufendem Dev-Server und die 009-Fixes committen.

