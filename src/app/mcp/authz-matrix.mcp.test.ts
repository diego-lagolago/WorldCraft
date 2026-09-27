import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BASE, login, testSql } from "@/test/api-harness";
import { purgeMcpAuditLog } from "@/lib/mcp/audit";

const protocolMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};

const readTools = [
  "welten_auflisten",
  "suchen",
  "inhalte_auflisten",
  "inhalt_lesen",
  "relationen_abrufen",
  "quests_auflisten",
  "universen_auflisten",
  "bild_lesen",
] as const;

type McpClient = { clientId: string; redirectUri: string };
type McpCredentials = {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  session: Awaited<ReturnType<typeof login>>;
};

function resultText(result: unknown): string {
  return JSON.stringify(result);
}

function idFor(result: unknown, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = resultText(result).match(new RegExp(`${escaped} \\([^,]+, ([0-9a-f-]{36})\\)`));
  if (!match) throw new Error(`Keine ID für ${title} in MCP-Antwort gefunden.`);
  return match[1];
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function registerClient(port: number, label: string): Promise<McpClient> {
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const response = await fetch(`${BASE}/api/auth/oauth2/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Each test is a separate public client, therefore it must not consume
      // the five DCR registrations/minute budget of another test.
      "x-forwarded-for": `198.51.100.${port % 255}`,
    },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      application_type: "native",
      token_endpoint_auth_method: "none",
      client_name: label,
    }),
  });
  expect(response.status).toBe(201);
  const body = await json(response);
  expect(typeof body.client_id).toBe("string");
  return { clientId: body.client_id as string, redirectUri };
}

async function authorize(discordId: string, client: McpClient, scope = "worlds:read offline_access"): Promise<McpCredentials> {
  const session = await login(discordId);
  const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorizeUrl = new URL(`${BASE}/api/auth/oauth2/authorize`);
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    scope,
    resource: `${BASE}/mcp`,
    code_challenge_method: "S256",
    code_challenge: challenge,
  }).toString();
  const authorization = await fetch(authorizeUrl, { headers: { cookie: session.cookie }, redirect: "manual" });
  expect([200, 302]).toContain(authorization.status);
  const payload = authorization.status === 200 ? await json(authorization) : null;
  const location = authorization.headers.get("location") ?? payload?.url;
  expect(typeof location).toBe("string");

  const consent = await fetch(`${BASE}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, cookie: session.cookie },
    body: JSON.stringify({ accept: true, oauth_query: (location as string).split("?", 2)[1] }),
  });
  const decision = await json(consent);
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
  const body = await json(token);
  expect(typeof body.access_token).toBe("string");
  if (scope.split(" ").includes("worlds:read")) {
    expect(body.scope, "OAuth token did not retain requested read scope.").toContain("worlds:read");
  } else {
    expect(body.scope).not.toContain("worlds:read");
  }
  return {
    clientId: client.clientId,
    accessToken: body.access_token as string,
    refreshToken: body.refresh_token as string,
    session,
  };
}

async function toolRequest(accessToken: string, name: string, args: Record<string, unknown> = {}) {
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

async function callTool(accessToken: string, name: string, args: Record<string, unknown> = {}) {
  const response = await toolRequest(accessToken, name, args);
  expect(response.status, await response.clone().text()).toBe(200);
  return json(response);
}

async function fixtureIds(credentials: McpCredentials) {
  const articles = await callTool(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "Rabenstein" });
  const hidden = await callTool(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "SLTEST" });
  return { burg: idFor(articles, "Burg Rabenstein"), guild: idFor(hidden, "Archiv der Spielleitung") };
}

function toolArguments(name: typeof readTools[number], burgId: string): Record<string, unknown> {
  switch (name) {
    case "welten_auflisten": return {};
    case "suchen": return { welt: "MCP-Testwelt", suchbegriff: "Rabenstein" };
    case "inhalte_auflisten": return { welt: "MCP-Testwelt", art: "artikel" };
    case "inhalt_lesen": return { welt: "MCP-Testwelt", art: "artikel", id: burgId };
    case "relationen_abrufen": return { welt: "MCP-Testwelt", art: "artikel", id: burgId, tiefe: 2 };
    case "quests_auflisten": return { welt: "MCP-Testwelt", status: "aktiv" };
    case "universen_auflisten": return { welt: "MCP-Testwelt" };
    case "bild_lesen": return { welt: "MCP-Testwelt", art: "artikel", id: burgId };
  }
}

describe("CR-002: MCP rights and exclusion matrix", () => {
  it("T-008: calls every read tool for every test user without exposing journal, chat, or D9 data", async () => {
    const client = await registerClient(9911, "MCP complete rights matrix");
    const [gameMaster, master, playerA, playerB] = await Promise.all([
      authorize("test-gm", client),
      authorize("test-master", client),
      authorize("test-player-a", client),
      authorize("test-player-b", client),
    ]);
    const { burg } = await fixtureIds(gameMaster);

    for (const credentials of [gameMaster, master, playerA, playerB]) {
      const responses = await Promise.all(readTools.map((tool) => callTool(credentials.accessToken, tool, toolArguments(tool, burg))));
      const output = responses.map(resultText).join("\n");
      expect(output).not.toContain("GEHEIMTEST");
      expect(output).not.toContain("CHATTEST");
      expect(output).not.toMatch(/pos_[xy]|character_markers|monster_markers|file_id|invite|@[\w.-]+\.[a-z]{2,}/i);
      expect(output).not.toMatch(/https?:\/\//i);
    }
  });

  it("T-008: exposes gm_only content only to Game Master and Master, including relations", async () => {
    const client = await registerClient(9912, "MCP visibility roles");
    const [gameMaster, master, playerA, playerB] = await Promise.all([
      authorize("test-gm", client),
      authorize("test-master", client),
      authorize("test-player-a", client),
      authorize("test-player-b", client),
    ]);
    const { burg, guild } = await fixtureIds(gameMaster);

    for (const credentials of [gameMaster, master]) {
      await expect(callTool(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "SLTEST" }))
        .resolves.toSatisfy((result) => resultText(result).includes("Archiv der Spielleitung"));
      await expect(callTool(credentials.accessToken, "inhalt_lesen", { welt: "MCP-Testwelt", art: "artikel", id: guild }))
        .resolves.toSatisfy((result) => resultText(result).includes("Archiv der Spielleitung"));
      await expect(callTool(credentials.accessToken, "relationen_abrufen", { welt: "MCP-Testwelt", art: "artikel", id: burg }))
        .resolves.toSatisfy((result) => resultText(result).includes("Archiv der Spielleitung"));
    }
    for (const credentials of [playerA, playerB]) {
      const responses = await Promise.all([
        callTool(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "SLTEST" }),
        callTool(credentials.accessToken, "inhalt_lesen", { welt: "MCP-Testwelt", art: "artikel", id: guild }),
        callTool(credentials.accessToken, "relationen_abrufen", { welt: "MCP-Testwelt", art: "artikel", id: burg, tiefe: 2 }),
      ]);
      expect(responses.map(resultText).join("\n")).not.toContain("Archiv der Spielleitung");
    }
  });

  it("T-008: keeps a Master's owner_only content out of every other role and hidden relation paths", async () => {
    const client = await registerClient(9913, "MCP owner-only matrix");
    const [gameMaster, master, playerA, playerB] = await Promise.all([
      authorize("test-gm", client),
      authorize("test-master", client),
      authorize("test-player-a", client),
      authorize("test-player-b", client),
    ]);
    const { burg } = await fixtureIds(gameMaster);
    const privateSearch = await callTool(master.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "NURICHTEST" });
    const privateId = idFor(privateSearch, "Private Notiz des Masters");
    expect(resultText(privateSearch)).toContain("Private Notiz des Masters");

    for (const credentials of [gameMaster, playerA, playerB]) {
      const responses = await Promise.all([
        callTool(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "NURICHTEST" }),
        callTool(credentials.accessToken, "inhalt_lesen", { welt: "MCP-Testwelt", art: "artikel", id: privateId }),
        callTool(credentials.accessToken, "relationen_abrufen", { welt: "MCP-Testwelt", art: "artikel", id: burg, tiefe: 2 }),
      ]);
      expect(responses.map(resultText).join("\n")).not.toContain("Private Notiz des Masters");
    }
  });

  it("T-008 / T-012(3): returns no content from a world whose MCP switch is disabled", async () => {
    const client = await registerClient(9914, "MCP disabled-world matrix");
    const playerB = await authorize("test-player-b", client);
    const inaccessibleArticleId = "00000000-0000-4000-8000-000000000000";
    const blockedArgs: Record<typeof readTools[number], Record<string, unknown>> = {
      welten_auflisten: {},
      suchen: { welt: "MCP-Zweite-Welt", suchbegriff: "Rabenstein" },
      inhalte_auflisten: { welt: "MCP-Zweite-Welt", art: "artikel" },
      inhalt_lesen: { welt: "MCP-Zweite-Welt", art: "artikel", id: inaccessibleArticleId },
      relationen_abrufen: { welt: "MCP-Zweite-Welt", art: "artikel", id: inaccessibleArticleId },
      quests_auflisten: { welt: "MCP-Zweite-Welt" },
      universen_auflisten: { welt: "MCP-Zweite-Welt" },
      bild_lesen: { welt: "MCP-Zweite-Welt", art: "artikel", id: inaccessibleArticleId },
    };
    const results = await Promise.all(readTools.map((tool) => callTool(playerB.accessToken, tool, blockedArgs[tool])));
    expect(resultText(results[0])).toContain("MCP für diese Welt nicht freigegeben");
    for (const result of results.slice(1)) {
      expect(resultText(result)).toContain("MCP ist für diese Welt nicht freigegeben.");
      expect(resultText(result)).not.toContain("Burg Rabenstein");
    }
  });

  it("T-008 / T-005(2): rejects every read tool before execution when worlds:read is absent", async () => {
    const client = await registerClient(9915, "MCP wrong-scope matrix");
    const noReadScope = await authorize("test-player-a", client, "offline_access");
    for (const tool of readTools) {
      const response = await toolRequest(noReadScope.accessToken, tool, toolArguments(tool, "00000000-0000-4000-8000-000000000000"));
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
    }
  });
});

describe("CR-002: audit proof", () => {
  it("T-009(1)/(2)/(3): returns Retry-After, stores metadata without a search term, and purges only records older than 30 days", async () => {
    const client = await registerClient(9916, "MCP audit proof");
    const credentials = await authorize("test-rate-limit", client);
    const sql = testSql();
    try {
      const search = await callTool(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "Rabenstein" });
      expect(resultText(search)).toContain("Burg Rabenstein");
      const auditRows = await sql`
        SELECT user_id, client_id, tool_name, world_id, duration_ms, result, created_at
        FROM mcp_audit_logs
        WHERE user_id = ${credentials.session.user.id} AND client_id = ${client.clientId} AND tool_name = 'suchen'
        ORDER BY created_at DESC LIMIT 1
      `;
      expect(auditRows).toHaveLength(1);
      expect(JSON.stringify(auditRows[0])).not.toContain("Rabenstein");
      expect(auditRows[0]).toMatchObject({ user_id: credentials.session.user.id, client_id: client.clientId, tool_name: "suchen", result: "ok" });
      expect(auditRows[0].world_id).toBeTruthy();
      expect(Number(auditRows[0].duration_ms)).toBeGreaterThanOrEqual(0);

      const [expired] = await sql`
        INSERT INTO mcp_audit_logs (user_id, client_id, tool_name, world_id, duration_ms, result, created_at)
        VALUES (${credentials.session.user.id}, ${client.clientId}, 'expired-test', NULL, 0, 'ok', now() - interval '31 days') RETURNING id
      `;
      const [retained] = await sql`
        INSERT INTO mcp_audit_logs (user_id, client_id, tool_name, world_id, duration_ms, result, created_at)
        VALUES (${credentials.session.user.id}, ${client.clientId}, 'retained-test', NULL, 0, 'ok', now() - interval '29 days') RETURNING id
      `;
      await purgeMcpAuditLog();
      expect(await sql`SELECT id FROM mcp_audit_logs WHERE id = ${expired.id}`).toHaveLength(0);
      expect(await sql`SELECT id FROM mcp_audit_logs WHERE id = ${retained.id}`).toHaveLength(1);
      await sql`DELETE FROM mcp_audit_logs WHERE id = ${retained.id}`;

      for (let index = 0; index < 59; index += 1) await callTool(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "Rabenstein" });
      const limited = await toolRequest(credentials.accessToken, "suchen", { welt: "MCP-Testwelt", suchbegriff: "Rabenstein" });
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }, 30_000);
});
