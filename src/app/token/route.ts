import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { getAuthUrl } from "@/lib/env";
import { logMcpOAuthMilestone } from "@/lib/mcp/oauth-observability";

/**
 * Compatibility token endpoint for MCP clients that derive OAuth endpoints
 * from the resource origin (/authorize, /token) instead of server metadata.
 *
 * Token clients commonly do not follow redirects on POST, so the request is
 * handed to the Better Auth handler in-process. Grant checks and OAuth
 * logging of /api/auth/oauth2/token apply unchanged.
 */
export async function POST(request: Request) {
  logMcpOAuthMilestone("mcp_oauth_compat_token", { clientId: null });
  const target = new URL("/api/auth/oauth2/token", getAuthUrl());
  target.search = new URL(request.url).search;
  return authPost(
    new Request(target, {
      method: "POST",
      headers: request.headers,
      body: await request.arrayBuffer(),
    }),
  );
}
