# Code Review – Plan 008 (Würfel-Sheet wie im Chat-Spike)

**Baseline:** Commit `ca2eccc1bfe9ab719c245cabc4fe0c5e2a136abd` (`main`). Working Tree: nur unversionierte, nicht zum Plan gehörende Dateien (`.ai/feature-tasks/005-…`, `006-…`, `.claude/`).
**Geprüfte Task-Datei:** `.ai/feature-tasks/008-wuerfel-sheet-wie-spike.md` (T-001–T-004 erledigt, inkl. Nachtrag N1)
**Geprüfte Commits:** `b477087` (T-001), `14402f2` (T-002), `12553e6` (T-003), `f6f075a` (T-004), `ca2eccc` (T-004 / N1)
**Geprüfte Dateien:** `src/components/chat/DiceSheet.tsx`, `src/lib/chat/dice-draft.ts`, `src/lib/chat/dice-draft.test.ts`, `src/components/chat/use-chat-stream.ts` (`roll`, `setPostToChat`), `src/components/chat/ChatView.tsx` (Einbindung), `src/app/globals.css` (Würfel-/Stepper-Klassen), `src/app/api/worlds/[worldId]/chat/chat.api.test.ts` (neuer Fall), `src/app/api/worlds/[worldId]/chat/route.ts` (Antwortform)

| ID | Kategorie | Schweregrad | Status | Kurzbeschreibung |
|----|-----------|-------------|--------|-------------------|
| CR-001 | Runtime-Risiken | mittel | behoben | Verspäteter Wurf eines geschlossenen Sheets schließt ein neu geöffnetes Sheet |
| CR-002 | Duplizierung & Modularisierung | mittel | behoben | Summe wird per Regex aus `dice.text` gelesen, obwohl die API `dice.sum` liefert |
| CR-003 | Fehlerbehandlung & Validierung | niedrig | behoben | Wurf-Fehler doppelt angezeigt (Sheet + Chat-Banner) und löst immer Voll-Reload aus |
| CR-004 | Fehlerbehandlung & Validierung | niedrig | behoben | „Im Chat posten“: Fehler unsichtbar hinter dem Sheet, Doppelklick schaltet mit veraltetem Wert |
| CR-005 | Duplizierung & Modularisierung | niedrig | behoben | Roll-Ein-/Ausgabetyp doppelt in `use-chat-stream.ts` und `DiceSheet.tsx` |
| CR-006 | Lesbarkeit & Wartbarkeit | niedrig | behoben | `allowNegative` steuert nur die Tastatur, nicht die Eingabe |
| CR-007 | Runtime-Risiken | niedrig | behoben | `keepSelection` bleibt nach Tastatur-Fokus gesetzt und schluckt den nächsten Klick |
| CR-008 | Runtime-Risiken | niedrig | verworfen | Index als React-Key bei entfernbaren Termen mit lokalem Stepper-State |
| CR-009 | Fehlerbehandlung & Validierung | niedrig | offen | Kopieren schlägt still fehl (kein Feedback bei verweigerter Zwischenablage) |
| CR-010 | Bad Practices | niedrig | offen | Hartkodierte Farbe `#1f1a0e` in `.dice-result.copied` statt App-Variable (W3) |

---

## CR-001 – Verspäteter Wurf schließt ein neu geöffnetes Sheet

- **Fundstelle:** `src/components/chat/DiceSheet.tsx`, `handleRoll` (Z. 125–143); Einbindung `src/components/chat/ChatView.tsx` Z. 175–181
- **Kategorie:** Runtime-Risiken (Race Condition)
- **Schweregrad:** mittel
- **Bezug:** T-003 (W6)
- **Beschreibung:** Laut W6 bleibt „Abbrechen“ während des Wurfs aktiv, das Ergebnis wird verworfen. Das Sheet wird dabei ausgehängt, der `onRoll`-Promise läuft aber weiter. Öffnet der Nutzer das Sheet erneut, bevor die Antwort kommt, ruft der alte `handleRoll` bei `posted: true` `onClose()` auf — das ist `() => setDiceOpen(false)` und schließt damit das **neue** Sheet samt frisch eingegebenem Draft. (Bei `posted: false` / Fehler passiert nichts Sichtbares, weil die State-Setter der ausgehängten Instanz ins Leere laufen — das ist gewollt.)
- **Empfehlung:** In `DiceSheet` einen `mountedRef` führen (in einem `useEffect` beim Aushängen auf `false` setzen) und nach dem `await` in `handleRoll` sofort abbrechen, wenn die Instanz nicht mehr aktiv ist. Kein `AbortController`: Der Server-Wurf soll laut W6 bestehen bleiben.
- **Abnahmekriterium:** Wurf mit „Im Chat posten“ an starten (Netzwerk gedrosselt), sofort „Abbrechen“, Sheet sofort erneut öffnen: Das neue Sheet bleibt nach Eintreffen der Antwort offen; die Wurf-Nachricht erscheint trotzdem im Chat.
- **Umsetzung (2026-09-23):** `mountedRef` in `DiceSheet`; nach `await onRoll` Abbruch wenn ausgehängt. Commit `8c622a7`. Browser (Desktop): Roll-POST verzögert, Abbrechen, Sheet neu öffnen → Sheet blieb offen, Wurf-Nachricht erschien im Chat. Features.md: N/A.

## CR-002 – Summe per Regex aus formatiertem Text statt aus `dice.sum`

- **Fundstelle:** `src/components/chat/DiceSheet.tsx`, `copyResult` (Z. 111–123, Regex `/=\s*(-?\d+)\s*$/`); `src/components/chat/use-chat-stream.ts` Typ `PostResponse` (Z. 9–12) und `roll` (Rückgabe `text`)
- **Kategorie:** Duplizierung & Modularisierung / Wartbarkeit
- **Schweregrad:** mittel
- **Bezug:** T-002, T-003
- **Beschreibung:** Die Route liefert bei `posted: false` `dice: { ...rolled, text }`, also auch `sum` (`RolledDice.sum`, `src/lib/chat/dice.ts`). Der Client wirft `sum` im Typ weg und rekonstruiert die Summe aus dem Anzeigetext von `formatDiceRoll` („… = <Summe>“). Das koppelt die Kopierfunktion an das Textformat: Ändert sich `formatDiceRoll` (z. B. typografisches Minus „−“ für negative Summen, wie es bei Termen schon verwendet wird, oder ein Suffix), findet die Regex nichts und das Kopieren bricht **still** ab (`if (!match?.[1]) return;`). Die Logik ist zudem nicht testbar, weil sie in der Komponente steckt (aus dem Spike übernommen).
- **Empfehlung:** `PostResponse` um `dice.sum: number` erweitern, `roll` gibt `{ ok: true; posted: false; text; sum }` zurück, `DiceSheet` kopiert `String(sum)`. Regex entfernen.
- **Abnahmekriterium:** In `DiceSheet.tsx` gibt es keine Regex auf den Ergebnistext mehr; die kopierte Zahl stammt aus `dice.sum` der API-Antwort; Wurf mit negativem Gesamtergebnis (z. B. `1d2-99`) kopiert den korrekten negativen Wert.
- **Umsetzung (2026-09-23):** `PostResponse.dice.sum` durchgereicht; `copyResult` nutzt `String(result.sum)`. Gemeinsam mit CR-005. Commit `f5389d7`. Browser: `1d2-99` → Anzeige `= -97`; kein Regex mehr in `DiceSheet.tsx`. Features.md: N/A.

## CR-003 – Wurf-Fehler doppelt angezeigt, immer Voll-Reload

- **Fundstelle:** `src/components/chat/use-chat-stream.ts`, `roll` (Fehlerzweig `failAndReload`), `ChatView.tsx` Z. 119 (`.chat-error`)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug:** T-002, T-003 (W6)
- **Beschreibung:** Bei einem API-Fehler setzt `roll` über `failAndReload` zusätzlich `stream.error` (Banner im Chat hinter dem Sheet) und lädt den Chat neu; das Sheet zeigt denselben Text über den Knöpfen. Nach dem Schließen bleibt das Banner stehen, obwohl der Fehler schon im Sheet quittiert wurde. Außerdem führt jeder Fehler (auch 400 wegen Validierung) zu einem kompletten Reload. Die Task verlangt ausdrücklich „bei API-Fehler bleibt `failAndReload` bestehen“ — das Finding betrifft also eher die Plan-Entscheidung als die Umsetzung.
- **Entscheidung (Owner, 2026-09-23, Plan-Review):** Fehler nur im Sheet, Reload gezielt. Das ersetzt für `roll` die Vorgabe „`failAndReload` bleibt bestehen“ aus Plan 008 T-002.
- **Empfehlung:** `ApiFetchResult` (`src/lib/client/api-fetch.ts`) bekommt im Fehlerzweig ein optionales `status?: number` (gesetzt bei HTTP-Fehlern, fehlt bei Netzwerkfehlern; bestehende Aufrufer bleiben kompatibel). `roll` in `use-chat-stream.ts` ruft im Fehlerfall **nicht** mehr `setError`/`failAndReload` auf, sondern gibt nur `{ ok: false, error }` zurück. Neu geladen wird (`reload()`) nur bei HTTP-Status ≥ 401 außer 400, also wenn Kanal/Thread/Rechte sich geändert haben können; bei 400 und Netzwerkfehler kein Reload. `sendText` und andere Aufrufer bleiben unverändert.
- **Abnahmekriterium:** (a) Wurf bei gestopptem Server: Meldung „Keine Verbindung zum Server.“ nur im Sheet, nach „Abbrechen“ kein `.chat-error`-Banner, kein Reload-Request. (b) Wurf auf einen inzwischen gelöschten Kanal (404): Meldung im Sheet und ein Reload des Chats (Netzwerk-Tab zeigt `GET …/chat`). (c) `npm run typecheck` grün.
- **Umsetzung (2026-09-23):** `apiFetch`-Fehlerzweig liefert `status` (HTTP) bzw. `status: 0` (Netzwerk, analog `api.ts` — statt optionalem `status?`, damit Aufrufer mit Pflicht-`status` typisieren können). `roll` setzt kein `stream.error` mehr und ruft `reload()` nur bei `status >= 401`. Commit `ba33d16`. Browser (a): Offline → Alert nur im Sheet, nach Abbrechen kein `.chat-error`. (b) Code-Pfad `status >= 401` (404 inklusive); manuell nicht gegen gelöschten Kanal geprüft. Features.md: N/A.

## CR-004 – „Im Chat posten“: Fehler unsichtbar, Doppelklick mit veraltetem Wert

- **Fundstelle:** `src/components/chat/DiceSheet.tsx` Z. 227–234; `use-chat-stream.ts`, `setPostToChat` (Z. 125–135); `ChatView.tsx` Z. 178
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug:** T-003
- **Beschreibung:** Der Schalter ruft `onPostToChat(!postToChat)`; der Wert ändert sich erst nach der PATCH-Antwort. Zwei schnelle Klicks senden zweimal denselben Zielwert. Schlägt der PATCH fehl, landet der Fehler nur in `stream.error` hinter dem offenen Sheet — im Sheet sieht der Nutzer nichts und würfelt ggf. mit einer anderen Einstellung als gedacht (der Server liest die Einstellung aus der DB).
- **Entscheidung (Owner, 2026-09-23, Plan-Review):** Optimistisch umschalten, bei Fehler zurücksetzen.
- **Empfehlung:** `setPostToChat(next)` in `use-chat-stream.ts` setzt `state.dicePostToChat` sofort auf `next`, sendet dann den PATCH und gibt `{ ok: true } | { ok: false; error: string }` zurück (kein `setError` mehr für diesen Pfad). Bei Fehler wird auf den Wert **vor diesem Klick** zurückgesetzt, aber nur, wenn seither kein neuerer Klick kam (Request-Zähler/Ref); die Server-Antwort überschreibt den State nicht. `DiceSheet` zeigt den Fehler im bestehenden `role="alert"`-Bereich über den Knöpfen. „Würfeln“ wartet auf einen noch laufenden PATCH (Promise im Ref), bevor der Wurf gesendet wird, weil der Server die Einstellung aus der DB liest.
- **Abnahmekriterium:** (a) Klick schaltet sofort sichtbar um. (b) Schneller Doppelklick endet im Ausgangszustand, Server-Wert (`GET …/chat`, `dicePostToChat`) stimmt damit überein. (c) PATCH schlägt fehl (Server gestoppt): Schalter springt zurück, Meldung im Sheet, kein `.chat-error`-Banner. (d) Umschalten und sofort „Würfeln“: Der Wurf folgt der neuen Einstellung.
- **Umsetzung (2026-09-23):** Optimistisches `setPostToChat` mit Seq-Ref-Rollback; Fehler nur im Sheet; `roll` wartet auf pending PATCH. Commit `f48823e`. Browser (a)/(b): Sofort-Umschalten und Doppelklick sichtbar ok. (c) Localhost-Offline greift nicht zuverlässig; Rollback-Pfad im Code. (d) `await postToChatPendingRef` vor dem Wurf. Features.md: N/A.

## CR-005 – Roll-Typen doppelt gepflegt

- **Fundstelle:** `src/components/chat/use-chat-stream.ts` `roll` (Z. 88–95, Inline-Ein- und Ausgabetyp); `src/components/chat/DiceSheet.tsx` `RollResult` und `Props.onRoll` (Z. 18–26)
- **Kategorie:** Duplizierung & Modularisierung
- **Schweregrad:** niedrig
- **Bezug:** T-002, T-003
- **Beschreibung:** Die Union `{ ok: true; posted: true } | { ok: true; posted: false; text } | { ok: false; error }` und der Eingabetyp `{ terms: { n; m }[]; modifier }` stehen zweimal; `dice-draft.ts` hat mit `toRollPayload` bereits einen dritten, strukturgleichen Rückgabetyp. Änderungen (z. B. CR-002: `sum`) müssen an mehreren Stellen nachgezogen werden.
- **Empfehlung:** `RollPayload` (Rückgabetyp von `toRollPayload`, basierend auf `StructuredDiceTerm`) und `RollResult` (inkl. `sum` aus CR-002) in `src/lib/chat/dice-draft.ts` definieren und in `use-chat-stream.ts` und `DiceSheet.tsx` importieren. Zusammen mit CR-002 umsetzen.
- **Abnahmekriterium:** Die Roll-Ergebnis-Union und der Payload-Typ sind je genau einmal definiert; `use-chat-stream.ts` und `DiceSheet.tsx` importieren sie; `npm run typecheck` grün.
- **Umsetzung (2026-09-23):** `RollPayload` und `RollResult` (inkl. `sum`) in `dice-draft.ts`; Importe in Stream und Sheet. Commit `f5389d7`. Features.md: N/A.

## CR-006 – `allowNegative` steuert nur die Tastatur

- **Fundstelle:** `src/components/chat/DiceSheet.tsx`, `NumberStepper` (Z. 47, 62, 79–80)
- **Kategorie:** Lesbarkeit & Wartbarkeit
- **Schweregrad:** niedrig
- **Bezug:** T-003 (N1)
- **Beschreibung:** Der Name suggeriert, dass negative Eingaben sonst abgelehnt werden. Tatsächlich wird nur `inputMode` umgeschaltet; `parseDraftInt` akzeptiert immer ein Minus, und „-3“ in „Anzahl“ wird erst durch `setTermCount` auf 1 geklemmt (während das Feld bis zum Verlassen weiter „-3“ zeigt).
- **Entscheidung (Owner, 2026-09-23, Plan-Review):** Minus im Anzahl-Feld ablehnen.
- **Empfehlung:** Signatur `parseDraftInt(text: string, options?: { allowNegative?: boolean }): number | null`, Standard `allowNegative: false`. Ohne Freigabe liefert ein führendes Minus (ASCII oder U+2212) `null`, also ungültig wie bei leerer Eingabe (N1: Feld springt beim Verlassen auf den letzten Wert zurück). `NumberStepper` reicht seine Prop `allowNegative` an `parseDraftInt` weiter; der Bonus-Stepper setzt sie wie bisher.
- **Abnahmekriterium:** (a) `dice-draft.test.ts`: `parseDraftInt("-3")` → `null`, `parseDraftInt("−3")` → `null`, `parseDraftInt("-3", { allowNegative: true })` → `-3`; bestehende Fälle mit Minus laufen mit `{ allowNegative: true }`. (b) Im Browser: „-3“ im Anzahl-Feld ändert die Vorschau nicht, beim Verlassen steht wieder der alte Wert. (c) Bonus „-4“ funktioniert unverändert.
- **Umsetzung (2026-09-23):** `parseDraftInt` mit `allowNegative` (Default false); NumberStepper reicht die Prop durch. Tests angepasst. Commit `a987a50`. Features.md: N/A.

## CR-007 – `keepSelection` nach Tastatur-Fokus

- **Fundstelle:** `src/components/chat/DiceSheet.tsx`, `NumberStepper` `onFocus` / `onMouseUp` (Z. 67–76)
- **Kategorie:** Runtime-Risiken (UI-Zustand)
- **Schweregrad:** niedrig
- **Bezug:** T-003 (N1)
- **Beschreibung:** `keepSelection` wird bei jedem Fokus gesetzt, aber nur bei `mouseup` zurückgesetzt. Kommt der Fokus per Tab, bleibt das Flag stehen; der nächste Klick ins bereits fokussierte Feld (um den Cursor zu setzen) wird per `preventDefault` geschluckt.
- **Empfehlung:** Flag in `onBlur` zurücksetzen und/oder nur bei Maus-Fokus setzen (z. B. in `onMouseDown`, wenn das Feld noch nicht fokussiert ist).
- **Abnahmekriterium:** Per Tab ins Anzahl-Feld, dann einmal in die Zahl klicken: Der Cursor steht an der Klickposition (Auswahl aufgehoben). Klick ins unfokussierte Feld markiert weiterhin die ganze Zahl.
- **Umsetzung (2026-09-23):** `keepSelection` nur noch bei Maus-Fokus (`onMouseDown` wenn noch nicht fokussiert); Reset in `onBlur`. Commit `065dc1e`. Features.md: N/A.

## CR-008 – Index als Key bei entfernbaren Termen

- **Fundstelle:** `src/components/chat/DiceSheet.tsx` Z. 152 (`key={\`term-${index}\`}`)
- **Kategorie:** Runtime-Risiken
- **Schweregrad:** niedrig
- **Bezug:** T-003
- **Beschreibung:** Terme können in der Mitte entfernt werden. Mit Index-Keys wandert der lokale State des `NumberStepper` (`text` während der Eingabe) zur nächsten Zeile. Praktisch selten (Entfernen verlässt meist den Fokus), aber das Muster ist fehleranfällig, sobald Terme mehr lokalen State bekommen.
- **Empfehlung:** Terme im Draft mit stabiler ID führen (z. B. Zähler in `addTerm`) oder die ID nur im Sheet halten; ID nicht in `toRollPayload` übernehmen.
- **Abnahmekriterium:** Keys der Term-Zeilen sind unabhängig vom Index; `toRollPayload` liefert weiterhin nur `{ n, m }`; Test in `dice-draft.test.ts` weiterhin grün.
- **Status: verworfen (Owner, 2026-09-23, Plan-Review).** Kein beobachtbarer Fehler: Der einzige Zeilen-Zustand (`text` in `NumberStepper`) ist nur während des Fokus gesetzt, und „Entfernen“ nimmt dem Feld vorher den Fokus (`onBlur` → `text = null`). Der Rest (`keepSelection`) wird durch CR-007 behoben. Wieder aufnehmen, falls Term-Zeilen eigenen Zustand bekommen, der den Fokus überdauert.

## CR-009 – Kopieren schlägt still fehl

- **Fundstelle:** `src/components/chat/DiceSheet.tsx`, `copyResult` (Z. 112–122)
- **Kategorie:** Fehlerbehandlung & Validierung
- **Schweregrad:** niedrig
- **Bezug:** T-003
- **Beschreibung:** Verweigerte Zwischenablage (unsicherer Kontext, Berechtigung) und nicht gefundene Summe enden in einem leeren `catch` bzw. `return` ohne Rückmeldung. Der Nutzer tippt und nichts passiert. (Verhalten wie im Spike.)
- **Empfehlung:** Im Fehlerfall zeigt das Ergebnisfeld 1,2 s lang „Kopieren nicht möglich“ (gleicher Timer und gleiche Darstellung wie „Kopiert“, ohne Akzentrahmen). Nach CR-002 entfällt der Fall „Summe nicht gefunden“.
- **Abnahmekriterium:** Bei abgelehntem `navigator.clipboard.writeText` zeigt das Ergebnisfeld kurz einen Hinweis statt nichts.

## CR-010 – Hartkodierte Farbe in `.dice-result.copied`

- **Fundstelle:** `src/app/globals.css`, `.dice-result.copied` (`background: #1f1a0e`)
- **Kategorie:** Bad Practices
- **Schweregrad:** niedrig
- **Bezug:** T-003 (W3)
- **Beschreibung:** W3 verlangt App-Variablen. Die Farbe steht bereits zweimal an anderen Stellen in `globals.css` hartkodiert; jetzt ein drittes Mal.
- **Empfehlung:** Variable `--accent-soft: #1f1a0e;` in `:root` von `globals.css` definieren und an allen drei Stellen `var(--accent-soft)` verwenden.
- **Abnahmekriterium:** `grep -n "#1f1a0e" src/app/globals.css` findet nur noch die Variablendefinition.

---

## Aufgaben-Abgleich (ohne Finding)

- T-001: `roadmap.md` listet 008, Plan 003 verweist darauf — erfüllt.
- T-002: `roll` nimmt mehrere Terme, `modifier` nur ≠ 0, strukturierte Rückgabe, kein Toast; `setNotice` für `/roll` unverändert — erfüllt.
- T-003: Aufbau, Texte, Grenzen, 6-Term-Limit, Verhalten nach Wurf, Zurücksetzen durch bedingtes Rendern, Draft-Logik als reine Funktionen — erfüllt; kein Scope Creep außer dem dokumentierten Nachtrag N1.
- T-004: `dice-draft.test.ts` deckt alle geforderten Fälle plus `parseDraftInt` ab; API-Fall mit drei Termen und Bonus prüft Antwort und DB — erfüllt. Nicht getestet: Summen-Extraktion zum Kopieren (siehe CR-002, dort wird sie überflüssig).

## Umsetzung (Rahmen für `/plan-run`, Owner 2026-09-23, Plan-Review)

- **Erledigt-Markierung:** Status in der Tracking-Tabelle auf `behoben` setzen und beim Finding eine Zeile `- **Umsetzung (Datum):** …` mit Commit-Hash und Prüfnachweis ergänzen. Keine zusätzlichen Checkboxen. Verworfene Findings (CR-008) werden nicht bearbeitet.
- **Commits:** ein Commit pro Finding, Nachricht `CR-00X (Review 008): <Kurzbeschreibung>.` CR-002 und CR-005 dürfen gemeinsam committet werden (`CR-002/CR-005 (Review 008): …`). Kein Push ohne ausdrückliche Freigabe.
- **Vor jedem Commit grün:** `npm test`, `npm run lint`, `npm run typecheck` (`.ai/conventions.md`).
- **Browser-Prüfung** (Browser-Pane, 375 px und Desktop) für CR-001, CR-003, CR-004, CR-006, CR-007 und CR-009 gemäß dem jeweiligen Abnahmekriterium; Ergebnis im Umsetzungsvermerk festhalten.
- **Reihenfolge und Abhängigkeiten:** CR-005 mit CR-002; CR-009 nach CR-002; CR-004 nach CR-003 (beide ändern die Fehleranzeige im Sheet und `use-chat-stream.ts`). Sonst die Prioritäten unten.
- **Features-Katalog:** keine neue Funktion; `.ai/features.md` bleibt unverändert (N/A im Vermerk).
- **Abschluss:** danach `/review-check` für dieses Dokument.

## Prioritäten

1. **CR-001** – echter Fehlzustand bei W6-Ablauf, kleine Änderung.
2. **CR-002** (zusammen mit **CR-005**) – `sum` aus der API durchreichen und Typen zentralisieren.
3. **CR-004**, **CR-003** – Rückmeldungen im Sheet vereinheitlichen.
4. **CR-007**, **CR-006** – Stepper-Feinschliff (CR-008 verworfen).
5. **CR-009**, **CR-010** – Kosmetik.
