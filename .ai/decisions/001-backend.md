# ADR-001: Backend-Ansatz

**Status:** Freigegeben durch den Projektinhaber am 2026-09-22 (Option C).
**Datum:** 2026-09-22
**Betrifft:** Plan `.ai/feature-tasks/001-mvp-infrastruktur.md` (T-002), Folgeplan `.ai/feature-tasks/002-mcp-server.md`

## Kontext

WorldCraft ist eine selbst gehostete Webapp für eine private D&D-Gruppe. Betrieb über Coolify auf dem Server des Projektinhabers. Anmeldung ausschließlich über Discord-Login. Die Infrastruktur muss die MVP-Funktionen F1–F10 und die Rechtematrix tragen (Welten mit Rollen, Artikel mit Relationen, Karten mit Live-Pins, Chat mit serverseitigen Würfeln, weltunabhängige Charaktere, Tagebuchsichtbarkeit). Zusätzlich muss das Backend in Plan `002` als **OAuth-2.1-Autorisierungsserver** für einen Claude-Connector auftreten können (Scope `worlds:read`, PKCE S256, Dynamic Client Registration, Resource Indicators), und dieselbe Rechteschicht muss Oberfläche und MCP-Werkzeuge bedienen.

T-001 (Server-Eckdaten) wurde am 2026-09-22 vom Projektinhaber als **Won't do** übersprungen. Kriterium 5 bewertet daher den Ressourcenbedarf gegen die Rahmenbedingungen des Plans (Coolify, privater Nutzerkreis, kein großes Aufkommen), nicht gegen gemessene CPU-/RAM-Werte. Annahme: Coolify läuft bereits auf demselben Host und belegt selbst RAM; ein zusätzlicher Stack mit mehreren Dienst-Containern ist riskanter als ein schlanker Stack.

Bewertung gemäß *Vorgehen bei Architekturentscheidungen* in Plan `001`. Kriterium 9 zählt doppelt.

## Kandidaten

### A – PocketBase

Einzelnes Go-Binary mit eingebettetem SQLite, Admin-UI, REST-ähnlicher API, Dateispeicher unter `pb_data`, Discord-OAuth2 als Login-Provider und Realtime über Server-Sent Events. Erweiterung über JS-Hooks und Collection-API-Rules.

**Eignung für WorldCraft:** PocketBase deckt Discord-Login, Dateiupload und Live-Updates ohne Extra-Dienste ab und passt zum Coolify-Betrieb als ein Container mit einem Volume. Für eine kleine Gruppe ist der Ressourcenbedarf ideal. Die Rechtematrix (Rollen pro Welt, Tagebuch `privat` vs. `geteilt`, Sichtbarkeitsvererbung Universum → Karte → Pin, Relationen nur wenn Quelle **und** Ziel sichtbar, Archivieren statt Löschen) übersteigt typische Collection-Filter und müsste in JS-Hooks nachgebaut werden. PocketBase ist OAuth-*Client* gegenüber Discord, nicht OAuth-*Autorisierungsserver* gegenüber Claude; Plan `002` hätte dafür einen zweiten Auth-Stack oder ein inoffizielles Plugin nötig. SQLite und fehlende First-Class-Typsicherheit erschweren das fachliche Modell (JSONB-Vorlagenfelder, Teilwortsuche über mehrere Inhaltsarten, partielle Uniqueness für „genau ein Game Master“).

### B – Supabase (selbst gehostet)

PostgreSQL plus mehrere Container (Auth/GoTrue, PostgREST, Realtime, Storage, API-Gateway, Studio). Discord-Login über GoTrue, Rechte über Row-Level-Security, Dateien über Storage, Live-Updates über den Realtime-Dienst. GoTrue kann als OAuth-2.1-Autorisierungsserver mit DCR und MCP-Dokumentation auftreten.

**Eignung für WorldCraft:** Discord, Realtime, Storage und datenebene Rechte passen fachlich zu F1–F10. RLS kann dieselbe Policy für App und MCP-Token nutzen — das ist genau die gemeinsame Rechteschicht aus Plan `002`. Dagegen steht der Betrieb: die offizielle Self-Host-Doku nennt mindestens 4 GB RAM / 2 Kerne / 40 GB SSD für den vollen Stack, zusätzlich zu Coolify. Ohne T-001-Messwerte ist das ein Risiko auf einem bereits beladenen Host. GoTrue unterstützt als Scopes nur `openid`, `email`, `profile`, `phone` (plus `offline_access`); den in Plan `002` T-003 geforderten Scope `worlds:read` gibt es nicht. Die Consent-UI muss trotzdem selbst gebaut werden. Der Stack ist an GoTrue/PostgREST/Realtime gebunden.

### C – Eigenes TypeScript-Backend

Node.js-Anwendung mit PostgreSQL, Drizzle ORM, Better Auth (Discord-Provider) und WebSockets (z. B. Socket.IO). Dateien auf einem Coolify-Volume (Karten bis 20 MB, Titelbilder bis 10 MB). Rechte als gemeinsame TypeScript-Schicht plus Postgres-Constraints. MCP über das Better-Auth-Plugin `mcp()` im selben Prozess.

**Eignung für WorldCraft:** Ein Prozess spricht Discord-Login, HTTP-API, Realtime und später `/mcp` mit demselben Benutzerkontext. Better Auth liefert Discord-Login jetzt und in Plan `002` den OAuth-2.1-Autorisierungsserver (PKCE, RFC 8414, RFC 9728, Consent, Resource-gebundene Tokens, optionales DCR, CIMD, frei definierbare Scopes wie `worlds:read`). PostgreSQL trägt das fachliche Modell: partielle Unique-Indexes für „genau ein Game Master“, „höchstens eine nicht archivierte Teilnahme pro Charakter und Welt“ und „höchstens ein Marker pro Charakter und Karte“, JSONB für Vorlagenfelder, Volltext- bzw. `ILIKE`-Suche für Erwähnungen. Der Preis ist Eigenbau von Upload, Realtime-Räumen und der Rechteschicht — das sind aber dieselben Stellen, die bei A in Hooks und bei B in RLS/Edge Functions ohnehin projektspezifisch werden. Zwei Container (App + Postgres) passen zu Coolify; der Ressourcenbedarf liegt zwischen A und B.

## Bewertung

Punkte 1–5, Gewicht 1 außer Kriterium 9 (Gewicht 2). Begründung jeweils in einem Satz.

| # | Kriterium | Gewicht | A PocketBase | B Supabase | C TypeScript |
|---|---|:-:|:-:|:-:|:-:|
| 1 | Discord-Login | 1 | 5 | 5 | 5 |
| 2 | Realtime für Chat und Pins | 1 | 4 | 5 | 4 |
| 3 | Dateispeicher (Karten 20 MB, Titelbilder 10 MB) | 1 | 4 | 5 | 4 |
| 4 | Rechteprüfung auf Datenebene | 1 | 3 | 4 | 5 |
| 5 | Ressourcenbedarf und Coolify | 1 | 5 | 2 | 4 |
| 6 | Backup & Wiederherstellung | 1 | 4 | 4 | 3 |
| 7 | Typsicherheit und Entwicklerfreundlichkeit | 1 | 2 | 5 | 5 |
| 8 | Anbieterbindung | 1 | 3 | 2 | 5 |
| 9 | MCP-Tauglichkeit | 2 | 2 | 4 | 5 |
| | **Gewichtete Summe** | | **34** | **40** | **45** |

### Begründungen

**1 Discord-Login**
- A 5: Discord ist ein eingebauter OAuth2-Provider; erster Login legt den Auth-Record an, Folge-Logins erkennen ihn wieder.
- B 5: GoTrue schaltet Discord über `GOTRUE_EXTERNAL_DISCORD_*` frei, inkl. Redirect für Staging und lokal.
- C 5: Better Auth hat einen nativen Discord-Provider (`socialProviders.discord`) mit konfigurierbarer Callback-URL.

**2 Realtime**
- A 4: Collection-Abos per SSE reichen für Pin-Moves und Chat einer kleinen Gruppe; Würfelauswertung braucht trotzdem einen Hook, und SSE hinter Proxies braucht lange Timeouts (Doku: 360 s).
- B 5: Der Realtime-Dienst ist dafür gebaut (Broadcast/Postgres-Changes) und trifft Chat plus gleichzeitige Pin-Positionen.
- C 4: Socket.IO (oder vergleichbares WS) erfüllt die 1-Sekunden-Spikes, muss aber Räume, Auth am Socket und den Coolify-/Traefik-WebSocket-Upgrade selbst verdrahten.

**3 Dateispeicher**
- A 4: File-Felder erlauben konfigurierbares `MaxSize` (Default ~5 MB, 20 MB möglich); die Doku warnt, dass große Dateien die App belasten, und Proxies müssen `client_max_body_size` anheben.
- B 5: Storage ist ein eigener Dienst mit S3-kompatiblem Backend; 10–20 MB sind unkritisch.
- C 4: Upload ins persistente Volume mit MIME- und Größenprüfung ist Standard, aber komplett Eigenbau (kein fertiges Storage-Produkt).

**4 Rechte auf Datenebene**
- A 3: API-Rules filtern Records, bilden aber die Rechtematrix (Weltrolle, Tagebuch pro Eintrag, Vererbung, Relation Quelle+Ziel, Archiv statt Löschen) nicht ohne umfangreiche JS-Hooks ab.
- B 4: RLS plus SQL-Hilfsfunktionen können die Matrix erzwingen und gelten automatisch für OAuth-Tokens; polymorphe Relationen und Vererbung werden trotzdem lange Policies.
- C 5: Eine TypeScript-Rechteschicht plus Postgres-Constraints/partielle Unique-Indexes setzt T-011 und Plan `002` auf demselben Code durch, inklusive Test-Login-Skripte per `curl`.

**5 Ressourcen / Coolify (ohne T-001-Messwerte)**
- A 5: Ein Binary, SQLite, ein Volume; passt auch neben einem bereits laufenden Coolify.
- B 2: Offizielles Minimum 4 GB RAM / 2 Kerne / 40 GB SSD für den vollen Stack, mehrere Container; ohne Serverdaten aus T-001 zu schwer für die Rahmenbedingungen.
- C 4: App-Container plus Postgres, moderater RAM; übliches Coolify-Anwendungsmuster.

**6 Backup & Wiederherstellung**
- A 4: Eingebautes ZIP von `pb_data` (DB + lokale Dateien), optional S3; Restore ist als experimentell gekennzeichnet.
- B 4: `pg_dump` ist Standard, Dateien liegen aber im Storage-Dienst und müssen getrennt gesichert werden.
- C 3: `pg_dump` plus Volume-Kopie sind machbar, es gibt keine Produkt-UI; der Punkt liegt ohnehin im Backlog (ehemals T-012).

**7 Typsicherheit / DX**
- A 2: JS/TS-SDK existiert, das Schema lebt in Collections; PocketBase ist vor v1.0 ohne stabile Kompatibilität.
- B 5: Generierte Datenbanktypen und ein ausgereiftes Ökosystem.
- C 5: Drizzle-Schema ist die Typquelle für API, Tests und später MCP-Werkzeuge in einer Sprache.

**8 Anbieterbindung**
- A 3: MIT und SQLite-Datei sind portabel, API-Rules, Hooks und das JS-SDK sind PocketBase-spezifisch.
- B 2: Self-Hosting ist OSS, der Betrieb hängt aber an GoTrue, PostgREST, Realtime und Storage; ein Ausstieg ist ein Rewrite.
- C 5: PostgreSQL, Drizzle und Better Auth sind austauschbare Bibliotheken hinter eigenem Schema und eigener API.

**9 MCP-Tauglichkeit (doppelt)**
- A 2: PocketBase ist OAuth-Client, nicht Autorisierungsserver; Metadaten, DCR, Resource Indicators und Scope `worlds:read` wären Eigenbau oder ein inoffizielles Go-Plugin, getrennt von den Collection-Rules.
- B 4: Offizieller OAuth-2.1-Server mit PKCE, Discovery, DCR und MCP-Doku; RLS gilt für dieselben Tokens — aber Custom Scopes wie `worlds:read` (Plan `002` T-003) sind ausdrücklich nicht unterstützt.
- C 5: `@better-auth/mcp` macht die App zum OAuth-2.1-AS und zur Protected Resource (RFC 8414/9728, Consent, resource-gebundene Tokens, optionales DCR, CIMD, eigene Scopes); `requireMcpAuth` liefert den Benutzerkontext an dieselbe Rechteschicht wie die HTTP-API.

## Entscheidung

**Gewählt: C – Eigenes TypeScript-Backend** (Node.js, PostgreSQL, Drizzle, Better Auth, WebSockets).

Die gewichtete Summe ist am höchsten (45 gegenüber 40 und 34). Ausschlaggebend ist Kriterium 9: Plan `002` verlangt WorldCraft als OAuth-2.1-Autorisierungsserver mit Scope `worlds:read` und gemeinsamer Rechteschicht. Better Auth liefert das als Bibliothek. Supabase kommt als OAuth-AS nah heran, scheitert aber am Custom-Scope und am Ressourcenprofil ohne T-001. PocketBase gewinnt beim Betrieb, verliert bei MCP, Rechten und Typen.

**Freigabe:** Der Projektinhaber hat Option C am 2026-09-22 bestätigt. Zusätzlicher Grund außerhalb der Bewertungstabelle: Es existiert bereits produktiv genutzter Code auf derselben Basis in einem anderen Projekt des Inhabers; Folgeaufgaben (ab T-007) dürfen dort spicken, ohne das andere Projekt zu kopieren oder seine Secrets zu übernehmen.

## Gegenprüfung

### (a) Stärkste Argumente gegen C

1. **Mehr Eigenbau jetzt:** Upload, Realtime und die Rechteschicht sind keine Fertigprodukte. A und B liefern davon mehr Out-of-the-Box; C verschiebt Aufwand in T-007 bis T-011.
2. **Zwei bewegliche Teile hinter dem Proxy:** WebSockets und 20-MB-Uploads müssen in Coolify (Traefik/Caddy, Body-Limit, Timeout) stimmen; das ist der wahrscheinlichste Smoketest-Fail (T-014).
3. **Better Auth MCP ist ein junges Plugin:** Das Profil zielt auf MCP 2026-07-28 (CIMD vor DCR). Plan `002` schreibt DCR noch fest; das Plugin kann DCR einschalten, der Spec-Stand kann sich vor der Umsetzung von Plan `002` weiter drehen.

### (b) Stärkstes Argument für die zweitbeste Option (B)

Supabase ist der einzige Kandidat, bei dem **derselbe OAuth-2.1-Token** automatisch unter **denselben RLS-Policies** läuft, mit offizieller MCP-Auth-Dokumentation und DCR. Für Plan `002` wäre das die kleinste konzeptionelle Lücke bei der gemeinsamen Rechteschicht — wenn Custom Scopes entfallen dürften und der Host den vollen Stack sicher trägt.

Warum das nicht reicht: Plan `002` T-003 verlangt den Scope `worlds:read` in den Authorization-Server-Metadaten. Die Supabase-Doku nennt Custom Scopes als nicht unterstützt. Zusätzlich ist das Self-Host-Minimum (4 GB RAM) ohne T-001 ein Betriebsrisiko, das C und A nicht in gleichem Maß haben.

### (c) Belegte Tatsachenbehauptungen

Abrufdatum aller Links: 2026-09-22.

| Behauptung | Quelle |
|---|---|
| PocketBase: OAuth2-Login über externe Provider (inkl. Discord über `authWithOAuth2`), Redirect `/api/oauth2-redirect` | https://pocketbase.io/docs/authentication/ |
| PocketBase: File-Felder Default ~5 MB, `MaxSize` konfigurierbar; große Uploads können die App belasten | https://pocketbase.io/docs/files-handling/ |
| PocketBase: Realtime per SSE, Collection-/Record-Abos, View-/List-Rules | https://pocketbase.io/docs/api-realtime/ |
| PocketBase: Docker-Beispiel Version `0.40.4`, Volume `pb_data`; Backup als ZIP von `pb_data`, Restore als experimentell beschrieben | https://pocketbase.io/docs/going-to-production/ |
| PocketBase: MIT, vor v1.0 keine volle Rückwärtskompatibilität | https://github.com/pocketbase/pocketbase |
| Supabase Self-Host Minimum: 4 GB RAM, 2 Kerne, 40 GB SSD | https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/self-hosting/docker.mdx |
| Supabase: Discord u. a. Social-Login per `GOTRUE_EXTERNAL_*` | https://supabase.com/docs/guides/self-hosting/self-hosted-oauth |
| Supabase Auth als OAuth-2.1-AS, PKCE, DCR, MCP als Use-Case; Standard-Scopes `openid`, `email`, `profile`, `phone` | https://supabase.com/docs/guides/auth/oauth-server |
| Supabase: „Custom scopes are not currently supported“ | https://supabase.com/docs/guides/auth/oauth-server/oauth-flows |
| Supabase: MCP-Auth-Anleitung (Discovery, optionales DCR, Consent selbst bauen, RLS auf Tokens) | https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication |
| Better Auth: Discord-Provider | https://better-auth.com/docs/authentication/discord |
| Better Auth: `mcp()` als OAuth-2.1-Provider + Protected Resource (RFC 8414/9728), Consent, optionales DCR, CIMD, `requireMcpAuth`, eigene Scopes | https://better-auth.com/docs/plugins/mcp |
| Better Auth: Drizzle-Adapter (`sqlite` / `pg` / `mysql`) | https://better-auth.com/docs/adapters/drizzle |
| Claude Custom Connectors: OAuth mit DCR (`oauth_dcr`) oder CIMD (`oauth_cimd`) | https://claude.com/docs/connectors/building/authentication |
| MCP-Spezifikation: OAuth 2.1, RFC 9728, Resource Indicators RFC 8707 | https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization |
| Plan `002` T-003: Scope `worlds:read`, PKCE nur `S256`, DCR, Resource-gebundene Tokens | `.ai/feature-tasks/002-mcp-server.md` |

### (d) Vereinbarkeit mit bereits getroffenen Entscheidungen

- Fachliches Datenmodell (freigegeben 2026-09-22): C setzt es in T-006 als PostgreSQL/Drizzle um (Constraints, JSONB, polymorphe Verweise). Kein Widerspruch.
- T-001 Won't do: C hängt nicht an gemessenen Serverwerten; B täte das stärker.
- Editor (TipTap, T-005) und Kartenbibliothek (T-004) sind frontendseitig; C ist frameworkagnostisch. Keine Vorfestlegung, die ADR-002 widerspräche.
- Kein älteres Backend-ADR vorhanden.

Die Empfehlung bleibt C. Die Gegenprüfung ändert die Rangfolge nicht: das stärkste B-Argument (RLS + fertiger OAuth-AS) wiegt das Scope-Loch gegenüber Plan `002` und das Ressourcenrisiko ohne T-001 nicht auf.

## Konsequenzen

- **Stack:** TypeScript-Backend (Node.js), PostgreSQL, Drizzle, Better Auth mit Discord, Realtime über WebSockets, Dateien auf Volume. Konkrete Versionen hält T-013 in `.ai/tech-stack.md` fest, sobald das Grundgerüst (T-007) steht.
- **Auth jetzt:** Discord-OAuth als Client (T-008) plus Test-Login. **Auth später:** dieselbe Better-Auth-Instanz als OAuth-2.1-AS für MCP (Plan `002`); DCR trotz CIMD-Empfehlung der Bibliothek einschalten, solange Plan `002` DCR fordert.
- **Rechte:** Eine serverseitige Schicht, von HTTP, WebSockets und MCP genutzt. Postgres sichert Uniqueness/Archive-Regeln; die Matrix selbst bleibt Anwendungslogik mit Tests (T-011).
- **Betrieb:** Coolify-App plus Postgres-Dienst, HTTPS, persistente Volumes für DB und Uploads, Proxy-Limits für 20 MB und WebSockets. Lokale Dev: Postgres per Docker Compose, App per Dev-Server.
- **Nicht gewählt:** PocketBase (MCP-AS fehlt, Rechte/Typen zu schwach) und selbst gehostetes Supabase (zu schwer ohne T-001, kein Scope `worlds:read`).
- **Änderungspflicht:** Scheitert T-005, T-008–T-011 oder T-014 am Backend, wird dieses ADR überarbeitet (siehe T-002 / T-013 Stopp bei No-Go).
- **Nächste abhängige Aufgaben nach Freigabe:** T-003 (Frontend), T-006 (technisches Schema), T-007 (Grundgerüst & Coolify).
