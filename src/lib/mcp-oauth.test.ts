import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), isDiscordIdAllowed: vi.fn(() => true) }));

vi.mock("@/db/client", () => ({ db: { select: mocks.select } }));
vi.mock("@/db/schema", () => ({ memberships: {}, oauthRefreshTokens: {}, users: {}, verifications: {} }));
vi.mock("@/lib/env", () => ({
  getAuthUrl: () => "http://localhost:3000",
  isDiscordIdAllowed: mocks.isDiscordIdAllowed,
}));

import {
  hasAllowedMcpAuthorizeRedirect,
  hasRequiredMcpPkce,
  hashStoredOAuthToken,
  isAllowedMcpRedirectUri,
  MCP_CIMD_LIMITS,
  MCP_OAUTH_RATE_LIMITS,
  mcpTokenGrantFailure,
} from "./mcp-oauth";

function query(result: unknown[]) {
  const builder = {
    from: () => builder,
    innerJoin: () => builder,
    where: () => builder,
    limit: async () => result,
  };
  return builder;
}

describe("MCP OAuth redirect policy", () => {
  it("accepts HTTPS and local loopback redirects only (CR-004 / CR-024)", () => {
    expect(isAllowedMcpRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedMcpRedirectUri("http://127.0.0.1:9876/callback")).toBe(true);
    expect(isAllowedMcpRedirectUri("http://[::1]:9876/callback")).toBe(true);
    expect(isAllowedMcpRedirectUri("http://localhost:9876/callback")).toBe(true);
    expect(isAllowedMcpRedirectUri("http://evil.example/callback")).toBe(false);
    expect(isAllowedMcpRedirectUri("myapp://callback")).toBe(false);
  });

  it("uses the same policy at the authorization endpoint for CIMD clients", () => {
    const rejected = new Request("http://localhost:3000/api/auth/oauth2/authorize?redirect_uri=http://evil.example/callback");
    const privateUse = new Request("http://localhost:3000/api/auth/oauth2/authorize?redirect_uri=myapp://callback");
    const https = new Request("http://localhost:3000/api/auth/oauth2/authorize?redirect_uri=https://claude.ai/api/mcp/auth_callback");
    const accepted = new Request("http://localhost:3000/api/auth/oauth2/authorize?redirect_uri=http://127.0.0.1:9876/callback");
    expect(hasAllowedMcpAuthorizeRedirect(rejected)).toBe(false);
    expect(hasAllowedMcpAuthorizeRedirect(privateUse)).toBe(false);
    expect(hasAllowedMcpAuthorizeRedirect(https)).toBe(true);
    expect(hasAllowedMcpAuthorizeRedirect(accepted)).toBe(true);
  });

  it("requires an S256 PKCE challenge at the authorization endpoint", () => {
    const valid = new Request("http://localhost:3000/api/auth/oauth2/authorize?code_challenge_method=S256&code_challenge=challenge");
    const plain = new Request("http://localhost:3000/api/auth/oauth2/authorize?code_challenge_method=plain&code_challenge=challenge");
    const missing = new Request("http://localhost:3000/api/auth/oauth2/authorize");
    expect(hasRequiredMcpPkce(valid)).toBe(true);
    expect(hasRequiredMcpPkce(plain)).toBe(false);
    expect(hasRequiredMcpPkce(missing)).toBe(false);
  });
});

describe("MCP OAuth storage and abuse limits", () => {
  it("matches Better Auth's SHA-256 base64url default token hasher", () => {
    expect(hashStoredOAuthToken("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });

  it("pins the reviewed OAuth and CIMD limits", () => {
    expect(MCP_OAUTH_RATE_LIMITS.register).toMatchObject({ window: 60, max: 5 });
    expect(MCP_OAUTH_RATE_LIMITS.authorize).toMatchObject({ window: 60, max: 30 });
    expect(MCP_OAUTH_RATE_LIMITS.token).toMatchObject({ window: 60, max: 30 });
    expect(MCP_CIMD_LIMITS).toMatchObject({ responseBytes: 5120, timeoutMs: 5000, cacheSeconds: 900, failedFetchRetrySeconds: 60 });
  });

  it("CR-005 / T-003(5): denies authorization-code and refresh grants for users removed from the allowlist", async () => {
    mocks.isDiscordIdAllowed.mockReturnValue(false);
    mocks.select
      .mockReturnValueOnce(query([{ value: JSON.stringify({ userId: "user-1" }) }]))
      .mockReturnValueOnce(query([{ userId: "user-1", discordId: "removed-user" }]))
      .mockReturnValueOnce(query([{ userId: "user-1", discordId: "removed-user" }]));

    const code = await mcpTokenGrantFailure(new Request("http://localhost:3000/api/auth/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: "code-1" }),
    }));
    const refresh = await mcpTokenGrantFailure(new Request("http://localhost:3000/api/auth/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: "refresh-1" }),
    }));

    expect(code).toBe("access_denied");
    expect(refresh).toBe("invalid_grant");
    mocks.isDiscordIdAllowed.mockReturnValue(true);
  });
});
