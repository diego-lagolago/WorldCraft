# Code Review – 005 Monster (Bestiarium) und Titelbild beim Anlegen

**Baseline:** Commit `485e30eb7728e085ed2d75209ed745f702e5a862` (`main`). Uncommittete Änderungen im Working Tree betreffen nur `.ai/…` (Plan 006, Normen, Roadmap) und `spikes/ui-prototype/index.html` – kein Produktcode aus Plan 005.
**Geprüfte Task-Datei:** `.ai/feature-tasks/005-monster-bestiarium.md` (T-001 bis T-011, alle `- [x]`).
**Plan-Review:** 2026-09-24 – offene Entscheidungen in CR-001, 002, 003, 006, 007, 010, 011, 012, 013 geklärt und im jeweiligen Finding vermerkt; CR-015 neu aufgenommen; Backlog-Eintrag „Versteckte Verweise kryptisch darstellen“ ergänzt.
**Geprüfter Umfang:** Commits `ebba48a` (T-001) bis `485e30e` (T-010), Schwerpunkt Produktcode unter `src/`.

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Runtime-Risiken / Aufgaben-Abgleich | mittel | behoben | Dirty-Check schützt nicht auswählbare Lebensräume; sichtbare Nicht-Orte werden erklärt. |
| CR-002 | Duplizierung & Modularisierung | mittel | behoben | `sheetLocalError` ist für Charakter und Monster zentralisiert. |
| CR-003 | Duplizierung / Fehlerbehandlung | niedrig | behoben | Gemeinsamer Parser liefert Blattregeln konsistent als 422. |
| CR-004 | Duplizierung & Modularisierung | niedrig | behoben | Drizzle-Enums nutzen die Monster-Konstanten. |
| CR-005 | Toter Code | niedrig | behoben | Fallback-Konvertierungen entfernt; DB-Enum-Typen fließen durch. |
| CR-006 | Toter Code | niedrig | behoben | Ungenutzte Seltenheit aus verknüpften Zielen entfernt. |
| CR-007 | Duplizierung & Modularisierung | niedrig | behoben | Typisiertes deutsches Label-Wörterbuch eingeführt und Verbraucher umgestellt. |
| CR-008 | Lesbarkeit / Konsistenz | niedrig | behoben | Kartenansicht leitet Reihenfolge ab und zeigt Porträts. |
| CR-009 | Lesbarkeit & Wartbarkeit | niedrig | offen | Regression: `map/repository.ts` (Plan 006) kopiert den 404-Text erneut als Literal. |
| CR-010 | Runtime-Risiken | niedrig | behoben | Bildarten typisiert; Object-URLs werden beim Unmount freigegeben. |
| CR-011 | Runtime-Risiken | niedrig | behoben | Einzelbildwechsel werden unter Zeilensperre atomar ausgeführt. |
| CR-012 | Sicherheit | niedrig | behoben | Nicht lesbare Lebensraum-IDs werden in Liste und Detail maskiert. |
| CR-013 | Bad Practices | niedrig | behoben | Monster-Links nutzen die zentralen Content-Routenhelfer. |
| CR-014 | Testabdeckung | niedrig | behoben | Rechte-, GC-, Lebensraum- und Maskierungstests ergänzt. |
| CR-015 | Duplizierung & Modularisierung | mittel | behoben | Zentraler Upload-Feld, Helper und Storage-Löschgrenze eingeführt. |

---

## Findings im Detail

### CR-001 – Lebensraum außerhalb der Auswahl blockiert jedes Speichern

**Status: behoben.** Das Formular übermittelt den Lebensraum beim Bearbeiten nur bei Änderung; lesbare, ungültig gewordene Ziele erscheinen als deaktivierte Hinweis-Option.

- **Fundstelle:** `src/components/monsters/MonsterForm.tsx` (State `habitatArticleId` Z. 101, `sheetPayload()` Z. 165, Select Z. 345–355); `src/app/w/[worldId]/monsters/[monsterId]/edit/page.tsx` Z. 29; `src/lib/domain/monsters.ts` `toPatch` Z. 325–329 / `resolveHabitat` Z. 236–264
- **Kategorie:** Runtime-Risiken / Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-005, T-008
- **Beschreibung:** Die Bearbeiten-Seite füllt `placeOptions` nur mit Ort-Artikeln, die der aktuelle Bearbeiter sieht (`listArticles(…, "place")`). Das Formular schickt `habitatArticleId` bei **jedem** `PATCH` mit. Ist der gespeicherte Lebensraum für den Bearbeiter nicht (mehr) wählbar – z. B. der Ort-Artikel gehört einem anderen Master und steht auf `owner_only`, oder seine Vorlage wurde von `place` auf eine andere geändert –, dann:
  1. zeigt das `<select>` optisch „— keiner —“ (kein passendes `<option>`), der State hält aber weiter die alte ID;
  2. validiert `resolveHabitat` die ID erneut und antwortet mit 422 „Lebensraum muss ein sichtbarer Ort-Artikel dieser Welt sein.“
  Folge: Das Monster lässt sich nicht mehr bearbeiten (auch Name, Blatt, Sichtbarkeit nicht), und die Fehlermeldung passt nicht zu dem, was die UI anzeigt. Wählt der Nutzer bewusst „— keiner —“, wird der Lebensraum eines anderen Masters stillschweigend entfernt.
- **Empfehlung (Entscheidung Plan-Review 2026-09-24: Dirty-Check + Hinweis-Option):**
  1. **Dirty-Check:** `MonsterForm.sheetPayload()` sendet `habitatArticleId` nur, wenn der Select-Wert von `monster.habitatArticleId` (bzw. `""` ↔ `null`) abweicht. Beim Anlegen wird er wie bisher immer gesendet.
  2. **Sichtbar, aber kein Ort mehr:** Die Bearbeiten-Seite (`edit/page.tsx`) prüft, ob `monster.habitatArticleId` in `places` enthalten ist. Falls nicht und die ID nicht `null` ist, lädt sie den Artikel per `getArticle(…)` und übergibt ihn als neues Prop `currentHabitat: { id, title } | null` an `MonsterForm`. Das Select zeigt dann zusätzlich eine **deaktivierte** Option mit `value = id` und dem Text „<Titel> (kein Ort mehr)“, die vorausgewählt ist. Der Nutzer kann auf „— keiner —“ oder einen gültigen Ort wechseln.
  3. **Nicht sichtbar:** Durch CR-012 kommt die ID beim Bearbeiter als `null` an. Das Select zeigt „— keiner —“, der Dirty-Check verhindert, dass der gespeicherte Lebensraum überschrieben wird, solange der Nutzer das Select nicht ändert.
- **Abnahmekriterium:**
  - Ein Monster mit Lebensraum auf einen Artikel, dessen Vorlage nicht mehr `place` ist, lässt sich über das Formular umbenennen (200, `habitat_article_id` unverändert); das Select zeigt „<Titel> (kein Ort mehr)“ als ausgewählte, deaktivierte Option.
  - Ein zweiter Master bearbeitet ein Monster, dessen Lebensraum ein fremder `owner_only`-Ort ist: Speichern liefert 200, `habitat_article_id` bleibt unverändert.
  - API-Test: `PATCH` ohne `habitatArticleId` auf ein Monster mit ungültigem (Nicht-Ort-)Lebensraum liefert 200.

### CR-002 – Blatt-Validierung kopiert

**Status: behoben.** `sheetLocalError` in `src/lib/characters/sheet.ts` ist nun die gemeinsame reine Validierungsfunktion.

- **Fundstelle:** `src/components/monsters/MonsterForm.tsx` `localError()` Z. 135–149; `src/components/characters/CharacterForm.tsx` `localError()` Z. 67–81
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-003, T-008, T-009
- **Beschreibung:** T-003 sollte Validierung und Formularbausteine so schneiden, dass Charakter und Monster dieselben Bausteine nutzen. `localError()` ist jedoch 1:1 zwischen `CharacterForm` und `MonsterForm` kopiert (Attributbereich, leere/doppelte Fertigkeiten und Fähigkeiten, identische Meldungstexte). Ebenso ist der Ablauf „POST → ggf. Bild hochladen → bei Fehler zur Bearbeiten-Seite mit `?…Error=1` → sonst Detailansicht“ in `ArticleForm` und `MonsterForm` nahezu identisch; `usePendingImageUpload` kapselt nur den Upload, nicht den Ablauf. Jede Regeländerung (z. B. neue Blatt-Regel, anderer Fehlerparameter) muss an zwei bis drei Stellen nachgezogen werden.
- **Empfehlung:** `sheetLocalError({ attributes, skills, abilities })` als reine Funktion in `src/lib/characters/sheet.ts` auslagern und in beiden Formularen verwenden. *(Der ursprünglich hier mit erfasste Anlegen+Upload-Ablauf ist nach Entscheidung im Plan-Review 2026-09-24 in **CR-015** aufgegangen.)*
- **Abnahmekriterium:** Die Meldungstexte „Jede Fertigkeit braucht einen Namen.“, „Jede Fähigkeit braucht einen Text.“ und die Duplikat-Meldungen kommen im Code genau einmal vor (`git grep` findet je eine Definition außerhalb von Tests); `CharacterForm` und `MonsterForm` rufen dieselbe Funktion auf; `src/lib/characters/sheet.test.ts` deckt `sheetLocalError` ab.

### CR-003 – 422-Fehlerextraktion doppelt; Statuscode inkonsistent zu Charakter

**Status: behoben.** `parseWithUserMessage` zentralisiert die Fehlerextraktion; Blattregelverletzungen sind für Charakter und Monster 422.

- **Fundstelle:** `src/lib/domain/monsters.ts` `toPatch` Z. 286–305, `monsterFields.skills/abilities` Z. 79–81; vgl. `src/lib/domain/characters.ts` `characterFields.skills/abilities`
- **Kategorie:** Duplizierung / Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-003, T-005
- **Beschreibung:** Der Block „`safeParse` → `issues.find(code === "custom" && params[USER_MESSAGE])` → `fail(422, …)`“ steht zweimal direkt hintereinander. Außerdem nutzt Monster bewusst `z.array(skillSchema)` (unbegrenzt) + 422 im Domain-Layer, Charakter dagegen `sheetSchema.shape.skills` (400 aus `parseJsonBody`). Dieselbe Blattregel liefert damit je nach Inhaltsart einen anderen HTTP-Status; das widerspricht dem Ziel von T-003 („dieselben Bausteine“).
- **Empfehlung:** Hilfsfunktion `parseWithUserMessage(schema, value)` in `src/lib/http` für beide Aufrufe. **Entscheidung (Plan-Review 2026-09-24): beide 422.** Charakter wird auf das Monster-Muster umgestellt: Zod im Request prüft nur die Form (`z.array(skillSchema)` / `z.array(abilitySchema)`, Formfehler → 400), die Blattregeln (Anzahl, Duplikate) prüft der Domain-Layer über `parseWithUserMessage` mit `skillsSchema`/`abilitiesSchema` → 422 mit der deutschen Meldung. Bestehende Charakter-Tests, die 400 für Blattregeln erwarten, auf 422 anpassen.
- **Abnahmekriterium:** In `monsters.ts` existiert der Extraktionsblock nicht mehr doppelt, `characters.ts` nutzt denselben Helper; ein Request mit 31 Fertigkeiten liefert für `PATCH /api/characters/{id}` und `PATCH /api/worlds/{worldId}/monsters/{id}` jeweils **422** mit der Meldung aus `skillsSchema`, jeweils durch einen API-Test belegt.

### CR-004 – Monster-Enum-Werte doppelt gepflegt

**Status: behoben.** Die vier Drizzle-Enums erhalten ihre Werte direkt aus `lib/monsters/labels.ts`.

- **Fundstelle:** `src/db/schema.ts` `monsterKind`, `monsterRarity`, `monsterDanger`, `monsterSize` (ca. Z. 171–204); `src/lib/monsters/labels.ts` `MONSTER_KINDS`, `MONSTER_RARITIES`, `MONSTER_DANGERS`, `MONSTER_SIZES`
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-004, T-005
- **Beschreibung:** Die Wertelisten stehen als Literale in `pgEnum(...)` und nochmals in `labels.ts`. Ein neuer Wert muss an beiden Stellen ergänzt werden; ein Auseinanderlaufen fällt erst zur Laufzeit auf (siehe auch CR-005).
- **Empfehlung:** In `schema.ts` `pgEnum("monster_kind", MONSTER_KINDS)` usw. mit den Konstanten aus `@/lib/monsters/labels` verwenden (die Datei ist bereits frei von Server-Abhängigkeiten).
- **Abnahmekriterium:** Die Strings `"beast"`, `"common"`, `"harmless"`, `"tiny"` kommen in `src/` außerhalb von Migrationen und Tests nur noch in `labels.ts` vor; `drizzle-kit generate` erzeugt danach keine neue Migration.

### CR-005 – Unerreichbare Fallbacks `asKind`/`asRarity`/`asDanger`/`asSize`

**Status: behoben.** Die Fallbacks sind entfernt; `toSummary` übernimmt die Datenbank-Enumtypen.

- **Fundstelle:** `src/lib/domain/monsters.ts` Z. 189–233 (`asKind`, `asRarity`, `asDanger`, `asSize`, `toSummary`)
- **Kategorie:** Toter Code
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005
- **Beschreibung:** Die Spalten sind Postgres-Enums mit `NOT NULL`; Drizzle typisiert sie bereits als Union. Die Fallback-Zweige (`"other"`, `"common"` …) sind unerreichbar und würden einen echten Inkonsistenzfehler (Enum in DB ≠ Code) stillschweigend verdecken. `toSummary` deklariert die Felder zudem als `string` statt mit den Enum-Typen.
- **Empfehlung:** Hilfsfunktionen entfernen und `toSummary` mit dem Zeilentyp von `summaryColumns` (bzw. `typeof monsters.$inferSelect`) typisieren, sodass die Enum-Typen durchgereicht werden.
- **Abnahmekriterium:** `asKind`, `asRarity`, `asDanger`, `asSize` existieren nicht mehr; `npm run lint` und `tsc` (über `npm run build`) sind grün.

### CR-006 – `LinkedItem.rarity` wird nirgends genutzt

**Status: behoben.** Feld, Abfrage und Zuweisung wurden entfernt.

- **Fundstelle:** `src/lib/domain/linked.ts` Z. 17 (`rarity?: string`); `src/lib/domain/relations.ts` `loadVisibleTargets` (Monster-Zweig lädt `rarity`); `src/components/linked/LinkedPanel.tsx`, `src/components/map/LinkedPanel.tsx`
- **Kategorie:** Toter Code
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-007
- **Beschreibung:** Die Seltenheit wird für „Verknüpft“ abgefragt und ins Item geschrieben, von keiner Komponente aber gelesen. Zudem ist sie als `string` statt `MonsterRarity` typisiert.
- **Empfehlung (Entscheidung Plan-Review 2026-09-24: entfernen):** Feld `rarity` aus `LinkedItem` (`src/lib/domain/linked.ts`) und die Spalte `rarity` samt Zuweisung aus dem Monster-Zweig von `loadVisibleTargets` (`src/lib/domain/relations.ts`) streichen.
- **Abnahmekriterium:** `git grep -n "rarity" src/lib/domain/linked.ts src/lib/domain/relations.ts` liefert keinen Treffer; `npm run lint` und `npm test` sind grün.

### CR-007 – `ContentKind`-Labels mehrfach gepflegt

**Status: behoben.** `src/lib/i18n/de.ts` und `contentKindLabel` sind die einzige Quelle für diese Systemlabels.

- **Fundstelle:** `src/lib/domain/search.ts` `KIND_LABEL`; `src/lib/editor/mentions.ts` `KIND_LABEL`; `src/components/linked/ManualRelationForm.tsx` `KIND_LABEL`; `src/lib/domain/linked.ts` `linkedGroupLabel` (Plural)
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-007
- **Beschreibung:** Für „monster“ musste in vier Dateien dieselbe Label-Zuordnung ergänzt werden (Singular „Monster“ dreimal identisch). Die nächste Inhaltsart (z. B. Plan 006) erzwingt wieder dieselbe Streuänderung.
- **Empfehlung (Entscheidung Plan-Review 2026-09-24: typisiertes Label-Wörterbuch, i18n-vorbereitet, ohne Bibliothek):**
  1. **Wörterbuch** `src/lib/i18n/de.ts` (client-sicher, keine Abhängigkeiten): flaches, typisiertes Objekt mit Systemschlüsseln, zunächst nur für Inhaltsarten, z. B. `"contentKind.monster.one": "Monster"`, `"contentKind.monster.other": "Monster"`, `"contentKind.universe.one": "Universum"`, `"contentKind.universe.other": "Universen"` usw. für alle Werte aus `CONTENT_KINDS` (`src/lib/authz/types.ts`). Der Typ erzwingt per Mapped Type, dass für jede `ContentKind` beide Formen existieren (fehlender Eintrag = TypeScript-Fehler).
  2. **Zugriff** `src/lib/i18n/index.ts` mit `label(key)` sowie Komfortfunktion `contentKindLabel(kind, "one" | "other")`. Nur Deutsch; eine weitere Sprache wäre später eine zweite Datei plus Auswahl – das ist ausdrücklich **nicht** Teil dieses Findings.
  3. **Systemschlüssel statt Text in Daten:** `SearchHit.kindLabel` (`src/lib/search.ts`, befüllt in `src/lib/domain/search.ts`) entfällt; die API liefert nur `kind` (+ `templateType`), `src/components/world/CampaignSearch.tsx` bildet das Label beim Rendern. Artikel mit Vorlage behalten die Anzeige „Artikel · Ort“ (Vorlagen-Label weiter aus `templates/registry`).
  4. **Umstellen:** `KIND_LABEL` in `src/lib/domain/search.ts`, `src/lib/editor/mentions.ts` und `src/components/linked/ManualRelationForm.tsx` sowie die Plural-Map in `linkedGroupLabel` (`src/lib/domain/linked.ts`) werden entfernt und durch `contentKindLabel` ersetzt. Weitere Label-Maps (Monster-Enums, Rollen, Sichtbarkeit) werden **nicht** jetzt migriert; `.ai/conventions.md` bekommt einen Satz: „Neue UI-Labels für Systemschlüssel kommen ins Wörterbuch `src/lib/i18n/de.ts`.“
  5. Hinweis für Plan `002` (MCP): Liefert ein MCP-Werkzeug später Labels, nutzt es dasselbe Wörterbuch.
- **Abnahmekriterium:**
  - `git grep -n '"Universum"' src` findet genau eine Definition in `src/lib/i18n/de.ts` (plus Tests).
  - `git grep -n "KIND_LABEL" src/lib/domain/search.ts src/lib/editor/mentions.ts src/components/linked/ManualRelationForm.tsx` liefert keine Treffer; `linkedGroupLabel` enthält keine Literal-Map mehr.
  - `git grep -n "kindLabel" src` liefert keine Treffer; die Kampagnensuche zeigt Kategorien unverändert an (manuell geprüft, inkl. „Artikel · Ort“ und „Monster“).
  - Entfernt man testweise `contentKind.monster.other` aus `de.ts`, schlägt `tsc` fehl.
  - `.ai/conventions.md` enthält die Regel zum Wörterbuch; `npm run lint`, `npm test`, `npm run test:rechte` (Such-API-Tests angepasst) grün.

### CR-008 – Karten-`LinkedPanel`: eigene Reihenfolge, Monster ohne Profilbild

**Status: behoben.** Die Kartenansicht leitet ihre Reihenfolge vom gemeinsamen Array ab und nutzt die Porträtlogik.

- **Fundstelle:** `src/components/map/LinkedPanel.tsx` Z. 7 (`KIND_ORDER`) und Z. 60 (Avatar-Zweig)
- **Kategorie:** Lesbarkeit / Konsistenz
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-007
- **Beschreibung:** Das Panel pflegt eine eigene `KIND_ORDER` neben `LINKED_KIND_ORDER` (bewusst mit `pin` zuerst, aber undokumentiert) und musste deshalb separat um `monster` ergänzt werden. Monster zeigen dort nur den Anfangsbuchstaben, obwohl `portraitId` im Item vorhanden ist; im Welt-`LinkedPanel` wird das Bild angezeigt.
- **Empfehlung:** Reihenfolge aus `LINKED_KIND_ORDER` ableiten (z. B. `["pin", ...LINKED_KIND_ORDER.filter(k => k !== "pin")]`) und kommentieren; Avatar-Logik wie in `src/components/linked/LinkedPanel.tsx` (Bild, sonst Initiale) übernehmen oder als gemeinsame Mini-Komponente extrahieren.
- **Abnahmekriterium:** `src/components/map/LinkedPanel.tsx` enthält kein literal gepflegtes Array aller Content-Kinds mehr; ein Monster mit Profilbild zeigt im Karten-„Verknüpft“ das Bild.

### CR-009 – 404-Texte für Monster doppelt und uneinheitlich

~~Status: behoben.~~ Alle Monster-404-Pfade beziehen dieselbe Konstante aus dem leichtgewichtigen Nachrichtenmodul (und diese wird aus der Domain re-exportiert).

**Status: offen (Review-Check 2026-09-24, Regression erkannt).** Der nach der Baseline hinzugekommene Monster-Marker-Code aus Plan 006 in `src/lib/map/repository.ts` (Monster-Zweig, ca. Z. 1195 und 1202) enthält `fail(404, "Dieses Monster gibt es nicht.")` zweimal als Literal statt `MONSTER_NOT_FOUND` aus `src/lib/monsters/messages.ts`. Das Abnahmekriterium (genau eine Definition außerhalb von Tests) ist damit nicht mehr erfüllt. Die übrigen Stellen (Route, `attach.ts`, `authorize.ts`, Domain) nutzen weiterhin die Konstante.

- **Fundstelle:** `src/lib/domain/monsters.ts` Z. 71 und `src/app/api/worlds/[worldId]/monsters/[monsterId]/route.ts` Z. 11 („Dieses Monster gibt es nicht.“); `src/lib/files/attach.ts` Monster-Zweig und `src/lib/files/authorize.ts` („Monster nicht gefunden.“)
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005, T-006
- **Beschreibung:** Dieselbe Situation liefert je nach Endpunkt zwei verschiedene Texte, und der Text der Route ist eine Kopie der Domain-Konstante.
- **Empfehlung:** `MONSTER_NOT_FOUND` aus `monsters.ts` exportieren und in Route, `attach.ts` und `authorize.ts` verwenden.
- **Abnahmekriterium:** `git grep -n "Monster nicht gefunden\|Dieses Monster gibt es nicht" src` findet genau eine Definition außerhalb von Tests.

### CR-010 – `usePendingImageUpload`: Object-URL-Leak, untypisierte Bildart

**Status: behoben.** `ImageKind` lebt in `files/kinds.ts`; der Hook räumt die Object-URL beim Unmount auf und ist per DOM-Test belegt.

- **Fundstelle:** `src/lib/client/usePendingImageUpload.ts` Z. 10–37
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-009, T-008
- **Beschreibung:** Verlässt der Nutzer das Anlege-Formular mit gewähltem Bild ohne zu speichern (z. B. „Abbrechen“), wird `URL.revokeObjectURL` nie aufgerufen – der Blob bleibt bis zum Neuladen im Speicher. `uploadAfterCreate` akzeptiert `kind: string` statt `ImageKind`, Tippfehler fallen erst serverseitig auf.
- **Empfehlung (Entscheidung Plan-Review 2026-09-24):**
  1. `useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl])` ergänzen. Wird der Hook im Zuge von CR-015 in `ImageUploadField` (Modus `pending`) aufgelöst, gilt die Anforderung dort.
  2. **Neues Modul `src/lib/files/kinds.ts`** ohne Abhängigkeiten mit `IMAGE_KINDS` und `ImageKind` (Muster wie `src/lib/monsters/labels.ts`). `src/lib/files/authorize.ts` und `inspect.ts` importieren von dort (bestehende Exporte aus `authorize.ts` ggf. re-exportieren). `uploadImage` (`src/lib/client/api.ts`), `usePendingImageUpload` bzw. `ImageUploadField` typisieren `kind` als `ImageKind`.
- **Abnahmekriterium:** `src/lib/files/kinds.ts` existiert und importiert nichts; `IMAGE_KINDS` ist nur dort definiert. `uploadImage({ kind: "foo", … })` erzeugt einen TypeScript-Fehler. Ein Unit-Test (`// @vitest-environment happy-dom`) belegt, dass beim Unmount der Komponente/des Hooks mit gewählter Datei `URL.revokeObjectURL` aufgerufen wird.

### CR-011 – Race bei Profilbild ersetzen/entfernen hinterlässt verwaiste Dateien

**Status: behoben.** `swapSingleImage` sperrt und aktualisiert die jeweilige Zeile in einer Transaktion; ein Paralleltest deckt Monster-Porträts ab.

- **Fundstelle:** `src/lib/domain/monsters.ts` `updateMonster` Z. 454–490; `src/lib/files/attach.ts` Zweig `monster_portrait` (Lesen von `portraitId`, `persistImage`, `update`, `collectUnreferencedFiles([monster.portraitId])`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-006
- **Beschreibung:** Der alte `portraitId` wird **vor** dem Update gelesen und nur dieser Wert wird danach der GC übergeben. Laufen zwei Uploads parallel oder ein Upload parallel zu `removePortrait`, überschreibt der zweite Schreiber das Bild des ersten, der GC erfasst aber nur den jeweils vorher gelesenen Wert – das Zwischenbild bleibt als unreferenzierte Datei liegen, bis ein globaler GC-Lauf sie findet (falls es einen gibt). Das Muster stammt aus `article_title`, wird hier aber übernommen.
- **Empfehlung:** Alten Wert atomar mit dem Update ermitteln, z. B. `UPDATE monsters SET portrait_id = $new FROM (SELECT portrait_id AS old FROM monsters WHERE id = $id FOR UPDATE) … RETURNING old` bzw. `SELECT … FOR UPDATE` in einer Transaktion, und genau diesen Wert an `collectUnreferencedFiles` geben. *(Geprüft im Plan-Review 2026-09-24: Es gibt keinen periodischen GC-Lauf – `collectUnreferencedFiles` in `src/lib/files/gc.ts` räumt nur übergebene Kandidaten ab. Verwaiste Dateien bleiben also dauerhaft liegen.)*
- **Umfang (Entscheidung Plan-Review 2026-09-24): alle Einzelbild-Arten**, nicht nur Monster. Betroffen:
  - Uploads in `src/lib/files/attach.ts`: `world_title` (`worlds.title_image_id`), `article_title` (`articles.title_image_id`), `monster_portrait` (`monsters.portrait_id`), `character_portrait` (`characters.portrait_id`). `map` (`setMapImage`) und `character_image` (Anhänge, mehrere pro Charakter) sind **nicht** betroffen.
  - Entfernen: `removeTitleImage` in `src/lib/domain/worlds.ts` (ca. Z. 137) und `src/lib/domain/articles.ts` (Z. 237/366), `removePortrait` in `src/lib/domain/characters.ts` (Z. 262/314) und `src/lib/domain/monsters.ts` (Z. 316/490).
  - Umsetzung über einen gemeinsamen Helper in `src/lib/files/` (z. B. `swapSingleImage({ table, idColumn, imageColumn, targetId, newFileId | null, actorId, tx? })`), der in einer Transaktion den alten Wert mit `SELECT … FOR UPDATE` liest, den neuen setzt und den alten Wert zurückgibt; danach `collectUnreferencedFiles([old])`. Die vier Upload-Zweige in `attach.ts` und die vier Entfernen-Pfade nutzen ihn.
- **Abnahmekriterium:** Für alle vier Einzelbild-Spalten erfolgen Lesen des alten und Setzen des neuen Werts über denselben Helper in einer Transaktion mit Zeilensperre (`git grep -n "collectUnreferencedFiles(\[current\.\|collectUnreferencedFiles(\[monster\.\|collectUnreferencedFiles(\[owned\." src` findet keine Stellen mehr, die einen vor der Transaktion gelesenen Wert übergeben); ein Integrationstest (`*.integration.test.ts`) mit zwei parallelen Monster-Profilbild-Uploads hinterlässt genau eine referenzierte und keine unreferenzierte Datei in `files`.

### CR-012 – `habitatArticleId` wird an Betrachter ohne Leserecht auf den Ort ausgeliefert

**Status: behoben.** `getMonster` und `listMonsters` maskieren nicht lesbare Ziele auf `null`.

- **Fundstelle:** `src/lib/domain/monsters.ts` `getMonster` / `listMonsters` (`habitatArticleId` in `summaryColumns`); `GET /api/worlds/[worldId]/monsters[/…]`
- **Kategorie:** Sicherheit
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005
- **Beschreibung:** Ein Player sieht ein `published`-Monster, dessen Lebensraum ein `gm_only`-Ort ist. Die Detailseite blendet den Ort korrekt aus („–“), die API liefert aber die UUID des versteckten Artikels mit. Das verrät die Existenz (nicht den Inhalt) eines verborgenen Artikels und widerspricht dem Grundsatz „unsichtbar = 404/nicht vorhanden“.
- **Empfehlung (Entscheidung Plan-Review 2026-09-24: minimal maskieren):** In `getMonster` und `listMonsters` die Sichtbarkeit des Habitat-Artikels für den Betrachter prüfen (Left-Join auf `articles` mit `visibility`/`owner_id`, dann `canSeeContent`) und für Betrachter ohne Leserecht `habitatArticleId: null` zurückgeben. Feldname und API-Form bleiben. Die Detailseite zeigt weiterhin „–“. Zusammenspiel mit der Bearbeitung: siehe CR-001.
  Die weitergehende Idee des Projektinhabers (versteckte Verweise kryptisch darstellen statt ausblenden) ist **nicht** Teil dieses Findings, sondern als Backlog-Eintrag „2026-09-24 – Versteckte Verweise kryptisch darstellen“ in `.ai/backlog.md` für einen eigenen Plan erfasst.
- **Abnahmekriterium:** API-Test: Player ruft `GET /api/worlds/{worldId}/monsters/{id}` und `GET …/monsters` für ein veröffentlichtes Monster mit `gm_only`-Lebensraum ab und erhält jeweils `habitatArticleId: null`; die Spielleitung erhält die ID. Ein zweiter Master erhält `null`, wenn der Lebensraum ein fremder `owner_only`-Artikel ist.

### CR-013 – Hart kodierte Content-Pfade

**Status: behoben.** `contentHref` unterstützt den typisierten Edit-Modus, `contentNewHref` Anlege-Routen; die Monster-Komponenten verwenden beides.

- **Fundstelle:** `src/components/monsters/MonsterDetailView.tsx` Z. 62, 79; `src/components/monsters/MonsterList.tsx` Z. 52; `src/components/monsters/MonsterForm.tsx` Z. 123–124
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-008
- **Beschreibung:** Links auf Monster- und Artikelseiten werden per String-Template gebaut (`worldPath(worldId, \`/articles/${id}\`)`, `…/monsters/${id}`), obwohl `contentHref(worldId, kind, id)` (in T-007 um `monster` erweitert) genau dafür existiert. Bei einer Routenänderung müssen mehrere Stellen angepasst werden.
- **Empfehlung (Entscheidung Plan-Review 2026-09-24: `contentHref` mit Aktion):** `src/lib/content-href.ts` erweitern:
  - `contentHref(worldId, kind, id, action?: "edit")` – ohne `action` unverändert (Detail), mit `"edit"` → `…/{id}/edit`. Die Aktion ist per Typ nur für Inhaltsarten mit Bearbeiten-Route erlaubt (`EditableContentKind`, mindestens `article`, `quest`, `monster`; `pin` und `character` ausgeschlossen, falls sie keine solche Route haben – beim Umsetzen an den vorhandenen Routen unter `src/app/w/[worldId]/` prüfen).
  - `contentNewHref(worldId, kind)` für Anlege-Seiten (`…/new`), ebenfalls nur für Arten mit Route.
  - In den Monster-Komponenten (`MonsterDetailView`, `MonsterList`, `MonsterForm`) alle Links über diese Funktionen bauen; der Lebensraum-Link über `contentHref(worldId, "article", id)`. Andere Bereiche werden nicht angefasst, sollen aber bei Gelegenheit folgen.
- **Abnahmekriterium:** `git grep -n '/monsters/' src/components/monsters` und `git grep -n '/articles/' src/components/monsters` liefern keine Treffer; `src/lib/content-href.test.ts` deckt `action: "edit"` und `contentNewHref` für `monster` ab; `contentHref(w, "pin", id, "edit")` erzeugt einen TypeScript-Fehler.

### CR-014 – Testlücken

**Status: behoben.** Die Monster-API-Suite deckt nun Owner-Schreibschutz, Porträt-GC, ungültige gespeicherte Lebensräume und die Sichtbarkeitsmaskierung ab.

- **Fundstelle:** `src/app/api/worlds/[worldId]/monsters/monsters.api.test.ts`
- **Kategorie:** Testabdeckung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-005, T-006
- **Beschreibung:** Nicht abgedeckt sind: (a) `PATCH visibility: "owner_only"` durch einen Master, der nicht Owner ist → 403 (Anforderung aus T-005, bisher nur indirekt über die gemeinsame Authz-Funktion und Artikel-Tests); (b) `PATCH removePortrait: true` setzt `portrait_id` auf NULL und entfernt die Datei per GC; (c) das Szenario aus CR-001; (d) der Fall aus CR-012.
- **Empfehlung:** Die vier Fälle als API-Tests ergänzen (c und d zusammen mit den jeweiligen Fixes).
- **Abnahmekriterium:** `monsters.api.test.ts` enthält Tests für (a) 403 bei Nicht-Owner und `owner_only`, (b) `removePortrait` → `portrait_id IS NULL` und Datei nicht mehr in `files`; `npm run test:rechte` ist grün.

### CR-015 – Bild-Uploads ohne einheitlichen Client-Weg

**Status: behoben.** `ImageUploadField`, `finishCreateWithImage` und der zentralisierte Speicher-Löschweg vereinheitlichen alle Bild-Uploads.

- **Fundstelle:**
  - Upload-Aufrufe: `src/components/world/CreateWorldForm.tsx` (Z. 34, 80), `src/components/world/WorldSettingsCard.tsx` (Z. 47, 101), `src/components/articles/ArticleForm.tsx` (`onImage`, Create-Zweig), `src/components/monsters/MonsterForm.tsx` (`onPortrait`, Create-Zweig), `src/components/characters/CharacterForm.tsx` (Z. 112, 125, 161, 218), `src/components/map/use-map-state.ts` `replaceImage` (Z. ca. 160, eigenes `FormData` + `apiFetch`), `src/components/map/MapView.tsx` (Z. ca. 154, hart kodiertes `accept`).
  - Helfer: `src/lib/client/api.ts` `uploadImage`, `src/lib/client/usePendingImageUpload.ts`.
  - Server: `src/lib/files/gc.ts` (`unlink(storedFilePath(…))` direkt statt über `store.ts`).
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-006, T-008, T-009
- **Beschreibung:** Serverseitig laufen alle Uploads bereits über einen Weg (`POST /api/files` → `attachImage`/`setMapImage` → `store.ts`). Im Client gibt es dagegen kein Hausmuster: Jede Komponente baut ihren eigenen „Bild wählen“-Knopf mit verstecktem `<input type="file">`, die Karte umgeht `uploadImage` mit eigenem `FormData`, und „anlegen, dann Bild hochladen“ existiert dreimal mit drei unterschiedlichen Fehlverhalten (Welt: Inline-Meldung + „Weiter zur Welt“; Artikel/Monster: Redirect mit `?titleImageError=1` / `?portraitError=1`). Außerdem umgeht `gc.ts` beim Löschen die Speicher-Abstraktion `store.ts`. Wunsch des Projektinhabers (Plan-Review 2026-09-24): **Datei-Uploads folgen immer demselben Weg**, damit spätere Umstellungen (z. B. S3) an einer Stelle passieren.
- **Empfehlung (Entscheidung Plan-Review 2026-09-24: neues Finding, alle Uploads):**
  1. **Ein Client-Helper:** `uploadImage` in `src/lib/client/api.ts` ist der einzige Weg zu `POST /api/files`; `use-map-state.ts` `replaceImage` wird darauf umgestellt. Parameter `kind` als `ImageKind` typisiert (siehe CR-010).
  2. **Eine Komponente** `src/components/files/ImageUploadField.tsx` (Client): Knopf „Bild wählen“ (`accept={IMAGE_ACCEPT}`), optional „Entfernen“, Vorschau über einen Render-Prop bzw. Variante (`avatar` für Profilbilder, `banner` für Titelbilder, `none` wenn die Seite selbst anzeigt). Zwei Modi:
     - `mode="immediate"` (Ziel existiert): lädt sofort über `uploadImage` hoch, meldet Erfolg/Fehler per Callback (`onUploaded`, `onError`), `onRemove` optional.
     - `mode="pending"` (Anlegen): hält die Datei (Logik aus `usePendingImageUpload`, inkl. Object-URL-Freigabe beim Unmount, CR-010) und stellt sie dem Formular zur Verfügung.
  3. **Ein Anlege-Ablauf:** Hilfsfunktion (z. B. `finishCreateWithImage({ file, kind, worldId, targetId, onSuccessHref, onFailureHref, router })` in `src/lib/client/`), die nach erfolgreichem `POST` hochlädt und navigiert. Einheitliches Fehlverhalten: **Datensatz bleibt angelegt, Redirect auf die Bearbeiten-/Einstellungsseite des neuen Datensatzes mit Query `?imageError=1`, die Seite zeigt „<Art> angelegt, Bild konnte nicht hochgeladen werden.“** Für Welten ist das Ziel `/w/{worldId}/menu` (dort liegt `WorldSettingsCard`). Die bisherigen Parameter `titleImageError` / `portraitError` entfallen.
  4. **Einsatz:** `CreateWorldForm`, `WorldSettingsCard`, `ArticleForm`, `MonsterForm`, `CharacterForm` (Profilbild und Anhänge – Anhänge im Modus `immediate`, Vorschau `none`, da die Galerie selbst rendert) und `MapView` (Modus `immediate`, Vorschau `none`) nutzen `ImageUploadField`.
  5. **Server:** `gc.ts` löscht Dateien über eine Funktion aus `store.ts` (z. B. `deleteStoredObject(storageKey)`), sodass nur `store.ts` den Speicherort kennt.
- **Abnahmekriterium:**
  - `git grep -n 'type="file"' src/components` findet nur noch `ImageUploadField.tsx`.
  - `git grep -n "new FormData" src` findet nur noch `src/lib/client/api.ts` (und ggf. Tests).
  - `git grep -n "storedFilePath\|unlink(" src/lib/files` findet Treffer nur in `store.ts`.
  - `git grep -n "titleImageError\|portraitError" src` liefert keine Treffer; alle drei Anlege-Formulare (Welt, Artikel, Monster) leiten bei fehlgeschlagenem Bild-Upload mit `?imageError=1` auf die jeweilige Bearbeiten-/Einstellungsseite, die die Meldung anzeigt (manuell mit 11-MB-Datei geprüft).
  - Manuell (Smoketest): Weltbild, Artikel-Titelbild, Monster-Profilbild, Charakter-Profilbild und -Anhang, Kartenbild hochladen/ersetzen funktionieren wie bisher; `npm run lint`, `npm test`, `npm run build` grün.

---

## Prioritätenliste

## Umsetzung & Prüfung (2026-09-24)

Alle Findings CR-001 bis CR-015 sind umgesetzt und in der Tabelle als `behoben` markiert. Erfolgreich geprüft: `npm test` (238 Tests), `npm run lint` (ohne Fehler), `npm run typecheck`, `npm run test:rechte` (171 Tests) und `npm run test:triggers` (16 Tests).

`npm run build` konnte in dieser Ausführungsumgebung nicht abgeschlossen werden: Turbopack bricht bereits beim bestehenden Import `leaflet/dist/leaflet.css` mit `creating new process / binding to a port: Operation not permitted` ab. Der Fehler tritt auch außerhalb der Sandbox auf und liegt vor der Anwendungs-Kompilierung; er ist kein fehlgeschlagener Finding-Fix. Der Produktionsbuild muss in einer Umgebung ohne diese Prozess-/Port-Beschränkung erneut bestätigt werden.

1. **CR-001** – echter Bearbeitungs-Blocker für Monster mit nicht mehr wählbarem Lebensraum.
2. **CR-012** – kleines Informationsleck, zusammen mit CR-001 im selben Codebereich lösbar.
3. **CR-015** und **CR-002** – größter Hebel für Wartbarkeit (einheitlicher Upload-Weg, zentrale Blattregeln); CR-010 wird mit CR-015 miterledigt.
4. **CR-014** – Tests zu CR-001/CR-012 und den fehlenden Rechte-/GC-Fällen nachziehen.
5. **CR-003**, **CR-004**, **CR-005** – Domain-Layer aufräumen (Validierung, Enums, tote Fallbacks).
6. **CR-011**, **CR-010** – Laufzeit-Kleinigkeiten (verwaiste Dateien, Blob-Leak).
7. **CR-006**, **CR-007**, **CR-008**, **CR-009**, **CR-013** – Konsistenz und Kosmetik.

---

## Review-Check 2026-09-24

**Geprüfter Stand:** HEAD `485e30e` plus uncommittete Änderungen im Working Tree (Snapshot vom 2026-09-24, 07:30). Die Fixes zu CR-001 bis CR-015 und die Umsetzung von Plan 006 (Monster-Marker, Kartenfilter) sind noch nicht committet. Verglichen wurde gegen die Baseline `485e30e`.

**Statusänderungen:**
- `behoben` bestätigt: 14 (CR-001 bis CR-008, CR-010 bis CR-015). Die Abnahmekriterien wurden per `grep` und Codeinspektion nachgeprüft. Tests wurden in diesem Check nicht ausgeführt.
- Regressionen (`behoben` → `offen`): 1 (CR-009, siehe Detailabschnitt)
- `drift`: 0

**Hinweis zu CR-011 (Status bleibt `behoben`):** Der wörtliche `grep` aus dem Abnahmekriterium trifft noch `collectUnreferencedFiles([current.…])` in `deleteMonster` (`src/lib/domain/monsters.ts`) und `deleteArticle` (`src/lib/domain/articles.ts`) sowie `[owned.data.portraitId, …]` in `deleteCharacter` (`src/lib/domain/characters.ts`). Das sind Löschpfade für ganze Datensätze und keine Bildwechsel. Laut Finding gehören sie nicht zum Umfang. Ein paralleler Upload zwischen dem Lesen und dem `DELETE` könnte aber theoretisch weiterhin eine verwaiste Datei hinterlassen.

**Nicht abgedeckte Änderungen seit der Baseline im Scope von Plan 005** (keinem Finding zuzuordnen):
1. **Umbenennung „Legendär“ → „Boss“:** Migration `src/db/migrations/0021_monster_is_boss.sql` (`is_legendary` → `is_boss`) und `MonsterBossMark` (💀) statt `MonsterLegendaryPill` in `src/components/monsters/MonsterRarityPill.tsx`, in rund 10 Dateien umgestellt (Schema, Domain, Formular, Liste, Detail, Tests). Die Task-Datei 005 ist entsprechend nachgezogen.
2. **Seltenheits-Labels deutsch statt englisch:** `MONSTER_RARITY_LABEL` in `src/lib/monsters/labels.ts` (Owner-Entscheidung 2026-09-24, in der Task-Datei 005 vermerkt).
3. **Monster auf der Karte (Plan 006):** `publishMapsForMonster` in `updateMonster` und `deleteMonster` (`src/lib/domain/monsters.ts`), neuer Monster-Zweig in `src/lib/map/repository.ts`, neue Routen `src/app/api/worlds/[worldId]/map/monster-markers/…`, Migration `0022_monster_markers.sql`, `src/lib/map/monster-marker-events.ts` sowie Erweiterungen in `src/lib/realtime/events.ts`. Hier ist die CR-009-Regression entstanden. Fachlich gehört das zu Plan 006 und sollte dort reviewt werden.

**Empfehlung:** Einen vollständigen neuen `/code-review` für 005 braucht es nicht. Die 14 bestätigten Fixes halten, Drift gibt es keine. CR-009 lässt sich mit zwei Zeilen beheben (`MONSTER_NOT_FOUND` in `src/lib/map/repository.ts` importieren), am besten zusammen mit Plan 006. Die Punkte 1 und 2 sind kleine Owner-Entscheidungen, für die sich kein eigenes Review lohnt. Punkt 3 sollte beim `/code-review` für Plan 006 mit abgedeckt werden. Vor dem Commit sollten `npm test`, `npm run test:rechte` und `npm run build` noch einmal laufen, weil der Build laut Umsetzungsvermerk bisher nicht bestätigt ist.
