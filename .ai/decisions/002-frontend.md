# ADR-002: Frontend-Framework

**Status:** Freigegeben durch den Projektinhaber am 2026-09-22 (Option A – Next.js).
**Datum:** 2026-09-22
**Betrifft:** Plan `.ai/feature-tasks/001-mvp-infrastruktur.md` (T-003)
**Setzt voraus:** ADR-001 (Backend: TypeScript, PostgreSQL, Drizzle, Better Auth, Realtime)

## Kontext

Das Frontend muss Discord-Login, TipTap-Artikel, eine zoom-/verschiebbare Karte mit Live-Pins, Chat und die Rechtematrix tragen. Es wird als Container auf Coolify bereitgestellt (T-007) und teilt sich Auth und Datenbank mit dem Backend aus ADR-001.

**Realtime-Präzisierung (Projektinhaber, 2026-09-22):** Pin- und Marker-Positionen werden **nach dem Drop** an andere geöffnete Karten übertragen, nicht während des Ziehens. Ziel: innerhalb von 1 Sekunde nach dem Ablegen steht der Pin in Browser B an derselben Stelle. Dasselbe Muster gilt fachlich für neue Chat-Nachrichten (Ereignis nach Speichern, kein Zeichen-Stream). Live-Drag-Streaming ist kein MVP-Ziel.

**Referenzprojekt Vitura** (lokaler Pfad `/Users/diego.lagolago/Documents/VS Code/Teinei`, npm-Name `teinei-v2`): produktiv auf **Next.js 16.3**, React 19, Better Auth 1.7, Drizzle, PostgreSQL, TipTap (`@tiptap/react` 3.30), Dockerfile mit `output: "standalone"`, Coolify-Laufzeitvariablen. Der Projektinhaber hat am 2026-09-22 erlaubt, dort zu spicken. Das ist ein praktisches Argument für Next.js, ersetzt aber nicht die Bewertung der drei Kandidaten.

Spikes und Folgecode dürfen Muster übernehmen, nicht die Vitura-Anwendung kopieren: keine Tenants/SSO/Sentry/S3, keine Secrets, kein 1:1-UI. Sinnvolle Fundstellen: `src/lib/auth.ts` + `src/app/api/auth/[...all]/route.ts` (Better Auth), `Dockerfile` / `next.config.ts` (`standalone`), `src/components/ui/rich-text-editor.tsx` (TipTap-Client, Bilder für WorldCraft-Artikeltext **nicht** übernehmen).

Bewertung gemäß *Vorgehen bei Architekturentscheidungen* in Plan `001`. Alle Kriterien Gewicht 1.

## Kandidaten

### A – Next.js (React)

React-Framework mit App Router, Route Handlers und Server Components. Frontend und das TypeScript-Backend aus ADR-001 leben in **einer** Node-Anwendung (wie Vitura).

**Eignung für WorldCraft:** Better Auth hat `toNextJsHandler` und dokumentiert Next.js 16 (`proxy` statt Middleware). Discord-Login, Test-Login, später `/mcp` und die Rechteschicht sitzen same-origin — Plan `002` verlangt den MCP-Endpunkt auf derselben Domain. `@tiptap/react` ist die offizielle Anbindung und in Vitura bereits im Einsatz (T-005). Für T-004 bleiben alle drei Karten-Kandidaten offen (`react-leaflet`, `react-konva`, `tldraw` braucht React 18/19). Coolify: Nixpacks oder Dockerfile; Vitura beweist Standalone-Image inkl. Stub-Env zur Buildzeit. Nach der Realtime-Präzisierung (Ereignis nach Drop/Speichern, kein Drag-Stream) reicht ein SSE- oder WebSocket-Kanal ohne Socket.IO-Custom-Server (ADR-001 nannte Socket.IO nur als Beispiel). Karte und TipTap müssen Client Components sein (`immediatelyRender: false` bei SSR).

### B – SvelteKit

Svelte-Framework mit `adapter-node` als langlebiger Server. Eigenes Template-Modell, offizielle Better-Auth- und TipTap-Anleitungen.

**Eignung für WorldCraft:** Better Auth per `svelteKitHandler` in `hooks.server.ts`. TipTap läuft über `@tiptap/core` (Svelte-Guide, kein gleichwertiges `@tiptap/svelte` wie `@tiptap/react`). Leaflet und Konva sind anbindbar (`svelte-konva` ist offiziell); **tldraw ist React-only** und fiele als T-004-Kandidat aus. Kein Nutzen aus Vitura: Auth, Editor, Dockerfile, Drizzle-Schichten müssten neu entstehen. Ökosystem und UI-Bibliotheken sind kleiner. Realtime am Node-Adapter ist unproblematischer als Next-Custom-Server, wiegt den Verlust an Wiederverwendung und Karten-Optionen aber nicht auf.

### C – React + Vite (Single-Page-App)

Vite baut ein statisches SPA. Das Backend aus ADR-001 wäre ein **separater** Node-Dienst (z. B. Hono/Express) mit Better Auth, Drizzle und WebSockets. Coolify hätte zwei Ressourcen oder ein Compose aus SPA-Nginx plus API.

**Eignung für WorldCraft:** TipTap und alle drei Karten-Bibliotheken wie bei A. Socket.IO am API-Prozess ist der natürlichste Realtime-Weg und trifft ADR-001 am wörtlichsten. Dafür: zwei Deployments, CORS und Cookie-Domain zwischen SPA und API, Discord-Redirect auf die API, MCP-Pfad über Reverse-Proxy auf dieselbe Domain legen. Vitura-Muster (Route Handler, Standalone-Dockerfile, same-origin Cookies) lassen sich nur teilweise übertragen. Für eine kleine Gruppe ist der Betriebsaufwand höher als bei einer Next.js-App, ohne dass F1–F10 etwas gewinnen, das A nicht auch kann.

## Bewertung

| # | Kriterium | A Next.js | B SvelteKit | C React+Vite SPA |
|---|---|:-:|:-:|:-:|
| 1 | Zusammenspiel mit ADR-001 (Better Auth, Drizzle, Rechte, MCP-Pfad) | 5 | 3 | 4 |
| 2 | Karten-Bibliothek (T-004: Leaflet, Konva, tldraw) | 5 | 3 | 5 |
| 3 | TipTap-Anbindung (T-005) | 5 | 4 | 5 |
| 4 | Deployment als Container auf Coolify | 5 | 4 | 4 |
| 5 | Typsicherheit (TypeScript) | 5 | 5 | 5 |
| 6 | Aufwand Realtime (Chat, Pin nach Drop) | 4 | 4 | 5 |
| 7 | Größe des Ökosystems | 5 | 3 | 5 |
| | **Summe** | **34** | **26** | **33** |

### Begründungen

**1 Zusammenspiel mit ADR-001**
- A 5: Eine App, Session-Cookies same-origin, `toNextJsHandler`, Drizzle wie in Vitura; `/mcp` als Route Handler auf derselben Origin wie Plan `002`.
- B 3: Better Auth existiert, Vitura-Code und das MCP-Beispiel von Better Auth (`requireMcpAuth` an Next-Route) sind nicht übertragbar.
- C 4: Saubere Trennung API/SPA, aber Cookies, Redirects und MCP brauchen extra Proxy-Arbeit.

**2 Karten-Bibliothek**
- A 5: Leaflet (vanilla oder react-leaflet), offizielles `react-konva`, tldraw (React 18/19) — alle T-004-Kandidaten bleiben wählbar.
- B 3: Leaflet und `svelte-konva` ja, tldraw nein (SDK verlangt React).
- C 5: identisch zu A, weil React.

**3 TipTap**
- A 5: Offizielles `@tiptap/react`; Vitura hat `useEditor` / `EditorContent` plus Toolbar bereits.
- B 4: Offizieller Svelte-Guide über `@tiptap/core` und `onMount`; weniger fertige UI-Hilfen, keine Vitura-Vorlage.
- C 5: dasselbe `@tiptap/react` wie A, ohne Next-SSR-Fußangel.

**4 Coolify**
- A 5: Offizielle Coolify-Next-Doku (Nixpacks oder Dockerfile, Port 3000); Vitura-Dockerfile (standalone, Stub-Env, Volume-tauglich) ist ein erprobtes Muster.
- B 4: `adapter-node` im Container üblich, aber ohne vorhandenes Projektmuster.
- C 4: Vite als Static Site plus API-Container — Coolify kann beides, verdoppelt Ressourcen und HTTPS-Routing.

**5 Typsicherheit**
- A/B/C 5: alle drei sind First-Class-TypeScript.

**6 Realtime**
- A 4: Nach-Drop-/Nach-Speichern-Ereignisse sind SSE an einem Route Handler (Position persistieren, Event an Abonnenten); kein Drag-Stream, kein Socket.IO-Custom-Server. Coolify/Traefik muss lange SSE-Verbindungen durchlassen (T-014).
- B 4: langlebiger Node-Adapter, WS/SSE ohne Next-Sonderweg.
- C 5: WebSocket-Server gehört zum API-Prozess; für reines Nach-Drop etwas mehr als nötig, aber der geradlinigste WS-Weg.

**7 Ökosystem**
- A 5: größtes React-/Next-Ökosystem, UI-Kits, Beispiele, Better-Auth- und MCP-Docs.
- B 3: tragfähig, aber kleiner; weniger Karten-/Editor-Beispiele.
- C 5: React-Ökosystem, ohne Next-spezifische Server-Teile.

## Entscheidung

**Gewählt: A – Next.js (React), App Router.**

Höchste Summe nach der Realtime-Präzisierung (34 gegenüber 33 und 26). Zusätzlich:

1. **Same-origin** für Discord-Login, Test-Login, Session, Datei-Upload und späteren MCP-Endpunkt `/mcp` (Plan `002`) ohne CORS- und Cookie-Split.
2. **Vitura** liefert Auth-Handler, Drizzle, TipTap-Client und Coolify-Dockerfile.
3. T-004 bleibt vollständig (inkl. tldraw).
4. **Realtime:** Pin-Drop und Chat-Nachricht sind einzelne Server-Ereignisse. Next.js sendet sie per SSE (oder WebSocket ohne Custom Server). Socket.IO-Custom-Server ist dafür nicht nötig.

**Freigabe:** Der Projektinhaber hat Option A am 2026-09-22 bestätigt, ausdrücklich um möglichst viel aus Vitura zu recyclen.

Nicht C: ein Punkt Rückstand, zwei Container, weniger Vitura-Transfer; der Realtime-Vorteil entfällt weitgehend ohne Drag-Stream. Nicht B: tldraw fällt weg, Vitura fällt weg.

## Gegenprüfung

### (a) Stärkste Argumente gegen A

1. **SSE hinter Coolify:** Lange offene Verbindungen müssen durch Traefik; das bleibt der Smoketest-Risikopunkt (T-014), auch ohne Drag-Stream.
2. **SSR kämpft mit Canvas und TipTap:** Karte und Editor müssen Client-only sein; Hydration-Fallen sind real (Vitura setzt TipTap als `'use client'`).
3. **Framework-Gewicht:** Für eine private D&D-App ist Next.js schwerer als Vite-SPA. App Router und Caching sind Fehlerquellen, die C nicht hat.

### (b) Stärkstes Argument für die zweitbeste Option (C)

React+Vite plus eigenes Node-API trifft ADR-001 wörtlich (Socket.IO am Backend), vermeidet SSR und behält TipTap plus alle Karten-Bibliotheken.

Warum trotzdem A: Nach-Drop braucht keinen Socket.IO-Server. Same-origin Auth/MCP und Vitura wiegen den verbliebenen Realtime-Punkt von C auf.

### (c) Belegte Tatsachenbehauptungen

Abrufdatum: 2026-09-22.

| Behauptung | Quelle |
|---|---|
| Better Auth Next.js: `toNextJsHandler`, Route `app/api/auth/[...all]/route.ts`, kompatibel mit Next.js 16 (`proxy`) | https://better-auth.com/docs/integrations/next |
| Better Auth SvelteKit: `svelteKitHandler` in `hooks.server.ts` | https://better-auth.com/docs/integrations/svelte-kit |
| TipTap React: `@tiptap/react`, SSR mit `immediatelyRender` | https://tiptap.dev/docs/editor/getting-started/install/react |
| TipTap Svelte: `@tiptap/core` + Lifecycle, offizieller SvelteKit-Guide | https://tiptap.dev/docs/editor/getting-started/install/svelte |
| tldraw SDK: React-Komponente, React 18 oder 19 | https://tldraw.dev/installation |
| Konva: offiziell `react-konva` und `svelte-konva` | https://konvajs.org/docs/ |
| Socket.IO + Next.js: Custom `server.js`; Standalone tracet Custom Server nicht | https://socket.io/how-to/use-with-nextjs |
| Coolify: Next.js Nixpacks oder Dockerfile, Port 3000 | https://coolify.io/docs/applications/framework-examples/javascript/nextjs |
| Better Auth MCP-Beispiel nutzt Next.js Route + `requireMcpAuth` | https://better-auth.com/docs/plugins/mcp |
| Vitura: Next 16.3.5, React 19.2.8, better-auth ^1.7.1, drizzle-orm ^0.45.2, @tiptap/react ^3.30.2, `output: "standalone"` | `Teinei/package.json`, `Teinei/next.config.ts`, `Teinei/Dockerfile`, `Teinei/src/app/api/auth/[...all]/route.ts` |

### (d) Vereinbarkeit mit bereits getroffenen Entscheidungen

- **ADR-001 (C, TypeScript-Backend):** Next.js Route Handlers + Drizzle + Better Auth **sind** dieses Backend in einem Prozess. Kein zweites Framework. Realtime-Mechanismus (SSE vs. WS) wird in T-009/T-010 festgehalten, nicht Socket.IO als Pflicht.
- **Fachliches Datenmodell:** unabhängig vom UI-Framework.
- **T-001 Won't do:** kein Einfluss; Coolify-Deployment folgt Vitura-Dockerfile-Muster in T-007.
- **TipTap festgelegt (Plan 001 / T-005):** A und C haben die offizielle React-Anbindung; B nur Core. A bleibt kompatibel.

Die Empfehlung bleibt A. Nach der Präzisierung „nach dem Drop, nicht während des Ziehens“ (2026-09-22) führt A auch in der Summe; ein Gleichstand besteht nicht mehr.

## Konsequenzen

- **Stack:** Next.js App Router (React + TypeScript) als einzige App: UI, Better Auth, Drizzle, später `/mcp`. Versionen analog Vitura als Startpunkt (Next 16, React 19), konkret in T-007/T-013 festzurren.
- **Spicken aus Vitura:** Auth-Route, Standalone-Dockerfile, TipTap-Client-Komponente (ohne Bilder-im-Text), Drizzle-Client. Nicht übernehmen: Multi-Tenant, SSO, E-Mail-Passwort als Hauptlogin, S3, Sentry, RBAC-Bereiche.
- **Realtime:** Pin-/Marker-Position nach Drop und Chat-Nachricht nach Speichern per SSE (bevorzugt) oder WebSocket, kompatibel zu `output: "standalone"`. Kein Mitzeichnen während des Drags. Socket.IO-Custom-Server nur, wenn T-009/T-010 das widerlegen.
- **Plan:** F5 und T-009 sind am 2026-09-22 auf Nach-Drop angepasst.
- **Client-only:** TipTap und Karte als Client Components; keine SSR des Editors.
- **T-004:** alle drei Karten-Kandidaten bleiben zulässig.
- **T-005:** Spike unter `spikes/editor/` mit `@tiptap/react` (kann Vite-Mini-App bleiben, wie der Plan den Editor-Spike unabhängig beschreibt) bzw. dieselbe Anbindung später in der Next-App.
- **Nicht gewählt:** SvelteKit; React+Vite-SPA (bei Gleichstand verworfen, Begründung oben).
- **Nächste abhängige Aufgaben nach Freigabe:** T-004, T-005, T-007.
