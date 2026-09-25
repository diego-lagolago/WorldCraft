# Code Review – 010 Status für Quest-Kapitel (2026-09-24)

**Baseline:** Commit `b6a9429a793a42b7a47f4229e5122467bbbaa833` (Merge `codex/010-kapitel-status`). Umfang von Plan 010: `99f6f2a..b6a9429`. Im Working Tree sind zum Zeitpunkt des Reviews nur Änderungen ohne Bezug zu Plan 010 uncommittet (`.ai/backlog.md`, `.ai/code-review-009-…`, `.claude/`).
**Geprüfte Task-Datei:** `.ai/feature-tasks/010-kapitel-status.md` (T-001 bis T-005, alle `[x]`)

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Duplizierung & Modularisierung | mittel | behoben | Markup für das Quest-Status-Badge steht jetzt an drei Stellen |
| CR-002 | Toter Code / Duplizierung | niedrig | behoben | Der `compact`-Zweig von `ContentVisibilitySelect` wird nirgends mehr genutzt; sein Inline-Style ist in `QuestStatusSelect` kopiert |
| CR-003 | Testabdeckung | niedrig | behoben | Die Tests prüfen `updated_*` beim Status-PATCH nicht und auch nicht, dass `status` beim Anlegen ignoriert wird; ein einziger großer Testfall deckt fünf Kriterien ab |
| CR-004 | Lesbarkeit & Wartbarkeit (UX) | niedrig | behoben | Die Status-Auswahl springt bis zum Ende von `router.refresh()` auf den alten Wert zurück |
| CR-005 | Aufgaben-Abgleich | niedrig | verworfen | Fehlinterpretation: „Badge zeigt den neuen Wert“ in T-003 (3) meint das Status-Badge, nicht das Sichtbarkeits-Badge (Projektinhaber, 2026-09-25) |

---

## CR-001

- **Fundstelle:** `src/components/quests/QuestChapters.tsx:173`, `src/components/quests/QuestList.tsx:7-9` (`StatusBadge`), `src/app/w/[worldId]/quests/[questId]/page.tsx:56`
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** mittel
- **Bezug (Task-ID):** T-003
- **Status:** behoben — `QuestStatusBadge` zentralisiert das Markup und wird in Quest-Liste, Detailseite und Kapitelzeile verwendet.
- **Beschreibung:** Das Badge `<span className={`badge st-${status}`}>{QUEST_STATUS_LABEL[status]}</span>` wird mit Plan 010 zum dritten Mal geschrieben. In `QuestList.tsx` gibt es dafür schon eine lokale Komponente `StatusBadge`, die aber nicht exportiert ist. Eine Änderung am Aussehen (etwa ein Icon oder ein `title`-Attribut) müsste an drei Stellen nachgezogen werden. Genau diese Gleichheit mit dem Quest-Status verlangt A2.
- **Empfehlung:** Eine `QuestStatusBadge({ status })` als eigene Datei `src/components/quests/QuestStatusBadge.tsx` anlegen, neben `QuestStatusSelect`. `StatusBadge` in `QuestList.tsx` durch sie ersetzen und sie auch in `QuestChapters.tsx` und auf der Quest-Detailseite verwenden. Die Datei bekommt **kein** `"use client"`. Die Komponente ist rein darstellend und muss sowohl in der Server-Komponente `page.tsx` als auch in der Client-Komponente `QuestChapters.tsx` funktionieren.
- **Abnahmekriterium:** Das Muster `` `badge st-${`` kommt in `src/` nur noch einmal vor, in `QuestStatusBadge.tsx`. Quest-Liste, Quest-Detail und die Player-Kapitelzeile nutzen die Komponente. `npm run lint` ist grün.

## CR-002

- **Fundstelle:** `src/components/world/VisibilitySelect.tsx:14,23,31-48` (`compact`-Prop und -Zweig); `src/components/quests/QuestStatusSelect.tsx:20`
- **Kategorie:** Toter Code / Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-003
- **Status:** behoben — Prop, Dokumentation und `compact`-Zweig wurden aus `ContentVisibilitySelect` entfernt.
- **Beschreibung:** Die Kapitelzeile war der einzige Aufrufer von `ContentVisibilitySelect compact`. Seit T-003 ruft niemand mehr `compact` auf (`grep compact src/**/*.tsx` findet nur die Definition). Der Zweig ist damit toter Code. Seinen Inline-Style `{ width: "auto", padding: "6px 8px", fontSize: 12 }` gibt es jetzt zusätzlich als Kopie in `QuestStatusSelect`. Im Plan-Review wurde entschieden, `ContentVisibilitySelect` in T-003 „unverändert“ zu lassen. Dabei ging es darum, die Komponente nicht umzubauen. Dass sie danach einen ungenutzten Zweig mitträgt, war damit nicht gemeint.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-25):** Entfernen. `compact` wird nicht für spätere Inline-Felder vorgehalten.
- **Empfehlung:** In `ContentVisibilitySelect` die Prop `compact` samt Doc-Kommentar („Kein Feld-Label/Hint, kleines Select (z. B. Kapitel-Zeile)“) und den `if (compact) { … }`-Zweig löschen. `QuestStatusSelect` bleibt unverändert und behält seinen Inline-Style; dieser ist danach die einzige Definition. Keine CSS-Klasse einführen.
- **Abnahmekriterium:** `ContentVisibilitySelect` hat keine `compact`-Prop mehr, und `grep -rn "compact" src/components/world/VisibilitySelect.tsx` findet nichts. Das Style-Objekt `{ width: "auto", padding: "6px 8px", fontSize: 12 }` kommt in `src/` nur noch in `QuestStatusSelect.tsx` vor. Die Sichtbarkeits-Auswahl im Kapitel-Bearbeitendialog und im Quest-Formular sieht aus und funktioniert wie vorher. `npm run lint` ist grün.

## CR-003

- **Fundstelle:** `src/app/api/worlds/[worldId]/quests/[questId]/chapters/quest-chapters.api.test.ts`, `describe("T-002 (010): chapter status")`
- **Kategorie:** Testabdeckung
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-002
- **Status:** behoben — getrennte API-Tests sichern Default, POST-Whitelist, Audit-Felder, Validierung, Rechte und unveränderte Relationen ab.
- **Beschreibung:** Zwei Punkte aus der Aufgabe sind nicht durch Tests abgesichert:
  - T-002 verlangt, dass ein reiner Status-PATCH `updated_*` ändert. Der Test prüft `updated_at` und `updated_by` nicht.
  - Nach A1/A4 setzt das Anlegen `status` nicht. Heute verwirft Zod ein mitgeschicktes `status` stillschweigend (`chapterCreateSchema` ohne `status`), aber kein Test sichert das ab. Nimmt jemand später `...chapterFields` in das Create-Schema auf, fällt das nicht auf.

  Außerdem prüft ein einziges `it` fünf unabhängige Abnahmekriterien. Schlägt ein früher Schritt fehl, werden die späteren gar nicht mehr ausgeführt, und die Fehlermeldung sagt nicht, welches Kriterium betroffen ist.
- **Empfehlung:**
  - Den Testfall in einzelne `it`s aufteilen: Default `open`, Staff-PATCH 200, ungültiger Wert 400, Player 403, Relationen unverändert.
  - Prüfen, dass nach dem Status-PATCH `updated_by` gleich dem Master-Benutzer ist und `updated_at` größer als vorher (per `sql` auf `quest_chapters`).
  - Einen Fall `POST { title, status: "completed" }` ergänzen, der `status === "open"` erwartet.
- **Abnahmekriterium:** `npm run test:rechte` ist grün und enthält je einen eigenen Testfall für: Default `open`, `status` beim POST wird ignoriert, Staff-PATCH 200 mit geändertem `updated_at` und `updated_by`, 400 bei `status: "done"`, 403 für den Player, Relationen unverändert.

## CR-004

- **Fundstelle:** `src/components/quests/QuestChapters.tsx:70-76` (`onStatusChange`) und `:129-134` (`QuestStatusSelect value={chapter.status}`)
- **Kategorie:** Lesbarkeit & Wartbarkeit (UX)
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-003
- **Status:** behoben — ein lokaler Override zeigt die Auswahl direkt; ein Effect räumt ihn nach Bestätigung durch Server-Props bzw. beim Fehler ab.
- **Beschreibung:** Das Select ist vollständig kontrolliert über `chapter.status` aus den Server-Props. Nach der Auswahl rendert React sofort wieder den alten Wert. Der neue Wert erscheint erst, wenn PATCH und `router.refresh()` durch sind. Weil `setPending(false)` schon vor dem Refresh läuft, gibt es außerdem einen Moment, in dem das Feld wieder aktiv ist, aber noch den alten Status zeigt. Bei langsamer Verbindung sieht das so aus, als sei die Änderung verloren gegangen. Das Muster stammt aus dem früheren `onVisibilityChange`. Beim Status, der jetzt der Hauptzweck des Inline-Felds ist, fällt es aber stärker auf. Die Prüfung `if (status === chapter.status) return;` greift bei einem `<select>`-`onChange` praktisch nie.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-25):** Lokaler Anzeigewert mit `useState`, kein `useOptimistic`. `run`/`pending` bleiben unverändert.
- **Empfehlung:** In `QuestChapters` einen State `statusOverride: Record<string, QuestStatus>` ergänzen. Angezeigt wird `statusOverride[chapter.id] ?? chapter.status`. In `onStatusChange` zuerst mit dem angezeigten Wert vergleichen und bei Gleichheit abbrechen, dann den Override setzen und danach das PATCH senden. Bei einem Fehler den Eintrag entfernen (die Fehlermeldung zeigt `run` wie heute über `error`). Bei Erfolg bleibt der Eintrag stehen, bis die Server-Props ihn bestätigen: Dafür entfernt ein `useEffect` mit Abhängigkeit `chapters` alle Einträge, bei denen `chapter.status === statusOverride[chapter.id]` gilt oder das Kapitel nicht mehr existiert. Andere Kapitel-Aktionen und der Umgang mit `pending` bleiben unverändert.
- **Abnahmekriterium:** (1) Bei gedrosseltem Netz (DevTools „Slow 3G“) zeigt die Status-Auswahl direkt nach der Auswahl den neuen Wert und springt nicht zwischendurch auf den alten zurück. Nach dem Neuladen steht weiter der neue Wert. (2) Schlägt das PATCH fehl (DevTools „Offline“ vor der Auswahl), zeigt die Auswahl wieder den alten Wert, und die Fehlermeldung erscheint. (3) `npm run lint` ist grün.

## CR-005

- **Fundstelle:** `.ai/feature-tasks/010-kapitel-status.md` T-003 Abnahmekriterium (3) bzw. T-005 S10.2; `.ai/infrastructure/smoketest.md` S10.2; `src/components/world/display.tsx` (`VisibilityBadge` zeigt bei `published` nichts)
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug (Task-ID):** T-003, T-005
- **Beschreibung:** Laut Abnahme sollen „das Badge zeigt den neuen Wert“ und „Das Badge wechselt“ gelten. Tatsächlich blendet `VisibilityBadge` bei `veröffentlicht` das Badge aus. S10.2 wurde trotzdem als bestanden dokumentiert, mit der Begründung „verschwindet wie bei anderen veröffentlichten Inhalten“. Das Verhalten ist projektweit konsistent, weicht aber vom Wortlaut der Abnahme ab. Eine spätere `/review-check`- oder Prod-Smoke-Prüfung könnte darüber stolpern.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-25): Verworfen. Das Finding beruht auf einer Fehlinterpretation und ist kein ToDo.** Mit „das Badge zeigt den neuen Wert“ bzw. „Das Badge wechselt“ ist das **Status**-Badge gemeint, nicht das Sichtbarkeits-Badge. Dass `VisibilityBadge` bei `veröffentlicht` ausgeblendet wird, ist gewolltes, projektweit einheitliches Verhalten und widerspricht der Abnahme nicht.
- **Hinweis für künftige Agents:** Dieses Finding nicht umsetzen und nicht neu aufmachen. Weder den Wortlaut von T-003 (3) oder S10.2 in `010-kapitel-status.md` ändern noch `VisibilityBadge` oder `QuestChapters.tsx` wegen dieses Punkts anfassen. `/review-check` bewertet CR-005 als `verworfen`, unabhängig vom Code-Stand.
- **Empfehlung:** Keine.
- **Abnahmekriterium:** Entfällt, da verworfen.

---

## Ohne Befund geprüft

- **Sicherheit / Rechte:** Der Status-PATCH läuft über `loadWritableChapter` → `requireStaff` + `authorizeOwnedContentWrite`, genauso wie Titel und Sichtbarkeit (A3). Der Wert wird über `z.enum(QUEST_STATUSES)` validiert, und das DB-Enum sichert zusätzlich ab.
- **A5:** `needsMentionRecalc` ist unverändert. Ein reiner Status-PATCH löst `recalcQuestMentions` nicht aus, und der Test prüft das.
- **Migration:** `0023_quest_chapter_status.sql` ist von Hand geschrieben und additiv, der Default füllt bestehende Zeilen, und das Drizzle-Journal ist unverändert. Das entspricht der Konvention.
- **Datenfluss:** `status` steht in `ChapterSummary`, `loadChapters` und `createChapter.returning`. `getQuest` reicht die Kapitel samt Status an die Seite weiter. `reorderChapters` braucht keinen Status.
- **Normen / MCP-Abgleich (T-001, T-004):** Beide Datenmodell-Dokumente, `features.md`, `architecture.md` (P10-1 bis P10-3 plus offene Frage) und die Roadmap sind vollständig nachgezogen.

## Prioritäten

1. **CR-001**: Status-Badge zentralisieren. Der Aufwand ist klein, und es verhindert, dass die drei Darstellungen auseinanderlaufen.
2. **CR-003**: Die Tests für `updated_*` und das Ignorieren von `status` beim Anlegen nachziehen, bevor Plan 002 auf Kapitel aufsetzt.
3. **CR-002**: Den toten `compact`-Zweig aus `ContentVisibilitySelect` entfernen (entschieden 2026-09-25).
4. **CR-004**: Lokaler Anzeigewert für die Status-Auswahl (entschieden 2026-09-25).

CR-005 ist verworfen und wird nicht bearbeitet.
