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

describe("MCP OAuth and protected resource", () => {
  it("rejects unsafe DCR redirects, exchanges a PKCE code and calls a read tool", async () => {
    const metadata = await fetch(`${BASE}/.well-known/oauth-protected-resource`);
    expect(metadata.status, "Dev-Server mit MCP_ENABLED=true starten.").toBe(200);

    const unsafe = await fetch(`${BASE}/api/auth/oauth2/register`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["http://evil.example/callback"] }),
    });
    expect(unsafe.status).toBe(400);

    const session = await login("test-player-a");
    const registered = await fetch(`${BASE}/api/auth/oauth2/register`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://127.0.0.1:9876/callback"], application_type: "native",
        token_endpoint_auth_method: "none", client_name: "MCP Integration Test",
      }),
    });
    expect(registered.status).toBe(201);
    const client = await json(registered);
    const clientId = client.client_id;
    expect(typeof clientId).toBe("string");

    const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorize = new URL(`${BASE}/api/auth/oauth2/authorize`);
    authorize.search = new URLSearchParams({
      response_type: "code", client_id: clientId as string, redirect_uri: "http://127.0.0.1:9876/callback",
      scope: "worlds:read offline_access", resource: `${BASE}/mcp`, code_challenge_method: "S256", code_challenge: challenge,
    }).toString();
    const authorization = await fetch(authorize, { headers: { cookie: session.cookie }, redirect: "manual" });
    const authorizationPayload = authorization.status === 200 ? await json(authorization) : null;
    expect([200, 302]).toContain(authorization.status);
    const consentLocation = authorization.headers.get("location") ?? authorizationPayload?.url;
    expect(typeof consentLocation).toBe("string");
    const oauthQuery = (consentLocation as string).split("?", 2)[1];
    const consent = await fetch(`${BASE}/api/auth/oauth2/consent`, {
      method: "POST", headers: { "content-type": "application/json", origin: BASE, cookie: session.cookie },
      body: JSON.stringify({ accept: true, oauth_query: oauthQuery }),
    });
    const decision = await json(consent);
    expect(typeof decision.url).toBe("string");
    const code = new URL(decision.url as string).searchParams.get("code");
    expect(code).toBeTruthy();

    const token = await fetch(`${BASE}/api/auth/oauth2/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: code!, redirect_uri: "http://127.0.0.1:9876/callback", client_id: clientId as string, code_verifier: verifier }),
    });
    expect(token.status).toBe(200);
    const credentials = await json(token);
    expect(typeof credentials.access_token).toBe("string");

    const call = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credentials.access_token as string}`, "content-type": "application/json",
        "mcp-protocol-version": "2026-07-28", "mcp-method": "tools/call", "mcp-name": "welten_auflisten",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "welten_auflisten", arguments: {}, _meta: protocolMeta } }),
    });
    expect(call.status).toBe(200);
    const result = await json(call);
    expect(JSON.stringify(result)).toContain("MCP-Testwelt");
  });
});
