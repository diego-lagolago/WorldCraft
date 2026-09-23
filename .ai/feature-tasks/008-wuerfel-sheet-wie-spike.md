# 008 – Würfel-Sheet wie im Chat-Spike

## Kontext & Ziel

Beim Ausbau des Chats in Plan `003` wurde das Würfel-Sheet vereinfacht nachgebaut. Der Projektinhaber hat am 2026-09-23 den ursprünglichen Chat-Spike (Plan `001` T-010) erneut ausprobiert und bestätigt: **Der Würfel im Spike ist genau richtig so.** Die App soll sich beim Würfeln genauso verhalten.

**Unterschiede heute (App → Spike):**

| Punkt | App (`src/components/chat/ComposerBar.tsx`, `DiceSheet`) | Spike (Referenz) |
|---|---|---|
| Würfel pro Wurf | genau ein Term (Anzahl × Seiten) | bis zu 6 Terme: „Würfel“, „Plus-Würfel 2“ … mit „Weiteren Würfel“ und „Entfernen“ |
| Bedienung pro Term | Seitenwahl oben, ein Anzahl-Stepper | pro Term: Anzahl-Stepper und eigene Seitenwahl d2–d100 |
| Standard | 1d20, neuer Term entfällt | 1d20; neuer Term startet mit 1d4 |
| Grenzen im Formular | Anzahl 1–100, Modifikator −999…999 | Anzahl 1–20, Bonus −99…99 |
| Bezeichnung | „Modifikator“ | „Bonus“, darunter Vorschau (z. B. `1d20+1d4+2`) |
| Knöpfe | „`<Vorschau>` würfeln“, darunter „Das Ergebnis entsteht auf dem Server.“ | „Abbrechen“ und „Würfeln“ |
| Nicht im Chat posten | Sheet schließt, Ergebnis als Toast | Sheet bleibt offen, Ergebnis im **Ergebnisfeld** neben dem Bonus; Tippen darauf kopiert die Summe, Feld zeigt kurz „Kopiert“ |
| Im Chat posten | Sheet schließt | Sheet schließt nach erfolgreichem Wurf |
| Öffnen | Sheet wird bei jedem Öffnen neu gemountet (`diceOpen && state ? <DiceSheet/> : null` in `ChatView.tsx`), startet also schon mit 1d20/Bonus 0 | gleich: Standard (1d20, Bonus 0) und leeres Ergebnisfeld |

**Nicht Ziel dieses Plans:**

- Darstellung des Wurfs im Chatverlauf (`DiceBubble` in `MessageList.tsx`) bleibt unverändert (Entscheidung Projektinhaber 2026-09-23).
- Server-Würfeln, API und Datenmodell (`APP-DICE-SERVER`, `dice_terms`) bleiben unverändert; die API nimmt schon heute bis zu `MAX_DICE_TERMS` Terme an.
- `/roll`-Pfad, Composer-Leiste und Thread-Sheet.

## Entscheidungen (Projektinhaber, 2026-09-23)

| # | Frage | Entscheidung |
|---|---|---|
| W1 | Referenz für den Würfel | Chat-Spike, Stand Commit `b5d28e8`, „genau richtig so“. |
| W2 | Auch die Wurfzeile im Chat wie im Spike? | **Nein**, nur das Würfel-Sheet. Die Chat-Zeile bleibt wie in der App. |
| W3 | Farben/Abstände | Werden an das App-Design (`src/app/globals.css`, Variablen) angepasst; Aufbau, Reihenfolge, Texte und Verhalten folgen dem Spike. |
| W4 | Wie wird das Würfel-Sheet automatisch getestet? (Plan-Review 2026-09-23) | Kein React-Komponententest (keine Testing Library im Projekt). Die Draft-Logik liegt als reine Funktionen in `src/lib/chat/dice-draft.ts` und wird mit `dice-draft.test.ts` (Vitest, `environment: node`) getestet; das Sheet ruft nur diese Funktionen auf. |
| W5 | API-Test für Würfe mit mehreren Termen (Plan-Review 2026-09-23) | Neuer Fall in `chat.api.test.ts`; `npm run test:rechte` (mit laufendem Dev-Server) ist Teil der Abnahme von T-004. |
| W6 | Fehler und laufender Wurf im Sheet (Plan-Review 2026-09-23) | Fehler erscheint im Sheet über den Knöpfen, Sheet bleibt offen, Eingaben bleiben. „Abbrechen“ bleibt während des Wurfs aktiv (wie Spike); Schließen verwirft nur die Anzeige, der Server-Wurf (ggf. im Chat gepostet) bleibt. |
| W7 | Zurücksetzen beim Öffnen (Plan-Review 2026-09-23) | Ist-Verhalten (bedingtes Rendern) ist bereits korrekt und bleibt; kein Umbau in `ChatView.tsx` nötig. |
| W8 | Manuelle Abnahme (Plan-Review 2026-09-23) | Agent vergleicht die App im Browser-Pane mit der Spike-Quelle (`git show b5d28e8:…`), kein paralleler Spike-Start. Den Smoketest-Punkt macht der Owner; T-004 ist erst nach dessen OK erledigt. |
| W9 | Smoketest und Spikes (Plan-Review 2026-09-23) | Eigener Smoketest WS.1–WS.6 in diesem Plan, `smoketest.md` bleibt unverändert. Spikes (inkl. `spikes/ui-prototype/`) werden **nicht** angepasst; sie sollen mittelfristig gelöscht werden, sobald ihre Funktionalität in der App nachgebaut ist. Beim Würfel-Sheet hat der Chat-Spike Vorrang vor `ui-prototype`. |
| N1 | Nachtrag nach Smoketest (Projektinhaber, 2026-09-23): Anzahl und Bonus direkt eingeben? | **Ja, Inline-Eingabe** zwischen − und +. Beim Hineinklicken wird die ganze Zahl markiert (wie Strg+A), Tippen ersetzt sie. Gültige Eingaben wirken sofort (Vorschau), die Grenzen 1–20 bzw. −99…99 bleiben; ungültige oder leere Eingabe springt beim Verlassen auf den letzten Wert zurück. Enter übernimmt. Umsetzung: `NumberStepper` in `DiceSheet.tsx`, `parseDraftInt` in `dice-draft.ts`. Beim Bonus bleibt die normale Tastatur, weil die iOS-Zifferntastatur kein Minus hat. |

## Begriffe & Systeme

- **Chat-Spike**: Wegwerf-Prototyp aus Plan `001` T-010, in Commit `378ffd8` entfernt. Referenzdateien, abrufbar mit `git show b5d28e8:<pfad>`:
  - `src/spike/chat/ChatSpikePage.tsx` (Würfel-Sheet: Zeilen mit `sheet === "dice"`, `sendRoll`, `copyPrivateRoll`, `clampCount`, `clampModifier`, `DEFAULT_DRAFT`)
  - `src/spike/chat/chat.css` (Klassen `spike-chat-term`, `spike-chat-stepper`, `spike-chat-sides`, `spike-chat-bonus-row`, `spike-chat-dice-result`, `spike-chat-switch`)
  - `src/spike/chat/dice-sides.ts`
- **Würfel-Sheet**: Bottom-Sheet zum Zusammenstellen und Auslösen eines Wurfs, heute `DiceSheet` in `src/components/chat/ComposerBar.tsx`.
- **Term**: Ein Würfelblock `n` × d`m` (n = Anzahl, m = Seiten aus `ALLOWED_SIDES` in `src/lib/chat/dice-format.ts`). Höchstens `MAX_DICE_TERMS` (6) Terme pro Wurf.
- **Bonus**: Ganzzahliger Modifikator −99…99, wird als `modifier` gesendet (entfällt bei 0).
- **Ergebnisfeld**: Feld neben dem Bonus im Sheet. Leer: „—“. Nach einem nicht geposteten Wurf: formatierter Wurf (`dice.text` aus der API-Antwort). Antippen/Enter/Leertaste kopiert nur die Summe (Zahl nach dem letzten `=`) und zeigt 1,2 s lang „Kopiert“.
- **Im Chat posten**: Bestehende, pro Benutzer gespeicherte Einstellung `dicePostToChat` (`/api/worlds/[worldId]/chat/settings`).

## Relevante Normen

- `.ai/architecture/datenmodell.md` — 3.17 Chat (`dice_*`-Spalten), 5 Regeln (`APP-DICE-SERVER`).
- `.ai/feature-tasks/001-mvp-infrastruktur.md` — T-010 (Spike Chat mit Würfeln, UI-Änderung 2026-09-22).
- `.ai/standards/mobile-first.md` (Touch-Ziele ≥ 44 px, 375 px ohne horizontales Scrollen).
- `.ai/conventions.md` — UI Deutsch, Code Englisch; `npm run lint` vor jedem Commit.
- `.ai/roadmap.md` — Arbeitsweise (Commit pro Task, nie automatisch pushen).

## Globale Abhängigkeiten

- Plan `003` abgeschlossen (Chat, Würfel-API).
- Keine Abhängigkeit zu Plan `004`–`007`. Berührt dieselben Dateien wie Plan `007` (`ComposerBar.tsx`, `use-chat-stream.ts`, `globals.css`); bei paralleler Umsetzung Konflikte beim Mergen beachten.

## Aufgaben

### T-001: Normen und Roadmap nachziehen
- [x] Beschreibung: W1–W3 in `.ai/feature-tasks/003-mvp-funktionen.md` (Hinweis beim Chat-Task, dass das Würfel-Sheet durch Plan `008` an den Spike angeglichen wird) und `roadmap.md` (Plan `008` eintragen) festhalten. Die Spike-Referenz (`git show b5d28e8:…`) im Plan belassen, keine Spike-Dateien zurück ins Repo holen. Kein Spike anpassen, auch nicht `spikes/ui-prototype/` (W9): Beim Würfel-Sheet hat der Chat-Spike Vorrang vor der Design-Referenz `ui-prototype`; das in der Notiz in Plan `003` vermerken.
- Abhängigkeiten: keine
- Abnahmekriterium: `roadmap.md` listet `008`; Plan `003` verweist auf `008`.

### T-002: Client-Roll mit mehreren Termen
- [x] Beschreibung: `roll` in `src/components/chat/use-chat-stream.ts` nimmt `{ terms: { n; m }[]; modifier: number }` statt eines einzelnen Terms und sendet `modifier` nur, wenn ≠ 0. Rückgabe unterscheidet (W6): `{ ok: true; posted: true }` bzw. `{ ok: true; posted: false; text: string }` bzw. `{ ok: false; error: string }` (auch wenn kein Kanal geladen ist; bei API-Fehler bleibt `failAndReload` bestehen), statt das Ergebnis als Toast (`setNotice`) anzuzeigen. Andere Aufrufer von `setNotice` bleiben unverändert.
- Abhängigkeiten: keine
- Abnahmekriterium: Wurf `1d20+1d4+2` mit „Im Chat posten“ an erscheint im Chat mit zwei Würfel-Termen und Bonus; ohne Posten liefert `roll` den Text zurück und es erscheint **kein** Toast; `npm run lint` grün.

### T-003: Würfel-Sheet nach Spike umbauen
- [x] Beschreibung: `DiceSheet` in `ComposerBar.tsx` (bei Bedarf eigene Datei `DiceSheet.tsx`) nach Referenz umbauen: Term-Liste mit Kopf („Würfel“ / „Plus-Würfel N“, „Entfernen“ ab Term 2), Anzahl-Stepper 1–20, Seitenwahl d2–d100 pro Term (`aria-pressed`); „Weiteren Würfel“ (neuer Term 1d4) bis 6 Terme; Bonus-Stepper −99…99 mit Vorschau (`formatStructuredPreview`); Ergebnisfeld nach *Begriffe*; Schalter „Im Chat posten“; Knöpfe „Abbrechen“ und „Würfeln“ (während des Wurfs deaktiviert). Beim Öffnen immer Standard (1d20, Bonus 0, leeres Ergebnis) — das ist heute schon so und bleibt so (W7): bedingtes Rendern in `ChatView.tsx` beibehalten, Draft-, Ergebnis- und Fehler-State lokal in `DiceSheet`, kein zusätzlicher `key`-Zähler. `reload` in `use-chat-stream.ts` setzt `state` nie auf `null`, das Sheet bleibt bei Fehlern (W6) also offen. Verhalten nach Wurf: gepostet → Sheet schließt; nicht gepostet → Sheet bleibt offen und zeigt das Ergebnis; Fehler (W6) → Sheet bleibt offen, Fehlertext über den Knöpfen (`role="alert"`), Eingaben und Ergebnisfeld bleiben erhalten, erneutes Würfeln möglich. „Abbrechen“ und Hintergrund-Tippen schließen auch während eines laufenden Wurfs; das Ergebnis wird dann verworfen. Hinweis „Das Ergebnis entsteht auf dem Server.“ entfällt. CSS in `globals.css` mit App-Variablen (W3). Die Draft-Logik (W4) liegt in `src/lib/chat/dice-draft.ts` als reine Funktionen: `DEFAULT_DICE_DRAFT` (1d20, Bonus 0), `addTerm` (hängt 1d4 an, ab 6 Termen unverändert), `removeTerm` (Term 1 nicht entfernbar), `setTermCount` (1–20), `setTermSides`, `setModifier` (−99…99) und `toRollPayload` (`{ terms, modifier }`; `modifier` 0 bleibt 0, T-002 lässt ihn beim Senden weg). `DiceSheet` hält nur den Draft-State und ruft diese Funktionen auf.
- Abhängigkeiten: T-002
- Abnahmekriterium: Agent prüft die laufende App im Browser-Pane (375 px und Desktop) gegen die Spike-Quelle `git show b5d28e8:src/spike/chat/ChatSpikePage.tsx` (Abschnitt `sheet === "dice"`), **ohne** den Spike selbst zu starten (W8): gleiche Bedienelemente in gleicher Reihenfolge und mit gleichen Texten, gleiche Grenzen (Anzahl 20 → „+“ ohne Wirkung; Bonus −99/99); siebter Term nicht möglich; nicht geposteter Wurf bleibt im Sheet sichtbar, Antippen des Ergebnisfelds legt nur die Summe in die Zwischenablage und zeigt „Kopiert“; nach Schließen und erneutem Öffnen steht wieder 1d20/Bonus 0; mobil (375 px) ohne horizontales Scrollen, Touch-Ziele ≥ 44 px; `npm run lint` grün.

### T-004: Tests und Smoketest
- [x] Beschreibung: Unit-Test `src/lib/chat/dice-draft.test.ts` für die Draft-Logik aus T-003 (W4): Term hinzufügen/entfernen (neuer Term 1d4, siebter Term nicht möglich, Term 1 nicht entfernbar), Grenzen (Anzahl 1–20, Bonus −99…99), `toRollPayload`. Kein React-Komponententest. `src/app/api/worlds/[worldId]/chat/chat.api.test.ts` um einen Fall ergänzen (bisher nur Würfe mit einem Term): `kind: "roll"` mit drei Termen und Bonus, erwartet werden drei gespeicherte Würfel-Terme plus Bonus-Term in `dice_terms` und der Bonus in `dice.text`. Die Datei läuft nicht mit `npm test`, sondern mit `npm run test:rechte` (Dev-Server mit `.env` muss laufen, W5); Smoketest WS.1–WS.6 (Abschnitt *Smoketest Plan 008* unten) wird vom Owner durchlaufen und das Ergebnis dort eingetragen. `.ai/infrastructure/smoketest.md` bleibt unverändert (N.6 ist ein historisches Ergebnis) (W9).
- Abhängigkeiten: T-003
- Abnahmekriterium: Neue Tests grün; `npm run test:rechte` bei laufendem Dev-Server grün; WS.1–WS.6 vom **Owner** lokal durchlaufen und im Abschnitt *Smoketest Plan 008* mit Datum als bestanden eingetragen (W8, T-004 erst danach abhaken); `npm test`, `npm run lint`, `npm run build` grün.
- Umsetzungsvermerk (2026-09-23): WS.1–WS.6 vom Owner bestanden; `npm test` und `npm run test:rechte` (17 Dateien, 139 Tests) grün, `lint` und `build` grün. Nachtrag N1 (Inline-Eingabe) umgesetzt, WS.7 im Browser geprüft.

## Smoketest Plan 008

Lokal, mobil (375 px) und Desktop; vom Owner durchzuführen (W8, W9). Ergebnis und Datum hier eintragen.

| # | Kriterium | Ergebnis | Beobachtung |
|---|---|---|---|
| WS.1 | Sheet zeigt „Würfel“ mit Anzahl-Stepper und d2–d100; „Weiteren Würfel“ fügt „Plus-Würfel 2“ … mit 1d4 hinzu; bei 6 Termen verschwindet „Weiteren Würfel“; „Entfernen“ ab Term 2 | **bestanden** | Owner 2026-09-23. |
| WS.2 | Grenzen: Anzahl 1–20 („+“ bei 20 ohne Wirkung), Bonus −99…99; Vorschau unter dem Bonus (z. B. `1d20+1d4+2`) stimmt | **bestanden** | Owner 2026-09-23. |
| WS.3 | „Im Chat posten“ aus: Sheet bleibt offen, Ergebnisfeld zeigt den Wurf, kein Toast; Antippen kopiert nur die Summe und zeigt kurz „Kopiert“ | **bestanden** | Owner 2026-09-23. |
| WS.4 | „Im Chat posten“ an: Wurf mit mehreren Termen und Bonus erscheint im Chat, Sheet schließt | **bestanden** | Owner 2026-09-23. |
| WS.5 | Schließen und erneut öffnen: wieder 1d20, Bonus 0, Ergebnisfeld „—“ | **bestanden** | Owner 2026-09-23. |
| WS.6 | 375 px: kein horizontales Scrollen, Touch-Ziele ≥ 44 px; Fehlerfall (z. B. Server gestoppt) zeigt Meldung im Sheet, Sheet bleibt offen | **bestanden** | Owner 2026-09-23. |
| WS.7 | **Inline-Eingabe** (Nachtrag N1): Klick in Anzahl oder Bonus markiert die ganze Zahl; Tippen ersetzt sie; Vorschau läuft mit; Enter übernimmt; zu große Werte werden begrenzt (z. B. Anzahl 50 → 20); leeres Feld springt beim Verlassen auf den alten Wert | **bestanden** | Claude im Browser 2026-09-23 (Test-GM): `1` → `3`, `0` → `-4`, Vorschau `3d20-4`; `50` → `20`; leer → alter Wert. |
