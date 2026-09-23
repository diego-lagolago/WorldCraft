# 007 – Chat: eigene Nachrichten rechts, statische Avatare, Bearbeiten, Kopieren, Lösch-Bestätigung

## Kontext & Ziel

Der Chat aus Plan `003` funktioniert. Beim Testen fielen dem Projektinhaber (2026-09-23) folgende Punkte auf:

1. Eigene und fremde Nachrichten stehen beide links; man erkennt die eigenen nicht auf einen Blick.
2. Animierte Discord-Profilbilder laufen dauerhaft und lenken ab.
3. Nachrichten lassen sich nicht bearbeiten.
4. Löschen passiert ohne Rückfrage.
5. Threads lassen sich nicht umbenennen; der Titel steht im Hauptstrom doppelt (Nachrichtentext + Thread-Karte). (Plan-Review 2026-09-23)
6. Der Auf-/Zuklapp-Zustand der Kanäle in der Kanalliste geht beim Neuladen verloren. (Plan-Review 2026-09-23)

**Ziel dieses Plans:** Eigene Nachrichten stehen rechts, Profilbilder sind statisch, und jede Nachricht hat Schnellaktionen (Bearbeiten, Kopieren, Löschen). Löschen fragt nach, außer bei gedrückter Umschalttaste. Threads lassen sich über das ⋯-Menü in der Kanalliste umbenennen, der Titel liegt nur noch in einem Feld; Kanäle merken sich, ob sie aufgeklappt waren.

**Nicht Ziel dieses Plans:**

- Würfel-Verhalten (Phase 4, eigener Plan nach Vorführung im Prototyp).
- Bearbeitungsverlauf / frühere Fassungen anzeigen.
- Bearbeiten fremder Nachrichten durch die Spielleitung.
- Weitere Änderungen an Threads und Kanälen (außer Umbenennen von Threads, C6–C8, und gemerktem Aufklapp-Zustand, C9), Composer-Formatierung.

## Entscheidungen (Projektinhaber, 2026-09-23, beim Anlegen des Plans)

| # | Frage | Entscheidung |
|---|---|---|
| C1 | Darstellung eigener Nachrichten | **Rechts, gespiegelt:** rechtsbündig, Avatar rechts, leicht abgesetzter Hintergrund. Fremde Nachrichten bleiben links. |
| C2 | Animierte Profilbilder | **Nie animieren** (weniger Umbau als Hover-Animation, vom Projektinhaber freigegeben: „je nachdem, was weniger Aufwand ist“). |
| C3 | Wer bearbeitet? | **Nur der Autor**, nur Textnachrichten. Würfelwürfe sind nie bearbeitbar. Bearbeitete Nachrichten tragen „(bearbeitet)“. |
| C4 | Bedienung | **Kleine Symbole beim Hovern** über der Nachricht (wie der Papierkorb): Bearbeiten ✏️, Kopieren 📋, Löschen 🗑. Kopieren kopiert den ganzen Nachrichtentext. |
| C5 | Lösch-Bestätigung | Klick auf 🗑 öffnet einen Bestätigungsdialog. Mit **gedrückter Umschalttaste** (Shift) wird ohne Dialog sofort gelöscht. |

## Entscheidungen aus dem Plan-Review (Projektinhaber, 2026-09-23)

Zusätzlich im Plan-Review präzisiert (ohne Produktwirkung): Dateiorte für Rechteprüfungen, Echtzeit-Ersetzung in `withMessage`, Validierung beim Bearbeiten, Wiederverwendung von `Toast.tsx`, Kopierinhalt je Nachrichtenart.

| # | Frage | Entscheidung |
|---|---|---|
| C6 | Threads umbenennen | **Über das ⋯-Menü am Thread in der Kanalliste**, analog zum Umbenennen von Kanälen. Die Eröffnungsnachricht im Hauptstrom hat **kein** ✏️. Titel 1–80 Zeichen (`THREAD_TITLE_MAX`). |
| C7 | Wer darf Threads umbenennen? | **Ersteller des Threads (`chat_threads.created_by`) und Spielleitung.** ⋯ am Thread erscheint nur für diese. Neue Regel `APP-THREAD-RENAME`. |
| C8 | Ein Feld für Thread-Titel | **`chat_threads.title` ist die einzige Quelle.** Die Eröffnungsnachricht (`opens_thread_id` gesetzt) hat `body = NULL`; `chat_messages.body` wird nullable mit `CHK-OPENER-BODY` (`body IS NULL` genau dann, wenn `opens_thread_id IS NOT NULL`). Migration leert `body` bestehender Eröffnungsnachrichten. Die Eröffnungsnachricht zeigt nur Kopfzeile + Thread-Karte, keinen Text. Umbenennen = ein `UPDATE chat_threads` (+ `updated_at/by`) und ein `chat.thread`-Ereignis. 📋 an der Eröffnungsnachricht kopiert den Thread-Titel. |
| C9 | Aufklapp-Zustand der Kanäle | ~~Global in `localStorage`~~ → **Cookie je Welt** (Nachtrag N2, 2026-09-23), Zuordnung Kanal-ID → auf/zu. Kein gespeicherter Wert → heutiges Verhalten (Kanal des offenen Threads aufgeklappt, sonst zu). Nur pro Gerät/Browser. |
| C10 | Bearbeiten zu einem Würfelbefehl (`isRollCommand`, z. B. `/r 1d20`) | **Ablehnen mit 422** und Hinweis „Würfelbefehle können nicht nachträglich eingefügt werden. Sende sie als neue Nachricht.“ Es wird nie gewürfelt, der Text wird nicht gespeichert. |
| C11 | Tests für den Lösch-Dialog | **Nur Logik testen, kein Render-Test.** Entscheidungen als reine Funktionen (z. B. `deleteAction(event)` → `"immediate" | "confirm"`, Tastenbehandlung Esc/Enter) in einer `.test.ts`; Dialog-Verhalten (Fokus, kein `onConfirm` bei Abbrechen) nur manuell. Keine neue Abhängigkeit, keine Änderung an `vitest.config.ts`. Umstellung auf `@testing-library/react` + `.test.tsx` gesammelt später, siehe `.ai/backlog.md` (2026-09-23 – Komponenten-Tests). |

## Begriffe & Systeme

Begriffe aus Plan `003` und `.ai/architecture/datenmodell.md` 3.17 gelten (Kanal, Thread, Hauptstrom, Nachricht, Würfelwurf, Spielleitung, SSE, Test-Login). Zusätzlich:

- **Eigene Nachricht**: Nachricht mit `author_id` = angemeldeter Benutzer. CSS-Klasse `msg mine`.
- **Schnellaktionen**: Die Symbolleiste einer Nachricht mit ✏️ Bearbeiten (nur eigene Textnachrichten, nicht an Eröffnungsnachrichten, C6), 📋 Kopieren (alle Nachrichten, bei Würfelwürfen die formatierte Wurfzeile, bei Eröffnungsnachrichten der Thread-Titel, C8), 🗑 Löschen (Rechte wie bisher, `APP-CHAT-DELETE`). **Geräte mit Maus** (`@media (hover: hover)`): sichtbar bei Hover oder Tastaturfokus auf der Nachricht. **Touch-Geräte** (`@media (hover: none)`): sichtbar nach Antippen der Nachricht, erneutes Antippen oder Tippen außerhalb blendet sie aus.
- **Inline-Bearbeiten**: ✏️ ersetzt den Nachrichtentext durch ein mehrzeiliges Eingabefeld mit dem Markdown-Rohtext; Enter speichert, Shift+Enter macht einen Zeilenumbruch, Esc bricht ab; zusätzlich Knöpfe „Speichern“ und „Abbrechen“ (Touch). Leerer Text wird nicht gespeichert (Hinweis „Zum Entfernen löschen“).
- **Bearbeitet-Markierung**: Spalte `chat_messages.edited_at timestamptz NULL`; gesetzt → neben der Uhrzeit „(bearbeitet)“ mit Tooltip der Bearbeitungszeit.
- **Lösch-Bestätigung**: Modaler Dialog (kein `window.confirm`) „Nachricht löschen?“ mit Textvorschau (max. 120 Zeichen), Knöpfen „Abbrechen“ / „Löschen“ und dem Hinweis „Tipp: Mit gedrückter Umschalttaste ohne Nachfrage löschen.“ Esc/Abbrechen schließt ohne Löschen.
- **Eröffnungsnachricht**: Nachricht im Hauptstrom mit gesetztem `opens_thread_id`, die beim Anlegen eines Threads entsteht (`createThreadWithOpening` in `src/lib/chat/repository.ts`). Hat ab diesem Plan `body = NULL` und zeigt nur die Thread-Karte (C8). Im Thread selbst liegt sie nicht.
- **Thread-⋯-Menü**: ⋯-Knopf rechts neben einem Thread in der Kanalliste (`ChannelList.tsx`), gleiche Optik und Bedienung wie das ⋯-Menü am Kanal. Einziger Eintrag in diesem Plan: „Umbenennen“ (öffnet ein Sheet mit Titelfeld wie beim Umbenennen eines Kanals).
- **Aufklapp-Speicher** (seit Nachtrag N2): Cookie `chat-expanded` mit `Path=/w/<worldId>/chat`, Wert `<channelId>.<1|0>` getrennt durch `~`, höchstens 3500 Zeichen (älteste Einträge fallen weg). Der Server liest es in `src/app/w/[worldId]/chat/page.tsx` (`src/lib/chat/expanded-state.ts`), der Client schreibt es (`src/lib/client/chat-expanded.ts`). Kaputte oder fremde Einträge gelten als „nichts gespeichert“.
- **Statisches Profilbild**: Discord liefert animierte Avatare als `https://cdn.discordapp.com/avatars/<id>/a_<hash>.gif`. Dieselbe URL mit Endung `.png` liefert ein statisches Bild. Umschreiben durch eine reine Funktion `staticDiscordAvatar(url)` in `src/lib/discord-profile.ts`.

## Relevante Normen

- `.ai/architecture/datenmodell.md` — 3.17 Chat (`chat_messages`, „Kein `updated_*`“ wird geändert), 5 Regeln (`APP-CHAT-DELETE`, `APP-DICE-SERVER`).
- `.ai/architecture/datenmodell-fachlich.md` — Chat-Abschnitt und Rechte je Entität.
- `.ai/standards/mobile-first.md` (Touch-Ziele ≥ 44 px), `.ai/standards/mobile-navigation.md`
- `.ai/conventions.md` — UI Deutsch, Code Englisch; `npm run lint` vor jedem Commit.
- `.ai/roadmap.md` — Arbeitsweise (Prototyp vor Umsetzung, Commit pro Task, nie automatisch pushen).
- `spikes/ui-prototype/index.html` — Design-Referenz; wird in T-002 erweitert.

## Globale Abhängigkeiten

- Plan `003` abgeschlossen (Chat, SSE-Bus `src/lib/realtime/events.ts`).
- Keine Abhängigkeit zu Plan `004`–`006`; dieser Plan kann parallel oder vorher umgesetzt werden.
- Chat-Code: `src/components/chat/*`, `src/lib/chat/*`, API `src/app/api/worlds/[worldId]/chat/messages/[messageId]`.

## Aufgaben

### T-001: Normen nachziehen
- [x] Beschreibung: C1–C5 in die Normen übernehmen: `datenmodell.md` 3.17 `chat_messages` um `edited_at` ergänzen, Satz „Kein `updated_*`“ ersetzen, neue Regel `APP-CHAT-EDIT` (nur Autor, nur ohne Würfelwurf, Text 1–2000 Zeichen, kein Würfelbefehl (C10), setzt `edited_at`); `datenmodell-fachlich.md` Chat-Rechte um Bearbeiten ergänzen; Regel zu statischen Profilbildern bei Benutzer (3.1) vermerken. Außerdem die heutigen Aussagen „nicht editierbar“ anpassen: `datenmodell.md` Zeile *Protokollfelder* in Abschnitt 2 („Chat-Nachrichten … nicht editierbar“) und `datenmodell-fachlich.md` Rechte-Tabelle „Bearbeiten: niemand“ sowie OF-03 („kein Bearbeiten“) mit Verweis auf Plan `007`. C6–C8: `chat_messages.body` nullable + `CHK-OPENER-BODY`, neue Regel `APP-THREAD-RENAME` (Ersteller oder Spielleitung, Titel 1–80, setzt `updated_at/by`), in 3.17 den Satz zur Eröffnungsnachricht um „`body` leer, Titel nur in `chat_threads.title`“ ergänzen. `roadmap.md`: Plan `007` eintragen.
- Abhängigkeiten: keine
- Abnahmekriterium: `datenmodell.md` nennt `edited_at`, `APP-CHAT-EDIT`, `APP-THREAD-RENAME` und `CHK-OPENER-BODY` mit Datum 2026-09-23; `datenmodell-fachlich.md` beschreibt Bearbeiten, Thread-Umbenennen und leere Eröffnungsnachricht inhaltlich (ohne technische Kennungen); keine Stelle in `.ai/architecture/` sagt mehr, Chat-Nachrichten seien nicht bearbeitbar; `roadmap.md` listet `007`.

### T-002: Prototyp erweitern
- [x] Beschreibung: In `spikes/ui-prototype/index.html`: eigene Nachrichten rechts gespiegelt (C1); Schnellaktionen bei Hover bzw. Antippen (C4); Inline-Bearbeiten mit „(bearbeitet)“; Lösch-Bestätigungsdialog mit Shift-Umgehung (C5); Kopieren mit Toast „Kopiert“; Eröffnungsnachricht nur mit Thread-Karte (C8); ⋯-Menü am Thread in der Kanalliste mit „Umbenennen“ (C6); Aufklapp-Zustand bleibt nach Neuladen erhalten (C9). Dem Projektinhaber zeigen, bevor T-005 beginnt.
- Abhängigkeiten: T-001
- Abnahmekriterium: Prototyp zeigt alle genannten Punkte mobil (375 px) und Desktop; Projektinhaber hat den Prototyp im Chat freigegeben (Datum im Plan vermerkt: **2026-09-23**, Auftrag „mach mit allen Aufgaben weiter“).

### T-003: Statische Profilbilder
- [x] Beschreibung: `staticDiscordAvatar(url)` in `src/lib/discord-profile.ts`: ersetzt bei Host `cdn.discordapp.com` eine Endung `.gif` (vor optionalem Query-String) durch `.png`, alle anderen URLs unverändert. Aufruf in `mapDiscordProfileToUser` (greift bei jeder Anmeldung, da `overrideUserInfoOnSignIn: true` in `src/lib/auth.ts`). Einmaliges Backfill als SQL-Migration für bestehende `users.image`-Werte mit derselben Regel.
- Abhängigkeiten: keine
- Abnahmekriterium: Unit-Tests in `src/lib/discord-profile.test.ts`: `…/a_abc.gif` → `…/a_abc.png`, `…/a_abc.gif?size=128` → `…/a_abc.png?size=128`, `…/abc.png` unverändert, fremder Host unverändert; nach Migration enthält lokal kein `users.image` mit `cdn.discordapp.com` mehr die Endung `.gif`; manuell: animierter Avatar im Chat steht still.

### T-004: Bearbeiten – Schema, API, Echtzeit
- [x] Beschreibung: Spalte `edited_at` in `src/db/schema.ts` + Migration; `PATCH /api/worlds/[worldId]/chat/messages/[messageId]` mit `{ body }` nach `APP-CHAT-EDIT` (403 für Nicht-Autor, 422 für Würfelwurf/Eröffnungsnachricht/leeren/zu langen Text/Würfelbefehl nach C10), Validierung wie beim Senden (`z.string().trim().min(1).max(2000)`, `body` roh speichern, gerendert wird erst in der Anzeige); Rechteprüfung `authorizeEditChatMessage` in `src/lib/authz/authz.ts` neben `authorizeDeleteChatMessage`, Tests in `src/lib/authz/authz.test.ts`; `ChatMessageDto` um `editedAt` erweitern; nach dem Speichern `chat.message`-Ereignis mit der geänderten Nachricht; `withMessage` in `src/components/chat/use-chat-stream.ts` ersetzt eine vorhandene Nachricht gleicher ID (heute wird sie ignoriert) statt sie anzuhängen; `replyCount` steigt dabei nicht (bestehende `!known`-Prüfung beibehalten). `use-chat-realtime.ts` bleibt unverändert (nur SSE-Hülle).
- Abhängigkeiten: T-001
- Abnahmekriterium: `chat.api.test.ts` erweitert: Autor bearbeitet → 200, `editedAt` gesetzt; Eröffnungsnachricht bearbeiten → 422 (C6); andere Person inkl. Game Master → 403; Würfelwurf → 422; leerer Text → 422; 2001 Zeichen → 422; neuer Text `/r 1d20` → 422 mit Hinweis aus C10, Nachricht unverändert. Manuell mit zwei Browsern: Änderung erscheint beim anderen ohne Neuladen an derselben Stelle, nicht als neue Nachricht.

### T-005: Nachrichten-UI – Ausrichtung, Schnellaktionen, Bearbeiten, Kopieren
- [x] Beschreibung: Nach freigegebenem Prototyp (T-002) in `MessageList.tsx` und `src/app/globals.css`: Klasse `mine` für eigene Nachrichten mit gespiegeltem Layout (C1); Schnellaktionen-Leiste nach *Begriffe* ersetzt den heutigen `.del`-Knopf; Inline-Bearbeiten mit `PATCH` aus T-004 und „(bearbeitet)“; Kopieren über `navigator.clipboard.writeText` mit Toast „Kopiert“ über die vorhandene `src/components/chat/Toast.tsx` (bei Fehler Toast „Kopieren nicht möglich“). Touch-Ziele mind. 44 px auf Touch-Geräten.
- Abhängigkeiten: T-002, T-004
- Abnahmekriterium: Manuell als zwei Benutzer: eigene Nachrichten rechts, fremde links, auch in Threads; Desktop: Symbole erscheinen nur bei Hover/Fokus; mobil (375 px, Touch-Emulation): Symbole nach Antippen; ✏️ fehlt bei fremden Nachrichten, Würfelwürfen und Eröffnungsnachrichten; Kopieren legt bei Textnachrichten exakt den Markdown-Rohtext in die Zwischenablage, bei Würfelwürfen `formatDiceRoll(expression, terms)` aus `src/lib/chat/dice-format.ts`, bei Eröffnungsnachrichten den Thread-Titel (C8); `npm run lint` grün.

### T-006: Lösch-Bestätigung mit Shift-Umgehung
- [x] Beschreibung: Dialog nach *Begriffe* als wiederverwendbare Komponente `src/components/ui/ConfirmDialog.tsx` (Ordner neu; es gibt noch keinen gemeinsamen Bestätigungsdialog, `window.confirm` in `MembersCard.tsx`/`LeaveWorldButton.tsx` bleibt unverändert), optisch und in den ARIA-Attributen (`role="dialog"`, `aria-modal`) aufgebaut wie `Sheet` aus `src/components/chat/ChannelList.tsx`. Entscheidungslogik als reine Funktionen in `src/components/ui/confirm-dialog.ts` (C11); Klick auf 🗑 öffnet ihn; ist beim Klick `event.shiftKey` gesetzt, wird sofort gelöscht. Fokus liegt beim Öffnen auf „Abbrechen“; Enter im Dialog löscht nicht versehentlich.
- Abhängigkeiten: T-005
- Abnahmekriterium: Manuell: Klick → Dialog, „Abbrechen“ und Esc lassen die Nachricht stehen, „Löschen“ entfernt sie bei beiden Browsern; Shift+Klick löscht sofort ohne Dialog; Unit-Test `src/components/ui/confirm-dialog.test.ts` für die reinen Funktionen: Shift → sofort löschen, ohne Shift → Dialog; Esc → abbrechen; Enter bei Fokus auf „Abbrechen“ → kein Löschen. Kein Render-Test (C11).

### T-008: Threads umbenennen, Titel nur in einem Feld
- [x] Beschreibung: Nach C6–C8. Schema + Migration: `chat_messages.body` nullable, `CHK-OPENER-BODY`, bestehende Eröffnungsnachrichten `body = NULL` (vor dem Constraint). `createThreadWithOpening` hinterlässt keinen `body` an der Eröffnungsnachricht. `ChatMessageDto.body` → `string | null`; alle Leser (`MessageList.tsx`, Kopieren, ggf. Suche) behandeln `null`. Neue Route `PATCH /api/worlds/[worldId]/chat/threads/[threadId]` mit `{ title }` nach `APP-THREAD-RENAME` (Rechtefunktion `authorizeRenameChatThread` in `src/lib/authz/authz.ts` neben `authorizeDeleteChatMessage`); nach dem Speichern `chat.thread`-Ereignis. `withThread` in `use-chat-stream.ts` ersetzt einen vorhandenen Thread gleicher ID (heute wird er ignoriert), damit Kanalliste, Thread-Karte und Thread-Kopf den neuen Titel zeigen. UI: Thread-⋯-Menü nach *Begriffe*, sichtbar nur für Ersteller und Spielleitung; Eröffnungsnachricht zeigt nur Kopfzeile + Thread-Karte.
- Abhängigkeiten: T-001, T-002 (Prototyp freigegeben); T-004 (gleiche Datei `schema.ts`/Migrationen, danach umsetzen)
- Abnahmekriterium: `chat.api.test.ts`: Ersteller benennt um → 200; Spielleitung benennt fremden Thread um → 200; anderes Mitglied → 403; leerer / 81 Zeichen langer Titel → 422. Unit-Tests für `authorizeRenameChatThread` in `src/lib/authz/authz.test.ts` (Ersteller, Spielleitung, anderes Mitglied). DB: Insert einer Eröffnungsnachricht mit `body` ≠ NULL und einer normalen Nachricht mit `body` = NULL schlagen fehl. Nach Migration lokal keine Eröffnungsnachricht mit `body` ≠ NULL. Manuell mit zwei Browsern: Umbenennen erscheint beim anderen ohne Neuladen in Kanalliste, Thread-Karte und Thread-Kopf; Player sieht ⋯ nur an eigenen Threads.

### T-009: Aufklapp-Zustand der Kanäle merken
- [x] Beschreibung: Nach C9 und *Aufklapp-Speicher*. `ChannelList.tsx` initialisiert `expanded` aus dem Speicher und schreibt jede Änderung zurück. Ohne gespeicherten Wert für einen Kanal gilt das heutige Verhalten.
- Abhängigkeiten: T-002 (Prototyp freigegeben)
- Abnahmekriterium: Unit-Test mit `// @vitest-environment happy-dom` für das Speichermodul (lesen, schreiben, kaputtes JSON → leer); manuell: Kanal aufklappen, neu laden → bleibt auf; zuklappen, neu laden → bleibt zu; in einer anderen Welt unbeeinflusst von fremden Kanal-IDs.

### T-007: Smoketest und Abschlussprüfung
- [x] Beschreibung: `.ai/infrastructure/smoketest.md` um Punkte für Ausrichtung, statische Avatare, Bearbeiten, Kopieren, Lösch-Bestätigung, Thread-Umbenennen und gemerkten Aufklapp-Zustand ergänzen; vollständige Testsuite laufen lassen.
- Abhängigkeiten: T-003, T-005, T-006, T-008, T-009
- Abnahmekriterium: Neue Smoketest-Punkte lokal durchlaufen und abgehakt; `npm test`, `npm run lint`, `npm run build` grün.
- Umsetzungsvermerk (2026-09-23): C7.1–C7.8 vom Projektinhaber bestanden; C7.9–C7.12 im Browser geprüft (Test-GM, Welt „Smoke“). Anmerkungen aus dem Smoketest als Nachtrag N1–N3 umgesetzt. `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` grün.

## Nachtrag nach Smoketest (Projektinhaber, 2026-09-23)

| # | Anmerkung | Entscheidung | Umsetzung |
|---|---|---|---|
| N1 | Eigene Nachrichten mit Absätzen wirken durch den Hintergrund der Textfläche seltsam | **Hintergrund komplett entfernen** (Text, Würfel und Thread-Karte eigener Nachrichten ohne Farbton) | `globals.css`: Regel `.chat .msg.mine .txt, .dice, .thread-card` entfernt |
| N2 | Aufklapp-Zustand flackert beim Neuladen (zu → auf) | **Cookie statt `localStorage`**, damit der Server den gespeicherten Zustand direkt rendert. Je Welt ein Cookie mit Pfad `/w/<worldId>/chat` (ein globales Cookie ginge mit jedem Request mit und stößt an die 4-KB-Grenze). Ersetzt C9 „global in `localStorage`“ und die Umsetzung von CR-003 (Lesen im `useEffect`). Bisher gespeicherte `localStorage`-Werte werden nicht übernommen. | `src/lib/chat/expanded-state.ts`, `src/lib/client/chat-expanded.ts`, `ChannelList.tsx`, `ChatView.tsx`, Chat-Seite |
| N3 | Nachricht mit offenen Schnellaktionen soll hervorgehoben werden | **Ganze Zeile leicht heller**, von Avatar bis zu den Aktionsknöpfen; Desktop bei Hover/Fokus, Touch bei ausgewählter Nachricht | `globals.css`: `.chat .msg` mit Innenabstand und negativem Rand, Hintergrund bei `:hover`/`:focus-within` bzw. `.selected`; Abstand zwischen Nachrichten unverändert |

