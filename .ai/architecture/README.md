# Architektur — Überblick

**Status:** Festgehalten durch Plan `001` T-013 (2026-09-22).  
**Details:** [datenmodell-fachlich.md](datenmodell-fachlich.md) · [datenmodell.md](datenmodell.md) · ADRs · [architecture.md](../architecture.md)

## Komponenten

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser (Mobile-First UI)                                  │
│  Next.js Client: Karte (Leaflet), Chat, TipTap, Seiten      │
└───────────────┬─────────────────────────────┬───────────────┘
                │ HTTPS / Cookies             │ SSE (EventSource)
                ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js App (ein Container, Port 3000)                     │
│  • Seiten (App Router)                                      │
│  • Route Handlers: /api/auth, /api/worlds/…, später /mcp    │
│  • Better Auth (Discord-Client jetzt; OAuth-AS für MCP später)│
│  • Rechteschicht (TypeScript)                               │
│  • Drizzle → PostgreSQL                                     │
│  • Dateien → Volume (FILE_STORAGE_PATH)                     │
│  • SSE-Bus (in-process, genau eine App-Replica)             │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
         ┌────────────┐              ┌────────────────┐
         │ PostgreSQL │              │ Upload-Volume  │
         │ (Coolify / │              │ Karten, Avatare│
         │  Compose)  │              │ Titelbilder    │
         └────────────┘              └────────────────┘
```

| Komponente | Rolle |
|---|---|
| **Next.js-App** | UI + API + Auth + Rechte + Realtime-Endpunkte in einem Prozess ([ADR-001](../decisions/001-backend.md), [ADR-002](../decisions/002-frontend.md)) |
| **PostgreSQL** | Fachdaten, Constraints, Archive; keine RLS als Rechtematrix |
| **Better Auth** | Sessions, Discord-OAuth; später MCP-Plugin / OAuth-AS (Plan `002`) |
| **Volume** | Binärdateien; Metadaten in Tabelle `files` |
| **Leaflet** | Kartenbild + Pins/Marker ([ADR-003](../decisions/003-karten.md)) |
| **TipTap** | Rich-Text JSON + Klartext ([ADR-004](../decisions/004-editor.md)) |
| **Coolify + GHCR** | Betrieb Prod; Image vorgebaut ([deployment.md](../infrastructure/deployment.md)) |

Design-Referenz: `spikes/ui-prototype/` (HTML-Prototyp, nicht Teil der Next-App).

## Datenfluss (kurz)

### Login

1. Browser → Discord (OAuth) → Callback `/api/auth/callback/discord`.
2. Better Auth legt/aktualisiert `users` (Discord-ID, Name, Avatar, E-Mail).
3. Session-Cookie same-origin.

Test-Login (nur lokal): `POST /api/test-login` → gleiche Session-Form, Seed-User.

### Karte (Produkt)

1. Upload → `files` + `maps.image_id` (eine Karte je Universum in der Anwendungslogik).
2. Pins/Marker: Position relativ `{x,y}` ∈ [0,1], Pin-Typen zentral in `src/lib/map/pin-types.ts`.
3. Nach **Drop**: Persistenz → SSE (`map.pin` / `map.marker`) an andere Clients derselben Welt (kein Live-Drag).
4. Deep-Link `/w/[worldId]/map?pin=` zentriert und hebt den Pin hervor.

### Chat

1. Nachricht oder Würfel-Aktion → Server speichert (Würfel **nur serverseitig**).
2. SSE benachrichtigt andere Clients derselben Welt.
3. Composer-UI: Würfel-Sheet; `/roll` bleibt API-/Test-Pfad und folgt dem Schalter „Im Chat posten“.

### Realtime

Die App läuft mit **genau einer App-Replica**. Realtime ist In-Process (`src/lib/realtime`). Chat und Karte teilen sich den Bus und eine SSE-Route pro Welt (`/api/worlds/[worldId]/events`). Skalierung auf mehr als eine Replica nur nach einem neuen ADR (Kandidaten: PostgreSQL `LISTEN/NOTIFY`, Redis Pub/Sub).

### Rechte

Jede lesende/schreibende API (und später MCP) fragt die **gemeinsame Rechteschicht** mit Benutzerkontext. Sichtbarkeit erbt Universum → Karte → Pin/Marker; Relationen nur wenn Quelle **und** Ziel sichtbar. Mitgliedschaften/Teilnahmen werden archiviert, nicht hart gelöscht (siehe fachliches Modell).

### Relationen

1. Speichern von Artikel, Universumsbeschreibung und Pin berechnet ausgehende automatische Relationen neu (`APP-REL-RECALC` in `src/lib/domain/relations.ts`); manuelle Relationen bleiben.
2. `listLinked` lädt Ziele je Inhaltsart in einer Query (CR-011). Sichtbar nur, wenn Quelle **und** Ziel sichtbar sind.
3. UI „Verknüpft“: Artikel, Charakter, Universum, Quest (`src/components/linked/`); Pin im Karten-Popup.

### Geplant: MCP (Plan 002)

```text
Claude ──OAuth 2.1──► WorldCraft AS (Better Auth)
Claude ──Bearer──► POST /mcp ──► Rechteschicht ──► DB
```

Nur lesend; kein Tagebuch, kein Chat über MCP.

## Domänenkerne (MVP)

Welt → Universen → Karten → Pins / Charakter-Marker  
Welt → Artikel, Quests, Relationen, Chat  
Benutzer → Charaktere (weltunabhängig) → Mitbringen → Marker / Tagebuch  

Rollen pro Welt: Game Master | Master | Player (Rechtematrix in Plan `001`).

## UI-Shell (später)

Angepinnte Mobile-Navigation: Kampagne · Karte · Chat · Menü — [mobile-navigation.md](../standards/mobile-navigation.md).
