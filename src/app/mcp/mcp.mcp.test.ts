import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BASE, login, testSql } from "@/test/api-harness";
import { purgeMcpAuditLog } from "@/lib/mcp/audit";

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
