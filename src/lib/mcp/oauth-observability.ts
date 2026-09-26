import { createHash } from "node:crypto";

export function mcpOAuthClientFingerprint(value: string | null): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function truncate(value: string, maxLength = 160): string {
  return value.slice(0, maxLength);
}

async function requestDetails(request: Request) {
  const url = new URL(request.url);
  let clientId = url.searchParams.get("client_id");
  let grantType: string | null = null;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = new URLSearchParams(await request.clone().text());
      clientId ??= form.get("client_id");
      grantType = form.get("grant_type");
    }
  } catch {
    // Observability must never interfere with the OAuth request itself.
  }

  return { endpoint: url.pathname, grantType, client: mcpOAuthClientFingerprint(clientId) };
}

async function responseError(response: Response): Promise<{ code: string | null; description: string | null }> {
  if (response.ok) return { code: null, description: null };
  try {
    const payload: unknown = await response.clone().json();
    if (!payload || typeof payload !== "object") return { code: null, description: null };
    const value = payload as Record<string, unknown>;
    return {
      code: typeof value.error === "string" ? truncate(value.error) : null,
      description: typeof value.error_description === "string" ? truncate(value.error_description) : null,
    };
  } catch {
    return { code: null, description: null };
  }
}

/**
 * Emits a safe, structured event for the OAuth leg of an MCP connection.
 * OAuth codes, access tokens, PKCE values, state and raw client IDs are never
 * logged, so the events can be kept in regular container logs.
 */
export async function logMcpOAuthResponse(request: Request, response: Response): Promise<void> {
  const { endpoint, grantType, client } = await requestDetails(request);
  const { code, description } = await responseError(response);
  if (response.ok && endpoint !== "/api/auth/oauth2/consent" && endpoint !== "/api/auth/oauth2/token") return;

  console.info(
    JSON.stringify({
      event: "mcp_oauth",
      endpoint,
      method: request.method,
      status: response.status,
      ...(grantType ? { grant_type: grantType } : {}),
      ...(client ? { client: client } : {}),
      ...(code ? { oauth_error: code } : {}),
      ...(description ? { oauth_error_description: description } : {}),
    }),
  );
}

export async function logMcpOAuthException(request: Request, error: unknown): Promise<void> {
  const { endpoint, grantType, client } = await requestDetails(request);
  console.error(
    JSON.stringify({
      event: "mcp_oauth_exception",
      endpoint,
      method: request.method,
      ...(grantType ? { grant_type: grantType } : {}),
      ...(client ? { client: client } : {}),
      error_type: error instanceof Error ? error.name : "unknown",
    }),
  );
}

/** Records a navigation milestone in the browser-facing OAuth flow. */
export function logMcpOAuthMilestone(event: "mcp_oauth_consent_page" | "mcp_oauth_compat_authorize", details: {
  clientId: string | null;
  accessAllowed?: boolean;
}): void {
  const client = mcpOAuthClientFingerprint(details.clientId);
  console.info(
    JSON.stringify({
      event,
      ...(client ? { client } : {}),
      ...(typeof details.accessAllowed === "boolean" ? { access_allowed: details.accessAllowed } : {}),
    }),
  );
}
