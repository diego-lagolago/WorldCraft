# Smoketest T-014 — Produktion `worldcraft.lagolago.at`

**Datum:** 2026-09-22  
**Umgebung:** Produktion (kein separates Staging; Abweichung Projektinhaber).  
**Basis-URL:** `https://worldcraft.lagolago.at`  
**Lokal (Test-Login / T-011-Skript):** `http://localhost:3000` mit `ENABLE_TEST_LOGIN=true`

## Abweichung vom Plantext (verbindlich)

| Plan-Annahme | Ist |
|---|---|
| Eigene Staging-Umgebung + `ENABLE_TEST_LOGIN=true` dort | Entfällt. Domain ist Produktion: `APP_ENV=production`, **kein** `ENABLE_TEST_LOGIN` in Coolify. |
| Alle Kriterien von T-008–T-011 gegen Staging mit Test-Login | HTTPS / Discord / Karte / Chat gegen **Prod**. Test-Login und Rechte-Skript **nur lokal**. |
| Zwei Browser mit Test-Login für Realtime | Auf Prod nur mit **zwei Discord-Konten** möglich. |

Produktion liefert `POST /api/test-login` → **404** (geprüft 2026-09-22). `testLoginEnabled: false` auf der Startseite.

## Gesamtstatus

**T-014: bestanden** (Owner-Bestätigung 2026-09-22: Smoketest insgesamt erfolgreich). Offene Chat-/Karten-UX-Bugs sind **kein Blocker** — sie werden iterativ / im Backlog nachgezogen (u. a. Karten-Zoom in `.ai/backlog.md`; Composer-/Markdown- und weitere Map-UX falls noch offen, ohne neue Spec zu erfinden).

| Block | Status |
|---|---|
| T-008 Discord (Prod) | bestanden (Owner) |
| T-008 Test-Login | bestanden **lokal**; N/A auf Prod |
| T-009 Karte (Prod) | bestanden für Smoketest-Zwecke (Owner); UX-Nacharbeit iterativ |
| T-010 Chat (Prod) | bestanden für Smoketest-Zwecke (Owner); UX-Nacharbeit iterativ |
| T-011 Rechte-Skript | bestanden **lokal** (15/15); N/A auf Prod |

---

## T-008 Discord-Login & Test-Login

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| 8.1 | „Mit Discord anmelden“ → Freigabe → Anzeigename/Avatar | Prod | **bestanden** | Owner 2026-09-22: Discord-Login auf Live OK. |
| 8.2 | Zweiter Login derselbe Discord-User → kein zweiter DB-User | Prod | **bestanden** | Owner-Smoketest 2026-09-22. |
| 8.3 | Abmelden beendet Sitzung | Prod | **bestanden** | Owner-Smoketest 2026-09-22. |
| 8.4 | Test-Login: vier Seeds anmelden, Session per curl | Lokal | **bestanden** | Rechte-Skript meldet alle vier Seeds an. |
| 8.5 | Ohne `ENABLE_TEST_LOGIN` → Test-Login nicht erreichbar (404) | Prod | **bestanden** | `POST …/api/test-login` → **404**. |
| 8.6 | `ENABLE_TEST_LOGIN=true` + `APP_ENV=production` → App startet nicht | Prod-Config | **bestanden (by design)** | In Coolify nicht gesetzt; Guard in `src/lib/env.ts`. |

---

## T-009 Karten-Spike

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| 9.* | Upload, Pins, Marker, Realtime nach Drop, Deep-Link, Touch | Prod | **bestanden** (Owner-Smoketest) | Feinschliff (Zoom u. a.) iterativ — siehe `.ai/backlog.md`. |

**Lokal (Referenz):** Spike T-009 zuvor `[x]`.

---

## T-010 Chat-Spike

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| 10.* | Realtime-Nachrichten, serverseitige Würfel, Reload | Prod | **bestanden** (Owner-Smoketest) | Composer-/Markdown- und Channel-/Thread-UX iterativ — siehe `.ai/backlog.md`. |

**Lokal (Referenz):** Spike T-010 zuvor `[x]`.

---

## T-011 Rechteprüfung

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| 11.* | Gesamte Matrix | Lokal | **bestanden** | `npm run test:rechte` → **15/15** (2026-09-22). |
| 11.* | Gleiches Skript gegen Prod-URL | Prod | **N/A** | Test-Login auf Prod by design aus. |

---

## Infrastruktur-Checks (T-007 / T-014 Rahmen)

| Check | Ergebnis | Beobachtung |
|---|---|---|
| HTTPS Startseite | **bestanden** | `GET /` → **200**. |
| Wert aus DB | **bestanden** | Seed-Text aus Prod-DB. |
| Discord-Button / Config | **bestanden** | `discordConfigured: true`, `testLoginEnabled: false`. |
| Test-Login auf Prod aus | **bestanden** | siehe 8.5. |

---

## Offene UX (Backlog / iterativ, kein T-014-Blocker)

- Weitere Composer-/Karten-UX nach Owner-Feedback: nach und nach; keine neuen Spezifikationen hier erfinden
- Quest-Kapitel / Owner-Sichtbarkeit: **geplant** (Plan `004`), hier **nicht** als shipped prüfen

## Agent-seitig erledigt (Protokoll-Historie)

- Prod-Homepage, Test-Login-404, Rechte-Skript lokal 15/15.
- Owner 2026-09-22: Smoketest insgesamt erfolgreich → T-014 für den Plan abgeschlossen.

---

## MVP F1–F10 / Nachzüge Smoketest-Fixes (T-017)

**Zweck:** Owner-Protokoll für den produktiven MVP-Stand (Plan `003` T-017) plus nachgezogene UX-Fixes.  
**Umgebung:** Prod `https://worldcraft.lagolago.at` (Discord); Test-Login / Rechte-Skript nur lokal.  
**Ergebnis je Zeile:** bestanden / nicht bestanden / N/A — ggf. Prod vs. lokal vermerken.

**Owner-Protokoll:** 2026-09-23 (Prod Discord; F.5/F.6 ohne lokale Umgebung nicht getestet).

### Kernpfad F1–F10 (Stichprobe)

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| F.1 | Discord-Login → Welt öffnen / anlegen | Prod | **bestanden** | Owner 2026-09-23. |
| F.2 | Artikel mit Erwähnung speichern | Prod | **bestanden** | Owner 2026-09-23. |
| F.3 | Karte: Bild + Pin setzen | Prod | **bestanden** | Owner 2026-09-23. |
| F.4 | Chat: Nachricht senden | Prod | **bestanden** | Owner 2026-09-23. |
| F.5 | Rechte-Skript (`npm run test:rechte`) | Lokal | **N/A** | Nicht getestet — keine lokale Umgebung beim Owner-Lauf 2026-09-23. |
| F.6 | `ENABLE_TEST_LOGIN` in Coolify unset; Test-Login auf Prod 404 | Prod | **N/A** | Nicht getestet (Owner 2026-09-23). |
| F.7 | Phone-first ~390 px: Shell, Karte, Chat, Editor stichprobenartig | Prod/Lokal | **bestanden** | Owner 2026-09-23. |

### Offene Multi-Personen-Tests

Zwei Discord-Konten, **gleiche Welt**. Optional — kein T-014-Blocker, für T-017 / Realtime-Vertrauen.

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| M.1 | **Chat-Realtime:** A schreibt → B sieht ohne Reload | Prod | **bestanden** | Owner 2026-09-23. |
| M.2 | **Pin-Realtime:** A setzt/verschiebt Pin (nach Drop) → B sieht Sync | Prod | **bestanden** | Owner 2026-09-23. |
| M.3 | **Optional Marker:** A verschiebt eigenen Marker → B sieht Update; B kann Markers von A nicht verschieben | Prod | **bestanden** | Owner 2026-09-23. |

### Nachzüge Smoketest-Fixes (shipped UX)

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| N.1 | **Discord-Allowlist:** nicht erlaubte Discord-ID → klare Fehlermeldung auf Login (kein stiller Fail) | Prod | **bestanden** | Owner 2026-09-23. |
| N.2 | **@-Erwähnung:** Bestätigen mit **Tab** (neben Enter/Klick) | Prod/Lokal | **bestanden** | Owner 2026-09-23. |
| N.3 | **Karten-Leerzustand:** Prompt mittig bei fehlendem Bild; Dropdown überlappt Text nicht | Prod/Lokal | **bestanden** | Owner 2026-09-23. |
| N.4 | **Chat:** Leerzeichen ohne Cursor-Sprung; Absätze (Shift+Enter) in Nachrichten sichtbar | Prod/Lokal | **bestanden** | Owner 2026-09-23. |
| N.5 | **Würfel:** Spielleitung kann Würfel-Nachricht löschen; Player nicht | Prod/Lokal | **bestanden** | Owner 2026-09-23. |
| N.6 | **Würfel-UI** am ui-prototype (Grid, fette Summe, Toast) — stichprobenartig | Prod/Lokal | **bestanden** | Owner 2026-09-23. |
| N.7 | **Karten-Zoom/Scroll** fühlt sich näher am Prototyp an (kein extremes Nachziehen) | Prod/Lokal | **bestanden** | Owner 2026-09-23. |
| N.8 | **Karten-Hinweistext** entfernt | Prod/Lokal | **bestanden** | Owner 2026-09-23. |
| N.9 | **Karten-Sichtbarkeit:** Auge-Icon in Toolbar (offen = sichtbar, durchgestrichen = SL-only) | Prod/Lokal | **bestanden** | Owner 2026-09-23. |
| N.10 | **Pins:** Mentions als blaue Links im Beschreibungstext; kein „Verknüpft“-Panel im Pin-Sheet | Prod/Lokal | **bestanden** | Owner 2026-09-23. |
| N.11 | **Versionsbadge** unten links, hellgrau lesbar; Version **0.1.1+** sichtbar | Prod/Lokal | **bestanden** | Owner 2026-09-23. |
| N.12–N.14 | **Multi-Karten** (Dropdown, Anlegen/Löschen, Bild ersetzen, Pins/Marker pro Karte) — Checkliste unten | Prod | **bestanden** | siehe MK.*; Owner 2026-09-23. |

### Multi-Karten (shipped ~1068ad6 / Migration 0012)

**Zweck:** Owner-Protokoll für mehrere Karten pro Universum nach Produktfreigabe 2026-09-23.  
**Umgebung:** Prod `https://worldcraft.lagolago.at` mit Discord; Staff (GM/Master) plus optional zweites Discord-Konto.  
**Voraussetzung:** Migration `0012_multi_map_and_marker_unique.sql` deployed (`maps.image_id` nullable; `UNIQUE(character_id)` auf Markern).  
**Ergebnis je Zeile:** bestanden / nicht bestanden / N/A  
**Owner-Protokoll:** 2026-09-23 — alle MK.* bestanden; MK.4 Dialog-UX (Checkbox-Abstand) nachträglich behoben.

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| MK.1 | **Dropdown-Label:** aktuelle Auswahl als `Universum: Karte`; übrige Einträge gleiches Format (bei SL-only ggf. `· SL`) | Prod | **bestanden** | Owner 2026-09-23. |
| MK.2 | **Zweite Karte anlegen (Staff):** zweite Karte im Universum anlegen (Default-Name ok); erscheint im Dropdown | Prod | **bestanden** | Owner 2026-09-23. |
| MK.3 | **Leere neue Karte:** startet ohne Bild → mittiger Upload-Prompt; erstes Upload **ohne** Ersetzen-Warnung | Prod | **bestanden** | Owner 2026-09-23. |
| MK.4 | **Bild ersetzen:** Toolbar-Upload-Icon → Checkbox-Dialog („Karte wird ersetzt, Pins bleiben“); Abbrechen bricht ab; Bestätigen + Upload behält Pins | Prod | **bestanden** | Ablauf OK; Checkbox-Layout (großer Abstand) beim Smoketest auffällig → UX-Fix nachgezogen (`confirm-check` + `input[type=checkbox]` Reset). |
| MK.5 | **Karte löschen (Staff):** Bestätigung; Pins/Marker dieser Karte weg; andere Karten unverändert | Prod | **bestanden** | Owner 2026-09-23. |
| MK.6 | **Pins pro Karte:** Pin auf Karte A nicht auf Karte B sichtbar; kein Verschieben von Pins zwischen Karten | Prod | **bestanden** | Owner 2026-09-23. |
| MK.7 | **Charakter-Marker:** auf Karte B platzieren, während Karte A aktiv ist → Marker von A entfernt, nur noch auf B | Prod | **bestanden** | Owner 2026-09-23. |
| MK.8 | **Auge-Sichtbarkeit:** Toggle wirkt weiterhin nur auf die **aktuell gewählte** Karte | Prod | **bestanden** | Owner 2026-09-23. |
| MK.9 | **Non-Staff:** keine Anlegen-/Löschen-/Upload-Controls (oder klare Ablehnung) | Prod | **bestanden** | Owner 2026-09-23. |
| MK.10 | **Optional Realtime:** zweiter User sieht Kartenwechsel / neuen Pin auf derselben Karte nach Drop | Prod | **bestanden** | Owner 2026-09-23. |

---

## Plan 007 – Chat-Verbesserungen (lokal)

**Zweck:** Owner-Checkliste für Ausrichtung, Avatare, Bearbeiten, Kopieren, Lösch-Bestätigung, Thread-Umbenennen, Aufklapp-Zustand.  
**Umgebung:** Lokal `http://localhost:3000` mit Test-Login (zwei Browser / zwei Seeds).  
**Ergebnis je Zeile:** bestanden / nicht bestanden / offen

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| C7.1 | **Eigene Nachrichten rechts**, fremde links (auch in Threads) | Lokal | **bestanden** | Owner 2026-09-23. Anmerkung: Mehrzeilige eigene Nachrichten (Absätze) wirken durch den Hintergrund der Textfläche seltsam. |
| C7.2 | **Statische Avatare:** animierte Discord-GIFs stehen still | Lokal | **bestanden** | Owner 2026-09-23. |
| C7.3 | **Bearbeiten:** nur eigene Textnachrichten; „(bearbeitet)“; Würfel/Eröffnung ohne ✏️; Realtime beim anderen | Lokal | **bestanden** | Owner 2026-09-23. |
| C7.4 | **Kopieren:** Text = Markdown-Rohtext; Würfel formatiert; Eröffnung = Thread-Titel; Toast „Kopiert“ | Lokal | **bestanden** | Owner 2026-09-23. |
| C7.5 | **Löschen:** Dialog mit Vorschau; Abbrechen/Esc behält; Shift+🗑 sofort | Lokal | **bestanden** | Owner 2026-09-23. |
| C7.6 | **Thread umbenennen:** ⋯ nur Ersteller/SL; Titel in Kanalliste, Karte und Kopf live | Lokal | **bestanden** | Owner 2026-09-23. |
| C7.7 | **Aufklapp merken:** Kanal auf/zu, Reload behält Zustand | Lokal | **bestanden** | Owner 2026-09-23. Anmerkung: Beim Neuladen kurzes Flackern (zu → auf), stört bei vielen Kanälen und Threads. |
| C7.8 | **Desktop:** Schnellaktionen bei Hover/Fokus; **Touch:** nach Antippen | Lokal | **bestanden** | Owner 2026-09-23. Anmerkung: Nachricht mit offenen Schnellaktionen (Hover/Antippen) sollte leicht heller hervorgehoben werden. |
| C7.9 | **`/r 1d20`** würfelt wie `/roll 1d20` (Alias) | Lokal | offen | |
