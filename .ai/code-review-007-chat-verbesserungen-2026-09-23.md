# Code Review – 007 Chat-Verbesserungen (2026-09-23)

**Baseline:** Commit `02203fd` („007: Chat-UX – Ausrichtung, Avatare, Bearbeiten, Lösch-Bestätigung, Threads.“). Außerhalb des Commits liegen im Working Tree die unversionierten Dateien `src/components/chat/DiceSheet.tsx` und `src/lib/chat/dice-draft.ts` (siehe CR-013) sowie Änderungen an `.ai/code-review-003-…` (nicht Gegenstand dieses Reviews).
**Nachtrag Baseline (Plan-Review 2026-09-23):** Nach dem Review kam Commit `12553e6` (Plan 008, T-003: Würfel-Sheet) hinzu. Er committet `DiceSheet.tsx`/`dice-draft.ts` und entfernt die alte `DiceSheet` aus `ComposerBar.tsx`; dadurch verschieben sich Zeilen in `ComposerBar.tsx` (CR-015). Die Findings beziehen sich weiter auf `02203fd`; der 008-Code ist nicht Gegenstand dieses Reviews.
**Geprüfte Task-Datei:** `.ai/feature-tasks/007-chat-verbesserungen.md` (alle Aufgaben T-001–T-009 als erledigt markiert).

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Runtime-Risiken | kritisch | behoben | Migration 0018 setzt `body = NULL`, bevor `NOT NULL` entfernt ist – schlägt auf jeder DB mit bestehenden Threads fehl |
| CR-002 | Runtime-Risiken | mittel | behoben | Bearbeitete Nachricht per SSE wird bei Clients ohne diese Nachricht angehängt und erhöht `replyCount` |
| CR-003 | Runtime-Risiken | mittel | behoben | `ChannelList` liest `localStorage` im `useState`-Initialisierer → Hydration-Mismatch |
| CR-004 | Sicherheit | mittel | behoben | Lösch-Dialog: Enter löscht, sobald der Fokus nicht auf „Abbrechen“ liegt; kein Fokus-Trap |
| CR-005 | Fehlerbehandlung & Validierung | mittel | behoben | PATCH Nachricht: jeder Validierungsfehler (auch 2001 Zeichen) meldet „Zum Entfernen löschen.“; Validierung doppelt |
| CR-006 | Aufgaben-Abgleich | mittel | behoben | Alias `/r` für Würfelbefehle ändert das Sendeverhalten (Scope Creep), ohne Tests und Doku |
| CR-007 | Testabdeckung | mittel | behoben | Keine Tests für `withMessage`/`withThread`, `messageCopyText`, `CHK-OPENER-BODY`-Inserts |
| CR-008 | Aufgaben-Abgleich | mittel | offen (Teil 1 erledigt) | T-007 als erledigt markiert, Smoketest-Punkte C7.1–C7.8 stehen auf „offen“ — T-007 zurückgesetzt; Smoketest C7.* Owner ausstehend |
| CR-009 | Fehlerbehandlung & Validierung | niedrig | behoben | Bearbeiten/Umbenennen im archivierten Kanal: erlaubt, Norm fehlt |
| CR-010 | Bad Practices | niedrig | behoben | `authorizeEditChatMessage` meldet 422 vor 403 – Nicht-Autor bekommt bei Würfelwurf 422 |
| CR-011 | Duplizierung & Modularisierung | niedrig | behoben | `renameChatThread`: redundantes `actorId`, eigene Reply-Count-Abfrage, abweichender Statuscode zu `createThreadWithOpening` |
| CR-012 | Duplizierung & Modularisierung | niedrig | behoben | `messageCopyText`/`messagePreviewText` doppelt und als reine Funktionen in einer Komponentendatei |
| CR-013 | Toter Code | niedrig | verworfen | Unversionierte, ungenutzte `DiceSheet.tsx` / `dice-draft.ts` duplizieren `DiceSheet` aus `ComposerBar.tsx` |
| CR-014 | Bad Practices | niedrig | behoben | `ConfirmDialog` ist „wiederverwendbar“, enthält aber fest den Lösch-/Shift-Hinweis |
| CR-015 | Bad Practices | niedrig | behoben | `RenameThreadSheet` in `ComposerBar.tsx`, `maxLength={80}` statt `THREAD_TITLE_MAX` |
| CR-016 | Bad Practices | niedrig | behoben | Seiteneffekt (`writeExpanded`) im `setState`-Updater; Aufklapp-Speicher wächst unbegrenzt |
| CR-017 | Sicherheit | niedrig | behoben | Backfill 0016 prüft Host per `LIKE '%cdn.discordapp.com%'`, nicht wie `staticDiscordAvatar` exakt |
| CR-018 | Aufgaben-Abgleich | niedrig | behoben | `datenmodell-fachlich.md` nennt `edited_at`, `APP-CHAT-EDIT`, `APP-THREAD-RENAME`, `CHK-OPENER-BODY` nicht (Abnahme T-001) |
| CR-019 | Bad Practices | niedrig | behoben | `createThreadWithOpening` schreibt den Titel weiterhin in `body` und leert ihn danach |
| CR-020 | Lesbarkeit & Wartbarkeit | niedrig | behoben | Thread-⋯-Knopf 40 × 40 px, unter 44-px-Touch-Ziel |

---

## Findings im Detail

### CR-001 – Migration 0018 scheitert an bestehenden Eröffnungsnachrichten
- **Fundstelle:** `src/db/migrations/0018_chat_opener_body.sql`, Zeilen 2–6
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** kritisch
- **Bezug:** T-008
- **Beschreibung:** Die Migration führt zuerst `UPDATE chat_messages SET body = NULL WHERE opens_thread_id IS NOT NULL` aus und entfernt erst danach `NOT NULL` von `body`. Solange die Spalte `NOT NULL` ist, bricht Postgres das UPDATE mit „null value in column "body" violates not-null constraint“ ab – sobald mindestens eine Eröffnungsnachricht existiert (Staging/Produktion, lokale Dev-DB mit Threads). Die API-Tests laufen auf einer leeren DB und fallen daher nicht auf. Der Plan verlangte „vor dem Constraint“, gemeint war der neue `CHECK`, nicht `NOT NULL`.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **0018 direkt korrigieren, keine Folgemigration.** `scripts/migrate.mjs` verfolgt Migrationen nur per Dateiname in `schema_migrations` (keine Prüfsumme). Wo 0018 bereits als angewendet eingetragen ist, lief sie auf einer DB ohne Eröffnungsnachrichten (mit Daten wäre sie abgebrochen und nicht eingetragen worden) – der Endzustand ist dort schon richtig.
- **Empfehlung:** Reihenfolge in `0018_chat_opener_body.sql`: `ALTER COLUMN body DROP NOT NULL` → `DROP CONSTRAINT IF EXISTS chat_messages_body_length` → `UPDATE … SET body = NULL WHERE opens_thread_id IS NOT NULL` → `ADD CONSTRAINT chk_opener_body`.
- **Abnahmekriterium:** Auf einer DB mit Stand 0017 und mindestens einer Eröffnungsnachricht (`body` = Titel) läuft `npm run db:migrate` (bzw. der Projekt-Migrationsbefehl) fehlerfrei durch; danach liefert `SELECT count(*) FROM chat_messages WHERE opens_thread_id IS NOT NULL AND body IS NOT NULL` 0.
- **Umsetzung (2026-09-23):** Reihenfolge in `0018_chat_opener_body.sql` wie empfohlen umgestellt. Geprüft auf einer Wegwerf-DB (Stand 0017, eine Eröffnungsnachricht mit `body` = Titel, eine normale Nachricht): `scripts/migrate.mjs` wendet 0018 fehlerfrei an, die Zählabfrage liefert 0, die normale Nachricht behält ihren Text.

### CR-002 – Bearbeitungs-Ereignis wird bei anderen Clients als neue Nachricht / neue Antwort gewertet
- **Fundstelle:** `src/components/chat/use-chat-stream.ts`, `withMessage` (Zeile 17 ff.); Auslöser `editChatMessage` in `src/lib/chat/repository.ts` (publiziert `chat.message`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-004, T-008
- **Beschreibung:** `known` prüft nur `state.messages`. Das sind (a) nur die geladenen Nachrichten und (b) nur die des aktuell offenen Stroms. Folgen:
  1. Wer den Hauptstrom offen hat, während jemand eine Antwort **in einem Thread** bearbeitet: `known = false`, `threadId` gesetzt → `replyCount` des Threads steigt bei jeder Bearbeitung um 1 (falsche Zahl auf der Thread-Karte bis zum Neuladen).
  2. Wird eine **ältere Nachricht** bearbeitet, die ein anderer Client wegen Paginierung nicht geladen hat, landet sie bei diesem am Ende der Liste wie eine neue Nachricht (widerspricht der Abnahme von T-004 „an derselben Stelle, nicht als neue Nachricht“).
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Eigenes SSE-Ereignis `chat.message.edited`.**
- **Empfehlung:** (1) `src/lib/realtime/events.ts`: Variante `{ type: "chat.message.edited"; worldId: string; message: ChatMessageDto }` in den Typ `WorldRealtimeEvent` und in die Liste der weitergeleiteten Ereignistypen aufnehmen. (2) `editChatMessage` in `src/lib/chat/repository.ts` publiziert `chat.message.edited` statt `chat.message`. (3) Neue reine Funktion `withEditedMessage(state, message)` (zusammen mit `withMessage`/`withThread`, siehe CR-007): ersetzt die Nachricht nur, wenn ihre ID in `state.messages` steht; sonst wird `state` unverändert zurückgegeben (kein Anhängen, keine `replyCount`-Änderung). (4) `applyEvent` und `editMessage` in `use-chat-stream.ts` nutzen `withEditedMessage`. (5) Den `known`-Zweig in `withMessage` wieder auf „bekannt → nichts tun“ zurückbauen.
- **Abnahmekriterium:** `editChatMessage` publiziert ausschließlich `chat.message.edited`; Unit-Tests: `withEditedMessage` mit unbekannter ID liefert denselben State (Nachrichten und alle `replyCount` unverändert), mit bekannter ID wird die Nachricht an derselben Position ersetzt; manuell: Thread-Antwort bearbeiten, während ein zweiter Browser den Hauptstrom offen hat → Antwortzahl auf der Thread-Karte bleibt gleich.
- **Umsetzung (2026-09-23):** Eigenes Ereignis `chat.message.edited`; `withEditedMessage` / `withMessage` / `withThread` in `src/lib/chat/stream-state.ts`; `withMessage` ignoriert bekannte IDs wieder.

### CR-003 – Hydration-Mismatch durch `localStorage` im `useState`-Initialisierer
- **Fundstelle:** `src/components/chat/ChannelList.tsx`, Zeile 38 (`useState(() => readExpanded())`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** mittel
- **Bezug:** T-009
- **Beschreibung:** `ChatView`/`ChannelList` werden serverseitig gerendert (`src/app/w/[worldId]/chat/page.tsx`). Auf dem Server liefert `readExpanded()` `{}`, im Browser den gespeicherten Zustand. Weicht er ab, rendert der Client anderes Markup (`aria-expanded`, Klasse `chev open`, Thread-Zeilen) → React-Hydration-Fehler; nicht passende Attribute werden dabei nicht zuverlässig nachgezogen. Das vorhandene Muster (`HomeRedirect.tsx` mit `last-context.ts`) liest den Speicher im `useEffect`.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **`useEffect`-Muster wie in `HomeRedirect.tsx`** (zusammen mit CR-016).
- **Empfehlung:** `useState<Record<string, boolean>>({})`; in einem `useEffect(() => setExpanded(readExpanded()), [])` nach dem Mount lesen. Ein kurzes Umspringen direkt nach dem Laden ist akzeptiert.
- **Abnahmekriterium:** Mit gespeichertem `worldcraft:chat-expanded`, das vom Standard abweicht, zeigt ein Neuladen von `/w/<id>/chat` keine Hydration-Warnung in der Konsole, und der gespeicherte Auf-/Zu-Zustand wird angezeigt.

### CR-004 – Lösch-Dialog kann per Enter unbeabsichtigt löschen
- **Fundstelle:** `src/components/ui/confirm-dialog.ts` (`confirmDialogKey`), `src/components/ui/ConfirmDialog.tsx` Zeilen 34–48
- **Kategorie:** Sicherheit (Schutz vor unbeabsichtigtem Datenverlust)
- **Schweregrad:** mittel
- **Bezug:** T-006
- **Beschreibung:** Der Keydown-Listener hängt global an `window`, und Enter bestätigt, sobald der Fokus **nicht** auf „Abbrechen“ liegt. Es gibt keinen Fokus-Trap: Nach einem Klick auf den Dialogtext (Fokus → `body`) oder Tab aus dem Dialog heraus (z. B. in den Composer) löscht Enter sofort; im Composer wird dabei zusätzlich das Senden per `preventDefault` verschluckt. Das widerspricht „Enter im Dialog löscht nicht versehentlich“. `aria-modal="true"` verspricht Modalität, die nicht umgesetzt ist.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Enter führt standardmäßig zu „Abbrechen“; Fokus bleibt im Dialog.** Gelöscht wird per Tastatur nur, wenn der Fokus ausdrücklich auf „Löschen“ liegt (native Knopf-Aktivierung).
- **Empfehlung:** (1) `confirmDialogKey(key, focusedConfirm)` in `src/components/ui/confirm-dialog.ts`: `Escape` → `"cancel"`; `Enter` bei Fokus auf „Löschen“ → `"none"` (der native Klick des Knopfes löst `onConfirm` aus, kein `preventDefault`); `Enter` bei jedem anderen Fokus (Abbrechen, Dialogtext, `body`) → `"cancel"`; sonst `"none"`. Parameter von `focusedCancel` auf `focusedConfirm` umstellen, `ConfirmDialog.tsx` übergibt `document.activeElement === confirmRef.current`. (2) Fokus-Trap in `ConfirmDialog.tsx`: Tab auf dem letzten Knopf springt zum ersten, Shift+Tab auf dem ersten zum letzten; als reine Funktion `nextFocusIndex(current, count, shift)` in `confirm-dialog.ts` (C11: nur Logik testen). (3) `confirm-dialog.test.ts` anpassen; der bisherige Fall „Enter ohne Fokus auf Abbrechen → confirm“ entfällt.
- **Abnahmekriterium:** Tests: `confirmDialogKey("Enter", false)` → `"cancel"`, `confirmDialogKey("Enter", true)` → `"none"`, `confirmDialogKey("Escape", …)` → `"cancel"`; `nextFocusIndex` zyklisch in beide Richtungen. Manuell: Dialog öffnen, in den Dialogtext klicken, Enter → Dialog schließt, Nachricht bleibt; Tab/Shift+Tab verlassen den Dialog nicht; Tab auf „Löschen“ + Enter → Nachricht wird gelöscht.

### CR-005 – Irreführende Fehlermeldung und doppelte Validierung beim Bearbeiten
- **Fundstelle:** `src/app/api/worlds/[worldId]/chat/messages/[messageId]/route.ts` Zeilen 24–28; `src/lib/chat/repository.ts` `editChatMessage` (Trim/Länge erneut geprüft)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** mittel
- **Bezug:** T-004
- **Beschreibung:** Jeder Zod-Fehler – auch Text > 2000 Zeichen, fehlendes oder nicht-String-`body` – wird mit „Zum Entfernen löschen.“ beantwortet. Bei zu langem Text ist das falsch und verwirrend. Gleichzeitig prüft `editChatMessage` Leerheit und Länge ein zweites Mal (mit korrekter Meldung), wird aber nie mit ungültigen Werten erreicht → toter, doppelt zu pflegender Code. Die Thread-Route macht es mit einer passenden Meldung besser.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Das Repository entscheidet.**
- **Empfehlung:** Route liest den Body mit `parseJsonBody(request, z.object({ body: z.string() }))` (nur Form; fehlt `body` oder ist es kein String → 400 „Die Eingaben sind ungültig.“, Standard von `parseJsonBody` in `src/lib/http.ts`). `editChatMessage` behält die Prüfungen leer → 422 „Zum Entfernen löschen.“, > `MESSAGE_MAX` → 422 „Die Nachricht darf höchstens 2000 Zeichen haben.“, Würfelbefehl → 422 (C10).
- **Abnahmekriterium:** Die Route enthält kein `.min(`/`.max(` für `body` mehr; PATCH mit 2001 Zeichen → 422 mit Meldung, die „2000“ enthält; leerer Text → 422 „Zum Entfernen löschen.“; `chat.api.test.ts` prüft beide Meldungen.

### CR-006 – `/r`-Alias ändert Würfelverhalten außerhalb des Plans
- **Fundstelle:** `src/lib/chat/dice.ts`, `isRollCommand` / `extractRollExpression`
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug:** T-004 (C10)
- **Beschreibung:** Um C10 (`/r 1d20` beim Bearbeiten ablehnen) zu erfüllen, wurde `isRollCommand` global auf `/r` erweitert. Damit würfelt jetzt auch **das Senden** von `/r …` – eine Änderung am Würfelverhalten, die der Plan ausdrücklich ausschließt („Würfel-Verhalten (Phase 4, eigener Plan)“). Es gibt weder einen Test für `/r` noch einen Eintrag in `datenmodell.md` (`APP-DICE-SERVER`) oder im Smoketest.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **`/r` wird offizieller Alias für `/roll`**, beim Senden (würfelt) wie beim Bearbeiten (422 nach C10). Code in `dice.ts` bleibt wie er ist; nachgezogen werden Norm, Tests und Smoketest.
- **Empfehlung:** (1) `.ai/architecture/datenmodell.md`: bei `APP-DICE-SERVER` und `APP-CHAT-EDIT` „Würfelbefehl = `/roll` oder `/r` (Groß-/Kleinschreibung egal, gefolgt von Leerzeichen oder Ende)“ mit Datum 2026-09-23 ergänzen. (2) `src/lib/chat/dice.test.ts`: `isRollCommand` für `/r 1d20`, `/R 1d20`, `/r` → true, `/rx`, `/random`, `r 1d20` → false; `extractRollExpression("/r 2d6+1")` → `"2d6+1"`. (3) `src/app/api/worlds/[worldId]/chat/chat.api.test.ts`: Senden von `/r 1d20` (bei `dicePostToChat: true`) erzeugt eine Nachricht mit `dice` gesetzt. (4) `.ai/infrastructure/smoketest.md`: Punkt C7.9 „`/r 1d20` würfelt wie `/roll 1d20`“.
- **Abnahmekriterium:** `datenmodell.md` nennt `/r` als Alias bei `APP-DICE-SERVER` und `APP-CHAT-EDIT`; die genannten Tests existieren und sind grün; Smoketest enthält C7.9.

### CR-007 – Testlücken bei den neuen Kernpfaden
- **Fundstelle:** `src/components/chat/use-chat-stream.ts` (`withMessage`, `withThread` nicht exportiert), `src/components/chat/MessageList.tsx` (`messageCopyText`, `messagePreviewText`, `truncatePreview`), `chat.api.test.ts`
- **Kategorie:** Testabdeckung
- **Schweregrad:** mittel
- **Bezug:** T-004, T-005, T-008
- **Beschreibung:** Die Echtzeit-Ersetzung (Kern von T-004/T-008, siehe Fehler in CR-002) und die Kopierlogik je Nachrichtenart (Abnahme T-005) haben keine automatisierten Tests. Die in T-008 geforderte DB-Prüfung („Insert einer Eröffnungsnachricht mit `body` ≠ NULL und einer normalen Nachricht mit `body` = NULL schlagen fehl“) ist nicht umgesetzt; der Test prüft nur, dass keine solche Zeile existiert.
- **Abhängigkeiten:** nach CR-002 (liefert `withEditedMessage`) und CR-012 (liefert `message-text.ts`); am besten im selben Arbeitsgang.
- **Empfehlung:** `withMessage`, `withEditedMessage` (CR-002) und `withThread` nach `src/lib/chat/stream-state.ts` verschieben (reines Modul, von `use-chat-stream.ts` importiert) und in `src/lib/chat/stream-state.test.ts` testen; Kopier-/Vorschaufunktionen in `src/lib/chat/message-text.test.ts` (Modul aus CR-012); zwei SQL-Inserts in `chat.api.test.ts` ergänzen, die an `chk_opener_body` scheitern müssen.
- **Abnahmekriterium:** Tests vorhanden für: `withMessage` hängt neue Nachrichten an und erhöht `replyCount` nur bei unbekannter Thread-Antwort; `withEditedMessage` wie in CR-002; `withThread` ersetzt einen bekannten Thread inkl. `state.thread`; Kopiertext für Text/Würfel/Eröffnung; zwei fehlschlagende Inserts gegen `CHK-OPENER-BODY`. `npm test` grün.

### CR-008 – T-007 abgehakt, Smoketest nicht durchlaufen
- **Fundstelle:** `.ai/infrastructure/smoketest.md` Zeilen 175–182; `.ai/feature-tasks/007-chat-verbesserungen.md` T-007
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** mittel
- **Bezug:** T-007 (sowie manuelle Abnahmen von T-003–T-006, T-008, T-009)
- **Beschreibung:** Die Abnahme von T-007 verlangt „Neue Smoketest-Punkte lokal durchlaufen und abgehakt“. Alle Punkte C7.1–C7.8 stehen auf „offen“; `roadmap.md` sagt selbst „Smoketest C7.* Owner“. Der Task ist trotzdem als `[x]` markiert. CR-001 und CR-003 wären beim manuellen Durchlauf auf einer DB mit Daten aufgefallen.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **T-007 zurücksetzen.**
- **Empfehlung:** In `.ai/feature-tasks/007-chat-verbesserungen.md` T-007 auf `- [ ]` setzen. Der Projektinhaber durchläuft den Smoketest C7.1–C7.9 (C7.9 aus CR-006) erst, wenn alle übrigen Findings erledigt sind; danach T-007 wieder abhaken.
- **Abnahmekriterium:** T-007 steht auf `- [ ]`, solange nicht alle C7.x mit Datum auf „ok“ stehen.

### CR-009 – Bearbeiten/Umbenennen in archivierten Kanälen möglich
- **Fundstelle:** `src/lib/chat/repository.ts`, `editChatMessage` und `renameChatThread`
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug:** T-004, T-008
- **Beschreibung:** Senden und Thread-Anlage lehnen archivierte Kanäle ab (`channel.archivedAt`), Bearbeiten und Umbenennen prüfen das nicht. Per API lassen sich so Inhalte in archivierten Kanälen ändern.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Erlaubt.** Bearbeiten (Autor) und Umbenennen (Ersteller/Spielleitung) bleiben auch in archivierten Kanälen möglich; kein Code-Umbau.
- **Empfehlung:** In `.ai/architecture/datenmodell.md` bei `APP-CHAT-EDIT` und `APP-THREAD-RENAME` ergänzen: „gilt auch in archivierten Kanälen (Plan-Review 2026-09-23, CR-009)“. Optional ein API-Test, der das Verhalten festschreibt.
- **Abnahmekriterium:** `datenmodell.md` sagt bei beiden Regeln ausdrücklich, dass sie auch für archivierte Kanäle gelten; `editChatMessage`/`renameChatThread` sind dafür unverändert.

### CR-010 – Reihenfolge der Prüfungen in `authorizeEditChatMessage`
- **Fundstelle:** `src/lib/authz/authz.ts`, `authorizeEditChatMessage` (Zeile 304 ff.)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-004
- **Beschreibung:** Würfel- und Eröffnungsprüfung (422) laufen vor der Autorprüfung (403). Ein Nicht-Autor erhält bei einem fremden Würfelwurf 422 statt 403 – entgegen „403 für Nicht-Autor“ und inkonsistent zur üblichen Reihenfolge „erst Berechtigung, dann Fachregel“.
- **Empfehlung:** Autorprüfung vor die 422-Prüfungen ziehen; Test ergänzen.
- **Abnahmekriterium:** `authorizeEditChatMessage(row("game_master"), { authorId: "someone", hasDice: true, opensThread: false })` liefert `status: 403`.

### CR-011 – `renameChatThread`: redundante Parameter und Abfragen
- **Fundstelle:** `src/lib/chat/repository.ts`, `renameChatThread` (Zeile 519 ff.); Route `threads/[threadId]/route.ts`
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug:** T-008
- **Beschreibung:** `actorId` wird zusätzlich zu `membership` (mit `userId`) übergeben – zwei Quellen für dieselbe Identität. Die Titelprüfung steht in Route und Repository. Der Reply-Count wird mit einer eigenen `count(*)`-Abfrage ermittelt, obwohl `loadChatState` dieselbe Zählung bereits enthält. `createThreadWithOpening` meldet einen ungültigen Titel mit 400, `renameChatThread` mit 422.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Ungültiger Thread-Titel → 422 bei Anlage und Umbenennen.**
- **Empfehlung:** `actorId` aus `membership.userId` ableiten; Titelvalidierung an einer Stelle; Reply-Count über eine gemeinsame Hilfsfunktion. Für 422 bei der Anlage: `src/app/api/worlds/[worldId]/chat/threads/route.ts` validiert `title` heute per `parseJsonBody(request, bodySchema)` (→ 400); wie in der Umbenenn-Route auf `parseJsonBody(request, z.unknown())` + `safeParse` umstellen und Titelfehler mit 422 beantworten (ungültige `channelId` bleibt 400). `createThreadWithOpening` gibt ebenfalls 422 statt 400 zurück.
- **Abnahmekriterium:** `renameChatThread` hat keinen `actorId`-Parameter mehr; es gibt genau eine Funktion zum Zählen der Antworten eines Threads; Anlage und Umbenennung liefern für einen 81 Zeichen langen Titel denselben Statuscode.

### CR-012 – Kopier- und Vorschautext doppelt und am falschen Ort
- **Fundstelle:** `src/components/chat/MessageList.tsx` Zeilen 40–62; Import in `ChatView.tsx`
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug:** T-005, T-006
- **Beschreibung:** `messageCopyText` und `messagePreviewText` unterscheiden sich nur im Präfix `🧵` und duplizieren die Fallunterscheidung Eröffnung/Würfel/Text. Sie liegen als Exporte in einer `"use client"`-Komponentendatei und werden von `ChatView` von dort importiert – schwer testbar ohne DOM-Umgebung.
- **Empfehlung:** In das reine Modul `src/lib/chat/message-text.ts` verschieben (zusammen mit `truncatePreview`); `messagePreviewText` auf `messageCopyText` aufbauen. Tests siehe CR-007.
- **Abnahmekriterium:** Die Fallunterscheidung existiert nur einmal in einem Nicht-Komponenten-Modul mit eigenem `.test.ts`; `MessageList.tsx` exportiert nur Komponenten.

### CR-013 – Unversionierter, ungenutzter Würfel-Code im Working Tree
- **Fundstelle:** `src/components/chat/DiceSheet.tsx`, `src/lib/chat/dice-draft.ts` (untracked)
- **Kategorie:** Toter Code
- **Schweregrad:** niedrig
- **Bezug:** – (nicht Teil von Plan 007)
- **Beschreibung:** Beide Dateien werden nirgends importiert; `ChatView` nutzt weiterhin `DiceSheet` aus `ComposerBar.tsx`. Es entsteht eine zweite Komponente gleichen Namens. Vermutlich Vorarbeit für Phase 4 (Würfel), die der Plan ausdrücklich ausschließt.
- **Empfehlung:** In einen eigenen Branch/Plan verschieben oder löschen; nicht versehentlich mit einem 007-Folgecommit einchecken.
- **Entscheidung (Plan-Review 2026-09-23):** **Verworfen.** Durch Plan 008 (Commit `12553e6`) gegenstandslos: Die Dateien sind dort bewusst committet und werden von `ChatView` genutzt; die alte `DiceSheet` in `ComposerBar.tsx` ist entfernt. Keine Aufgabe.
- **Abnahmekriterium:** Im Working Tree des 007-Stands gibt es genau eine `DiceSheet`-Komponente; `git status` zeigt die beiden Dateien nicht mehr als unversioniert (verschoben, gelöscht oder bewusst im passenden Plan committet).

### CR-014 – `ConfirmDialog` nicht wirklich wiederverwendbar
- **Fundstelle:** `src/components/ui/ConfirmDialog.tsx` Zeilen 17, 62
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-006
- **Beschreibung:** Die als wiederverwendbar geplante Komponente enthält fest den Hinweis „Tipp: Mit gedrückter Umschalttaste ohne Nachfrage löschen.“ und `confirmLabel = "Löschen"` als Standard. Für `MembersCard`/`LeaveWorldButton` (künftige Nutzer) passt das nicht. `deleteAction` ist Chat-Logik, liegt aber im generischen `ui`-Ordner.
- **Empfehlung:** Hinweis als optionale Prop (`hint`) übergeben. `deleteAction` bleibt in `confirm-dialog.ts` (Ort durch T-006/C11 vorgegeben), wird aber neutral benannt: `confirmMode(event)` → `"immediate" | "confirm"`. (Festgelegt im Plan-Review 2026-09-23, ohne Produktwirkung.)
- **Abnahmekriterium:** `ConfirmDialog` enthält keinen fest verdrahteten chat-/löschspezifischen Text; der Shift-Hinweis wird von `ChatView` übergeben.

### CR-015 – `RenameThreadSheet` falsch platziert, Magic Number
- **Fundstelle:** `src/components/chat/ComposerBar.tsx` Zeilen 230–260 (`maxLength={80}`, ebenso in den bestehenden Sheets Zeilen 143/186/217)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-008
- **Beschreibung:** Ein Sheet der Kanalliste liegt in der Composer-Datei, die damit weiter wächst. Die Grenze 80 ist hart kodiert, obwohl `THREAD_TITLE_MAX` (bzw. `CHANNEL_NAME_MAX`) existiert.
- **Empfehlung:** Sheets in eine eigene Datei (z. B. `ChatSheets.tsx`) auslagern; `maxLength={THREAD_TITLE_MAX}`.
- **Abnahmekriterium:** `RenameThreadSheet` verwendet `THREAD_TITLE_MAX`; in `src/components/chat` gibt es kein `maxLength={80}` mehr.

### CR-016 – Seiteneffekt im State-Updater, unbegrenzter Speicher
- **Fundstelle:** `src/components/chat/ChannelList.tsx` Zeilen 40–46; `src/lib/client/chat-expanded.ts`
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-009
- **Beschreibung:** `writeExpanded` läuft innerhalb der `setExpanded`-Updater-Funktion; Updater sollen rein sein (Strict Mode ruft sie doppelt auf). Der globale Schlüssel sammelt Kanal-IDs aller Welten, auch gelöschter, ohne Obergrenze.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Schreiben im `useEffect`, keine Obergrenze.**
- **Abhängigkeiten:** zusammen mit CR-003 umsetzen (dieselbe Stelle in `ChannelList.tsx`).
- **Empfehlung:** `toggleExpanded` setzt nur den State; das Schreiben passiert in einem `useEffect` auf `expanded`. Das Schreiben erst nach dem ersten Lesen erlauben (z. B. Ref `loaded`), damit der leere Anfangszustand aus CR-003 den Speicher nicht überschreibt. Im Modul-Kommentar von `src/lib/client/chat-expanded.ts` festhalten: „Keine Obergrenze: wenige Bytes pro Kanal, bewusst so entschieden (Plan-Review 2026-09-23, CR-016).“
- **Abnahmekriterium:** Kein `writeExpanded`-Aufruf innerhalb eines `setState`-Updaters; Neuladen verliert gespeicherte Einträge nicht; der Modul-Kommentar enthält die Begründung für die fehlende Obergrenze.

### CR-017 – Backfill-Migration prüft Host ungenau
- **Fundstelle:** `src/db/migrations/0016_static_avatars.sql` Zeile 5
- **Kategorie:** Sicherheit
- **Schweregrad:** niedrig
- **Bezug:** T-003
- **Beschreibung:** `LIKE '%cdn.discordapp.com%'` trifft auch `https://example.com/x?cdn.discordapp.com.gif` o. ä.; die TS-Regel prüft den Hostnamen exakt. Praktisch harmlos (nur Endung wird geändert), aber die beiden Regeln sind nicht „dieselbe Regel“ wie in T-003 verlangt.
- **Empfehlung:** `"image" ~* '^https://cdn\.discordapp\.com/'` verwenden.
- **Abnahmekriterium:** Die Migration schränkt auf URLs ein, die mit `https://cdn.discordapp.com/` beginnen.

### CR-018 – Fachliches Datenmodell ohne technische Kennungen
- **Fundstelle:** `.ai/architecture/datenmodell-fachlich.md`, Chat-Abschnitt
- **Kategorie:** Aufgaben-Abgleich
- **Schweregrad:** niedrig
- **Bezug:** T-001
- **Beschreibung:** Die Abnahme von T-001 verlangt, dass **beide** Datenmodell-Dokumente `edited_at`, `APP-CHAT-EDIT`, `APP-THREAD-RENAME` und `CHK-OPENER-BODY` mit Datum nennen. `datenmodell-fachlich.md` beschreibt die Regeln inhaltlich korrekt, nennt aber keine dieser Kennungen.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Die Abnahme von T-001 wird angepasst**; das fachliche Dokument bleibt ohne technische Kennungen.
- **Empfehlung:** In `.ai/feature-tasks/007-chat-verbesserungen.md` die Abnahme von T-001 ändern zu: „`datenmodell.md` nennt `edited_at`, `APP-CHAT-EDIT`, `APP-THREAD-RENAME` und `CHK-OPENER-BODY` mit Datum 2026-09-23; `datenmodell-fachlich.md` beschreibt Bearbeiten, Thread-Umbenennen und leere Eröffnungsnachricht inhaltlich (ohne technische Kennungen); …“ (Rest unverändert).
- **Abnahmekriterium:** Die Abnahme von T-001 in Plan 007 verlangt die Kennungen nur noch für `datenmodell.md`.

### CR-019 – Eröffnungsnachricht wird mit Titel angelegt und danach geleert
- **Fundstelle:** `src/lib/chat/repository.ts`, `createThreadWithOpening` (Insert mit `body: title`, anschließendes Update `body: null`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-008
- **Beschreibung:** Der Plan sagt „`createThreadWithOpening` schreibt `body` nicht mehr“. Tatsächlich wird der Titel zunächst in `body` geschrieben (nötig, weil `opens_thread_id` erst nach dem Thread-Insert bekannt ist) und im selben Transaktionsschritt geleert. Funktional korrekt, aber nicht selbsterklärend und abhängig von der Reihenfolge.
- **Entscheidung (Projektinhaber, Plan-Review 2026-09-23):** **Nur Kommentar ergänzen**, keine Umstellung des Ablaufs.
- **Empfehlung:** Kommentar über dem ersten Insert in `createThreadWithOpening`: Die Nachricht braucht vorübergehend `body = title`, weil `CHK-OPENER-BODY` ohne `opens_thread_id` einen Text verlangt und die Thread-ID erst nach dem Thread-Insert feststeht; das anschließende Update setzt `opens_thread_id` und `body = NULL` in derselben Transaktion. Den Satz in Plan 007 T-008 „schreibt `body` nicht mehr“ sinngemäß auf „hinterlässt keinen `body`“ präzisieren.
- **Abnahmekriterium:** Der Kommentar steht an der Stelle; die Formulierung in T-008 ist angepasst.

### CR-020 – Thread-⋯-Knopf unter Touch-Mindestgröße
- **Fundstelle:** `src/app/globals.css`, `.more { width: 40px; height: 40px; }` (verwendet auch am neuen Thread-⋯)
- **Kategorie:** Lesbarkeit & Wartbarkeit (Norm `mobile-first.md`)
- **Schweregrad:** niedrig
- **Bezug:** T-008
- **Beschreibung:** `.mobile-first.md` verlangt Touch-Ziele ≥ 44 px. Der neue Thread-⋯ übernimmt die 40-px-Klasse (bestehendes Problem am Kanal-⋯, durch 007 auf Threads ausgeweitet). `.msg-act` ist dagegen korrekt auf 44 px bei `hover: none`.
- **Empfehlung:** `.more` unter `@media (hover: none)` auf 44 × 44 px setzen.
- **Abnahmekriterium:** Bei Touch-Emulation (375 px) misst der ⋯-Knopf an Kanal und Thread mindestens 44 × 44 px.

---

## Prioritätenliste

1. **CR-001** – Migration korrigieren, bevor 0018 auf einer DB mit Daten läuft (Deploy-Blocker).
2. **CR-002**, **CR-007** – Echtzeit-Logik für Bearbeitungen reparieren und mit Tests absichern.
3. **CR-003**, **CR-016** – Aufklapp-Zustand hydration-sicher im Effekt lesen/schreiben.
4. **CR-004** – Enter-/Fokus-Verhalten des Lösch-Dialogs absichern.
5. **CR-005**, **CR-010**, **CR-009** – Validierung und Rechteprüfung beim Bearbeiten/Umbenennen bereinigen; Archiv-Regel dokumentieren.
6. **CR-006** – `/r`-Alias in Norm, Tests und Smoketest nachziehen.
7. **CR-018**, **CR-008** (Teil 1) – Plan 007 anpassen: Abnahme T-001 ändern, T-007 auf `[ ]`.
8. **CR-011**, **CR-012**, **CR-014**, **CR-015**, **CR-017**, **CR-019**, **CR-020** – Aufräumen. (CR-013 verworfen.)
9. **CR-008** (Teil 2) – Zum Schluss: Projektinhaber durchläuft den Smoketest C7.1–C7.9 und hakt T-007 ab.
