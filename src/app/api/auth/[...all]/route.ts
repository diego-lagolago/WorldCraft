import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { isDiscordIdAllowed, isMcpEnabled } from "@/lib/env";
import { hasAllowedMcpRegistrationRedirects, isMcpAuthPath, mcpTokenGrantFailure } from "@/lib/mcp-oauth";

const handlers = toNextJsHandler(auth);

function mcpUnavailable() {
  return new Response(null, { status: 404 });
}

async function handle(request: Request, method: "GET" | "POST") {
  const pathname = new URL(request.url).pathname;
  if (isMcpAuthPath(pathname) && !isMcpEnabled()) return mcpUnavailable();
  if (pathname === "/api/auth/oauth2/register" && !(await hasAllowedMcpRegistrationRedirects(request))) {
    return Response.json(
      { error: "invalid_redirect_uri", error_description: "Redirect-URIs müssen HTTPS oder lokale Loopback-Adressen sein." },
      { status: 400 },
    );
  }
  if (isMcpAuthPath(pathname)) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user && !isDiscordIdAllowed(session.user.discordId)) {
      return Response.json({ error: "access_denied" }, { status: 403 });
    }
    const grantFailure = await mcpTokenGrantFailure(request);
    if (grantFailure) {
      return Response.json({ error: grantFailure }, { status: 400 });
    }
  }
  return handlers[method](request);
}

export function GET(request: Request) {
  return handle(request, "GET");
}

export function POST(request: Request) {
  return handle(request, "POST");
}
