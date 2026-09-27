# MCP-OAuth-Anbindung an Claude – Fehleranalyse und Lehren

Stand: 2026-09-27, MCP-Server-Version aus `package.json`. Ergänzt [mcp.md](mcp.md).

Dieses Dokument hält fest, warum die Verbindung von Claude (claude.ai) zum WorldCraft-MCP-Server nach dem Release 0.1.6 zunächst scheiterte, welche Korrekturen nötig waren und was bei künftigen MCP-Servern mit eigenem OAuth-Server von Anfang an beachtet werden muss. Der technische Kern ist projektunabhängig.

## Ausgangslage

- MCP-Endpunkt (Resource): `https://worldcraft.lagolago.at/mcp`
- OAuth-Server: Better Auth mit den Plugins `@better-auth/mcp`, `@better-auth/oauth-provider` und `@better-auth/cimd`, Issuer `https://worldcraft.lagolago.at/api/auth`
- Endpunkte: `/api/auth/oauth2/authorize`, `/api/auth/oauth2/token`, `/api/auth/oauth2/register`, `/api/auth/oauth2/consent`
- Login über Discord, Zustimmungsseite unter `/oauth/consent`
- Betrieb: Next.js-Container hinter dem Reverse-Proxy von Coolify (Traefik)

Claude bietet beim Hinzufügen eines Connectors zwei Wege an:

| Weg | Client-Identität | Voraussetzung auf Serverseite |
|---|---|---|
| **Claude Auth (CIMD)** | `client_id` ist die URL `https://claude.ai/oauth/mcp-oauth-client-metadata` (Client ID Metadata Document) | Server muss CIMD unterstützen und das in den Metadaten mit `client_id_metadata_document_supported: true` ausweisen |
| **Client-ID** | per Dynamic Client Registration (DCR) oder manuell registrierte `client_id` | Registrierung oder DCR-Endpunkt |

## Chronologie der Fehler und Korrekturen

Die Fehler lagen hintereinander im Flow. Jede Korrektur legte den nächsten Fehler frei.

### 1. Login verlor die OAuth-Anfrage (0.1.6 → `e4b30d8`)

**Symptom:** Nach dem Discord-Login landete man auf der WorldCraft-Startseite statt auf der Zustimmungsseite. Der OAuth-Flow kam nie zurück zu Claude.

**Ursache:** Der Login-Screen hängte die OAuth-Query selbst und unsigniert an `signIn.social` an. Better Auth erwartet eine **signierte** `oauth_query` (Parameter `sig`, `exp`, `ba_iat`) und verwirft andere.

**Korrektur:** Das Client-Plugin `oauthProviderClient()` in `src/lib/auth-client.ts` registrieren. Es signiert die aktuelle Query automatisch bei jedem nicht lesenden Auth-Request. Nach dem Discord-Callback setzt der Server den Authorize-Flow dann selbst fort.

**Lehre:** Die Fortsetzung des Flows nach dem Login nie selbst nachbauen, sondern den dafür vorgesehenen Client-Mechanismus des Auth-Frameworks nutzen. Die signierte Query läuft nach 10 Minuten ab, der Login muss also in dieser Zeit abgeschlossen sein.

### 2. `/authorize` lieferte 404 (`e4b30d8`)

**Symptom:** Claude rief `https://worldcraft.lagolago.at/authorize` auf und bekam 404.

**Ursache:** Siehe Abschnitt 5. Claude fand die Metadaten nicht und fiel auf die alten Standardpfade der MCP-Spezifikation 2025-03-26 zurück: `/authorize`, `/token` und `/register` direkt an der Origin.

**Korrektur:** Kompatibilitätsroute `src/app/authorize/route.ts`, die per 307 auf `/api/auth/oauth2/authorize` umleitet und die komplette Query übernimmt.

### 3. Redirect auf `0.0.0.0` hinter dem Proxy (`6548dd3`)

**Symptom:** Die Umleitung von `/authorize` zeigte auf `http://0.0.0.0:80/api/auth/oauth2/authorize`.

**Ursache:** `new URL(pfad, request.url)` nutzt hinter dem Reverse-Proxy die interne Adresse des Containers, nicht die öffentliche Domain.

**Korrektur:** Redirect-Ziele immer aus der konfigurierten öffentlichen Basis-URL bilden (`getAuthUrl()` bzw. `BETTER_AUTH_URL`), nie aus `request.url`.

**Lehre:** Gilt für jede absolute URL, die ein Container hinter einem Proxy erzeugt: Redirects, Metadaten und Callback-URLs.

### 4. `/token` lieferte 404 (0.1.6.2, `4d6932d`)

**Symptom:** Auf dem Client-ID-Weg zeigte Claude nach dem Autorisieren einen Fehler. In den Logs standen nur `authorize` 302, aber weder Consent noch Token.

**Ursache:** Die Zustimmung war für diesen Client bereits in `oauth_consent` gespeichert. Better Auth überspringt dann die Zustimmungsseite und leitet mit dem Code direkt zurück zu Claude. Claude tauschte den Code anschließend am Fallback-Pfad `POST /token` ein, und den gab es nicht. Der 404 wurde nicht geloggt, weil `/token` kein OAuth-Pfad der App war.

**Korrektur:** Kompatibilitätsroute `src/app/token/route.ts`. Sie leitet **intern** an den Better-Auth-Handler weiter, statt umzuleiten, denn Token-Clients folgen Redirects auf POST oft nicht. Grant-Prüfung (Discord-Allowlist) und OAuth-Logging greifen so unverändert.

**Lehre:** Wer einen Fallback-Pfad bedient, muss alle bedienen: `/authorize` **und** `/token`. Ein bestehender Consent verkürzt den Flow, fehlende Consent-Logs sind dann kein Fehler.

### 5. Discovery-Metadaten an den falschen Pfaden (0.1.6.3, `90107aa`) – die eigentliche Ursache

**Symptom:** Mit „Claude Auth“ (CIMD) scheiterte die Verbindung, ohne dass eine einzige Anfrage an einem OAuth-Endpunkt ankam.

**Ursache:** Beide Metadaten-Dokumente lagen nur an der Origin, nicht an den Pfaden, die die RFCs für eine Resource bzw. einen Issuer **mit Pfad** vorschreiben:

| Dokument | Gesucht (RFC-konform) | Vorhanden war nur |
|---|---|---|
| Protected Resource Metadata (RFC 9728) für die Resource `…/mcp` | `/.well-known/oauth-protected-resource/mcp` | `/.well-known/oauth-protected-resource` |
| Authorization Server Metadata (RFC 8414) für den Issuer `…/api/auth` | `/.well-known/oauth-authorization-server/api/auth` | `/.well-known/oauth-authorization-server` und `/api/auth/.well-known/oauth-authorization-server` |

Der Header `WWW-Authenticate` der 401-Antwort von `/mcp` nannte korrekt `resource_metadata="https://…/.well-known/oauth-protected-resource/mcp"`. Diese URL lieferte aber 404.

- Ein spec-konformer Client (CIMD) bricht dann ab, bevor er den Browser weiterleitet.
- Der Client-ID-Weg wich auf die alten Standardpfade aus. Das erklärt die Fehler 2 und 4: Die Aliasse waren Symptombehandlung, die fehlende Discovery war die Ursache.

**Korrektur:** Zwei Routen, die die bestehenden Handler wiederverwenden:

- `src/app/.well-known/oauth-protected-resource/mcp/route.ts`
- `src/app/.well-known/oauth-authorization-server/api/auth/route.ts`

**Lehre:** Die Pfadregel der RFCs:

- Liegt die Resource unter einem Pfad, wird dieser Pfad **hinter** `/.well-known/oauth-protected-resource` angehängt.
- Hat der Issuer einen Pfad, wird dieser Pfad **hinter** `/.well-known/oauth-authorization-server` eingefügt, nicht davor.

Die Aliasse `/authorize` und `/token` bleiben für Clients mit alter Registrierung bestehen.

## Technische Bestandsaufnahme (Review CR-023–CR-026)

| Baustein | Implementierung | Erwartetes Verhalten |
|---|---|---|
| MCP Resource | `src/app/mcp/route.ts` | `POST /mcp` ohne Bearer-Token → `401` mit `WWW-Authenticate: Bearer resource_metadata="…/oauth-protected-resource/mcp"`; gültige JWTs brauchen Audience `/mcp` und `worlds:read`. |
| Protected-Resource-Discovery | `src/app/.well-known/oauth-protected-resource/route.ts` | Root- und `/mcp`-Pfad delegieren an das `mcp()`-Plugin. Das Dokument nennt die Resource und `authorization_servers`. |
| Authorization-Server-Discovery | `src/app/.well-known/oauth-authorization-server/route.ts` | Der RFC-8414-Pfad delegiert an `oauthProviderAuthServerMetadata(auth)` und meldet unter anderem `S256`, `none` und `client_id_metadata_document_supported: true`. |
| Authorization | `src/app/api/auth/[...all]/route.ts`, `/api/auth/oauth2/authorize` | Unzulässige oder fehlende Redirect-URI → `400 invalid_request`, ohne Weiterleitung. Login und Consent erfolgen danach über Better Auth. |
| Token | `src/app/api/auth/[...all]/route.ts`, `/api/auth/oauth2/token`; Alias `src/app/token/route.ts` | Code- und Refresh-Grant; ungültige Grants → OAuth-Fehler (`invalid_grant` bzw. `access_denied` für D13). |
| DCR | `src/lib/auth.ts`, `src/lib/mcp-oauth.ts` | Öffentliche native Clients mit `token_endpoint_auth_method: none`; nur HTTPS oder Loopback-HTTP. Mehr als fünf Registrierungen pro IP/Minute → `429`. |
| CIMD | `src/lib/auth.ts` mit `@better-auth/cimd/node` | HTTPS-Client-ID-URL, sicherer Abruf und Validierung durch die Bibliothek; siehe Sicherheitsgrenzen unten. |

Die Redirect-Prüfung von WorldCraft liegt zentral in `isAllowedMcpRedirectUri` und wird sowohl für DCR (`hasAllowedMcpRegistrationRedirects`) als auch am Authorize-Endpunkt (`hasAllowedMcpAuthorizeRedirect`) angewandt. Sie akzeptiert HTTPS sowie `http://127.0.0.1:<beliebiger-port>`, `http://[::1]:<beliebiger-port>` und `http://localhost:<beliebiger-port>`; private-use-URIs, Fremdhosts und sonstiges HTTP werden abgelehnt. Danach prüft der OAuth-Provider die registrierte URI einschließlich Schema, Host und Pfad. Für Loopback-Clients entfernt Better Auth beim Vergleich nur den Port (`stripLoopbackRedirectPort`); das ist der Grund, warum ein dynamischer Callback-Port funktioniert, eine geänderte Callback-URI aber nicht.

### Feste Client-ID und `invalid_redirect`

Eine feste Client-ID ist **nicht im Quellcode hinterlegt**. Manuell oder per DCR registrierte Clients liegen zur Laufzeit in `oauth_clients`; ihre Redirect-URIs stehen dort in `redirect_uris`. Sie sind keine Secrets, gehören aber zur betrieblichen OAuth-Konfiguration und werden nicht aus der Produktionsdatenbank in die Repository-Dokumentation kopiert.

Der reproduzierbare Fehlerfall für Codex lautet: Codex verwendet eine bei der festen Client-ID nicht registrierte Callback-URI (oder unterscheidet sich bei Nicht-Loopback in Schema, Host oder Pfad). Better Auth beendet den Authorize-Request dann mit `invalid_redirect`, bevor ein Code oder Token entstehen kann. Für die konkrete Analyse werden der gekürzte `client_id`-Fingerabdruck aus dem OAuth-Log, die verwendete Callback-URI und die zugehörige `oauth_clients.redirect_uris`-Zeile verglichen; Tokens, Codes und Client-Secrets werden nicht protokolliert.

Für Claude ist der reproduzierbare Gegenfall der CIMD-Flow: `client_id=https://claude.ai/oauth/mcp-oauth-client-metadata`, eine zulässige HTTPS-Redirect-URI und PKCE `S256` führen über Login und Consent zum Code- und Token-Austausch. Die lokalen Integrationstests decken Discovery, DCR, PKCE und Fehlerpfade ab; die tatsächlichen Codex-/Claude-Connector-Schritte bleiben als Produktionsprotokoll in `.ai/infrastructure/mcp-e2e-test.md` festzuhalten.

### CIMD-Sicherheitsgrenzen

`fetchClientMetadataResource` aus `@better-auth/cimd/node` verlangt HTTPS sowie `GET`/`HEAD`, löst den Host genau einmal auf und lehnt jede nicht öffentlich routbare DNS-Antwort ab. Die freigegebene Adresse wird für die Verbindung gepinnt; TLS-SNI, Zertifikatsprüfung und `Host` bleiben an den ursprünglichen Namen gebunden. Redirect-Antworten werden nicht gefolgt.

Die Bibliothek begrenzt den Body auf **5 KB**, bricht nach **5 s** ab und validiert MIME-Typ, JSON, übereinstimmende `client_id`, Metadatenprofil und Redirect-URIs. WorldCraft setzt darüber `metadataRevalidationInterval: 15 Minuten`, mindestens **60 s** zwischen fehlgeschlagenen Abrufen derselben Client-ID, maximal 16 parallele Abrufe (4 pro Origin), 120 Starts/min global und 30/min pro Origin. Diese Werte sind in `MCP_CIMD_LIMITS` fest definiert.

## Beobachtbarkeit

Ohne Logs war der Fehler nicht eingrenzbar, weil Claude nur eine allgemeine Fehlermeldung zeigt. Eingeführt wurden dafür `f4a6554` und `c49e80d` sowie das Event `mcp_oauth_compat_token` in 0.1.6.2. Implementierung in `src/lib/mcp/oauth-observability.ts`.

| Event | Wann |
|---|---|
| `mcp_oauth` | Jede nicht erfolgreiche Antwort unter `/api/auth/oauth2/*`, dazu **jede** Antwort von `consent` und `token` |
| `mcp_oauth_consent_page` | Zustimmungsseite gerendert (nach dem Session-Check), mit `access_allowed` |
| `mcp_oauth_compat_authorize` | Aufruf des Fallback-Pfads `/authorize` |
| `mcp_oauth_compat_token` | Aufruf des Fallback-Pfads `/token` |
| `mcp_oauth_exception` | Ausnahme im OAuth-Handler |

**Geloggt werden nur:** Endpunkt, Methode, Status, `grant_type`, OAuth-Fehlercode samt Beschreibung sowie ein gekürzter SHA-256-Fingerabdruck der `client_id` (12 Hex-Zeichen).

**Nie geloggt werden:** Tokens, Codes, PKCE-Werte, `state`, rohe Client-IDs.

Fingerabdruck einer bekannten Client-ID berechnen:

```bash
printf %s 'https://claude.ai/oauth/mcp-oauth-client-metadata' | shasum -a 256 | cut -c1-12
```

Für Claudes CIMD-Identität ergibt das `87035c02ba6c`.

### Erwartete Log-Sequenzen

**CIMD, erste Verbindung:**

```
mcp_oauth  authorize  302
mcp_oauth_consent_page
mcp_oauth  consent    200
mcp_oauth  token      200  authorization_code
```

**Client mit alter Registrierung und bestehender Zustimmung:**

```
mcp_oauth_compat_authorize
mcp_oauth  authorize  302
mcp_oauth_compat_token
mcp_oauth  token      200  authorization_code
```

**Token-Erneuerung**, etwa eine Stunde nach der letzten Ausgabe: `mcp_oauth  token  200  refresh_token`.

### Welche Identität ist tatsächlich aktiv?

Das Audit-Log speichert die rohe `client_id` jedes Werkzeugaufrufs:

```sql
SELECT client_id, tool_name, result, created_at
FROM mcp_audit_logs
ORDER BY created_at DESC
LIMIT 5;
```

Claude nutzt nach dem Entfernen und erneuten Hinzufügen eines Connectors unter Umständen weiterhin die gespeicherte alte Registrierung. Eine erfolgreiche Verbindung beweist also nicht, dass der gewählte Weg funktioniert. Nachgewiesen ist CIMD erst, wenn als `client_id` `https://claude.ai/oauth/mcp-oauth-client-metadata` erscheint oder eine Person ohne Vorgeschichte sich direkt verbindet.

## Vorgehen bei der Fehlersuche

1. **Log-Stream verifizieren:** Marker-Requests mit bekannter Client-ID absetzen und prüfen, ob sie in der beobachteten Log-Ansicht erscheinen. So lassen sich falscher Container, falsche Coolify-Ressource und eine eingefrorene Log-Ansicht ausschließen.
2. **Revision verifizieren:** Einen Endpunkt, der sich zwischen Versionen unterscheidet, mehrfach abfragen. So fällt ein alter Container im Load-Balancing auf.
3. **Discovery wie ein Client abfragen:** den Header `WWW-Authenticate` der 401-Antwort von `/mcp` lesen und jede dort genannte bzw. RFC-konform abgeleitete URL abrufen (siehe Checkliste).
4. **Fehlende Logs ernst nehmen:** Erscheint eine erwartete Zeile nicht, hat der Request die App nicht erreicht oder ging an einen Pfad außerhalb der geloggten Routen. Das ist ein Befund, kein Rauschen.

## Checkliste für künftige MCP-Server mit eigenem OAuth-Server

Vor dem ersten Verbindungsversuch mit Claude gegen die **öffentliche** Domain prüfen:

- [ ] `POST /mcp` ohne Token liefert 401 mit `WWW-Authenticate: Bearer resource_metadata="…"`.
- [ ] Die URL aus `resource_metadata` liefert 200 mit `resource` und `authorization_servers`.
- [ ] `/.well-known/oauth-protected-resource<Resource-Pfad>` liefert 200, z. B. `/.well-known/oauth-protected-resource/mcp`.
- [ ] Für jeden Eintrag in `authorization_servers` mit Pfad liefert `/.well-known/oauth-authorization-server<Issuer-Pfad>` 200, z. B. `/.well-known/oauth-authorization-server/api/auth`.
- [ ] Die Metadaten enthalten `client_id_metadata_document_supported: true` (für CIMD), `code_challenge_methods_supported` mit `S256` und `token_endpoint_auth_methods_supported` mit `none`.
- [ ] Alle URLs in den Metadaten und alle Redirects verwenden die öffentliche Domain, nicht die interne Container-Adresse.
- [ ] Ein Authorize-Aufruf mit Claudes CIMD-Client-ID liefert 302 zum Login bzw. zur Zustimmung, nicht 400.
- [ ] Nach dem Login führt der Flow zur Zustimmungsseite und nicht auf die Startseite.
- [ ] Für Clients mit alter Registrierung: `/authorize` und `POST /token` an der Origin funktionieren oder sind bewusst nicht vorgesehen.
- [ ] OAuth-Logging ist aktiv, bevor echte Clients getestet werden.

Prüfkommando für die Discovery:

```bash
B=https://example.com
curl -s -D - -o /dev/null -X POST $B/mcp -H 'content-type: application/json' --data '{}' | grep -i www-auth
for p in /.well-known/oauth-protected-resource/mcp /.well-known/oauth-authorization-server/api/auth; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' $B$p)"
done
```
