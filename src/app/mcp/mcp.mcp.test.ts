import { createHash } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BASE, login, testSql } from "@/test/api-harness";
import { purgeMcpAuditLog } from "@/lib/mcp/audit";

/** 1×1 PNG used for multipart upload tests (T-008). */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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
  authorizationCode: string;
  codeVerifier: string;
};

type McpClient = { clientId: string; redirectUri: string; forwardedFor: string };

async function registerMcpClient(port: number, clientName: string): Promise<McpClient> {
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const forwardedFor = `198.51.100.${port % 255}`;
  const registered = await fetch(`${BASE}/api/auth/oauth2/register`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
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
  return { clientId: clientId as string, redirectUri, forwardedFor };
}

async function authorizeMcpClient(
  discordId: string,
  client: McpClient,
  scope = "worlds:read offline_access",
): Promise<McpCredentials> {
  const session = await login(discordId);

  const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorize = new URL(`${BASE}/api/auth/oauth2/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    scope,
    resource: `${BASE}/mcp`,
    code_challenge_method: "S256",
    code_challenge: challenge,
  }).toString();
  const authorization = await fetch(authorize, {
    headers: { cookie: session.cookie, "x-forwarded-for": client.forwardedFor },
    redirect: "manual",
  });
  const authorizationPayload = authorization.status === 200 ? await json(authorization) : null;
  expect([200, 302]).toContain(authorization.status);
  const consentLocation = authorization.headers.get("location") ?? authorizationPayload?.url;
  expect(typeof consentLocation).toBe("string");
  const oauthQuery = (consentLocation as string).split("?", 2)[1];
  const consent = await fetch(`${BASE}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, cookie: session.cookie, "x-forwarded-for": client.forwardedFor },
    body: JSON.stringify({ accept: true, oauth_query: oauthQuery }),
  });
  const decision = await json(consent);
  expect(typeof decision.url).toBe("string");
  const code = new URL(decision.url as string).searchParams.get("code");
  expect(code).toBeTruthy();

  const token = await fetch(`${BASE}/api/auth/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": client.forwardedFor },
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
    authorizationCode: code!,
    codeVerifier: verifier,
  };
}

async function callTool(accessToken: string, name: string, args: Record<string, unknown> = {}) {
  const response = await callToolResponse(accessToken, name, args);
  expect(response.status).toBe(200);
  return json(response);
}

async function callToolResponse(accessToken: string, name: string, args: Record<string, unknown> = {}) {
  return fetch(`${BASE}/mcp`, {
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
}

async function resetMcpRateLimit() {
  const response = await fetch(`${BASE}/api/test/mcp-rate-limit-reset`, { method: "POST" });
  expect(response.status).toBe(200);
}

function toolText(result: Record<string, unknown>): string {
  return JSON.stringify(result);
}

function firstToolText(result: Record<string, unknown>): string {
  const content = (result.result as { content?: unknown[] } | undefined)?.content;
  const text = content?.find((entry): entry is { type: string; text: string } => (
    typeof entry === "object" && entry !== null
    && (entry as { type?: unknown }).type === "text"
    && typeof (entry as { text?: unknown }).text === "string"
  ));
  expect(text).toBeDefined();
  return text!.text;
}

function imageContent(result: Record<string, unknown>) {
  const content = (result.result as { content?: unknown[] } | undefined)?.content;
  const image = content?.find((entry): entry is { type: string; data: string; mimeType: string } => (
    typeof entry === "object" && entry !== null && (entry as { type?: unknown }).type === "image"
  ));
  expect(image).toBeDefined();
  return image!;
}

type Fixture = {
  worldId: string;
  secondWorldId: string;
  burgId: string;
  personId: string;
  raceId: string;
  guildId: string;
  masterSecretId: string;
  activeQuestId: string;
  visiblePinId: string;
};

async function fixture(): Promise<Fixture> {
  const sql = testSql();
  try {
    const worlds = await sql.unsafe("SELECT id FROM worlds WHERE name = 'MCP-Testwelt' LIMIT 1");
    const secondWorlds = await sql.unsafe("SELECT id FROM worlds WHERE name = 'MCP-Zweite-Welt' LIMIT 1");
    const articles = await sql.unsafe("SELECT id, title FROM articles WHERE world_id = $1", [worlds[0].id]);
    const quests = await sql.unsafe("SELECT id FROM quests WHERE world_id = $1 AND title = 'Die Rückkehr des Rabens'", [worlds[0].id]);
    const pins = await sql.unsafe("SELECT id FROM pins WHERE title = 'Burgtor' LIMIT 1");
    const byTitle = new Map(articles.map((row: { id: string; title: string }) => [row.title, row.id]));
    return {
      worldId: worlds[0].id,
      secondWorldId: secondWorlds[0].id,
      burgId: byTitle.get("Burg Rabenstein")!,
      personId: byTitle.get("Hauptmann Arin")!,
      raceId: byTitle.get("Rabenblut")!,
      guildId: byTitle.get("Archiv der Spielleitung")!,
      masterSecretId: byTitle.get("Private Notiz des Masters")!,
      activeQuestId: quests[0].id,
      visiblePinId: pins[0].id,
    };
  } finally {
    await sql.end();
  }
}

describe("MCP OAuth and protected resource", () => {
  beforeEach(async () => {
    await resetMcpRateLimit();
  });

  it("CR-024: advertises discovery and a machine-readable unauthenticated challenge", async () => {
    const challenge = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(challenge.status).toBe(401);
    expect(challenge.headers.get("www-authenticate")).toContain("resource_metadata=");
    expect(challenge.headers.get("www-authenticate")).toMatch(/worlds:write/);

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
    expect(issuerMetadata.scopes_supported).toEqual(expect.arrayContaining(["worlds:read", "worlds:write"]));
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

  it("T-003: enforces S256 and rejects reused authorization and refresh credentials", async () => {
    const client = await registerMcpClient(9878, "MCP PKCE Lifecycle Test");
    const session = await login("test-player-a");
    const baseAuthorize = new URL(`${BASE}/api/auth/oauth2/authorize`);
    baseAuthorize.search = new URLSearchParams({
      response_type: "code",
      client_id: client.clientId,
      redirect_uri: client.redirectUri,
      scope: "worlds:read",
      resource: `${BASE}/mcp`,
      code_challenge_method: "plain",
      code_challenge: "not-a-s256-challenge",
    }).toString();
    const plain = await fetch(baseAuthorize, { headers: { cookie: session.cookie }, redirect: "manual" });
    expect(plain.status).toBe(400);
    const missingPkce = new URL(baseAuthorize);
    missingPkce.searchParams.delete("code_challenge_method");
    missingPkce.searchParams.delete("code_challenge");
    const missing = await fetch(missingPkce, { headers: { cookie: session.cookie }, redirect: "manual" });
    expect(missing.status).toBe(400);

    const postAuthorize = await fetch(`${BASE}/api/auth/oauth2/authorize`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: session.cookie },
      body: new URLSearchParams({
        response_type: "code",
        client_id: client.clientId,
        redirect_uri: client.redirectUri,
        scope: "worlds:read",
        resource: `${BASE}/mcp`,
        code_challenge_method: "S256",
        code_challenge: "valid-s256-challenge",
      }),
    });
    expect(postAuthorize.status).toBe(405);
    expect(postAuthorize.headers.get("allow")).toBe("GET");
    expect((await json(postAuthorize)).error).toBe("invalid_request");

    const credentials = await authorizeMcpClient("test-player-a", client);
    const refresh = await fetch(`${BASE}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: client.clientId,
      }),
    });
    expect(refresh.status).toBe(200);
    const refreshReuse = await fetch(`${BASE}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: client.clientId,
      }),
    });
    expect(refreshReuse.status).toBe(400);
    expect((await json(refreshReuse)).error).toBe("invalid_grant");

    // A replayed refresh token revokes its token family. Check the
    // authorization-code replay afterwards, so each behavior is isolated.
    const codeReuse = await fetch(`${BASE}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: credentials.authorizationCode,
        redirect_uri: client.redirectUri,
        client_id: client.clientId,
        code_verifier: credentials.codeVerifier,
      }),
    });
    expect(codeReuse.status).toBe(400);
    expect((await json(codeReuse)).error).toBe("invalid_grant");
  });

  it("T-003: a write token can use read tools", async () => {
    const client = await registerMcpClient(9889, "MCP Write Scope Read Test");
    const credentials = await authorizeMcpClient("test-player-a", client, "worlds:write offline_access");
    const result = await callTool(credentials.accessToken, "welten_auflisten");
    expect(toolText(result)).toContain("MCP-Testwelt");
  });

  it("T-003(3): declining consent redirects the client with access_denied", async () => {
    const client = await registerMcpClient(9879, "MCP Consent Rejection Test");
    const session = await login("test-player-a");
    const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~reject";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorize = new URL(`${BASE}/api/auth/oauth2/authorize`);
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: client.clientId,
      redirect_uri: client.redirectUri,
      scope: "worlds:read",
      resource: `${BASE}/mcp`,
      code_challenge_method: "S256",
      code_challenge: challenge,
    }).toString();
    const authorization = await fetch(authorize, {
      headers: { cookie: session.cookie, "x-forwarded-for": client.forwardedFor },
      redirect: "manual",
    });
    const payload = await json(authorization);
    const oauthQuery = (payload.url as string).split("?", 2)[1];
    const consent = await fetch(`${BASE}/api/auth/oauth2/consent`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, cookie: session.cookie, "x-forwarded-for": client.forwardedFor },
      body: JSON.stringify({ accept: false, oauth_query: oauthQuery }),
    });
    const decision = await json(consent);
    expect(new URL(decision.url as string).searchParams.get("error")).toBe("access_denied");
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
    const [data, client] = await Promise.all([fixture(), registerMcpClient(9880, "MCP Authorization Matrix Test")]);
    const [gameMaster, master, playerA, playerB] = await Promise.all([
      authorizeMcpClient("test-gm", client),
      authorizeMcpClient("test-master", client),
      authorizeMcpClient("test-player-a", client),
      authorizeMcpClient("test-player-b", client),
    ]);

    const [gmHidden, playerHidden, masterPrivate, gmPrivate, gmContent, masterSearch, masterContent, masterRelations] = await Promise.all([
      callTool(gameMaster.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "SLTEST" }),
      callTool(playerA.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "SLTEST" }),
      callTool(master.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "NURICHTEST" }),
      callTool(gameMaster.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "NURICHTEST" }),
      callTool(gameMaster.accessToken, "inhalt_lesen", { welt: "MCP-Testwelt", art: "artikel", id: data.guildId }),
      callTool(master.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "Archiv" }),
      callTool(master.accessToken, "inhalt_lesen", { welt: "MCP-Testwelt", art: "artikel", id: data.guildId }),
      callTool(master.accessToken, "relationen_abrufen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId, tiefe: 2 }),
    ]);
    expect(toolText(gmHidden)).toContain("Archiv der Spielleitung");
    expect(toolText(playerHidden)).not.toContain("Archiv der Spielleitung");
    expect(toolText(masterPrivate)).toContain("Private Notiz des Masters");
    expect(toolText(gmPrivate)).not.toContain("Private Notiz des Masters");
    expect(toolText(gmContent)).toContain("Archiv der Spielleitung");
    expect(toolText(masterSearch)).toContain("Archiv der Spielleitung");
    expect(toolText(masterContent)).toContain("Archiv der Spielleitung");
    expect(toolText(masterRelations)).toContain("Archiv der Spielleitung");

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

  it("T-006(1–7): resolves worlds, renders content, validates input, and filters readable lists", async () => {
    const [data, client] = await Promise.all([fixture(), registerMcpClient(9881, "MCP Read Tools Test")]);
    const [gameMaster, playerA, playerB] = await Promise.all([
      authorizeMcpClient("test-gm", client),
      authorizeMcpClient("test-player-a", client),
      authorizeMcpClient("test-player-b", client),
    ]);

    const [worldsA, worldsB, searchByName, searchWithoutWorld, allArticles, questItems, beasts, content, quest, pin, relations, universes, invalidWorld, foreignWorld, largeLimit] = await Promise.all([
      callTool(playerA.accessToken, "welten_auflisten"),
      callTool(playerB.accessToken, "welten_auflisten"),
      callTool(playerA.accessToken, "suchen", { welt: "mcp-testwelt", suchbegriff: "Rabenstein" }),
      callTool(playerA.accessToken, "suchen", { suchbegriff: "Rabenstein" }),
      callTool(playerA.accessToken, "inhalte_auflisten", { welt: "MCP-Testwelt", art: "artikel" }),
      callTool(playerA.accessToken, "inhalte_auflisten", { welt: "MCP-Testwelt", art: "artikel", vorlagentyp: "gegenstand", quest_gegenstand: true }),
      callTool(playerA.accessToken, "inhalte_auflisten", { welt: "MCP-Testwelt", art: "monster", monster_art: "Bestie" }),
      callTool(playerA.accessToken, "inhalt_lesen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId }),
      callTool(playerA.accessToken, "inhalt_lesen", { welt: "MCP-Testwelt", art: "quest", id: data.activeQuestId }),
      callTool(playerA.accessToken, "inhalt_lesen", { welt: "MCP-Testwelt", art: "pin", id: data.visiblePinId }),
      callTool(playerA.accessToken, "relationen_abrufen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId, tiefe: 2 }),
      callTool(gameMaster.accessToken, "universen_auflisten", { welt: "MCP-Testwelt" }),
      callTool(playerA.accessToken, "suchen", { welt: "unbekannte Welt", suchbegriff: "Rabenstein" }),
      callTool(playerA.accessToken, "suchen", { welt: data.secondWorldId, suchbegriff: "Rabenstein" }),
      callTool(playerA.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "Rabenstein", limit: 500 }),
    ]);

    expect(toolText(worldsA)).toContain("MCP-Testwelt");
    expect(toolText(worldsA)).not.toContain("MCP-Zweite-Welt");
    expect(toolText(worldsB)).toContain("MCP-Zweite-Welt");
    expect(toolText(searchByName)).toContain("Burg Rabenstein");
    expect(toolText(searchWithoutWorld)).toContain("Burg Rabenstein");
    expect(toolText(allArticles)).toContain("Schlüssel von Rabenstein");
    expect(toolText(questItems)).toContain("Schlüssel von Rabenstein");
    expect(toolText(questItems)).toContain("Quest-Gegenstand");
    expect(toolText(questItems)).not.toContain("Seil der Kundschafter");
    expect(toolText(beasts)).toContain("Rabenwolf");
    expect(toolText(beasts)).not.toContain("Knochenwolf");
    expect(toolText(content)).toContain("# Burg Rabenstein");
    expect(toolText(content)).toContain("Stand:");
    expect(toolText(content)).toContain(`@[Hauptmann Arin](artikel:${data.personId})`);
    expect(toolText(content)).not.toContain('"type":"doc"');
    expect(toolText(quest)).toContain("Öffentliches Kapitel");
    expect(toolText(quest)).toContain("Spur im Regen");
    expect(toolText(quest)).toMatch(/ID: [0-9a-f-]{36}/);
    expect(toolText(quest)).toContain("Notizblock zur aktiven Quest");
    expect(toolText(quest)).not.toContain("SLTEST im SL-Kapitel.");
    expect(toolText(pin)).toContain("Karte: Rabenmark-Karte");
    expect(toolText(pin)).not.toContain("pos_x");
    expect(toolText(relations)).not.toContain("Archiv der Spielleitung");
    expect(toolText(relations)).not.toContain("Private Notiz des Masters");
    expect(toolText(universes)).toContain("Verbotene Tiefen");
    expect(toolText(universes)).not.toContain("Burgtor");
    expect(toolText(universes)).not.toContain("pos_x");
    expect(toolText(invalidWorld)).toContain("Welt nicht gefunden.");
    expect(toolText(foreignWorld)).toContain("Welt nicht gefunden.");
    expect(toolText(foreignWorld)).not.toContain("MCP-Zweite-Welt");
    expect(toolText(searchByName)).toContain("– Ort");
    expect(toolText(searchByName)).not.toContain("– place");
    expect(toolText(largeLimit)).toContain("Zu groß");
  });

  it("T-013: exposes only visible nested revision tokens and updates each target independently", async () => {
    const [data, client] = await Promise.all([fixture(), registerMcpClient(9888, "MCP Nested Revision Test")]);
    const credentials = await authorizeMcpClient("test-player-a", client);
    const sql = testSql();
    try {
      const chapters = await sql.unsafe(
        "SELECT id FROM quest_chapters WHERE quest_id = $1 AND visibility = 'published' ORDER BY position",
        [data.activeQuestId],
      );
      expect(chapters).toHaveLength(2);
      const hidden = await sql.unsafe(
        "SELECT id FROM quest_chapters WHERE quest_id = $1 AND visibility = 'gm_only' LIMIT 1",
        [data.activeQuestId],
      );
      const [beforeQuest, beforeWorlds] = await Promise.all([
        callTool(credentials.accessToken, "inhalt_lesen", { welt: "MCP-Testwelt", art: "quest", id: data.activeQuestId }),
        callTool(credentials.accessToken, "welten_auflisten"),
      ]);
      const beforeQuestText = firstToolText(beforeQuest);
      const beforeWorldsText = firstToolText(beforeWorlds);
      const standFor = (value: string, id: string) => value.match(new RegExp(`ID: ${id}\\nStatus: [^\\n]+\\nStand: ([^\\n]+)`))?.[1];
      const firstBefore = standFor(beforeQuestText, chapters[0].id);
      const secondBefore = standFor(beforeQuestText, chapters[1].id);
      const worldBefore = beforeWorldsText.match(new RegExp(`## MCP-Testwelt\\nID: ${data.worldId}\\nStand: ([^\\n]+)`))?.[1];
      expect(firstBefore).toBeTruthy();
      expect(secondBefore).toBeTruthy();
      expect(worldBefore).toBeTruthy();
      expect(beforeQuestText).not.toContain(hidden[0].id);

      await Promise.all([
        sql.unsafe("UPDATE quest_chapters SET updated_at = updated_at + interval '1 second' WHERE id = $1", [chapters[0].id]),
        sql.unsafe("UPDATE worlds SET updated_at = updated_at + interval '1 second' WHERE id = $1", [data.worldId]),
      ]);
      const [afterQuest, afterWorlds] = await Promise.all([
        callTool(credentials.accessToken, "inhalt_lesen", { welt: "MCP-Testwelt", art: "quest", id: data.activeQuestId }),
        callTool(credentials.accessToken, "welten_auflisten"),
      ]);
      const afterQuestText = firstToolText(afterQuest);
      const afterWorldsText = firstToolText(afterWorlds);
      expect(standFor(afterQuestText, chapters[0].id)).not.toBe(firstBefore);
      expect(standFor(afterQuestText, chapters[1].id)).toBe(secondBefore);
      expect(afterWorldsText.match(new RegExp(`## MCP-Testwelt\\nID: ${data.worldId}\\nStand: ([^\\n]+)`))?.[1]).not.toBe(worldBefore);
    } finally {
      await sql.end();
    }
  });

  it("T-007(1–4): applies the role matrix to relations, quests, and universes", async () => {
    const [data, client] = await Promise.all([fixture(), registerMcpClient(9884, "MCP Relation Matrix Test")]);
    const [gameMaster, master, playerA] = await Promise.all([
      authorizeMcpClient("test-gm", client),
      authorizeMcpClient("test-master", client),
      authorizeMcpClient("test-player-a", client),
    ]);
    const [gmRelations, masterRelations, playerRelations, activeQuests, gmUniverses, playerUniverses] = await Promise.all([
      callTool(gameMaster.accessToken, "relationen_abrufen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId, tiefe: 2 }),
      callTool(master.accessToken, "relationen_abrufen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId, tiefe: 2 }),
      callTool(playerA.accessToken, "relationen_abrufen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId, tiefe: 2 }),
      callTool(playerA.accessToken, "quests_auflisten", { welt: "MCP-Testwelt", status: "aktiv" }),
      callTool(gameMaster.accessToken, "universen_auflisten", { welt: "MCP-Testwelt" }),
      callTool(playerA.accessToken, "universen_auflisten", { welt: "MCP-Testwelt" }),
    ]);

    expect(toolText(gmRelations)).toContain("Archiv der Spielleitung");
    expect(toolText(gmRelations)).not.toContain("Private Notiz des Masters");
    expect(toolText(masterRelations)).toContain("Private Notiz des Masters");
    expect(toolText(masterRelations)).toContain("Herkunft: Erwähnung");
    expect(toolText(masterRelations)).toContain("Herkunft: manuell");
    expect(toolText(masterRelations)).toContain("wird bewacht von");
    expect(toolText(playerRelations)).not.toContain("Archiv der Spielleitung");
    expect(toolText(playerRelations)).not.toContain("Private Notiz des Masters");
    expect(toolText(playerRelations)).toContain("Schlüssel von Rabenstein → Rabenblut");
    expect(toolText(activeQuests)).toContain("Die Rückkehr des Rabens");
    expect(toolText(activeQuests)).not.toContain("Der letzte Schwur");
    expect(toolText(gmUniverses)).toContain("Verbotene Tiefen");
    expect(toolText(playerUniverses)).not.toContain("Verbotene Tiefen");
    expect(toolText(playerUniverses)).not.toMatch(/Burgtor|marker|pos_[xy]/i);
  });

  it("T-006(6): asks for a world when a user has two MCP-enabled worlds", async () => {
    const [data, client] = await Promise.all([fixture(), registerMcpClient(9885, "MCP Ambiguous World Test")]);
    const playerB = await authorizeMcpClient("test-player-b", client);
    const sql = testSql();
    try {
      await sql.unsafe("UPDATE worlds SET mcp_enabled = true WHERE id = $1", [data.secondWorldId]);
      const result = await callTool(playerB.accessToken, "suchen", { suchbegriff: "Rabenstein" });
      expect(toolText(result)).toContain("Bitte nenne eine Welt:");
      expect(toolText(result)).toContain("MCP-Testwelt");
      expect(toolText(result)).toContain("MCP-Zweite-Welt");
    } finally {
      await sql.unsafe("UPDATE worlds SET mcp_enabled = false WHERE id = $1", [data.secondWorldId]);
      await sql.end();
    }
  });

  it("T-013(1–4): returns only bounded visible images and rejects map images", async () => {
    const [data, client] = await Promise.all([fixture(), registerMcpClient(9886, "MCP Image Read Test")]);
    const [gameMaster, playerA] = await Promise.all([
      authorizeMcpClient("test-gm", client),
      authorizeMcpClient("test-player-a", client),
    ]);
    const [articleImage, hiddenImage, missingImage, mapImage] = await Promise.all([
      callTool(playerA.accessToken, "bild_lesen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId }),
      callTool(gameMaster.accessToken, "bild_lesen", { welt: "MCP-Testwelt", art: "artikel", id: data.guildId }),
      callTool(playerA.accessToken, "bild_lesen", { welt: "MCP-Testwelt", art: "artikel", id: data.guildId }),
      callTool(playerA.accessToken, "bild_lesen", { welt: "MCP-Testwelt", art: "karte", id: data.burgId }),
    ]);
    const image = imageContent(articleImage);
    const metadata = await sharp(Buffer.from(image.data, "base64")).metadata();
    expect(image.mimeType).toBe("image/webp");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(1568);
    expect(Buffer.from(image.data, "base64").byteLength).toBeLessThanOrEqual(1024 * 1024);
    expect(imageContent(hiddenImage).mimeType).toBe("image/webp");
    expect(toolText(missingImage)).toContain("Bild nicht gefunden.");
    expect(toolText(mapImage)).toContain("Ungültige Option");
    for (const result of [articleImage, hiddenImage, missingImage, mapImage]) {
      expect(toolText(result)).not.toMatch(/data\/uploads|https?:\/\//);
    }
  });

  it("T-008: GEHEIMTEST, CHATTEST, coordinates, markers, files, and emails never leak for any user", async () => {
    const [data, client] = await Promise.all([fixture(), registerMcpClient(9882, "MCP Exclusion Scan")]);
    const users = await Promise.all([
      authorizeMcpClient("test-gm", client),
      authorizeMcpClient("test-master", client),
      authorizeMcpClient("test-player-a", client),
      authorizeMcpClient("test-player-b", client),
    ]);
    const calls: Array<[string, Record<string, unknown>]> = [
      ["welten_auflisten", {}],
      ["suchen", { welt: "MCP-Testwelt", suchbegriff: "Rabenstein" }],
      ["inhalte_auflisten", { welt: "MCP-Testwelt", art: "artikel" }],
      ["inhalt_lesen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId }],
      ["relationen_abrufen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId }],
      ["quests_auflisten", { welt: "MCP-Testwelt" }],
      ["universen_auflisten", { welt: "MCP-Testwelt" }],
      ["bild_lesen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId }],
    ];
    for (const user of users) {
      const results = await Promise.all(calls.map(([name, args]) => callTool(user.accessToken, name, args)));
      const combined = results.map(toolText).join("\n");
      for (const excluded of ["GEHEIMTEST", "CHATTEST", "pos_x", "pos_y", "character_markers", "monster_markers", "@localhost", "storage_key"]) {
        expect(combined).not.toContain(excluded);
      }
    }
  });

  it("T-008: a token without worlds:read is rejected for every read tool", async () => {
    const [data, client] = await Promise.all([fixture(), registerMcpClient(9887, "MCP Scope Test")]);
    const credentials = await authorizeMcpClient("test-player-a", client, "offline_access");
    const calls: Array<[string, Record<string, unknown>]> = [
      ["welten_auflisten", {}],
      ["suchen", { welt: "MCP-Testwelt", suchbegriff: "Rabenstein" }],
      ["inhalte_auflisten", { welt: "MCP-Testwelt", art: "artikel" }],
      ["inhalt_lesen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId }],
      ["relationen_abrufen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId }],
      ["quests_auflisten", { welt: "MCP-Testwelt" }],
      ["universen_auflisten", { welt: "MCP-Testwelt" }],
      ["bild_lesen", { welt: "MCP-Testwelt", art: "artikel", id: data.burgId }],
    ];
    for (const [name, args] of calls) {
      const response = await callToolResponse(credentials.accessToken, name, args);
      expect(response.status).toBe(403);
    }
  });

  it("T-009: records metadata without search terms and purges expired audit rows", async () => {
    const client = await registerMcpClient(9883, "MCP Audit Test");
    const credentials = await authorizeMcpClient("test-master", client);
    await callTool(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "Rabenstein" });

    const sql = testSql();
    try {
      const entries = await sql.unsafe("SELECT tool_name, world_id, result, created_at FROM mcp_audit_logs WHERE user_id = $1 AND client_id = $2 ORDER BY created_at DESC LIMIT 1", [credentials.session.user.id, client.clientId]);
      expect(entries[0].tool_name).toBe("suchen");
      expect(entries[0].world_id).toBeTruthy();
      expect(entries[0].result).toBe("ok");
      expect(JSON.stringify(entries[0])).not.toContain("Rabenstein");

      await sql.unsafe("INSERT INTO mcp_audit_logs (user_id, client_id, tool_name, duration_ms, result, created_at) VALUES ($1, $2, 'purge-old', 0, 'ok', now() - interval '31 days'), ($1, $2, 'purge-new', 0, 'ok', now() - interval '29 days')", [credentials.session.user.id, client.clientId]);
      await purgeMcpAuditLog();
      const purged = await sql.unsafe("SELECT tool_name FROM mcp_audit_logs WHERE user_id = $1 AND client_id = $2 AND tool_name LIKE 'purge-%' ORDER BY tool_name", [credentials.session.user.id, client.clientId]);
      expect(purged.map((row: { tool_name: string }) => row.tool_name)).toEqual(["purge-new"]);
    } finally {
      await sql.end();
    }
  });

});

function extractId(text: string): string {
  const match = /ID: ([0-9a-f-]{36})/i.exec(text);
  expect(match?.[1]).toBeTruthy();
  return match![1];
}

function extractStand(text: string): string {
  const match = /^Stand: (.+)$/m.exec(text);
  expect(match?.[1]).toBeTruthy();
  return match![1].trim();
}

function extractNoteStand(text: string): string {
  const match = /## Notizblock\nStand: (.+)/.exec(text);
  expect(match?.[1]).toBeTruthy();
  return match![1].trim();
}

function extractToken(text: string): string {
  const match = /Bestätigungs-Token: (\S+)/.exec(text);
  expect(match?.[1]).toBeTruthy();
  return match![1];
}

function extractUploadLink(text: string): string {
  const match = /^Link: (\S+)$/m.exec(text);
  expect(match?.[1]).toBeTruthy();
  return match![1];
}

function rightsError(text: string) {
  expect(text.toLowerCase()).toMatch(/recht|berechtigung|spielleitung|staff|darf|nur der game master/);
}

function notFoundError(text: string) {
  expect(text.toLowerCase()).toMatch(/nicht gefunden|gibt es nicht/);
}

/** Undo TipTap→Markdown escaping so assertions can use plain German text. */
function plainMcp(text: string) {
  return text.replace(/\\([\\`*_{}\[\]()#+.!|-])/g, "$1");
}

function schemaError(text: string) {
  expect(text.toLowerCase()).toMatch(/ungültig|invalid|enum|erwartete|art|option|unterstützen|schema/);
}

async function sqlHiddenQuest(worldId: string): Promise<string> {
  const sql = testSql();
  try {
    const rows = await sql.unsafe(
      "SELECT id FROM quests WHERE world_id = $1 AND visibility = 'owner_only' ORDER BY created_at DESC LIMIT 1",
      [worldId],
    );
    if (rows[0]?.id) return rows[0].id as string;
    const inserted = await sql.unsafe(
      `INSERT INTO quests (world_id, title, visibility, owner_id, created_by, updated_by, status)
       SELECT $1, 'MCP Hidden Quest', 'owner_only', u.id, u.id, u.id, 'open'
       FROM users u WHERE u.discord_id = 'test-gm' LIMIT 1
       RETURNING id`,
      [worldId],
    );
    return inserted[0].id as string;
  } finally {
    await sql.end();
  }
}

async function tableCounts(worldId: string): Promise<Record<string, number>> {
  const sql = testSql();
  try {
    const queries: Record<string, string> = {
      articles: "SELECT count(*)::int AS count FROM articles WHERE world_id = $1",
      quests: "SELECT count(*)::int AS count FROM quests WHERE world_id = $1",
      quest_chapters: "SELECT count(*)::int AS count FROM quest_chapters qc JOIN quests q ON q.id = qc.quest_id WHERE q.world_id = $1",
      monsters: "SELECT count(*)::int AS count FROM monsters WHERE world_id = $1",
      universes: "SELECT count(*)::int AS count FROM universes WHERE world_id = $1",
      relations: "SELECT count(*)::int AS count FROM relations WHERE world_id = $1",
      pins: `SELECT count(*)::int AS count FROM pins p
        JOIN maps m ON m.id = p.map_id JOIN universes u ON u.id = m.universe_id WHERE u.world_id = $1`,
      characters: "SELECT count(*)::int AS count FROM characters c JOIN world_participations wp ON wp.character_id = c.id WHERE wp.world_id = $1",
      character_markers: `SELECT count(*)::int AS count FROM character_markers mk
        JOIN maps m ON m.id = mk.map_id JOIN universes u ON u.id = m.universe_id WHERE u.world_id = $1`,
      monster_markers: `SELECT count(*)::int AS count FROM monster_markers mk
        JOIN maps m ON m.id = mk.map_id JOIN universes u ON u.id = m.universe_id WHERE u.world_id = $1`,
      maps: "SELECT count(*)::int AS count FROM maps m JOIN universes u ON u.id = m.universe_id WHERE u.world_id = $1",
      journal_entries: "SELECT count(*)::int AS count FROM journal_entries WHERE world_id = $1",
      chat_messages: "SELECT count(*)::int AS count FROM chat_messages WHERE world_id = $1",
      memberships: "SELECT count(*)::int AS count FROM memberships WHERE world_id = $1",
      invite_links: "SELECT count(*)::int AS count FROM invite_links WHERE world_id = $1",
    };
    const out: Record<string, number> = {};
    for (const [table, query] of Object.entries(queries)) {
      const rows = await sql.unsafe(query, [worldId]);
      out[table] = rows[0].count as number;
    }
    return out;
  } finally {
    await sql.end();
  }
}

async function protectedChecksums(worldId: string): Promise<Record<string, string>> {
  const sql = testSql();
  try {
    const queries: Record<string, string> = {
      pins: `SELECT coalesce(md5(string_agg(p.id::text || coalesce(p.updated_at::text, ''), ',' ORDER BY p.id)), '') AS c FROM pins p JOIN maps m ON m.id = p.map_id JOIN universes u ON u.id = m.universe_id WHERE u.world_id = $1`,
      characters: `SELECT coalesce(md5(string_agg(c.id::text || coalesce(c.updated_at::text, ''), ',' ORDER BY c.id)), '') AS c FROM characters c JOIN world_participations wp ON wp.character_id = c.id WHERE wp.world_id = $1`,
      character_markers: `SELECT coalesce(md5(string_agg(mk.id::text, ',' ORDER BY mk.id)), '') AS c FROM character_markers mk JOIN maps m ON m.id = mk.map_id JOIN universes u ON u.id = m.universe_id WHERE u.world_id = $1`,
      monster_markers: `SELECT coalesce(md5(string_agg(mk.id::text, ',' ORDER BY mk.id)), '') AS c FROM monster_markers mk JOIN maps m ON m.id = mk.map_id JOIN universes u ON u.id = m.universe_id WHERE u.world_id = $1`,
      maps: `SELECT coalesce(md5(string_agg(m.id::text || coalesce(m.updated_at::text, ''), ',' ORDER BY m.id)), '') AS c FROM maps m JOIN universes u ON u.id = m.universe_id WHERE u.world_id = $1`,
      journal_entries: `SELECT coalesce(md5(string_agg(id::text || coalesce(updated_at::text, ''), ',' ORDER BY id)), '') AS c FROM journal_entries WHERE world_id = $1`,
      chat_messages: `SELECT coalesce(md5(string_agg(id::text || coalesce(sent_at::text, ''), ',' ORDER BY id)), '') AS c FROM chat_messages WHERE world_id = $1`,
      memberships: `SELECT coalesce(md5(string_agg(id::text || role::text, ',' ORDER BY id)), '') AS c FROM memberships WHERE world_id = $1`,
      invite_links: `SELECT coalesce(md5(string_agg(id::text || coalesce(revoked_at::text, ''), ',' ORDER BY id)), '') AS c FROM invite_links WHERE world_id = $1`,
    };
    const out: Record<string, string> = {};
    for (const [key, query] of Object.entries(queries)) {
      const rows = await sql.unsafe(query, [worldId]);
      out[key] = rows[0].c as string;
    }
    return out;
  } finally {
    await sql.end();
  }
}

async function postUpload(link: string, file: Buffer, filename: string, mime: string, accept = "application/json") {
  const body = new FormData();
  body.append("datei", new Blob([new Uint8Array(file)], { type: mime }), filename);
  return fetch(link, {
    method: "POST",
    headers: accept ? { accept } : undefined,
    body,
  });
}

describe("MCP write tools", () => {
  const WRITE_SCOPE = "worlds:write offline_access";
  let data: Fixture;
  let countsBefore: Record<string, number>;
  let checksumsBefore: Record<string, string>;

  beforeAll(async () => {
    await resetMcpRateLimit();
    data = await fixture();
    countsBefore = await tableCounts(data.worldId);
    checksumsBefore = await protectedChecksums(data.worldId);
  });

  beforeEach(async () => {
    await resetMcpRateLimit();
  });

  afterAll(async () => {
    const countsAfter = await tableCounts(data.worldId);
    for (const [table, before] of Object.entries(countsBefore)) {
      expect(countsAfter[table], `${table} must not shrink`).toBeGreaterThanOrEqual(before);
    }
    const checksumsAfter = await protectedChecksums(data.worldId);
    expect(checksumsAfter).toEqual(checksumsBefore);
  });

  it("T-005: creates content kinds, confirms stubs, renames stubs, rejects players/pins", async () => {
    const client = await registerMcpClient(9890, "MCP Write Create Test");
    const gm = await authorizeMcpClient("test-gm", client, WRITE_SCOPE);
    const master = await authorizeMcpClient("test-master", client, WRITE_SCOPE);
    const player = await authorizeMcpClient("test-player-a", client, WRITE_SCOPE);
    const suffix = Date.now().toString(36);

    const article = await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: {
        titel: `MCP Artikel ${suffix}`,
        vorlagentyp: "person",
        vorlagenfelder: { Rasse: `@[Rabenblut](artikel:${data.raceId})` },
        text: "Ein neuer Testartikel.",
      },
    });
    const articleText = firstToolText(article);
    expect(articleText).toMatch(/Sichtbarkeit: nur ich/);
    expect(articleText).toMatch(/Art: artikel/);
    const articleId = extractId(articleText);

    const readArticle = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: articleId,
    }));
    expect(readArticle).toContain("Rasse:");
    expect(readArticle).toContain("Rabenblut");
    const masterRead = firstToolText(await callTool(master.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: articleId,
    }));
    notFoundError(masterRead);

    for (const [art, felder] of [
      ["quest", { titel: `MCP Quest ${suffix}`, beschreibung: "Beschreibung" }],
      ["kapitel", { quest_id: data.activeQuestId, titel: `MCP Kapitel ${suffix}`, text: "Kapiteltext" }],
      ["monster", { name: `MCP Monster ${suffix}`, monster_art: "Bestie" }],
      ["universum", { name: `MCP Universum ${suffix}`, beschreibung: "Universum" }],
    ] as const) {
      const created = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
        welt: "MCP-Testwelt", art, felder,
      }));
      expect(created).toMatch(art === "universum" ? /Sichtbarkeit: nur Spielleitung/ : /Sichtbarkeit: nur ich/);
      expect(created).toContain(`Art: ${art}`);
      const createdId = extractId(created);
      const readBack = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
        welt: "MCP-Testwelt",
        art: art === "kapitel" ? "quest" : art,
        id: art === "kapitel" ? data.activeQuestId : createdId,
      }));
      if (art === "kapitel") expect(readBack).toContain(`MCP Kapitel ${suffix}`);
      else expect(readBack).toContain(art === "monster" || art === "universum" ? `MCP ${art === "monster" ? "Monster" : "Universum"} ${suffix}` : `MCP Quest ${suffix}`);
    }

    const stubTitle = `Gräfin Mirelda MCP ${suffix}`;
    const stubPreview = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP StubTräger ${suffix}`, text: `@[${stubTitle}]` },
    }));
    expect(stubPreview).toContain("Bestätigungs-Token:");
    expect(stubPreview).toContain(stubTitle);
    const token = extractToken(stubPreview);
    const sql = testSql();
    try {
      const before = await sql.unsafe(
        "SELECT count(*)::int AS count FROM articles WHERE world_id = $1 AND title IN ($2, $3)",
        [data.worldId, `MCP StubTräger ${suffix}`, stubTitle],
      );
      expect(before[0].count).toBe(0);
      const confirmed = firstToolText(await callTool(gm.accessToken, "aenderung_bestaetigen", { token }));
      expect(confirmed).toContain(stubTitle);
      const after = await sql.unsafe(
        "SELECT id, title, visibility FROM articles WHERE world_id = $1 AND title IN ($2, $3) ORDER BY title",
        [data.worldId, `MCP StubTräger ${suffix}`, stubTitle],
      );
      expect(after).toHaveLength(2);
      expect(after.every((row: { visibility: string }) => row.visibility === "owner_only")).toBe(true);

      const stubRow = after.find((row: { title: string }) => row.title === stubTitle)!;
      const stubRead = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
        welt: "MCP-Testwelt", art: "artikel", id: stubRow.id,
      }));
      const renamed = firstToolText(await callTool(gm.accessToken, "inhalt_aendern", {
        welt: "MCP-Testwelt",
        art: "artikel",
        id: stubRow.id,
        stand: extractStand(stubRead),
        felder: { titel: `Gräfin Umbenannt ${suffix}` },
      }));
      expect(renamed).not.toContain("Bestätigungs-Token:");
      expect(renamed).toContain(`Gräfin Umbenannt ${suffix}`);
    } finally {
      await sql.end();
    }

    for (const art of ["artikel", "quest", "kapitel", "monster", "universum"] as const) {
      const denied = firstToolText(await callTool(player.accessToken, "inhalt_anlegen", {
        welt: "MCP-Testwelt",
        art,
        felder: art === "kapitel"
          ? { quest_id: data.activeQuestId, titel: "x" }
          : art === "universum" || art === "monster"
            ? { name: "x" }
            : { titel: "x" },
      }));
      rightsError(denied);
    }

    schemaError(firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt", art: "pin", felder: { titel: "x" },
    })));
    schemaError(firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt", art: "charakter", felder: { titel: "x" },
    })));

    const hiddenQuest = await sqlHiddenQuest(data.worldId);
    notFoundError(firstToolText(await callTool(master.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "kapitel",
      felder: { quest_id: hiddenQuest, titel: `Hidden Chapter ${suffix}` },
    })));
  });

  it("T-006: updates content with confirmation, stubs, modes, stand, and rights", async () => {
    const client = await registerMcpClient(9891, "MCP Write Update Test");
    const gm = await authorizeMcpClient("test-gm", client, WRITE_SCOPE);
    const master = await authorizeMcpClient("test-master", client, WRITE_SCOPE);
    const player = await authorizeMcpClient("test-player-a", client, WRITE_SCOPE);
    const suffix = Date.now().toString(36);

    const filled = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP Filled ${suffix}`, text: "Ursprungstext bleibt." },
    }));
    const filledId = extractId(filled);
    const filledRead = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: filledId,
    }));
    const filledStand = extractStand(filledRead);
    const preview = firstToolText(await callTool(gm.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "artikel",
      id: filledId,
      stand: filledStand,
      felder: { text: "Anhang nach Bestätigung." },
    }));
    expect(preview).toContain("Bestätigungs-Token:");
    expect(preview).toMatch(/Ursprungstext bleibt/);
    const midRead = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: filledId,
    }));
    expect(midRead).toMatch(/Ursprungstext bleibt/);
    expect(midRead).not.toContain("Anhang nach Bestätigung.");
    const confirmed = firstToolText(await callTool(gm.accessToken, "aenderung_bestaetigen", {
      token: extractToken(preview),
    }));
    expect(confirmed).toContain(filledId);
    const afterConfirm = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: filledId,
    }));
    expect(afterConfirm).toMatch(/Ursprungstext bleibt/);
    expect(afterConfirm).toMatch(/Anhang nach Bestätigung/);

    const empty = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP Empty ${suffix}` },
    }));
    const emptyId = extractId(empty);
    const emptyRead = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: emptyId,
    }));
    const emptyRename = firstToolText(await callTool(gm.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "artikel",
      id: emptyId,
      stand: extractStand(emptyRead),
      felder: { titel: `MCP Empty Renamed ${suffix}`, text: "Sofort geschrieben." },
    }));
    expect(emptyRename).not.toContain("Bestätigungs-Token:");
    expect(emptyRename).toContain(`MCP Empty Renamed ${suffix}`);

    const appendBase = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP Append ${suffix}`, text: "Alpha." },
    }));
    const appendId = extractId(appendBase);
    const appendRead = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: appendId,
    }));
    const appendPreview = firstToolText(await callTool(gm.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "artikel",
      id: appendId,
      stand: extractStand(appendRead),
      felder: { text: "Beta." },
    }));
    expect(appendPreview).toContain("Bestätigungs-Token:");
    await callTool(gm.accessToken, "aenderung_bestaetigen", { token: extractToken(appendPreview) });
    const appendAfter = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: appendId,
    }));
    expect(plainMcp(appendAfter)).toContain("Alpha.");
    expect(plainMcp(appendAfter)).toContain("Beta.");

    const stale = firstToolText(await callTool(gm.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "artikel",
      id: filledId,
      stand: "2000-01-01T00:00:00.000Z",
      felder: { text: "soll fehlschlagen" },
    }));
    expect(stale.toLowerCase()).toMatch(/geändert|stand|neu lesen/);

    const questRead = firstToolText(await callTool(player.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "quest", id: data.activeQuestId,
    }));
    const noteStand = extractNoteStand(questRead);
    const notePreview = firstToolText(await callTool(player.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "notizblock",
      id: data.activeQuestId,
      stand: noteStand,
      felder: { text: `Player-Notiz ${suffix}` },
    }));
    expect(notePreview).toContain("Bestätigungs-Token:");
    await callTool(player.accessToken, "aenderung_bestaetigen", { token: extractToken(notePreview) });
    const noteAfter = firstToolText(await callTool(player.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "quest", id: data.activeQuestId,
    }));
    expect(plainMcp(noteAfter)).toContain(`Player-Notiz ${suffix}`);
    expect(plainMcp(noteAfter)).toContain("Notizblock zur aktiven Quest.");

    rightsError(firstToolText(await callTool(player.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "quest",
      id: data.activeQuestId,
      stand: extractStand(questRead),
      felder: { titel: "Darf nicht" },
    })));
    const chapterId = /ID: ([0-9a-f-]{36})/i.exec(questRead)?.[1];
    expect(chapterId).toBeTruthy();
    const chapterStand = questRead.match(new RegExp(`ID: ${chapterId}\\nStatus: [^\\n]+\\nStand: ([^\\n]+)`))?.[1];
    expect(chapterStand).toBeTruthy();
    rightsError(firstToolText(await callTool(player.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "kapitel",
      id: chapterId,
      stand: chapterStand!,
      felder: { titel: "Darf nicht" },
    })));

    const worlds = firstToolText(await callTool(gm.accessToken, "welten_auflisten"));
    const worldStand = worlds.match(new RegExp(`## MCP-Testwelt\\nID: ${data.worldId}\\nStand: ([^\\n]+)`))?.[1];
    expect(worldStand).toBeTruthy();
    rightsError(firstToolText(await callTool(master.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "welt",
      id: data.worldId,
      stand: worldStand!,
      felder: { beschreibung: "Master darf Welt nicht ändern." },
    })));
    const mentionDenied = firstToolText(await callTool(gm.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "welt",
      id: data.worldId,
      stand: worldStand!,
      felder: { beschreibung: `@[Burg Rabenstein](artikel:${data.burgId})` },
    }));
    expect(mentionDenied.toLowerCase()).toMatch(/erwähnung/);

    notFoundError(firstToolText(await callTool(gm.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "artikel",
      id: data.masterSecretId,
      stand: "2000-01-01T00:00:00.000Z",
      felder: { text: "unsichtbar" },
    })));
  });

  it("T-007: relations and visibility confirmations with rights matrix", async () => {
    const client = await registerMcpClient(9892, "MCP Write Relation Visibility Test");
    const gm = await authorizeMcpClient("test-gm", client, WRITE_SCOPE);
    const master = await authorizeMcpClient("test-master", client, WRITE_SCOPE);
    const player = await authorizeMcpClient("test-player-a", client, WRITE_SCOPE);
    const suffix = Date.now().toString(36);

    const created = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP RelSrc ${suffix}`, text: "Relationsträger." },
    }));
    const sourceId = extractId(created);
    const relation = firstToolText(await callTool(gm.accessToken, "relation_anlegen", {
      welt: "MCP-Testwelt",
      quelle: { art: "artikel", id: sourceId },
      ziel: { art: "quest", id: data.activeQuestId },
      bezeichnung: "führt zu",
      gegenbezeichnung: "kommt von",
    }));
    expect(relation).toContain("Relation angelegt.");
    const fromArticle = firstToolText(await callTool(gm.accessToken, "relationen_abrufen", {
      welt: "MCP-Testwelt", art: "artikel", id: sourceId,
    }));
    const fromQuest = firstToolText(await callTool(gm.accessToken, "relationen_abrufen", {
      welt: "MCP-Testwelt", art: "quest", id: data.activeQuestId,
    }));
    expect(fromArticle).toContain("führt zu");
    expect(fromArticle).toContain("Die Rückkehr des Rabens");
    expect(fromQuest).toContain("kommt von");
    expect(fromQuest).toContain(`MCP RelSrc ${suffix}`);

    schemaError(firstToolText(await callTool(gm.accessToken, "relation_anlegen", {
      welt: "MCP-Testwelt",
      quelle: { art: "pin", id: data.visiblePinId },
      ziel: { art: "artikel", id: sourceId },
      bezeichnung: "x",
    })));
    schemaError(firstToolText(await callTool(gm.accessToken, "relation_anlegen", {
      welt: "MCP-Testwelt",
      quelle: { art: "artikel", id: sourceId },
      ziel: { art: "charakter", id: data.personId },
      bezeichnung: "x",
    })));
    rightsError(firstToolText(await callTool(player.accessToken, "relation_anlegen", {
      welt: "MCP-Testwelt",
      quelle: { art: "artikel", id: sourceId },
      ziel: { art: "quest", id: data.activeQuestId },
      bezeichnung: "x",
    })));

    const visArticle = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP Publish ${suffix}`, text: "Bald öffentlich." },
    }));
    const visId = extractId(visArticle);
    const visRead = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: visId,
    }));
    const visPreview = firstToolText(await callTool(gm.accessToken, "sichtbarkeit_setzen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      id: visId,
      stand: extractStand(visRead),
      sichtbarkeit: "veröffentlicht",
    }));
    expect(visPreview).toContain("Bestätigungs-Token:");
    notFoundError(firstToolText(await callTool(player.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: visId,
    })));
    await callTool(gm.accessToken, "aenderung_bestaetigen", { token: extractToken(visPreview) });
    const playerSees = firstToolText(await callTool(player.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: visId,
    }));
    expect(playerSees).toContain(`MCP Publish ${suffix}`);
    expect(playerSees).toContain("veröffentlicht");

    const foreignRead = firstToolText(await callTool(master.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: data.burgId,
    }));
    const foreignPreview = firstToolText(await callTool(master.accessToken, "sichtbarkeit_setzen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      id: data.burgId,
      stand: extractStand(foreignRead),
      sichtbarkeit: "nur ich",
    }));
    expect(foreignPreview).toContain("Bestätigungs-Token:");
    rightsError(firstToolText(await callTool(master.accessToken, "aenderung_bestaetigen", {
      token: extractToken(foreignPreview),
    })));

    const universes = firstToolText(await callTool(gm.accessToken, "universen_auflisten", {
      welt: "MCP-Testwelt",
    }));
    const universeId = /ID: ([0-9a-f-]{36})/i.exec(universes)?.[1];
    expect(universeId).toBeTruthy();
    const universeRead = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "universum", id: universeId,
    }));
    schemaError(firstToolText(await callTool(gm.accessToken, "sichtbarkeit_setzen", {
      welt: "MCP-Testwelt",
      art: "universum",
      id: universeId,
      stand: extractStand(universeRead),
      sichtbarkeit: "nur ich",
    })));
  });

  it("T-008: upload links, single-use expiry, confirmation, validation", async () => {
    const client = await registerMcpClient(9893, "MCP Write Upload Test");
    const gm = await authorizeMcpClient("test-gm", client, WRITE_SCOPE);
    const suffix = Date.now().toString(36);

    const article = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP Upload ${suffix}`, text: "Mit Bild." },
    }));
    const articleId = extractId(article);
    let read = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: articleId,
    }));
    expect(read).toContain("Bilder: keine");
    const linkText = firstToolText(await callTool(gm.accessToken, "bild_hochladen", {
      welt: "MCP-Testwelt",
      ziel: "artikel",
      id: articleId,
      stand: extractStand(read),
    }));
    expect(linkText).toContain("Upload-Link");
    expect(linkText).not.toContain("Bestätigungs-Token:");
    const link = extractUploadLink(linkText);
    const uploaded = await postUpload(link, TINY_PNG, "tiny.png", "image/png", "");
    expect(uploaded.status).toBe(201);
    expect(uploaded.headers.get("content-type")).toContain("application/json");
    const uploadedJson = await json(uploaded);
    expect(uploadedJson.fileId).toBeTruthy();
    expect(uploadedJson.ziel).toBe("artikel");
    expect(uploadedJson.id).toBe(articleId);
    read = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: articleId,
    }));
    expect(read).toContain("Bilder: 1");

    const reuse = await postUpload(link, TINY_PNG, "tiny.png", "image/png");
    expect(reuse.status).toBe(404);

    const fresh = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP Upload Exp ${suffix}`, text: "Ablauf." },
    }));
    const freshId = extractId(fresh);
    const freshRead = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: freshId,
    }));
    const expireLinkText = firstToolText(await callTool(gm.accessToken, "bild_hochladen", {
      welt: "MCP-Testwelt",
      ziel: "artikel",
      id: freshId,
      stand: extractStand(freshRead),
    }));
    const expireLink = extractUploadLink(expireLinkText);
    const sql = testSql();
    try {
      await sql.unsafe(
        "UPDATE mcp_upload_tickets SET expires_at = now() - interval '1 minute' WHERE target_id = $1 AND consumed_at IS NULL",
        [freshId],
      );
    } finally {
      await sql.end();
    }
    const expired = await postUpload(expireLink, TINY_PNG, "tiny.png", "image/png");
    expect(expired.status).toBe(404);

    const replacePreview = firstToolText(await callTool(gm.accessToken, "bild_hochladen", {
      welt: "MCP-Testwelt",
      ziel: "artikel",
      id: articleId,
      stand: extractStand(read),
    }));
    expect(replacePreview).toContain("Bestätigungs-Token:");
    expect(replacePreview).not.toContain("Link:");

    const usable = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP Upload Bad ${suffix}`, text: "Validierung." },
    }));
    const usableId = extractId(usable);
    const usableRead = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: usableId,
    }));
    const usableLink = extractUploadLink(firstToolText(await callTool(gm.accessToken, "bild_hochladen", {
      welt: "MCP-Testwelt",
      ziel: "artikel",
      id: usableId,
      stand: extractStand(usableRead),
    })));
    const badType = await postUpload(usableLink, Buffer.from("not-an-image"), "bad.txt", "text/plain");
    expect(badType.status).toBe(400);
    const tooLarge = await postUpload(
      usableLink,
      Buffer.alloc(10 * 1024 * 1024 + 1, 1),
      "huge.png",
      "image/png",
    );
    expect(tooLarge.status).toBe(400);
    const stillOk = await postUpload(usableLink, TINY_PNG, "tiny.png", "image/png");
    expect(stillOk.status).toBe(201);

    schemaError(firstToolText(await callTool(gm.accessToken, "bild_hochladen", {
      welt: "MCP-Testwelt",
      ziel: "karte",
      id: articleId,
      stand: extractStand(read),
    })));
    schemaError(firstToolText(await callTool(gm.accessToken, "bild_hochladen", {
      welt: "MCP-Testwelt",
      ziel: "charakter",
      id: articleId,
      stand: extractStand(read),
    })));

    const missingStand = firstToolText(await callTool(gm.accessToken, "bild_hochladen", {
      welt: "MCP-Testwelt",
      ziel: "artikel",
      id: usableId,
    } as Record<string, unknown>));
    expect(missingStand.toLowerCase()).toMatch(/stand|required|ungültig|invalid|erwartet/);
    const staleStand = firstToolText(await callTool(gm.accessToken, "bild_hochladen", {
      welt: "MCP-Testwelt",
      ziel: "artikel",
      id: usableId,
      stand: "2000-01-01T00:00:00.000Z",
    }));
    expect(staleStand.toLowerCase()).toMatch(/geändert|stand|neu lesen/);
  });

  it("T-009: write audit fields omit titles and upload rate-limits", async () => {
    const client = await registerMcpClient(9894, "MCP Write Audit Test");
    const gm = await authorizeMcpClient("test-gm", client, WRITE_SCOPE);
    const master = await authorizeMcpClient("test-master", client, WRITE_SCOPE);
    const suffix = Date.now().toString(36);
    const secretTitle = `AuditSecretTitle ${suffix}`;
    const secretBody = `AuditSecretBody ${suffix}`;

    const created = firstToolText(await callTool(gm.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: secretTitle, text: secretBody },
    }));
    const articleId = extractId(created);
    const read = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: articleId,
    }));
    const preview = firstToolText(await callTool(gm.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "artikel",
      id: articleId,
      stand: extractStand(read),
      felder: { text: "Nach Audit-Bestätigung." },
    }));
    await callTool(gm.accessToken, "aenderung_bestaetigen", { token: extractToken(preview) });
    const after = firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: articleId,
    }));
    // Clear title image if any, then upload.
    const sql = testSql();
    try {
      await sql.unsafe("UPDATE articles SET title_image_id = NULL WHERE id = $1", [articleId]);
    } finally {
      await sql.end();
    }
    const standAfter = extractStand(firstToolText(await callTool(gm.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: articleId,
    })));
    const uploadTool = firstToolText(await callTool(gm.accessToken, "bild_hochladen", {
      welt: "MCP-Testwelt",
      ziel: "artikel",
      id: articleId,
      stand: standAfter,
    }));
    const uploadLink = extractUploadLink(uploadTool);
    expect((await postUpload(uploadLink, TINY_PNG, "tiny.png", "image/png")).status).toBe(201);

    const auditSql = testSql();
    try {
      const rows = await auditSql.unsafe(
        `SELECT tool_name, target_kind, target_id, confirmed, origin, world_id, client_id
         FROM mcp_audit_logs
         WHERE user_id = $1
           AND (
             (client_id = $2 AND tool_name IN ('inhalt_anlegen', 'inhalt_aendern', 'aenderung_bestaetigen', 'bild_hochladen'))
             OR (tool_name = 'upload_einloesen' AND target_id = $3)
           )
         ORDER BY created_at ASC`,
        [gm.session.user.id, client.clientId, articleId],
      );
      const byTool = Object.fromEntries(rows.map((row: { tool_name: string }) => [row.tool_name, row]));
      for (const tool of ["inhalt_anlegen", "inhalt_aendern", "aenderung_bestaetigen", "bild_hochladen", "upload_einloesen"]) {
        expect(byTool[tool], tool).toBeTruthy();
        expect(byTool[tool].target_kind).toBeTruthy();
        expect(byTool[tool].target_id).toBeTruthy();
        expect(byTool[tool].origin).toBe("mcp");
        expect(typeof byTool[tool].confirmed).toBe("boolean");
      }
      expect(byTool.aenderung_bestaetigen.confirmed).toBe(true);
      expect(byTool.upload_einloesen.confirmed).toBe(true);
      expect(JSON.stringify(rows)).not.toContain(secretTitle);
      expect(JSON.stringify(rows)).not.toContain(secretBody);
      expect(plainMcp(after)).toContain("Nach Audit-Bestätigung.");
    } finally {
      await auditSql.end();
    }

    // Upload redeem limit is per ticket owner; use master so prior GM uploads do not interfere.
    const rateArticle = firstToolText(await callTool(master.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP Rate ${suffix}`, text: "Rate limit." },
    }));
    const rateId = extractId(rateArticle);
    const rateRead = firstToolText(await callTool(master.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: rateId,
    }));
    const rateLink = extractUploadLink(firstToolText(await callTool(master.accessToken, "bild_hochladen", {
      welt: "MCP-Testwelt",
      ziel: "artikel",
      id: rateId,
      stand: extractStand(rateRead),
    })));

    const statuses: number[] = [];
    let limited: Response | null = null;
    for (let index = 0; index < 11; index += 1) {
      const response = await postUpload(rateLink, Buffer.from("bad"), "bad.txt", "text/plain");
      statuses.push(response.status);
      if (response.status === 429) {
        limited = response;
        break;
      }
    }
    expect(statuses.filter((status) => status === 400).length).toBeGreaterThanOrEqual(10);
    expect(limited).toBeTruthy();
    expect(limited!.status).toBe(429);
    expect(Number(limited!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("T-010: disabled worlds and missing write scope reject writes; confirms are required", async () => {
    const client = await registerMcpClient(9895, "MCP Write Guardrails Test");
    const gmWrite = await authorizeMcpClient("test-gm", client, WRITE_SCOPE);
    const gmRead = await authorizeMcpClient("test-gm", await registerMcpClient(9896, "MCP Write Scope Deny"), "worlds:read offline_access");
    const playerB = await authorizeMcpClient("test-player-b", client, WRITE_SCOPE);
    const suffix = Date.now().toString(36);

    const disabled = firstToolText(await callTool(playerB.accessToken, "inhalt_anlegen", {
      welt: "MCP-Zweite-Welt",
      art: "artikel",
      felder: { titel: `Disabled ${suffix}`, text: "nein" },
    }));
    expect(disabled).toContain("MCP ist für diese Welt nicht freigegeben.");

    const noScope = firstToolText(await callTool(gmRead.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `NoScope ${suffix}` },
    }));
    expect(noScope.toLowerCase()).toMatch(/worlds:write|berechtigung|scope/);

    const filled = firstToolText(await callTool(gmWrite.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP Noop ${suffix}`, text: "Vorher." },
    }));
    const filledId = extractId(filled);
    const filledRead = firstToolText(await callTool(gmWrite.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: filledId,
    }));
    const preview = firstToolText(await callTool(gmWrite.accessToken, "inhalt_aendern", {
      welt: "MCP-Testwelt",
      art: "artikel",
      id: filledId,
      stand: extractStand(filledRead),
      felder: { text: "Darf ohne Bestätigung nicht landen." },
    }));
    expect(preview).toContain("Bestätigungs-Token:");
    const mid = firstToolText(await callTool(gmWrite.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: filledId,
    }));
    expect(mid).toMatch(/Vorher/);
    expect(mid).not.toContain("Darf ohne Bestätigung nicht landen.");

    const stubPreview = firstToolText(await callTool(gmWrite.accessToken, "inhalt_anlegen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      felder: { titel: `MCP StubNoop ${suffix}`, text: `@[Stub Noop ${suffix}]` },
    }));
    expect(stubPreview).toContain("Bestätigungs-Token:");
    const sql = testSql();
    try {
      const rows = await sql.unsafe(
        "SELECT count(*)::int AS count FROM articles WHERE world_id = $1 AND title IN ($2, $3)",
        [data.worldId, `MCP StubNoop ${suffix}`, `Stub Noop ${suffix}`],
      );
      expect(rows[0].count).toBe(0);
    } finally {
      await sql.end();
    }

    const visPreview = firstToolText(await callTool(gmWrite.accessToken, "sichtbarkeit_setzen", {
      welt: "MCP-Testwelt",
      art: "artikel",
      id: filledId,
      stand: extractStand(mid),
      sichtbarkeit: "veröffentlicht",
    }));
    expect(visPreview).toContain("Bestätigungs-Token:");
    const stillPrivate = firstToolText(await callTool(gmWrite.accessToken, "inhalt_lesen", {
      welt: "MCP-Testwelt", art: "artikel", id: filledId,
    }));
    expect(stillPrivate).toMatch(/nur ich/);
  });
});
