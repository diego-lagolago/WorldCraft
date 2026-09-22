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

**T-014: teilweise** — nicht abgeschlossen. T-013 (Go/No-Go) wartet.

| Block | Status |
|---|---|
| T-008 Discord (Prod) | bestanden (Owner) |
| T-008 Test-Login | bestanden **lokal**; N/A auf Prod |
| T-009 Karte (Prod) | teilweise — Route deployed, Login-Gate OK; Upload/Realtime/Phone-First: Owner |
| T-010 Chat (Prod) | **offen** — `/spike/chat` auf Prod **404** (Code noch nicht auf `main`/GHCR) |
| T-011 Rechte-Skript | bestanden **lokal** (15/15); N/A auf Prod |

---

## T-008 Discord-Login & Test-Login

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| 8.1 | „Mit Discord anmelden“ → Freigabe → Anzeigename/Avatar | Prod | **bestanden** | Owner 2026-09-22: Discord-Login auf Live OK. Startseite zeigt Button, `discordConfigured: true`. |
| 8.2 | Zweiter Login derselbe Discord-User → kein zweiter DB-User | Prod | **Owner bestätigt** (implizit mit Live-Login); Detail-DB-Check optional | Nicht per Agent nachprüfbar ohne DB-Zugang. |
| 8.3 | Abmelden beendet Sitzung | Prod | **Owner** | Agent ohne Session. |
| 8.4 | Test-Login: vier Seeds anmelden, Session per curl | Lokal | **bestanden** | `POST /api/test-login` mit `test-gm` → 200 + User; Rechte-Skript meldet alle vier Seeds an. |
| 8.5 | Ohne `ENABLE_TEST_LOGIN` → Test-Login nicht erreichbar (404) | Prod | **bestanden** | `POST https://worldcraft.lagolago.at/api/test-login` → **404**. |
| 8.6 | `ENABLE_TEST_LOGIN=true` + `APP_ENV=production` → App startet nicht | Prod-Config | **bestanden (by design)** | In Coolify nicht gesetzt; Guard in `src/lib/env.ts` + Unit-Test. Nicht absichtlich in Prod aktiviert. |

---

## T-009 Karten-Spike

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| 9.0 | Route erreichbar nach Login | Prod | **teilweise** | Unauthenticated: `GET /spike/karte` → **307** → `/`. Nach Discord-Login: Link „Karten-Spike“ auf Startseite (Owner). |
| 9.1 | Testbild 8000×6000 hochladen, zoomen/verschieben | Prod | **offen — Owner** | Agent kann ohne Discord-Session und ohne Owner-Upload nicht prüfen. |
| 9.2 | Alle 12 Pin-Typen mit unterscheidbarem Icon | Prod | **offen — Owner** | Lokal Unit-Test Pin-Typen bestanden. |
| 9.3 | Drop in Browser A → Position in Browser B ≤1 s (anderer User) | Prod | **offen — Owner (2. Discord)** | Nur mit zweitem Discord-Konto; Test-Login auf Prod N/A. |
| 9.4 | Nach Reload / Zoom gleiche Bildstelle | Prod | **offen — Owner** | |
| 9.5 | Charakter-Marker optisch von Pins unterscheidbar | Prod | **offen — Owner** | |
| 9.6 | Karten-URL mit Pin-ID zentriert/hervorgehoben | Prod | **offen — Owner** | |
| 9.7 | Touch / Geräte-Emulation ~390 px | Prod | **offen — Owner** | Phone-First laut Plan. |

**Lokal (Referenz, bereits T-009 `[x]`):** Spike lokal abgenommen; Prod-Smoketest offen wie oben.

---

## T-010 Chat-Spike

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| 10.0 | Route `/spike/chat` auf Prod | Prod | **nicht bestanden / blockiert** | `GET https://worldcraft.lagolago.at/spike/chat` → **404**. Chat-Code + Migrationen liegen lokal (uncommitted / nicht deployed). |
| 10.1 | Nachricht A → B ≤1 s | Prod | **offen** | Blockiert durch 10.0; braucht zwei Discord-Konten. |
| 10.2–10.5 | Würfel serverseitig, ungültige Notation, manipulierter Client, Reload 50 Nachrichten | Prod | **offen** | Blockiert durch 10.0. Lokal Spike `[x]`. |

**Nächster Schritt für Chat auf Prod:** Chat-/Schema-Änderungen committen, Image-Build (GHCR), Coolify-Pull — **ohne** `src/spike/chat/chat.css` zu überschreiben, falls Dice-Layout-Agent noch läuft.

---

## T-011 Rechteprüfung

| # | Kriterium | Wo | Ergebnis | Beobachtung |
|---|---|---|---|---|
| 11.* | Gesamte Matrix (Tagebuch, Artikel `gm_only`, Rollen, Einladungen, Archiv/Re-Join, Marker, Relationen, …) | Lokal | **bestanden** | `npm run test:rechte` → **15/15** bestanden (2026-09-22, Dev-Server + Test-Login). Unit-Tests `APP-AUTHZ` ebenfalls grün. |
| 11.* | Gleiches Skript gegen Prod-URL | Prod | **N/A** | Skript braucht Test-Login-Seeds; auf Prod by design nicht verfügbar. |

---

## Infrastruktur-Checks (T-007 / T-014 Rahmen)

| Check | Ergebnis | Beobachtung |
|---|---|---|
| HTTPS Startseite | **bestanden** | `GET /` → **200**, Titel WorldCraft. |
| Wert aus DB | **bestanden** | Anzeige: `Hallo von der lokalen Datenbank.` (Seed-Text aus Migration `0000`; Name historisch, Inhalt kommt aus Prod-DB). |
| Discord-Button / Config | **bestanden** | Button sichtbar, `discordConfigured: true`, `testLoginEnabled: false`. |
| Test-Login auf Prod aus | **bestanden** | siehe 8.5. |

---

## Was der Projektinhaber noch prüfen muss

1. **Nach Deploy des Chat-Spikes:** `/spike/chat` auf Prod öffnen (nach Discord-Login).
2. **Kartenbild:** eigenes 8000×6000-Testbild auf Prod hochladen (9.1).
3. **Zweites Discord-Konto:** Pin-Drop und Chat-Nachricht zwischen zwei Browsern ≤1 s (9.3, 10.1).
4. Optional: Abmelden (8.3), Pin-Deep-Link (9.6), Phone-Emulation (9.7), Würfel-UI auf Prod (10.2–10.5).

## Agent-seitig erledigt (diese Runde)

- Prod-Homepage GET + Browser-Snapshot.
- Test-Login 404 auf Prod bestätigt.
- `/spike/karte` Redirect ohne Session, `/spike/chat` 404 dokumentiert.
- `npm run test:rechte` lokal 15/15.
- Dieses Protokoll angelegt.
