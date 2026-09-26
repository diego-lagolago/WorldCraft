import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { requireMcpAuth } from "@better-auth/mcp";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { isDiscordIdAllowed, isMcpEnabled, isProductionAppEnv } from "@/lib/env";
import { MCP_RESOURCE } from "@/lib/mcp-oauth";
import { consumeMcpCall, McpRateLimitError, writeMcpAuditLog } from "@/lib/mcp/audit";
import { registerMcpReadTools } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mcpHandler = createMcpHandler(
  (context) => {
    const server = new McpServer({ name: "WorldCraft", version: "0.1.6.2" });
    if (!isProductionAppEnv()) {
      const userName = typeof context.authInfo?.extra?.userName === "string" ? context.authInfo.extra.userName : "Unbekannt";
      server.registerTool("whoami", {
        title: "Angemeldeter Benutzer",
        description: "Gibt den Anzeigenamen des angemeldeten WorldCraft-Benutzers zurück.",
      }, async () => ({ content: [{ type: "text", text: userName }] }));
    }
    const userId = typeof context.authInfo?.extra?.userId === "string" ? context.authInfo.extra.userId : "";
    registerMcpReadTools(server, {
      userId,
      clientId: typeof context.authInfo?.clientId === "string" ? context.authInfo.clientId : "",
    });
    return server;
  },
  { legacy: "reject" },
);

async function isToolCall(request: Request): Promise<boolean> {
  if (request.headers.get("mcp-method") === "tools/call") return true;
  if (!request.headers.get("content-type")?.includes("application/json")) return false;
  try {
    const body = await request.clone().json() as { method?: unknown };
    return body.method === "tools/call";
  } catch {
    return false;
  }
}

const protectedMcpHandler = requireMcpAuth(auth, async (request, claims) => {
  if (typeof claims.sub !== "string") return new Response(null, { status: 401 });
  const [user] = await db.select({ name: users.name, discordId: users.discordId }).from(users).where(eq(users.id, claims.sub)).limit(1);
  if (!user || !isDiscordIdAllowed(user.discordId)) return new Response(null, { status: 401 });
  if (await isToolCall(request)) {
    const clientId = typeof claims.client_id === "string" ? claims.client_id : "";
    try {
      consumeMcpCall(claims.sub);
    } catch (error) {
      if (!(error instanceof McpRateLimitError)) throw error;
      await writeMcpAuditLog({
        userId: claims.sub,
        clientId,
        toolName: request.headers.get("mcp-name")?.slice(0, 120) || "tools/call",
        durationMs: 0,
        result: "rate_limited",
      }).catch(() => undefined);
      return new Response(null, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    }
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const scope = typeof claims.scope === "string" ? claims.scope.split(" ").filter(Boolean) : [];
  return mcpHandler.fetch(request, {
    authInfo: {
      token,
      clientId: typeof claims.client_id === "string" ? claims.client_id : "",
      scopes: scope,
      expiresAt: typeof claims.exp === "number" ? claims.exp : undefined,
      resource: new URL(MCP_RESOURCE),
      resourceMetadataUrl: `${new URL(MCP_RESOURCE).origin}/.well-known/oauth-protected-resource`,
      extra: { userId: claims.sub, userName: user.name },
    },
  });
}, { resource: MCP_RESOURCE, requiredScopes: ["worlds:read"] });

export async function POST(request: Request) {
  if (!isMcpEnabled()) return new Response(null, { status: 404 });
  return protectedMcpHandler(request);
}

/** The disabled switch must hide the resource for every HTTP method (D2). */
export async function GET() {
  return new Response(null, { status: isMcpEnabled() ? 405 : 404, headers: isMcpEnabled() ? { Allow: "POST" } : undefined });
}
