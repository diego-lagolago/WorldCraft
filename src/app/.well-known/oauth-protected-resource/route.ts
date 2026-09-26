import { isMcpEnabled } from "@/lib/env";
import { MCP_RESOURCE } from "@/lib/mcp-oauth";

export async function GET() {
  if (!isMcpEnabled()) return new Response(null, { status: 404 });
  return Response.json({
    resource: MCP_RESOURCE,
    authorization_servers: [`${new URL(MCP_RESOURCE).origin}/api/auth`],
    bearer_methods_supported: ["header"],
    dpop_signing_alg_values_supported: ["EdDSA", "ES256", "ES512", "PS256", "RS256"],
    scopes_supported: ["worlds:read"],
  });
}
