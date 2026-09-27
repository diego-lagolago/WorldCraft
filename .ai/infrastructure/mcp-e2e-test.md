# MCP OAuth E2E-Protokoll

**Server:** `https://worldcraft.lagolago.at/mcp`  
**Stand:** 2026-09-27  
**Regel:** Niemals Authorization-Codes, Tokens, PKCE-Verifier, `state` oder Secrets eintragen.

## Vorabprüfung (2026-09-27)

| Prüfschritt | Ergebnis | Nachweis |
|---|---|---|
| Nicht authentifiziertes `POST /mcp` | bestanden | `401` mit `WWW-Authenticate: Bearer resource_metadata="https://worldcraft.lagolago.at/.well-known/oauth-protected-resource/mcp"` und Scope `worlds:read`. |
| Protected-Resource-Metadaten | bestanden | `/.well-known/oauth-protected-resource/mcp` nennt die Resource und den Authorization Server `/api/auth`. |
| Authorization-Server-Metadaten | bestanden | `/.well-known/oauth-authorization-server/api/auth` meldet PKCE `S256`, DCR und CIMD. |
| Lokale OAuth-Tests | bestanden | `npm test -- --run src/lib/mcp-oauth.test.ts`, `npm run test:mcp`, `npm run typecheck`; enthält Redirect-, DCR-, PKCE-, Limit- und Tool-Zugriffsprüfungen. |

## Kompatibilitätsmatrix

| Client / Weg | OAuth-Anmeldung | Tool-Aufruf `quests_auflisten` | Status | Notiz |
|---|---|---|---|---|
| Codex, CIMD | Browser gestartet | ausstehend | läuft | `codex mcp list` meldet `OAuth`; Codex verwendet CIMD, `S256` und dynamischen HTTP-Loopback. Abschluss braucht einen Discord-Login. |
| Claude, CIMD | ausstehend | ausstehend | offen | Neue Connector-Verbindung ohne wiederverwendete Altregistrierung testen. |
| Öffentliche DCR | automatisiert bestanden | lokal bestanden | bestanden | Integrationstest registriert einen Public Client, tauscht PKCE-Code und ruft ein Lese-Tool auf; unsichere Redirects, vertrauliche Client-Authentifizierung und nicht unterstützte Grants werden abgelehnt. |
| Fest registrierter Client | ausstehend | ausstehend | offen | Nur durchführen, falls ein solcher Client betrieblich noch unterstützt wird; Redirect muss exakt registriert sein. |

## Manuelle Abnahme

### Codex (CIMD)

1. `codex mcp login worldcraft --no-browser` ausführen und den ausgegebenen Browser-Link öffnen.
2. Mit einem berechtigten Discord-Konto anmelden und Consent bestätigen. Der dynamische Loopback-Callback muss automatisch zum wartenden Codex-Prozess zurückkehren.
3. `codex mcp list` kontrollieren: `worldcraft` ist aktiviert und als `OAuth` erkannt.
4. Eine neue Codex-Aufgabe mit „Frage über WorldCraft die offenen Quests ab“ starten.
5. Bestehen: Die WorldCraft-Tools werden eingebunden, `quests_auflisten` wird aufgerufen und liefert nur Quests, die das angemeldete Konto sehen darf.

### Claude (CIMD)

1. Eine neue WorldCraft-MCP-Verbindung anlegen (keine gespeicherte Altverbindung wiederverwenden).
2. Den automatischen OAuth-Flow mit einem berechtigten Discord-Konto abschließen.
3. Eine offene Quest abfragen.
4. Bestehen: CIMD-Client-ID, `S256`, erfolgreicher Token-Austausch und sichtbarkeitskonformes Tool-Ergebnis im OAuth-/Audit-Log dokumentieren (ohne Tokens oder Codes).

## Abschlussvermerk

| Datum | Client / Weg | Ergebnis | Verantwortlich |
|---|---|---|---|
| 2026-09-27 | Codex CIMD | Login gestartet, Abschluss und Quest-Abfrage ausstehend | Codex / Projektinhaber |
