import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, oauthRefreshTokens, users, verifications } from "@/db/schema";
import { getAuthUrl, isDiscordIdAllowed } from "@/lib/env";

export const MCP_RESOURCE = `${getAuthUrl()}/mcp`;

/** Better Auth route paths are relative to its `/api/auth` base path. */
export const MCP_OAUTH_RATE_LIMITS = {
  default: { window: 10, max: 100 },
  register: { path: "/oauth2/register", window: 60, max: 5 },
  authorize: { path: "/oauth2/authorize", window: 60, max: 30 },
  token: { path: "/oauth2/token", window: 60, max: 30 },
} as const;

/** These caps match (and explicitly pin) the CIMD resolver's security bounds. */
export const MCP_CIMD_LIMITS = {
  responseBytes: 5 * 1024,
  timeoutMs: 5_000,
  cacheSeconds: 15 * 60,
  failedFetchRetrySeconds: 60,
  maxCacheEntries: 1000,
  maxConcurrentFetches: 16,
  maxConcurrentFetchesPerOrigin: 4,
  maxFetchesPerMinute: 120,
  maxFetchesPerOriginPerMinute: 30,
} as const;

const AUTH_PATH_PREFIX = "/api/auth/";
const MCP_AUTH_PATH_PREFIXES = [
  "/api/auth/oauth2/",
  "/api/auth/.well-known/oauth-authorization-server",
  "/api/auth/.well-known/oauth-protected-resource",
] as const;

export function isMcpAuthPath(pathname: string): boolean {
  return MCP_AUTH_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** DCR accepts HTTPS redirects and loopback HTTP redirects only. */
export function isAllowedMcpRedirectUri(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol === "https:") return !isLoopback;
    if (url.protocol !== "http:") return false;
    return isLoopback;
  } catch {
    return false;
  }
}

export type McpRegistrationError = "invalid_redirect_uri" | "invalid_client_metadata";

/**
 * WorldCraft supports only public native DCR clients. Better Auth validates
 * the remaining registration schema; this guard rejects client secrets and
 * grants the MCP server never offers before a client record is created.
 */
export async function mcpRegistrationValidationError(request: Request): Promise<McpRegistrationError | null> {
  if (new URL(request.url).pathname !== `${AUTH_PATH_PREFIX}oauth2/register`) return null;
  try {
    const body: unknown = await request.clone().json();
    if (!body || typeof body !== "object" || !("redirect_uris" in body)) return "invalid_redirect_uri";
    const registration = body as {
      redirect_uris?: unknown;
      application_type?: unknown;
      token_endpoint_auth_method?: unknown;
      grant_types?: unknown;
    };
    const redirects = registration.redirect_uris;
    if (!Array.isArray(redirects) || redirects.length === 0 || !redirects.every(isAllowedMcpRedirectUri)) {
      return "invalid_redirect_uri";
    }
    if (registration.application_type !== undefined && registration.application_type !== "native") return "invalid_client_metadata";
    if (registration.token_endpoint_auth_method !== "none") return "invalid_client_metadata";
    if (registration.grant_types !== undefined) {
      const grants = registration.grant_types;
      if (!Array.isArray(grants) || !grants.includes("authorization_code") || !grants.every((grant) => grant === "authorization_code" || grant === "refresh_token")) {
        return "invalid_client_metadata";
      }
    }
    return null;
  } catch {
    return "invalid_client_metadata";
  }
}

/** Applies the DCR redirect policy to every client type, including CIMD. */
export function hasAllowedMcpAuthorizeRedirect(request: Request): boolean {
  const url = new URL(request.url);
  if (url.pathname !== `${AUTH_PATH_PREFIX}oauth2/authorize`) return true;
  return isAllowedMcpRedirectUri(url.searchParams.get("redirect_uri"));
}

async function formBody(request: Request): Promise<URLSearchParams | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) return null;
  try {
    return new URLSearchParams(await request.clone().text());
  } catch {
    return null;
  }
}

/** Shared with Better Auth so grant-owner checks cannot drift from token storage. */
export function hashStoredOAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

type OAuthTokenOwner = { userId: string; discordId: string };

async function ownerForAuthorizationCode(code: string): Promise<OAuthTokenOwner | null> {
  const [verification] = await db
    .select({ value: verifications.value })
    .from(verifications)
    .where(eq(verifications.identifier, hashStoredOAuthToken(code)))
    .limit(1);
  if (!verification) return null;
  try {
    const value: unknown = JSON.parse(verification.value);
    if (!value || typeof value !== "object" || !("userId" in value) || typeof value.userId !== "string") return null;
    const [user] = await db.select({ userId: users.id, discordId: users.discordId }).from(users).where(eq(users.id, value.userId)).limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

async function ownerForRefreshToken(token: string): Promise<OAuthTokenOwner | null> {
  const [refreshToken] = await db
    .select({ userId: users.id, discordId: users.discordId })
    .from(oauthRefreshTokens)
    .innerJoin(users, eq(users.id, oauthRefreshTokens.userId))
    .where(eq(oauthRefreshTokens.token, hashStoredOAuthToken(token)))
    .limit(1);
  return refreshToken ?? null;
}

/**
 * Re-check D13 at token exchange. Unknown/revoked credentials are left to the
 * provider so it can preserve its standard `invalid_grant` response.
 */
export async function mcpTokenGrantFailure(request: Request): Promise<"access_denied" | "invalid_grant" | null> {
  if (new URL(request.url).pathname !== `${AUTH_PATH_PREFIX}oauth2/token`) return null;
  const form = await formBody(request);
  if (!form) return null;
  const grantType = form.get("grant_type");
  const token = grantType === "authorization_code" ? form.get("code") : grantType === "refresh_token" ? form.get("refresh_token") : null;
  if (!token) return null;
  const owner = grantType === "authorization_code" ? await ownerForAuthorizationCode(token) : await ownerForRefreshToken(token);
  if (!owner) {
    console.warn(JSON.stringify({ event: "mcp_oauth_grant_owner_not_found", grant_type: grantType }));
    return null;
  }
  if (!isDiscordIdAllowed(owner.discordId)) return grantType === "refresh_token" ? "invalid_grant" : "access_denied";
  if (grantType === "refresh_token") {
    const [membership] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, owner.userId), isNull(memberships.archivedAt)))
      .limit(1);
    if (!membership) return "invalid_grant";
  }
  return null;
}
