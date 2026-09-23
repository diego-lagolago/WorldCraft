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

### Kernpfad F1–F10 (Stichprobe)

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| F.1 | Discord-Login → Welt öffnen / anlegen | Prod | | |
| F.2 | Artikel mit Erwähnung speichern | Prod | | |
| F.3 | Karte: Bild + Pin setzen | Prod | | |
| F.4 | Chat: Nachricht senden | Prod | | |
| F.5 | Rechte-Skript (`npm run test:rechte`) | Lokal | | |
| F.6 | `ENABLE_TEST_LOGIN` in Coolify unset; Test-Login auf Prod 404 | Prod | | |
| F.7 | Phone-first ~390 px: Shell, Karte, Chat, Editor stichprobenartig | Prod/Lokal | | |

### Offene Multi-Personen-Tests

Zwei Discord-Konten, **gleiche Welt**. Optional — kein T-014-Blocker, für T-017 / Realtime-Vertrauen.

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| M.1 | **Chat-Realtime:** A schreibt → B sieht ohne Reload | Prod | | |
| M.2 | **Pin-Realtime:** A setzt/verschiebt Pin (nach Drop) → B sieht Sync | Prod | | |
| M.3 | **Optional Marker:** A verschiebt eigenen Marker → B sieht Update; B kann Markers von A nicht verschieben | Prod | | N/A wenn kein zweites Konto |

### Nachzüge Smoketest-Fixes (shipped UX)

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| N.1 | **Discord-Allowlist:** nicht erlaubte Discord-ID → klare Fehlermeldung auf Login (kein stiller Fail) | Prod | | |
| N.2 | **@-Erwähnung:** Bestätigen mit **Tab** (neben Enter/Klick) | Prod/Lokal | | |
| N.3 | **Karten-Leerzustand:** Prompt mittig; Chips überlappen Text nicht | Prod/Lokal | | |
| N.4 | **Chat:** Leerzeichen ohne Cursor-Sprung; Absätze (Shift+Enter) in Nachrichten sichtbar | Prod/Lokal | | |
| N.5 | **Würfel:** Spielleitung kann Würfel-Nachricht löschen; Player nicht | Prod/Lokal | | |
| N.6 | **Würfel-UI** am ui-prototype (Grid, fette Summe, Toast) — stichprobenartig | Prod/Lokal | | |
| N.7 | **Karten-Zoom/Scroll** fühlt sich näher am Prototyp an (kein extremes Nachziehen) | Prod/Lokal | | |
| N.8 | **Karten-Hinweistext** entfernt | Prod/Lokal | | |
| N.9 | **Karten-Sichtbarkeit:** Auge-Icon in Toolbar (offen = sichtbar, durchgestrichen = SL-only) | Prod/Lokal | | |
| N.10 | **Pins:** Mentions als blaue Links im Beschreibungstext; kein „Verknüpft“-Panel im Pin-Sheet | Prod/Lokal | | |
| N.11 | **Versionsbadge** unten links, hellgrau lesbar; Version **0.1.1+** sichtbar | Prod/Lokal | | |
