import { NextResponse } from "next/server";
import { getAuthUrl, isMcpEnabled } from "@/lib/env";
import { logMcpOAuthMilestone } from "@/lib/mcp/oauth-observability";

/**
 * Compatibility entry point for MCP clients that resolve the authorization
 * endpoint from the resource origin instead of OAuth server metadata.
 *
 * The advertised endpoint remains /api/auth/oauth2/authorize. Keeping this
 * alias prevents those clients from losing the PKCE request to a 404.
 */
export function GET(request: Request) {
  if (!isMcpEnabled()) return new Response(null, { status: 404 });
  logMcpOAuthMilestone("mcp_oauth_compat_authorize", {
    clientId: new URL(request.url).searchParams.get("client_id"),
  });
  const target = new URL("/api/auth/oauth2/authorize", getAuthUrl());
  target.search = new URL(request.url).search;
  return NextResponse.redirect(target, 307);
}
