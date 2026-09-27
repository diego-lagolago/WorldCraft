import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BASE, login } from "@/test/api-harness";

const protocolMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

type McpCredentials = {
  session: Awaited<ReturnType<typeof login>>;
  clientId: string;
  accessToken: string;
  refreshToken: string;
};

type McpClient = { clientId: string; redirectUri: string };

async function registerMcpClient(port: number, clientName: string): Promise<McpClient> {
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const registered = await fetch(`${BASE}/api/auth/oauth2/register`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${port % 255}` },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      application_type: "native",
      token_endpoint_auth_method: "none",
      client_name: clientName,
    }),
  });
  expect(registered.status).toBe(201);
  const clientId = (await json(registered)).client_id;
  expect(typeof clientId).toBe("string");
  return { clientId: clientId as string, redirectUri };
}

async function authorizeMcpClient(discordId: string, client: McpClient): Promise<McpCredentials> {
  const session = await login(discordId);

  const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorize = new URL(`${BASE}/api/auth/oauth2/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    scope: "worlds:read offline_access",
    resource: `${BASE}/mcp`,
    code_challenge_method: "S256",
    code_challenge: challenge,
  }).toString();
  const authorization = await fetch(authorize, { headers: { cookie: session.cookie }, redirect: "manual" });
  const authorizationPayload = authorization.status === 200 ? await json(authorization) : null;
  expect([200, 302]).toContain(authorization.status);
  const consentLocation = authorization.headers.get("location") ?? authorizationPayload?.url;
  expect(typeof consentLocation).toBe("string");
  const oauthQuery = (consentLocation as string).split("?", 2)[1];
  const consent = await fetch(`${BASE}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, cookie: session.cookie },
    body: JSON.stringify({ accept: true, oauth_query: oauthQuery }),
  });
  const decision = await json(consent);
  expect(typeof decision.url).toBe("string");
  const code = new URL(decision.url as string).searchParams.get("code");
  expect(code).toBeTruthy();

  const token = await fetch(`${BASE}/api/auth/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code!,
      redirect_uri: client.redirectUri,
      client_id: client.clientId,
      code_verifier: verifier,
    }),
  });
  expect(token.status).toBe(200);
  const credentials = await json(token);
  expect(typeof credentials.access_token).toBe("string");
  expect(typeof credentials.refresh_token).toBe("string");
  return {
    session,
    clientId: client.clientId,
    accessToken: credentials.access_token as string,
    refreshToken: credentials.refresh_token as string,
  };
}

async function callTool(accessToken: string, name: string, args: Record<string, unknown> = {}) {
  const response = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": "tools/call",
      "mcp-name": name,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args, _meta: protocolMeta },
    }),
  });
  expect(response.status).toBe(200);
  return json(response);
}

function toolText(result: Record<string, unknown>): string {
  return JSON.stringify(result);
}

describe("MCP OAuth and protected resource", () => {
  it("CR-024: advertises discovery and a machine-readable unauthenticated challenge", async () => {
    const challenge = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(challenge.status).toBe(401);
    expect(challenge.headers.get("www-authenticate")).toContain("resource_metadata=");

    const [resource, issuer] = await Promise.all([
      fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`),
      fetch(`${BASE}/.well-known/oauth-authorization-server/api/auth`),
    ]);
    expect(resource.status).toBe(200);
    expect(issuer.status).toBe(200);
    const resourceMetadata = await json(resource);
    const issuerMetadata = await json(issuer);
    expect(resourceMetadata.authorization_servers).toEqual([`${BASE}/api/auth`]);
    expect(issuerMetadata.client_id_metadata_document_supported).toBe(true);
    expect(issuerMetadata.code_challenge_methods_supported).toContain("S256");
  });

  it("CR-024 / CR-025: limits public DCR to five registrations per minute and IP", async () => {
    const testIp = `203.0.113.${1 + (Date.now() % 200)}`;
    const body = JSON.stringify({
      redirect_uris: ["http://127.0.0.1:9977/callback"],
      application_type: "native",
      token_endpoint_auth_method: "none",
      client_name: "MCP DCR rate-limit test",
    });
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await fetch(`${BASE}/api/auth/oauth2/register`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": testIp },
        body,
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  });

  it("rejects unsafe DCR redirects, exchanges a PKCE code and calls a read tool", async () => {
    const metadata = await fetch(`${BASE}/.well-known/oauth-protected-resource`);
    expect(metadata.status, "Dev-Server mit MCP_ENABLED=true starten.").toBe(200);

    const unsafe = await fetch(`${BASE}/api/auth/oauth2/register`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["http://evil.example/callback"] }),
    });
    expect(unsafe.status).toBe(400);

    const confidential = await fetch(`${BASE}/api/auth/oauth2/register`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://127.0.0.1:9876/callback"], application_type: "native",
        token_endpoint_auth_method: "client_secret_basic", grant_types: ["authorization_code"],
      }),
    });
    expect(confidential.status).toBe(400);
    expect((await json(confidential)).error).toBe("invalid_client_metadata");

    const unsupportedGrant = await fetch(`${BASE}/api/auth/oauth2/register`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://127.0.0.1:9876/callback"], application_type: "native",
        token_endpoint_auth_method: "none", grant_types: ["client_credentials"],
      }),
    });
    expect(unsupportedGrant.status).toBe(400);
    expect((await json(unsupportedGrant)).error).toBe("invalid_client_metadata");

    const client = await registerMcpClient(9876, "MCP Integration Test");
    const session = await login("test-player-a");
    const unsafeAuthorize = new URL(`${BASE}/api/auth/oauth2/authorize`);
    unsafeAuthorize.search = new URLSearchParams({
      response_type: "code",
      client_id: client.clientId,
      redirect_uri: "http://evil.example/callback",
      scope: "worlds:read",
      resource: `${BASE}/mcp`,
    }).toString();
    const blockedAuthorize = await fetch(unsafeAuthorize, { headers: { cookie: session.cookie }, redirect: "manual" });
    expect(blockedAuthorize.status).toBe(400);
    expect(blockedAuthorize.headers.get("location")).toBeNull();
    expect((await json(blockedAuthorize)).error).toBe("invalid_request");
    const credentials = await authorizeMcpClient("test-player-a", client);

    const call = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credentials.accessToken}`, "content-type": "application/json",
        "mcp-protocol-version": "2026-07-28", "mcp-method": "tools/call", "mcp-name": "welten_auflisten",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "welten_auflisten", arguments: {}, _meta: protocolMeta } }),
    });
    expect(call.status).toBe(200);
    const result = await json(call);
    expect(JSON.stringify(result)).toContain("MCP-Testwelt");
  });

  it("CR-001: revoking an application invalidates its access and refresh tokens", async () => {
    const client = await registerMcpClient(9877, "MCP Revocation Test");
    const credentials = await authorizeMcpClient("test-master", client);
    const revoked = await fetch(`${BASE}/api/connected-applications/${encodeURIComponent(credentials.clientId)}`, {
      method: "DELETE",
      headers: { origin: BASE, cookie: credentials.session.cookie },
    });
    expect(revoked.status).toBe(200);

    const access = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${credentials.accessToken}`, "content-type": "application/json" },
      body: "{}",
    });
    expect(access.status).toBe(401);

    const refresh = await fetch(`${BASE}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: credentials.clientId,
      }),
    });
    expect(refresh.status).toBe(400);
    expect((await json(refresh)).error).toBe("invalid_grant");
  });

  it("T-008: keeps journals, chat, hidden content, and disabled worlds inaccessible by role", async () => {
    const client = await registerMcpClient(9880, "MCP Authorization Matrix Test");
    const [gameMaster, master, playerA, playerB] = await Promise.all([
      authorizeMcpClient("test-gm", client),
      authorizeMcpClient("test-master", client),
      authorizeMcpClient("test-player-a", client),
      authorizeMcpClient("test-player-b", client),
    ]);

    const [gmHidden, playerHidden, masterPrivate, gmPrivate] = await Promise.all([
      callTool(gameMaster.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "SLTEST" }),
      callTool(playerA.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "SLTEST" }),
      callTool(master.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "NURICHTEST" }),
      callTool(gameMaster.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "NURICHTEST" }),
    ]);
    expect(toolText(gmHidden)).toContain("Archiv der Spielleitung");
    expect(toolText(playerHidden)).not.toContain("Archiv der Spielleitung");
    expect(toolText(masterPrivate)).toContain("Private Notiz des Masters");
    expect(toolText(gmPrivate)).not.toContain("Private Notiz des Masters");

    for (const credentials of [gameMaster, master, playerA, playerB]) {
      const [journal, chat] = await Promise.all([
        callTool(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "GEHEIMTEST" }),
        callTool(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "CHATTEST" }),
      ]);
      expect(toolText(journal)).not.toContain("GEHEIMTEST");
      expect(toolText(chat)).not.toContain("CHATTEST");
    }

    const worlds = await callTool(playerB.accessToken, "welten_auflisten");
    expect(toolText(worlds)).toContain("MCP-Zweite-Welt");
    const disabled = await callTool(playerB.accessToken, "suchen", {
      welt: "MCP-Zweite-Welt",
      suchbegriff: "Rabenstein",
    });
    expect(toolText(disabled)).toContain("MCP ist für diese Welt nicht freigegeben.");
  });
});
