# ADR-005 – Remote-MCP-Server

**Status:** angenommen
**Datum:** 2026-09-26
**Bezug:** Plan `002` T-001; ADR-001; `.ai/architecture.md`; `src/lib/authz/`

## Kontext

WorldCraft stellt einen öffentlich erreichbaren, aber nur nach OAuth-Anmeldung nutzbaren MCP-Endpunkt bereit. Er muss dieselbe fachliche Rechteschicht wie die App nutzen: Ein KI-Client darf nie mehr lesen als der angemeldete WorldCraft-Benutzer. Die erste Ausbaustufe ist ausschließlich lesend (`worlds:read`).

## Entscheidungen

### 1. MCP-SDK

Wir verwenden das offizielle TypeScript-Paket **`@modelcontextprotocol/server@2.1.0`** (MCP-Spezifikation **2026-07-28**) mit Zod 4. Der Server wird über `createMcpHandler` erzeugt und mit `legacy: "reject"` konfiguriert. Damit akzeptiert WorldCraft nur den aktuellen zustandslosen Streamable-HTTP-Transport und keine sitzungsorientierte Altimplementierung.

Das SDK ist die Protokollschicht: Tool-Registrierung, JSON-RPC und HTTP-Transport. Es enthält weder Fachlogik noch eigene Berechtigungen.

### 2. Betriebsart

Der Endpunkt ist ein **zustandsloser `POST /mcp` Route Handler im bestehenden Next.js-Backend**, kein separater Container. Für jede HTTP-Anfrage wird ein frischer MCP-Server erstellt. OAuth- und Audit-Daten bleiben dauerhaft in PostgreSQL, der MCP-Transport selbst hält keine Sitzung.

Das passt zur Einzel-Replica-Architektur aus ADR-001, vermeidet einen zweiten Deploy-/Secret-/Monitoring-Pfad und erlaubt den direkten Zugriff auf `auth`, `src/lib/authz/` und die Domänenschicht. `subscriptions/listen` wird nicht angeboten; bei einer späteren Multi-Replica-Entscheidung wäre dafür ein gemeinsamer Event-Bus erforderlich.

### 3. OAuth-Umsetzung

WorldCraft verwendet **Better Auth 1.7.6** mit `jwt()` sowie **`@better-auth/mcp@1.7.6`** als OAuth-2.1-Authorization-Server und Protected Resource. Ergänzend wird **`@better-auth/cimd@1.7.6`** mit dem Profil `mcp-2026-07-28` installiert. Das Plugin stellt OAuth-Standardflüsse, JWT/JWKS, Resource Binding und die Standard-Metadaten bereit; das SDK transportiert MCP. Die Paketversionen werden gemeinsam gelockt; bei der Installation in T-003 wird die konkrete Lockfile-Version geprüft.

Der aktuelle MCP-Standard bevorzugt CIMD statt DCR. Plan `002` fordert jedoch ausdrücklich DCR und Claude unterstützt weiterhin DCR. Daher aktivieren wir **beides**: CIMD ist der moderne Standardweg; DCR bleibt kompatibler Fallback durch `allowDynamicClientRegistration: true` und `allowUnauthenticatedClientRegistration: true`. DCR-Redirect-URIs werden zusätzlich auf HTTPS oder den explizit erlaubten Loopback-Hosts `localhost`/`127.0.0.1` beschränkt.

| Anforderung aus T-003 | Abgedeckt durch Bibliothek | Eigenbau in WorldCraft |
|---|---|---|
| RFC-9728 Protected-Resource-Metadata | `mcp()` | Root-Alias `/.well-known/oauth-protected-resource`, Hauptschalter-404 und Tests |
| RFC-8414 Authorization-Server-Metadata | `mcp()` | Root-Alias, Scope-/Laufzeitkonfiguration, Hauptschalter-404 und Tests |
| Authorization Code, PKCE S256, Ressourcenbindung | `mcp()` / OAuth Provider | erzwingende Tests und Rückkehr in den OAuth-Ablauf nach Discord-Login |
| DCR | OAuth Provider bei expliziter Freigabe | Redirect-Policy und Tests für abgelehnte HTTP-Fremdhost-URIs |
| CIMD | `@better-auth/cimd` | sichere Node-Transport-Konfiguration gemäß Paketdokumentation |
| Access-/Refresh-Token, Hash-Speicherung, Rotation, Widerruf | OAuth Provider | Laufzeiten 1 h/30 d, keine Reuse-Toleranz, UI zum Widerruf sowie Mitgliedschafts-/Allowlist-Prüfung |
| Consent-Datensatz und OAuth-Protokoll | OAuth Provider | deutsche Zustimmungsseite mit Client-Hinweis, Redirect-Domain und WorldCraft-Texten |
| Discord-Login | vorhandenes Better Auth | Rücksprung in den unvollständigen OAuth-Flow und D13-Prüfung bei jedem OAuth-Schritt |
| Allowlist und keine aktive Weltmitgliedschaft | – | serverseitige Prüfungen bei Autorisierung, Zustimmung, Token, Refresh und MCP-Anfrage |
| `WWW-Authenticate`, JWT-, Issuer-, Audience-, Ablauf- und Scope-Prüfung | `requireMcpAuth` | `worlds:read` als erforderlicher Scope, Revocation-/Allowlist-Prüfung und Fehler-Mapping |

Die Autorisierungsserver-Metadaten und die `/mcp`-Resource verwenden als kanonische Production-URLs `https://worldcraft.lagolago.at` bzw. `https://worldcraft.lagolago.at/mcp`; lokal sind ausschließlich Loopback-URLs zulässig. T-012 sorgt dafür, dass beide Metadatenpfade, OAuth-Routen und `/mcp` bei `MCP_ENABLED !== "true"` wie nicht vorhanden mit 404 antworten.

### 4. Scope-Modell

In dieser Ausbaustufe existiert nur `worlds:read`. Jede Tool-Definition deklariert ihren benötigten Scope in einer zentralen Tool-Registry. Der Route-Handler fordert mindestens `worlds:read` mit `requireMcpAuth`; die Registry prüft ihn vor der Toolausführung noch einmal, damit ein künftig anders erreichbarer Aufruf keinen Scope umgehen kann.

`worlds:write` ist reserviert, aber jetzt weder in Consent noch Discovery noch Tool-Registry aktiv. Ein späteres schreibendes Werkzeug erhält eine explizite `requiredScopes: ["worlds:write"]`-Deklaration und wird nicht durch einen Read-Token autorisiert.

### 5. Rechteschicht

`requireMcpAuth` liefert verifizierte Token-Claims (`sub`, Client-ID, Scope, Audience). Eine einzige Adapterfunktion löst `sub` zum WorldCraft-Benutzer auf, prüft `isDiscordIdAllowed` und erzeugt den MCP-Request-Kontext. Alle Werkzeuge rufen ausschließlich öffentliche Funktionen aus `src/lib/authz/` und `src/lib/domain/` mit diesem Kontext auf.

MCP-Module importieren weder `db` noch Tabellen aus `src/db/schema.ts`. Das wird durch Modulstruktur, Code-Review und die Rechte-/Ausschlusssuite abgesichert. Feste Ausschlüsse (Tagebuch, Chat, Dateien/URLs außerhalb von `bild_lesen`, Kartenbilder, Marker und Koordinaten) liegen zentral an der MCP-Fassade und werden nicht den einzelnen Abfragen überlassen.

### 6. TipTap-JSON nach Markdown

Wir ergänzen unter `src/lib/editor/` einen reinen, getesteten Server-Serializer `tiptapJsonToMcpMarkdown`. Er akzeptiert ausschließlich die im WorldCraft-Editor erlaubten JSON-Knoten und erzeugt sicheres Markdown ohne HTML. Erwähnungen werden anhand der gespeicherten Attribute als `@[Titel](art:id)` ausgegeben. Unbekannte oder kaputte Knoten werden nicht als Roh-JSON durchgereicht, sondern als sicherer Klartext behandelt und protokollierbar gekürzt.

Diese kleine, explizite Transformation ist dem Einbau eines weiteren Markdown-Editorpakets vorzuziehen: Sie entspricht genau dem vorhandenen TipTap-Schema, läuft ohne DOM im Node-Route-Handler und lässt sich mit Beispielen aus Artikeln, Quests, Pins, Charakteren und Monstern testen.

### 7. Grundlage für den späteren Schreib-Plan

Ein späterer Plan kann `worlds:write` aktivieren. Von MCP neu angelegte Inhalte starten immer mit `owner_only` („nur ich“), niemals veröffentlicht; ein Löschwerkzeug wird nicht angeboten. Das Audit-Log erhält dann zusätzlich die Herkunft `mcp`.

Der spätere Plan liefert einen separaten, validierten Markdown-zu-TipTap-Parser. Er muss die unter Punkt 6 definierte Erwähnungssyntax erhalten, nur erlaubte Knoten erzeugen und dieselbe Rechteschicht und Versions-/Standprüfung verwenden. Diese Anforderungen sind festgehalten, aber nicht Teil von Plan `002`.

### 8. Schalter

`isMcpEnabled()` kommt in `src/lib/env.ts` und ist die einzige Interpretation von `MCP_ENABLED`. Eine gemeinsame MCP-Request-Grenze prüft ihn **vor** OAuth- und MCP-Verarbeitung. Jede `/.well-known`-Route, OAuth-Route und `/mcp` delegiert zunächst an diese Grenze und liefert andernfalls 404.

Die Weltfreigabe ist `worlds.mcp_enabled`. Die zentrale Weltauflösung für jedes fachliche Werkzeug prüft Mitgliedschaft, dann diese Freigabe. `welten_auflisten` ist die einzige Ausnahme und gibt gesperrte Welten nur minimal gekennzeichnet zurück. Damit kann weder eine neue Tool-Route noch ein direkter Name/ID-Parameter die Freigabe umgehen.

### 9. Bildinhalte

`bild_lesen` liefert ausschließlich MCP-`image`-Content mit Base64-Daten, MIME-Typ `image/jpeg` oder `image/webp`, nie URLs, Dateipfade oder Datei-IDs. Claude unterstützt Bild-Tool-Ergebnisse laut der offiziellen Connector-Dokumentation. Für claude.ai, Claude Desktop und Claude Code gilt dieselbe Remote-Connector-Infrastruktur; der aktuelle Support-Artikel beschreibt insbesondere, dass die Verbindung bei allen drei aus der Anthropic-Cloud erfolgt.

Als konservatives, Client-unabhängiges Budget setzen wir **maximal 1568 px an der langen Kante und 1 MB nach Kodierung**. Anthropic dokumentiert dafür keine kleinere harte Ergebnisgrenze. T-013 prüft deshalb Format, Abmessungen, Größe und die Verarbeitung eines zulässigen 10-MB-Uploads; ein manueller E2E-Test in T-010 bestätigt die tatsächliche Modellweitergabe.

## Anforderungen der Claude-Clients

**Abgerufen am 2026-09-26.**

- Claude-Custom-Connectors akzeptieren eine URL eines öffentlichen Remote-MCP-Servers; die Verbindung wird auch für Claude Desktop über Anthropic-Cloud-Infrastruktur hergestellt. OAuth ist der normale Anmeldeweg. [Claude Support: Custom Connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- Claude bietet in den Connector-Einstellungen zusätzlich optionale statische OAuth-Client-ID/-Secret an. Unser Server bleibt durch DCR und CIMD ohne vorab registrierten Client nutzbar. Ein konfigurierter statischer Client darf nur mit derselben Redirect-/Consent-Policy zugelassen werden. [Claude Support: Connector-Einrichtung](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- Claude Code registriert einen Remote-Server via `claude mcp add --transport http <name> <url>` und startet den OAuth-Flow über `/mcp`; Tokens werden anschließend sicher gespeichert und automatisch erneuert. Für lokale Browser-Callbacks ist der Port konfigurierbar (`MCP_OAUTH_CALLBACK_PORT` bzw. `--callback-port`). Es gibt daher **keine feste, dokumentierte Claude-Code-Callback-URL**: DCR prüft die vom Client übermittelte Loopback-URI. [Claude Code: MCP](https://docs.anthropic.com/en/docs/claude-code/mcp), [Claude Code: Umgebungsvariablen](https://code.claude.com/docs/en/env-vars)
- Für das ältere, weiterhin relevante Claude-Web-DCR-Profil ist die dokumentierte Callback-URI `https://claude.ai/api/mcp/auth_callback`; sie wird nicht fest verdrahtet, sondern als gültige HTTPS-Redirect-URI durch DCR akzeptiert. [Anthropic Help: Remote MCP Integrations](https://support.anthropic.com/en/articles/11503834-building-custom-integrations-via-remote-mcp-servers)
- Das MCP-TypeScript-SDK v2 implementiert die stabile Spezifikation **2026-07-28**; Better Auth empfiehlt dafür CIMD und stellt DCR nur auf explizite Aktivierung bereit. [MCP SDK auf npm](https://www.npmjs.com/package/@modelcontextprotocol/server), [Better Auth MCP](https://better-auth.com/docs/plugins/mcp)

## Konsequenzen

- T-003 installiert die genannten Pakete, ergänzt die Drizzle-Tabellen über eine **manuelle** Migration und führt den OAuth-Flow lokal mit MCP Inspector aus.
- T-005 nutzt ausschließlich den zustandslosen `POST /mcp`-Handler hinter `requireMcpAuth`.
- T-012 setzt die Schaltergrenze und die `worlds.mcp_enabled`-Migration um.
- Jede Abweichung von MCP 2026-07-28 oder ein Major-Upgrade von Better Auth/MCP-SDK erfordert eine Aktualisierung dieses ADRs und erneute lokale Inspector- sowie Claude-Client-Tests.
