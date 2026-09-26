import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, oauthRefreshTokens, users, verifications } from "@/db/schema";
import { getAuthUrl, isDiscordIdAllowed } from "@/lib/env";

export const MCP_RESOURCE = `${getAuthUrl()}/mcp`;

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
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

export async function hasAllowedMcpRegistrationRedirects(request: Request): Promise<boolean> {
  if (new URL(request.url).pathname !== `${AUTH_PATH_PREFIX}oauth2/register`) return true;
  try {
    const body: unknown = await request.clone().json();
    if (!body || typeof body !== "object" || !("redirect_uris" in body)) return false;
    const redirects = (body as { redirect_uris?: unknown }).redirect_uris;
    return Array.isArray(redirects) && redirects.length > 0 && redirects.every(isAllowedMcpRedirectUri);
  } catch {
    return false;
  }
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

function hashStoredOAuthToken(token: string): string {
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
  if (!owner) return null;
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
