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

- Karten-Zoom (gestuft vs. weich / größere Schritte) — `.ai/backlog.md`
- Chat: Channel-Verwaltung & Thread-UX — `.ai/backlog.md`
- Weitere Composer-/Karten-UX nach Owner-Feedback: nach und nach; keine neuen Spezifikationen hier erfinden

## Agent-seitig erledigt (Protokoll-Historie)

- Prod-Homepage, Test-Login-404, Rechte-Skript lokal 15/15.
- Owner 2026-09-22: Smoketest insgesamt erfolgreich → T-014 für den Plan abgeschlossen.
