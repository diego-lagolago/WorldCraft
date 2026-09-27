import { describe, expect, it, vi } from "vitest";
import { createCimdClientDiscovery, validateCimdMetadata, validateClientIdUrl } from "@better-auth/cimd";

const mocks = vi.hoisted(() => ({ select: vi.fn(), isDiscordIdAllowed: vi.fn(() => true) }));

vi.mock("@/db/client", () => ({ db: { select: mocks.select } }));
vi.mock("@/db/schema", () => ({ memberships: {}, oauthRefreshTokens: {}, users: {}, verifications: {} }));
vi.mock("@/lib/env", () => ({
  getAuthUrl: () => "http://localhost:3000",
  isDiscordIdAllowed: mocks.isDiscordIdAllowed,
}));

import {
  hasAllowedMcpAuthorizeRedirect,
  hashStoredOAuthToken,
  isAllowedMcpRedirectUri,
  mcpRegistrationValidationError,
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
    expect(isAllowedMcpRedirectUri("https://127.0.0.1:9876/callback")).toBe(false);
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

  it("accepts only public native DCR metadata", async () => {
    const valid = new Request("http://localhost:3000/api/auth/oauth2/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://127.0.0.1:9876/callback"],
        application_type: "native",
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
      }),
    });
    const confidential = new Request("http://localhost:3000/api/auth/oauth2/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["http://127.0.0.1:9876/callback"], application_type: "native", token_endpoint_auth_method: "client_secret_basic" }),
    });
    const unsupportedGrant = new Request("http://localhost:3000/api/auth/oauth2/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["http://127.0.0.1:9876/callback"], application_type: "native", token_endpoint_auth_method: "none", grant_types: ["client_credentials"] }),
    });

    await expect(mcpRegistrationValidationError(valid)).resolves.toBeNull();
    await expect(mcpRegistrationValidationError(confidential)).resolves.toBe("invalid_client_metadata");
    await expect(mcpRegistrationValidationError(unsupportedGrant)).resolves.toBe("invalid_client_metadata");
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

describe("CIMD validation contract", () => {
  const clientId = "https://client.example.com/.well-known/mcp-client.json";

  function resolverFor(fetchClientMetadataResource: unknown, metadataFetchPolicy = {}) {
    const discovery = createCimdClientDiscovery({
      fetchClientMetadataResource: fetchClientMetadataResource as never,
      metadataProfile: "mcp-2026-07-28",
      metadataRevalidationInterval: MCP_CIMD_LIMITS.cacheSeconds,
      metadataFetchPolicy,
    });
    const context = {
      context: { getPlugin: () => ({ options: {} }), logger: { warn: vi.fn() } },
    } as never;
    return () => discovery.resolve(context, clientId);
  }

  it("accepts a public HTTPS metadata URL and rejects private or non-HTTPS targets", () => {
    expect(validateClientIdUrl(clientId)).toBeNull();
    expect(validateClientIdUrl("http://client.example.com/metadata.json")).toContain("HTTPS");
    expect(validateClientIdUrl("https://127.0.0.1/metadata.json")).toContain("private or reserved");
    expect(validateClientIdUrl("https://[::1]/metadata.json")).toContain("private or reserved");
    expect(validateClientIdUrl("https://169.254.169.254/metadata.json")).toContain("private or reserved");
  });

  it("requires MCP metadata to identify itself exactly and to use public-client authentication", () => {
    const validMetadata = {
      client_id: clientId,
      client_name: "WorldCraft CIMD test client",
      redirect_uris: ["https://client.example.com/oauth/callback"],
      token_endpoint_auth_method: "none",
    };
    expect(validateCimdMetadata(clientId, validMetadata, { metadataProfile: "mcp-2026-07-28" }).valid).toBe(true);
    expect(validateCimdMetadata(clientId, { ...validMetadata, client_id: "https://other.example.com/client.json" }, { metadataProfile: "mcp-2026-07-28" }))
      .toMatchObject({ valid: false, error: expect.stringContaining("does not match") });
    expect(validateCimdMetadata(clientId, { ...validMetadata, token_endpoint_auth_method: "client_secret_basic" }, { metadataProfile: "mcp-2026-07-28" }))
      .toMatchObject({ valid: false, error: expect.stringContaining("prohibited") });
  });

  it("rejects CIMD redirects and responses larger than the reviewed 5 KB cap before registration", async () => {
    const redirect = resolverFor(async () => new Response(null, { status: 302 }));
    const oversized = resolverFor(async () => new Response("x".repeat(MCP_CIMD_LIMITS.responseBytes + 1), {
      headers: { "content-type": "application/json" },
    }));

    await expect(redirect()).rejects.toMatchObject({ body: { error: "invalid_client" } });
    await expect(oversized()).rejects.toMatchObject({ body: { error: "invalid_client" } });
  });

  it("aborts a stalled CIMD fetch at the reviewed five-second timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetchClientMetadataResource = vi.fn((_url: unknown, init: { signal: AbortSignal }) => new Promise<never>((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }));
      const resolve = resolverFor(fetchClientMetadataResource);
      const pending = resolve();
      const timeoutAssertion = expect(pending).rejects.toMatchObject({ body: { error: "invalid_client" } });

      await vi.advanceTimersByTimeAsync(MCP_CIMD_LIMITS.timeoutMs);
      await timeoutAssertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("paces failed CIMD fetches for the reviewed one-minute retry interval", async () => {
    const fetchClientMetadataResource = vi.fn(async () => new Response(null, { status: 503 }));
    const resolve = resolverFor(fetchClientMetadataResource, { minimumFetchInterval: MCP_CIMD_LIMITS.failedFetchRetrySeconds });

    await expect(resolve()).rejects.toMatchObject({ body: { error: "invalid_client" } });
    await expect(resolve()).rejects.toMatchObject({ body: { error: "temporarily_unavailable" } });
    expect(fetchClientMetadataResource).toHaveBeenCalledTimes(1);
  });
});
