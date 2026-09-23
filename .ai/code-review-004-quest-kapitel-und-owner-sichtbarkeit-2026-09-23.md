# Code Review – 004 Quest-Kapitel, Quest-Notizblock und dreistufige Sichtbarkeit (2026-09-23)

**Baseline:** Commit `ca2eccc1bfe9ab719c245cabc4fe0c5e2a136abd` (HEAD, „T-004 (008): Smoketest WS.1–WS.6 bestanden …“). Die 004-Commits sind `ffe2350` (T-001) bis `1084d7e` (T-013), dazwischen liegen Commits aus Review 003 (CR-001–CR-017), Plan 007 und Plan 008. Geprüft wurde der Stand der 004-Dateien **bei HEAD**. Unversioniert im Working Tree (nicht Gegenstand dieses Reviews): `.ai/code-review-008-…`, `.ai/feature-tasks/005-…`, `.ai/feature-tasks/006-…`, `.claude/`.
**Geprüfte Task-Datei:** `.ai/feature-tasks/004-quest-kapitel-und-owner-sichtbarkeit.md` (T-001–T-013 alle als erledigt markiert; T-001, T-002, T-012 sind reine Doku- oder Prototyp-Aufgaben und wurden nur auf Abgleich geprüft).
**Plan-Review 2026-09-23:** Offene Entscheidungen geklärt (CR-001, CR-003, CR-005, CR-016 durch den Projektinhaber; Orte und Details für CR-004, CR-006–CR-010, CR-017 ohne Produktwirkung festgelegt). Reihenfolge siehe *Abhängigkeiten*. Das Review gilt erst als abgeschlossen, wenn der *Smoketest Review 004* bestanden ist.

### Abhängigkeiten (für die Umsetzung)

- **CR-007 vor CR-004** (Suche nutzt `visibleContentWhere`) und **vor CR-002** (Sichtprüfung der Relationsenden nutzt `canSeeContent`).
- **CR-008 vor CR-013 und CR-011** (alle drei ändern `quest-chapters.ts`; `loadWritableChapter` aus CR-013 nutzt `loadVisibleQuest` aus CR-008; das Sperren der Quest-Zeile in CR-011 kommt in dieselben Funktionen).
- **CR-012 zusammen mit CR-011** (beide in `reorderChapters`).
- **CR-015 nach CR-013** (Aufrufe von `recalcQuestRelations` in den überarbeiteten Kapitelfunktionen).
- **CR-009 vor CR-010** (Label-/Optionsfunktionen und Schema liegen danach beide unter `src/lib/authz`).
- **CR-001, CR-003 vor CR-005** (Smoketest prüft das neue Verhalten); **CR-006 zusammen mit CR-003** (gleiche Funktion `applyEvent`).
- **CR-017** begleitend zu CR-001–CR-004 (Tests je Finding im selben Commit).
- CR-014 und CR-016 unabhängig.

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Runtime-Risiken | mittel | erledigt | Notizblock-UI übernimmt bei 409 die Server-Version; zweites „Speichern“ überschreibt die fremde Änderung ungesehen |
| CR-002 | Sicherheit | mittel | erledigt | `createManualRelation` prüft die Sichtbarkeit von Quelle und Ziel nicht (Relationen an fremde `owner_only`-Inhalte) |
| CR-003 | Runtime-Risiken | mittel | erledigt | Karten-Refetch (R5): jeder Fehler entfernt den Pin/Marker; veraltete Antworten überschreiben neuere Stände oder holen gelöschte Pins zurück |
| CR-004 | Runtime-Risiken | mittel | erledigt | Hub-Suche: SQL-`limit` greift vor dem JS-Sichtbarkeitsfilter; fremde `owner_only`-Zeilen und mehrere Kapitel einer Quest verdrängen sichtbare Treffer |
| CR-005 | Aufgaben-Abgleich | mittel | erledigt | Browser-Abnahmen mit zwei Sitzungen (T-004 (4) R5, T-010 (2) Konflikt) fehlen — nachzuholen als *Smoketest Review 004* (SR4.1–SR4.4), blockierend für den Review-Abschluss |
| CR-006 | Performance | niedrig | erledigt | Jeder Client holt bei jedem `map.pin`/`map.marker` den Datensatz, auch für Karten, die er gar nicht offen hat |
| CR-007 | Duplizierung & Modularisierung | niedrig | erledigt | Sichtbarkeitsprädikat (SQL und `canSeeVisibility({...})`) an vielen Stellen dupliziert statt zentral in `authz` |
| CR-008 | Duplizierung & Modularisierung | niedrig | erledigt | `loadQuest`/`canSeeQuest` doppelt in `quest-chapters.ts` und `quest-notes.ts`; Quest-Seite lädt die Quest dreimal |
| CR-009 | Duplizierung & Modularisierung | niedrig | erledigt | `visibilitySchema` dreimal identisch exportiert, gleichnamig mit abweichendem Schema in `map/repository.ts` |
| CR-010 | Duplizierung & Modularisierung | niedrig | erledigt | UI: `CHAPTER_TITLE_MAX`, Stufen-Optionen und Stufen-Labels mehrfach gepflegt; `GmBadge` heißt irreführend |
| CR-011 | Runtime-Risiken | niedrig | erledigt | Kapitel-Position wird außerhalb der Transaktion bestimmt; parallele Anlage/Umsortierung erzeugt doppelte Positionen |
| CR-012 | Bad Practices | niedrig | erledigt | `reorderChapters` überschreibt `updated_at`/`updated_by` aller Kapitel, auch unsichtbarer und unveränderter, mit N Einzel-UPDATEs |
| CR-013 | Lesbarkeit & Wartbarkeit | niedrig | erledigt | `updateChapter`/`deleteChapter`: doppelte Lade-/Prüflogik, Prüfreihenfolge unklar, redundanter Null-Check, unnötig `async` |
| CR-014 | Lesbarkeit & Wartbarkeit | niedrig | erledigt | `withMentions` mit 8 Positionsparametern; `normalizeNote` mit totem Zweig für Nicht-String-Datum |
| CR-015 | Performance | niedrig | erledigt | Jede Kapiteländerung baut auch die `participation`-Relationen der Quest neu auf |
| CR-016 | Lesbarkeit & Wartbarkeit | niedrig | erledigt | Drizzle-`_journal.json`/Snapshots unvollständig (0013/0014 fehlen, 0015 drin) – `npm run db:generate` liefert falsche Diffs |
| CR-017 | Testabdeckung | niedrig | erledigt | Lücken zu T-004 (2)/(7), manuellen Relationen und der Client-Logik (Notiz-Konflikt, Karten-Refetch) |

---

## CR-001 – Notizblock: zweites Speichern nach Konflikt überschreibt fremde Änderung

- **Fundstelle:** `src/components/quests/QuestNotesSheet.tsx`, `onSave` (Z. 95–120, v. a. Z. 111–116)
- **Kategorie:** Runtime-Risiken (Datenverlust)
- **Schweregrad:** mittel
- **Bezug:** T-010 (E5, `APP-NOTE-VERSION`)
- **Beschreibung:** Bei HTTP 409 setzt der Client `note.version` auf die aktuelle Server-Version aus dem 409-Body und lässt den eigenen Entwurf im Editor. Klickt der Nutzer danach erneut auf „Speichern“ (der Knopf bleibt aktiv), geht der PUT mit der neuen Version durch und überschreibt die Änderung des anderen Mitglieds, ohne dass er sie je gesehen hat. Damit ist die Versionsprüfung in der Oberfläche umgangen: E5 will einen Konflikt anzeigen, nicht nach einem Extra-Klick stillschweigend überschreiben. Der Hinweistext („Dein Text bleibt im Editor, bis du neu lädst“) sagt nichts über dieses Verhalten.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Speichern sperren bis „Neu laden“.** Kein „Trotzdem überschreiben“, kein Zusammenführen.
- **Empfehlung:** Bei 409 die lokale Version **nicht** anheben (den `version`-Wert aus dem 409-Body nicht in `note` übernehmen). Solange `conflict` gilt, ist „Speichern“ deaktiviert; einzige Aktion ist „Neu laden“, das Text und Version vom Server übernimmt. Den Hinweistext ergänzen, damit klar ist, dass „Neu laden“ den eigenen Text ersetzt (z. B. „Kopiere deinen Text, bevor du neu lädst.“).
- **Abnahmekriterium:** Zwei Sitzungen auf derselben Quest: B speichert, danach speichert A mit alter Version → Konflikthinweis. Bei A ist „Speichern“ danach deaktiviert, der eigene Text steht weiter im Editor; Bs Text ist in der DB unverändert. Nach „Neu laden“ zeigt A Bs Stand mit dessen Version, „Speichern“ ist wieder aktiv und ein anschließendes Speichern gelingt.

## CR-002 – Manuelle Relation ohne Sichtbarkeitsprüfung der Enden

- **Fundstelle:** `src/lib/domain/relations.ts`, `createManualRelation` (Z. 641–683) und `loadEnd` (Z. 586–635); Aufruf `src/app/api/worlds/[worldId]/relations/route.ts` POST
- **Kategorie:** Sicherheit
- **Schweregrad:** mittel
- **Bezug:** T-004 (Alle Aufrufer umstellen, u. a. `relations.ts`; *Fachliche Regeln*: Bearbeiten nur, wenn sichtbar)
- **Beschreibung:** `loadEnd` prüft nur, ob Quelle und Ziel in der Welt existieren, nicht, ob der Aufrufer sie sieht. Ein Game Master (oder Master B) kann dadurch per API eine manuelle Relation von oder zu einem `owner_only`-Artikel, einer `owner_only`-Quest oder einem `owner_only`-Pin von Master A anlegen. Das ist ein Schreibzugriff auf einen Datensatz, den er nicht sieht. Außerdem verrät 201 statt 404, dass die ID existiert. A findet danach in „Verknüpft“ eine Relation, die jemand ohne Sichtrecht angelegt hat. Die UI-Zielliste (`listRelationTargets`) filtert zwar richtig, die API aber nicht.
- **Empfehlung:** In `createManualRelation` beide Enden mit derselben Sichtbarkeitslogik wie `loadVisibleTargets` prüfen (Pins mit Universum/Karte/Pin-Vererbung). Ist ein Ende unsichtbar, 404 mit derselben Meldung wie bei einem fehlenden Ende. `deleteManualRelation` ebenso an die Sichtbarkeit beider Enden binden.
- **Abnahmekriterium:** API-Test: Der GM legt per `POST /relations` eine Relation zu As `owner_only`-Artikel an → 404, keine Zeile in `relations`. Derselbe Aufruf durch A → 201.

## CR-003 – Karten-Refetch: Fehler entfernen Datensätze, veraltete Antworten gewinnen

- **Fundstelle:** `src/components/map/use-map-state.ts`, `applyEvent` (Z. 249–323, v. a. Z. 258–276 und 278–292)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-004 (R5)
- **Beschreibung:**
  1. `if (!result.ok)` entfernt Pin bzw. Marker bei **jedem** Fehler (Netzwerkabbruch = Status 0, 401, 500, 502 bei Neustart). R5 verlangt das Entfernen nur bei 404. Ein kurzer Aussetzer lässt Pins bis zum nächsten Reload verschwinden.
  2. Die Refetches laufen ungeordnet parallel. Schnelle Folgen von `map.pin` (Verschieben, Bearbeiten) können Antworten in anderer Reihenfolge liefern, dann steht eine ältere Position im State. Kommt `map.pin.deleted`, während ein Refetch noch läuft, der vor dem Löschen beantwortet wurde, fügt `setState` den gelöschten Pin wieder ein (die Antwort-Callbacks prüfen weder Reihenfolge noch Löschung).
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Stand lassen + Resync.** Bei jedem anderen Ergebnis als 200 oder 404 bleibt der Datensatz im State; der Kartenzustand wird danach vollständig neu geladen (vorhandenes `reload()`), bei Status 0 (keine Verbindung) erst, wenn die SSE-Leitung wieder steht (`onResync`). Kein eigener Fehlerhinweis.
- **Empfehlung:** Nur bei `result.status === 404` entfernen. Sonst State lassen und `reload()` anstoßen (bei Status 0 auf den Resync der Leitung warten; mehrere Fehler kurz hintereinander lösen nur ein `reload()` aus). Pro ID einen Zähler oder eine Sequenz führen und nur die Antwort der neuesten Anfrage anwenden; gelöschte IDs bis zur nächsten vollständigen Synchronisation merken und späte Upserts für sie verwerfen. (Festgelegt im Plan-Review 2026-09-23: Sequenz pro ID + Lösch-Merkliste, kein `AbortController` – ein Abbruch verhindert nicht, dass eine schon eingetroffene Antwort nach dem Löschen angewendet wird.)
- **Abnahmekriterium:** (1) Unit-Test (Hook oder extrahierte reine Funktion): Refetch mit Status 0/500 lässt den Pin im State und löst bei 500 genau ein `reload()` aus; Status 404 entfernt ihn. (2) Test: zwei Events für denselben Pin, die erste Antwort kommt zuletzt → State zeigt die Daten der zweiten. (3) Test: `map.pin.deleted` während eines laufenden Refetches → Pin bleibt entfernt.

## CR-004 – Hub-Suche: Limit vor Sichtbarkeitsfilter

- **Fundstelle:** `src/lib/domain/search.ts`: `searchArticles` (Z. 124/136), `searchQuests` (Z. 165/176), `searchQuestChapters` (Z. 216–234), `searchPins` (Z. 296–315)
- **Kategorie:** Runtime-Risiken (falsche bzw. fehlende Ergebnisse)
- **Schweregrad:** mittel
- **Bezug:** T-004, T-007
- **Beschreibung:** Für die Spielleitung schränkt das SQL nicht auf „nicht `owner_only` oder eigener Owner“ ein, anders als `listArticles`, `listQuests` und `mention-search.ts`. Die Datenbank liefert `limit` Zeilen, danach verwirft der JS-Filter fremde `owner_only`-Zeilen. Gibt es viele passende fremde Entwürfe, sieht ein Spielleiter weniger Treffer als vorhanden oder gar keine, obwohl sichtbare passen. Dasselbe in `searchQuestChapters`: Die Zeilen sind Kapitel, die Deduplizierung pro Quest passiert erst nach dem `limit`. Eine Quest mit vielen passenden Kapiteln verdrängt andere Quests. Unsichtbare Kapitel (fremdes `owner_only`) belegen für Staff ebenfalls Plätze.
- **Empfehlung:** Die Sichtbarkeit komplett im SQL abbilden (Prädikat aus CR-007: `visibility <> 'owner_only' OR owner_id = viewer` für Staff, `published` für Player; bei Kapiteln für Quest **und** Kapitel). Kapiteltreffer per `DISTINCT ON (quest_id)` (sortiert nach Kapitel-`position`, damit der Auszug aus dem ersten passenden sichtbaren Kapitel stammt) auf Quest-Ebene begrenzen, bevor `limit` greift. Den JS-Filter (`canSeeVisibility`) als zweite Absicherung **behalten** (festgelegt im Plan-Review 2026-09-23, ohne Produktwirkung). Umsetzung erst nach CR-007 (nutzt dessen Helper).
- **Abnahmekriterium:** API-Test: Master B hat `limit + 1` passende `owner_only`-Artikel, GM hat einen passenden `gm_only`-Artikel → die Hub-Suche des GM findet den `gm_only`-Artikel. Test: Quest X mit `limit + 1` passenden Kapiteln und Quest Y mit einem passenden Kapitel → beide Quests im Ergebnis.

## CR-005 – Browser-Abnahmen mit zwei Sitzungen fehlen

- **Fundstelle:** Task-Datei, Umsetzungsvermerke T-004 (Z. 153), T-010 (Z. 193), Tabelle *Abnahme* unter T-013 (Z. 232)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug:** T-004, T-010, T-013
- **Beschreibung:** T-004 (4) verlangt ausdrücklich die Browser-Prüfung „Spielleitung verschiebt `gm_only`-Pin … Karte des Players zeigt ihn nicht, die des Masters zeigt die neue Position ohne Neuladen“. T-010 (2) verlangt den Konflikt mit zwei Sitzungen im Browser. Beides ist laut Vermerk „nicht automatisierbar“ und wurde per API ersetzt. T-004 verschiebt die Sichtprüfung auf T-013, T-013 verweist wieder auf die API. Die Aufgaben sind trotzdem `[x]`. Gerade diese Pfade haben Fehler in der Client-Logik (CR-001, CR-003), die ein API-Test nicht findet. Zwei Sitzungen gehen mit getrennten Browser-Kontexten (zweites Profil oder Inkognito-Fenster, zweiter Browser, Playwright mit zwei `BrowserContext`s).
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Smoketest im Review, blockierend für den Abschluss des Reviews.** Die Browser-Abnahmen stehen als Smoketest-Punkte in diesem Review-Dokument (Abschnitt *Smoketest Review 004* unten), nicht in der Task-Datei und nicht in `.ai/infrastructure/smoketest.md`. T-004, T-010 und T-013 bleiben `[x]`; die Task-Datei wird nicht geändert. Das Review gilt erst als abgeschlossen, wenn alle Smoketest-Punkte bestanden sind.
- **Empfehlung:** Nach Behebung von CR-001 und CR-003 die Punkte SR4.1–SR4.4 mit zwei getrennten Browser-Kontexten durchführen (z. B. normales Fenster + Inkognito-Fenster oder zwei Browser, je mit eigenem Test-Login) und Ergebnis mit Datum in die Tabelle eintragen.
- **Abnahmekriterium:** Alle Zeilen der Tabelle *Smoketest Review 004* stehen auf „bestanden“ mit Datum. Solange eine Zeile offen ist, bleibt CR-005 `offen` und das Review nicht abgeschlossen.

## CR-006 – Refetch auch für Karten, die nicht offen sind

- **Fundstelle:** `src/components/map/use-map-state.ts` Z. 258–276 / 278–282; `src/components/map/use-map-realtime.ts` Z. 13–18
- **Kategorie:** Performance
- **Schweregrad:** niedrig
- **Bezug:** T-004 (R5)
- **Beschreibung:** Das Signal enthält `mapId`, trotzdem schickt jeder verbundene Client zuerst `GET …/pins/[pinId]` und verwirft das Ergebnis erst danach, wenn `pin.mapId !== current.map.id`. Bei Welten mit mehreren Karten und Drag-Operationen erzeugt jede Bewegung N zusätzliche API-Aufrufe inkl. Rechteprüfung. Bei Markern ist der Refetch für fremde Karten zum Teil nötig (Charakter „woanders platziert“), bei Pins nicht.
- **Empfehlung (festgelegt im Plan-Review 2026-09-23, ohne Produktwirkung):** Für `map.pin` vor dem Fetch prüfen: Ist keine Karte offen oder `event.mapId !== state.map.id`, nichts tun. `map.marker` bleibt unverändert beim Refetch, auch für fremde Karten: Nur so erfährt der Client, welcher Charakter „woanders platziert“ ist (das Signal trägt keine `characterId`), und es gibt höchstens einen Marker pro Charakter, also wenige Events.
- **Abnahmekriterium:** Ein `map.pin`-Event für eine andere `mapId` als die geöffnete Karte (oder ohne geöffnete Karte) löst keinen Netzwerk-Request aus (Unit-Test mit gemocktem `apiFetch`). Das Verhalten bei `map.marker` ist unverändert.

## CR-007 – Sichtbarkeitsprädikat vielfach dupliziert

- **Fundstelle:** SQL-Prädikat `or(ne(x.visibility, "owner_only"), eq(x.ownerId, viewerId))` in `articles.ts` Z. 181–182, `quests.ts` Z. 329–330, `mention-search.ts` Z. 40–41 und 85–86 (fehlt in `search.ts`, siehe CR-004). Objektaufrufe `canSeeVisibility({ role, visibility: row.visibility, viewerId, ownerId: row.ownerId })` in `relations.ts`, `search.ts`, `mention-resolve.ts`, `quest-chapters.ts`, `quest-notes.ts`, `quests.ts`, `articles.ts`, `authz.ts` (`authorizeOwnedContentWrite`, `authorizePinWrite`, `canReadArticleTitleFile`)
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug:** T-004
- **Beschreibung:** Die Regel `APP-VIS-OWNER` steckt in `canSeeVisibility`, das SQL-Gegenstück aber ist pro Datei von Hand nachgebaut, und jeder Aufruf baut dasselbe Objekt. Dass `search.ts` das Prädikat vergessen hat (CR-004), zeigt die Folge. Ebenso prüfen `authorizeOwnedContentWrite` und `authorizePinWrite` Sichtbarkeit und R2 mit fast identischem Code.
- **Empfehlung (Orte festgelegt im Plan-Review 2026-09-23, ohne Produktwirkung):**
  - `canSeeContent(viewer: { role; userId }, content: { visibility; ownerId? })` in `src/lib/authz/types.ts` neben `canSeeVisibility` (client-tauglich, kein DB-Import) und über `src/lib/authz/index.ts` exportieren; alle genannten Objektaufrufe darauf umstellen.
  - `visibleContentWhere(columns: { visibility; ownerId }, viewer)` als Drizzle-Helper in neuer Datei `src/lib/domain/visibility-sql.ts` (server-only, **nicht** aus `@/lib/authz` exportieren, damit kein Drizzle in Client-Bundles landet). Liefert für Player `visibility = 'published'`, für Staff `visibility <> 'owner_only' OR owner_id = viewerId`. Für zweistufige Tabellen (Universum, Karte) reicht der bestehende `isStaff`-Zweig; kein Helper nötig.
  - Nutzer: `articles.ts`, `quests.ts`, `mention-search.ts`, `search.ts` (CR-004, auch für Kapitel und Pins).
  - `authorizePinWrite` ruft für Sichtbarkeit und R2 `authorizeOwnedContentWrite` auf und ergänzt nur noch Anlegen und Lock-Regel.
- **Abnahmekriterium:** `git grep -n '"owner_only")' src/lib/domain src/lib/map` findet das SQL-Prädikat nur noch in `visibility-sql.ts`. `git grep -n "visibility-sql" src/components` findet nichts. `authorizePinWrite` enthält keine eigene R2-/Sichtbarkeitsprüfung mehr. `npm test`, `npm run test:rechte` und `npm run build` grün.

## CR-008 – Quest-Laden und -Sichtprüfung doppelt; dreifaches Laden auf der Quest-Seite

- **Fundstelle:** `src/lib/domain/quest-chapters.ts` Z. 91–116; `src/lib/domain/quest-notes.ts` Z. 50–70; `src/lib/domain/quests.ts` `getQuest` Z. 366–386; `src/app/w/[worldId]/quests/[questId]/page.tsx` Z. 21–31
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug:** T-006, T-009, T-010
- **Beschreibung:** `loadQuest` und `canSeeQuest` gibt es zweimal nahezu gleich (einmal mit, einmal ohne `worldId` im Select). Beim Aufruf der Quest-Seite lädt und prüft `getQuest` die Quest, `listVisibleChapters` lädt und prüft sie erneut, `getQuestNote` ein drittes Mal: drei identische Abfragen und drei Rechteprüfungen pro Seitenaufruf.
- **Empfehlung:** Ein gemeinsames `loadVisibleQuest(worldId, questId, viewer)` in neuer Datei `src/lib/domain/quest-access.ts` (Ort festgelegt im Plan-Review 2026-09-23; eigene Datei vermeidet einen Import-Zyklus `quests.ts` ↔ `quest-chapters.ts`) nutzen. `listVisibleChapters`/`getQuestNote` bekommen eine interne Variante, die eine bereits geprüfte Quest annimmt.
- **Abnahmekriterium:** `loadQuest`/`canSeeQuest` sind nur noch einmal definiert. Ein Aufruf der Quest-Seite macht genau eine `SELECT … FROM quests`-Abfrage für diese Quest (per Query-Log oder Test prüfbar).

## CR-009 – `visibilitySchema` dreifach und doppeldeutig

- **Fundstelle:** `src/lib/domain/articles.ts` Z. 39, `src/lib/domain/quests.ts` Z. 42, `src/lib/domain/quest-chapters.ts` Z. 24 (alle `z.enum(CONTENT_VISIBILITIES)`); `src/lib/map/repository.ts` Z. 58 (`z.enum(VISIBILITY_STATUSES)`)
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug:** T-003, T-006
- **Beschreibung:** Drei identische Exporte unter demselben Namen, dazu ein vierter mit gleichem Namen, aber zweistufigem Inhalt. Ein falscher Auto-Import (Karten-Schema statt Inhalts-Schema oder umgekehrt) wäre eine stille Rechte-Regression (z. B. `owner_only` für Karten erlaubt oder für Pins verboten).
- **Empfehlung (Ort festgelegt im Plan-Review 2026-09-23):** Neue Datei `src/lib/authz/schemas.ts` mit `contentVisibilitySchema = z.enum(CONTENT_VISIBILITIES)` und `visibilityStatusSchema = z.enum(VISIBILITY_STATUSES)`, exportiert über `src/lib/authz/index.ts`. Die vier lokalen `visibilitySchema`-Exporte entfernen und alle Importe (Domäne, Routen, Tests) umstellen.
- **Abnahmekriterium:** `git grep -n "export const visibilitySchema" src` ergibt keinen Treffer; beide Schemas sind je einmal definiert und benannt nach Stufenzahl.

## CR-010 – UI: Konstanten, Optionen und Labels mehrfach gepflegt

- **Fundstelle:** `src/components/quests/QuestChapters.tsx` Z. 19 (`CHAPTER_TITLE_MAX = 200`, parallel zu `quest-chapters.ts` Z. 21 und dem DB-Check), Z. 140–147 (hartkodierte Stufenlisten, parallel zu `ContentVisibilitySelect`); `src/components/world/display.tsx` Z. 4–6 (`GmBadge` mit eigenen Labels „nur ich“/„nur Spielleitung“ neben `CONTENT_VISIBILITY_LABEL`)
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug:** T-005, T-008
- **Beschreibung:** Die Titelgrenze steht an drei Stellen. Die R2-Optionslogik („nur ich“ nur für den Owner) ist in der Kapitelliste neu geschrieben statt aus `ContentVisibilitySelect` übernommen. Die Labels stehen doppelt. `GmBadge` zeigt jetzt auch „nur ich“ und heißt damit irreführend.
- **Empfehlung (Orte festgelegt im Plan-Review 2026-09-23, ohne Produktwirkung):**
  - `CHAPTER_TITLE_MAX` nach `src/lib/quests/status.ts` (bereits client-tauglich, „no DB“) verschieben; `quest-chapters.ts` und `QuestChapters.tsx` importieren von dort.
  - `CONTENT_VISIBILITY_LABEL` und neue Funktion `contentVisibilityOptions(allowOwner: boolean): ContentVisibility[]` in `src/lib/authz/types.ts` (client-tauglich) legen; `VisibilitySelect.tsx` re-exportiert nicht, sondern importiert von dort.
  - `ContentVisibilitySelect` bekommt eine Prop `compact` (ohne Feld-Label und Hinweis, kleines `select`); die Kapitelliste nutzt diese statt des eigenen `select`.
  - `GmBadge` → `VisibilityBadge` umbenennen (alle Aufrufer), Texte aus `CONTENT_VISIBILITY_LABEL`, CSS-Klassen `badge owner` / `badge gm` bleiben.
- **Abnahmekriterium:** `git grep -n "200" src/components/quests` zeigt keine Titelgrenze mehr. Die Zeichenketten „nur ich“ und „nur Spielleitung“ kommen in `src/components` nicht mehr vor (nur noch in `CONTENT_VISIBILITY_LABEL`; Hinweistexte wie „‚nur ich‘ ist nur für den Owner wählbar“ setzen das Label ein). `git grep -n GmBadge src` findet nichts.

## CR-011 – Kapitel-Position außerhalb der Transaktion

- **Fundstelle:** `src/lib/domain/quest-chapters.ts`, `createChapter` Z. 206–236; `reorderChapters` Z. 366–406
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug:** T-006
- **Beschreibung:** `max(position)` wird vor und außerhalb der Transaktion gelesen. Zwei gleichzeitige Anlagen bekommen dieselbe Position. `reorderChapters` liest die Liste ebenfalls außerhalb der Transaktion: Ein währenddessen angelegtes Kapitel behält seine Position und kollidiert mit den neu vergebenen. Die Anzeige sortiert zwar zusätzlich nach `created_at`, das nächste Umsortieren setzt aber auf einer inkonsistenten Liste auf. Es gibt keinen Unique-Index auf `(quest_id, position)`.
- **Empfehlung:** Beide Vorgänge in einer Transaktion ausführen und die Quest-Zeile sperren (`SELECT … FOR UPDATE` auf `quests`), damit Anlagen und Umsortierungen pro Quest seriell laufen.
- **Abnahmekriterium:** API-Test: 5 parallele `POST …/chapters` auf dieselbe Quest → die Positionen sind paarweise verschieden (0–4).

## CR-012 – Umsortieren schreibt Protokollfelder aller Kapitel

- **Fundstelle:** `src/lib/domain/quest-chapters.ts`, `reorderChapters` Z. 395–406
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-006 (R3)
- **Beschreibung:** Die Schleife setzt `position`, `updated_at` und `updated_by` für **jedes** Kapitel, auch für solche, die der Aufrufer nicht sieht (z. B. `owner_only` von B) und deren Position sich nicht ändert. B findet dann als letzte Änderung seines unsichtbaren Entwurfs den GM. Das widerspricht dem Sinn von R3 („unsichtbare Kapitel bleiben unberührt“). Außerdem gibt es ein UPDATE pro Kapitel.
- **Empfehlung:** Nur Zeilen aktualisieren, deren Position sich tatsächlich ändert (das sind per Konstruktion nur sichtbare). Einzel-UPDATEs pro geänderter Zeile in der Transaktion genügen (festgelegt im Plan-Review 2026-09-23; Kapitelzahlen pro Quest sind klein, ein `UPDATE … FROM (VALUES …)` ist nicht nötig).
- **Abnahmekriterium:** API-Test zu (4a): Nach dem Umsortieren durch A sind `updated_by`/`updated_at` von K2 (`owner_only` von B) unverändert.

## CR-013 – `updateChapter`/`deleteChapter`: doppelte, unklar geordnete Prüflogik

- **Fundstelle:** `src/lib/domain/quest-chapters.ts` Z. 169 (`toPatch` ist `async` ohne `await`), Z. 255–282 und 312–338
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug:** T-006
- **Beschreibung:** Beide Funktionen laden Quest und Kapitel identisch, prüfen `canSeeQuest` von Hand vor `authorizeOwnedContentWrite` (das die Mitgliedschaft erst danach prüft), und prüfen danach redundant `if (!current)`. Das Kapitel wird geladen, bevor feststeht, ob der Aufrufer Mitglied ist. `createChapter`/`reorderChapters` prüfen dagegen zuerst `requireStaff`, die Reihenfolge ist also innerhalb der Datei uneinheitlich.
- **Empfehlung:** Hilfsfunktion `loadWritableChapter(input, nextVisibility?)`: `requireStaff` → Quest laden und prüfen → Kapitel laden → `authorizeOwnedContentWrite`; gibt `{ quest, chapter }` typisiert zurück. `toPatch` synchron machen.
- **Abnahmekriterium:** `updateChapter` und `deleteChapter` rufen eine gemeinsame Lade-/Prüffunktion auf und enthalten keinen eigenen `canSeeQuest`-Aufruf mehr; `toPatch` ist nicht `async`; `quest-chapters.api.test.ts` bleibt grün.

## CR-014 – Notizblock: lange Parameterliste und toter Normalisierungszweig

- **Fundstelle:** `src/lib/domain/quest-notes.ts` `withMentions` Z. 88–105 und Aufrufe Z. 127, 129–140, 209–219; `src/components/quests/QuestNotesSheet.tsx` `normalizeNote` Z. 36–50
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug:** T-009, T-010
- **Beschreibung:** `withMentions` nimmt acht Positionsparameter, darunter drei nullable Strings bzw. Daten hintereinander; die Aufrufe sind kaum lesbar und vertauschungsanfällig. `normalizeNote` behandelt `updatedAt` als möglichen Nicht-String (`as unknown as string`), obwohl `QuestNoteView.updatedAt` als `string | null` typisiert ist und JSON immer Strings liefert.
- **Empfehlung:** `withMentions(viewer, row)` mit einem Objekt aus `loadNoteRow` (bzw. einer leeren Default-Zeile). Die Zeitumwandlung einmal serverseitig (Page/Route) erledigen und `normalizeNote` auf das Nötige reduzieren oder entfernen.
- **Abnahmekriterium:** `withMentions` hat höchstens drei Parameter; `normalizeNote` enthält keinen `as unknown as`-Cast mehr.

## CR-015 – Kapiteländerung baut auch Beteiligungs-Relationen neu

- **Fundstelle:** `src/lib/domain/relations.ts` `recalcQuestRelations` Z. 296–331 (Z. 330); Aufrufe in `quest-chapters.ts` Z. 234, 295, 342
- **Kategorie:** Performance
- **Schweregrad:** niedrig
- **Bezug:** T-006, T-007
- **Beschreibung:** Jede Kapitel-Anlage, -Änderung (auch reiner Titelwechsel) und -Löschung löscht alle `participation`-Relationen der Quest und legt sie neu an, obwohl sich die Beteiligten nicht geändert haben. Das kostet unnötige Schreibzugriffe und überschreibt `created_by`/`updated_by` dieser Relationen mit dem Kapitel-Bearbeiter.
- **Empfehlung:** `recalcQuestMentions(worldId, actorId, questId, tx)` abspalten und aus den Kapitelfunktionen nur diese aufrufen; bei reiner Titeländerung ohne Sichtbarkeits- oder Textänderung ganz überspringen.
- **Abnahmekriterium:** Nach `PATCH …/chapters/[id]` mit neuem Text sind die `participation`-Zeilen der Quest unverändert (gleiche `id`, gleiches `created_by`). Test in `quest-chapters.api.test.ts`.

## CR-016 – Drizzle-Journal und Snapshots unvollständig

- **Fundstelle:** `src/db/migrations/meta/_journal.json` (enthält 0000–0010, 0015–0018; es fehlen 0011–0014), `src/db/migrations/meta/*_snapshot.json` (letzter Snapshot 0010)
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug:** T-003, T-006, T-009
- **Beschreibung:** `scripts/migrate.mjs` liest das Verzeichnis und braucht das Journal nicht, deshalb laufen die Migrationen. T-003 schreibt aber `npm run db:generate` vor. Durch das lückenhafte Journal und fehlende Snapshots erzeugt `drizzle-kit generate` Diffs gegen den Stand 0010 (Enum, `owner_id`, `quest_chapters` usw. erneut). T-009 hat 0015 ins Journal eingetragen, T-003/T-006 nicht – das ist in sich inkonsistent. 0011/0012 fehlten schon vorher.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Handgeschriebene Migrationen, kein Journal.** Verbindlich ist allein `scripts/migrate.mjs` (Dateiname in `schema_migrations`). `_journal.json` und die Snapshots werden auf dem Stand 0010 eingefroren und nicht mehr gepflegt; `npm run db:generate` ist nur noch Entwurfshilfe (der erzeugte Diff wird von Hand gekürzt und die Datei danach wieder entfernt, das Journal bleibt unverändert). Im Repo nutzt sonst nichts das Journal (geprüft per `grep` am 2026-09-23).
- **Empfehlung:** Die Einträge 0015–0018 aus `src/db/migrations/meta/_journal.json` entfernen (Journal endet dann bei 0010, passend zum letzten Snapshot). In `.ai/conventions.md` (Abschnitt Code-Struktur/Migrationen oder neuer Abschnitt *Migrationen*) die Norm festhalten: Migrationen handgeschrieben als `NNNN_beschreibung.sql`, fortlaufend nummeriert, Bestandsdaten erhalten, Journal/Snapshots eingefroren, `db:generate` nur als Entwurfshilfe. Die Formulierung „Migration mit `npm run db:generate` erzeugen“ in künftigen Plänen durch Verweis auf diese Norm ersetzen (bestehende Pläne bleiben unverändert).
- **Abnahmekriterium:** (1) `_journal.json` enthält genau die Einträge 0000–0010. (2) `.ai/conventions.md` enthält die Migrations-Norm mit Datum 2026-09-23 und Verweis auf CR-016. (3) `npm run db:migrate` läuft auf einer frischen DB und auf der lokalen Bestands-DB weiter durch.

## CR-017 – Testlücken

- **Fundstelle:** `src/app/api/worlds/[worldId]/articles/owner-visibility.api.test.ts`, `src/app/api/worlds/[worldId]/owner-coverage.api.test.ts`; keine Tests für `src/components/quests/QuestNotesSheet.tsx` und `src/components/map/use-map-state.ts#applyEvent`
- **Kategorie:** Testabdeckung
- **Schweregrad:** niedrig
- **Bezug:** T-004, T-010, T-011
- **Beschreibung:** T-004 (2) nennt „Verknüpft“ ausdrücklich; es gibt keinen Test, dass eine Relation zu einem `owner_only`-Datensatz für GM/Master B nicht in `GET /relations` erscheint. Hub- und `@`-Suche sind nur für den Artikel geprüft, nicht für Quest und Pin. T-004 (7) verlangt „nach Hochstufung sieht **und bearbeitet** A ihn wieder“; getestet ist nur das Sehen. Für CR-002 und CR-004 gibt es keinen Test. Die Client-Logik für Konflikt (CR-001) und Refetch (CR-003) ist ungetestet; sie steckt in Komponente bzw. Hook, reine Funktionen dafür fehlen.
- **Empfehlung:** API-Tests ergänzen (Verknüpft, Quest/Pin in Suche, PATCH nach Hochstufung, manuelle Relation, Suche mit Limit). Die Zustandsübergänge von Notiz und Karten-Refetch als reine Funktionen herausziehen und mit Vitest prüfen. Orte (festgelegt im Plan-Review 2026-09-23): `src/components/quests/quest-note-state.ts` (+ `.test.ts`) und `src/components/map/map-refetch.ts` (+ `.test.ts`), analog zu `confirm-dialog.ts` aus Plan 007.
- **Abnahmekriterium:** `npm run test:rechte` enthält Tests mit den Namen bzw. Inhalten: „owner_only not in linked for non-owner“, „owner_only quest/pin not in hub/mention search“, „R1 promotion restores edit“, „manual relation to invisible target is 404“. `npm test` enthält Unit-Tests für die Konflikt- und die Refetch-Logik.

---

## Smoketest Review 004

Blockierend für den Abschluss dieses Reviews (CR-005). Durchführung erst nach CR-001 und CR-003. Lokale Testwelt, `ENABLE_TEST_LOGIN=true`, zwei **getrennte** Browser-Kontexte (eigene Cookies), Viewport 390 px und Desktop.

| ID | Vorbedingung | Schritte | Erwartet | Ergebnis |
|----|--------------|----------|----------|----------|
| SR4.1 | Kontext 1: Game Master; Kontext 2: Player. Veröffentlichte Karte in veröffentlichtem Universum, beide haben sie offen. GM legt einen `gm_only`-Pin an. | GM verschiebt den Pin per Drag. | Player-Karte zeigt den Pin zu keinem Zeitpunkt (auch nicht kurz), ohne Seiten-Neuladen, keine Fehlermeldung. | bestanden 2026-09-23 |
| SR4.2 | Kontext 1: Game Master; Kontext 2: Master. Gleiche Karte wie SR4.1. | GM verschiebt den `gm_only`-Pin erneut, danach setzt er ihn auf `veröffentlicht` und wieder zurück auf `nur Spielleitung`. | Master sieht jede neue Position ohne Seiten-Neuladen. Player (SR4.1-Kontext) sieht den Pin nur, solange er `veröffentlicht` ist, danach verschwindet er ohne Neuladen. | bestanden 2026-09-23 (Retest nach `forgetDeleted`) |
| SR4.3 | Kontext 1: Player; Kontext 2: Master. Veröffentlichte Quest, beide öffnen den Notizblock und klicken „Bearbeiten“. | Player tippt Text und speichert. Danach tippt der Master eigenen Text und speichert. | Master sieht „Die Notiz wurde inzwischen geändert“, sein Text steht noch im Editor, „Speichern“ ist deaktiviert (CR-001). | bestanden 2026-09-23 |
| SR4.4 | Fortsetzung von SR4.3. | Master klickt „Neu laden“, ändert den Text und speichert. | Nach „Neu laden“ steht der Stand des Players mit dessen Name/Zeitpunkt im Sheet; das Speichern danach gelingt, Player sieht nach Neuladen den Text des Masters. | bestanden 2026-09-23 |

---

## Prioritäten

1. **CR-001** – Datenverlust im Notizblock, der Kern von E5 ist in der UI umgangen.
2. **CR-002** – Schreibzugriff auf unsichtbare `owner_only`-Inhalte über die Relations-API.
3. **CR-003** – Karten verlieren bei Fehlern oder Races sichtbare Pins/Marker bzw. zeigen gelöschte.
4. **CR-004** (zusammen mit **CR-007**) – Suchergebnisse für die Spielleitung unvollständig; das zentrale Prädikat verhindert die Wiederholung.
5. **CR-005** – Browser-Abnahmen mit zwei Sitzungen nach 1–3 nachholen.
6. **CR-017** – Tests für 1–4 als Regressionsschutz.
7. **CR-011**, **CR-012**, **CR-015** – Kapitel-Konsistenz und unnötige Schreibvorgänge.
8. **CR-006**, **CR-008** – Performance und Doppelladen.
9. **CR-009**, **CR-010**, **CR-013**, **CR-014**, **CR-016** – Aufräumen und Wartbarkeit.

---

## Review-Check 2026-09-23

**Geprüfter Stand:** Commit `51c4fbb` (HEAD) **plus uncommittete Änderungen im Working Tree** (39 geänderte Dateien, neue Dateien u. a. `quest-access.ts`, `visibility-sql.ts`, `authz/schemas.ts`, `map-refetch.ts`, `quest-note-state.ts`, `review-004.api.test.ts`). Die Umsetzung aller Findings dieses Reviews ist **noch nicht committet**. Die Commits zwischen Baseline `ca2eccc` und HEAD gehören ausschließlich zu Review 008.

**Statusänderungen:** keine. Alle 17 Findings standen auf `erledigt` (entspricht `behoben`) und sind am aktuellen Code bestätigt. 0 Regressionen, 0 `drift`, 0 wieder `offen`.

| ID | Bestätigt durch |
|----|-----------------|
| CR-001 | `interpretNoteSave` liefert bei 409 nur `conflict` ohne Versionsübernahme; `noteSaveDisabled(pending, conflict)` sperrt „Speichern“; Hinweis „Kopiere deinen Text …“ vorhanden. |
| CR-002 | `createManualRelation`/`deleteManualRelation` prüfen beide Enden über `loadVisibleTargets`, sonst 404. |
| CR-003 | `resolveRefetchResponse`: Entfernen nur bei 404, Status 0 → Warten auf `onResync`, sonst ein entprelltes `reload()`; Sequenz pro ID und Lösch-Merkliste in `use-map-state.ts`. |
| CR-004 | `search.ts` filtert per `visibleContentWhere` im SQL (Artikel, Quests, Kapitel für Quest **und** Kapitel, Pins); Kapitel per `selectDistinctOn([quests.id])` nach `position`; JS-Filter bleibt. |
| CR-005 | Tabelle *Smoketest Review 004*: SR4.1–SR4.4 „bestanden 2026-09-23“ (Eintrag geprüft, Durchführung selbst nicht nachvollziehbar). |
| CR-006 | `shouldFetchPinForMap` vor dem Pin-Fetch; `map.marker` unverändert. |
| CR-007 | SQL-Prädikat nur noch in `src/lib/domain/visibility-sql.ts`; kein Import in `src/components`; `canSeeVisibility({…})` nur noch in `canSeeContent`; `authorizePinWrite` delegiert an `authorizeOwnedContentWrite`. |
| CR-008 | `loadVisibleQuest`/`canSeeQuest` nur in `quest-access.ts`; Quest-Seite lädt einmal per `getQuest` und reicht die Quest an `getQuestNote` weiter. |
| CR-009 | Kein `export const visibilitySchema` mehr (auch der fünfte, nicht im Finding genannte Export in `universes.ts` entfernt); `contentVisibilitySchema`/`visibilityStatusSchema` in `authz/schemas.ts`. |
| CR-010 | `CHAPTER_TITLE_MAX` in `lib/quests/status.ts`; `ContentVisibilitySelect compact`; `VisibilityBadge`; Labels aus `CONTENT_VISIBILITY_LABEL`. Rest: „nur ich“ nur noch in zwei Code-Kommentaren (`ArticleForm.tsx`, bereits vor Baseline, und `VisibilitySelect.tsx`), `maxLength={200}` in `QuestForm.tsx` ist die Quest-, nicht die Kapitel-Titelgrenze. |
| CR-011 | `createChapter` und `reorderChapters` in Transaktion mit `SELECT … FOR UPDATE` auf die Quest-Zeile. |
| CR-012 | `reorderChapters` aktualisiert nur Zeilen mit geänderter Position. |
| CR-013 | `loadWritableChapter` (requireStaff → Quest → Kapitel → `authorizeOwnedContentWrite`) für Update/Delete; `toPatch` synchron. |
| CR-014 | `withMentions(worldId, viewer, row)`; Serialisierung per `serializeQuestNoteClient` in Page/Route; kein `as unknown as` mehr im Sheet. |
| CR-015 | Kapitelfunktionen rufen `recalcQuestMentions`; `updateChapter` überspringt bei reinem Titelwechsel (`needsMentionRecalc`). |
| CR-016 | `_journal.json` endet bei 0010 (11 Einträge); Abschnitt *Migrationen* in `.ai/conventions.md` mit Verweis auf CR-016. |
| CR-017 | Tests mit den geforderten Namen in `review-004.api.test.ts`, CR-011/012/015-Tests in `quest-chapters.api.test.ts`; Unit-Tests `map-refetch.test.ts` (17) und `quest-note-state.test.ts` (7) laufen grün (`vitest`, zusammen mit `authz.test.ts` 54/54). `npm run test:rechte` (DB) im Check nicht ausgeführt. |

**Nicht abgedeckte Änderungen:**
- `src/lib/client/api-fetch.ts` (Commit `ba33d16`, Review 008 CR-003): Fehlerergebnis trägt jetzt `status` (0 bei Netzwerkfehler). CR-003 dieses Reviews baut darauf auf; die Änderung stammt aber aus Review 008 und ist hier nicht bewertet.
- Sonst sind alle Änderungen in den 004-Dateien einem Finding zuzuordnen (Folgeänderungen durch CR-009/CR-010 in Universum-/Karten-Routen, `ArticleList`, `MapSheets`, `MapView`, `UniverseForm`; `MapView` ruft beim Reconnect `onResync` statt `reload` für CR-003; `.ai/features.md` für CR-001).

**Empfehlung:** Ein erneuter `/code-review` ist nicht nötig. Offen ist nur der Commit der Umsetzung. Vor dem Commit einmal `npm test`, `npm run test:rechte` und `npm run build` vollständig laufen lassen, wie in CR-007 gefordert.
