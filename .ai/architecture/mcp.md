# MCP-Architektur

WorldCraft stellt unter `/mcp` einen ausschließlich lesenden Streamable-HTTP-MCP-Server bereit. Er ist nur aktiv, wenn `MCP_ENABLED=true` gesetzt ist. Zusätzlich muss die jeweilige Welt durch ihren Game Master freigegeben sein.

Fehleranalyse der Claude-Anbindung, Discovery-Pfade und Checkliste für künftige MCP-Server: [mcp-oauth-anbindung.md](mcp-oauth-anbindung.md).

## Client-Plugins (OpenAI)

Die Dateien unter `plugins/worldcraft/` ermöglichen die Ein-Klick-Einbindung in ChatGPT und Codex. Für Claude sind sie nicht nötig; Claude verbindet sich per MCP-URL (in claude.ai/Desktop als Custom Connector, in Claude Code per `claude mcp add --transport http`).

| Datei | Zweck |
|---|---|
| `plugins/worldcraft/mcp.json` | MCP-Endpunkt |
| `plugins/worldcraft/plugin.json` | Manifest nach agent-plugins.org-Schema mit Erweiterung `com.openai` |
| `plugins/worldcraft/.codex-plugin/plugin.json` | Codex-Manifest |

Die Texte `displayName`, `shortDescription`, `longDescription` und `defaultPrompt` stehen bewusst in beiden Manifesten und werden gemeinsam geändert. Die Plugin-Version folgt eigenem SemVer und ist von der App-Version unabhängig: Bei geänderten Texten oder Fähigkeiten steigt die Minor-Version, bei Korrekturen die Patch-Version.

## Ablauf

```mermaid
sequenceDiagram
  participant Client as KI-Client
  participant MCP as WorldCraft /mcp
  participant OAuth as OAuth-Server
  participant App as WorldCraft-App

  Client->>MCP: Protected-Resource-Metadaten
  Client->>OAuth: Authorization-Server-Metadaten
  Client->>OAuth: CIMD oder DCR + PKCE-Autorisierung
  OAuth->>App: Discord-Sitzung und Zustimmung
  App-->>OAuth: Zustimmung für worlds:read
  OAuth-->>Client: Access- und Refresh-Token
  Client->>MCP: Werkzeugaufruf mit Access-Token
  MCP->>App: Rechteschicht und Domänenabfrage
  App-->>MCP: ausschließlich sichtbare Inhalte
  MCP-->>Client: MCP-Antwort
```

## Token, Begrenzung und Audit

- Zugriffstoken gelten eine Stunde und sind auf die Ressource `/mcp` sowie den Scope `worlds:read` gebunden.
- Refresh-Tokens gelten 30 Tage und werden bei Verwendung rotiert.
- Vor Autorisierung, Token-Ausgabe, Refresh und jedem MCP-Aufruf wird die Discord-Allowlist geprüft.
- Pro Benutzer sind 60 Werkzeugaufrufe pro gleitender Minute zulässig. Der 61. Aufruf erhält HTTP `429` mit `Retry-After`.
- Jeder Werkzeugaufruf schreibt Zeitpunkt, Benutzer-ID, Client-ID, Werkzeugname, aufgelöste Welt-ID, Dauer und Ergebnis in das Audit-Log. Suchbegriffe, Inhalte und Bilddaten werden nie gespeichert. Einträge werden nach 30 Tagen täglich bereinigt.
- OAuth/DCR nutzt zusätzlich Better Auths In-Memory-Limiter pro Client-IP: `POST /oauth2/register` 5 pro 60 s, `/oauth2/authorize` und `/oauth2/token` je 30 pro 60 s; sonst 100 pro 10 s. Er ist auch lokal aktiv, damit die Integrationstests die Grenzen belegen. Coolify muss einen einzelnen vertrauenswürdigen `x-forwarded-for`-Wert weiterreichen; ein direkter Zugriff auf den Container ist nicht zulässig.
- CIMD verwendet den Node-Transport von `@better-auth/cimd`: HTTPS-only, DNS-Auflösung genau einmal, ausschließlich öffentlich routbare Adressen, gepinnte Verbindung und keine Redirects. Better Auth begrenzt den Dokumentabruf zusätzlich auf 5 KB und 5 s. WorldCraft pinnt die Revalidierung auf höchstens 15 Minuten und erneute Fehlversuche auf frühestens eine Minute.

## Neues MCP-Werkzeug hinzufügen

1. Scope und ausschließlich lesenden Umfang festlegen; Schreiboperationen gehören nicht in diesen Server.
2. Nur bestehende Domänen- und Rechteschicht verwenden. Das Werkzeug darf keine Tabellen direkt abfragen.
3. Sichtbarkeit, Weltfreigabe und die feste Ausschlussliste prüfen: Tagebuch, Chat, Einladungen, Koordinaten, Marker, Kartenbilder, Datei-IDs und URLs sind tabu.
4. Eingabeschema, deutschsprachige Beschreibung, Fehlertexte und Ausgabe-Begrenzung ergänzen.
5. Werkzeug über den Audit-Wrapper registrieren und keine Inhalte im Audit-Log ablegen.
6. Die lokale MCP-Suite um Rollen-, Sichtbarkeits- und Ausschlusstests erweitern und `npm run test:mcp` ausführen.
