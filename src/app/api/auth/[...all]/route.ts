import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { isDiscordIdAllowed, isMcpEnabled } from "@/lib/env";
import { hasAllowedMcpRegistrationRedirects, isMcpAuthPath, mcpTokenGrantFailure } from "@/lib/mcp-oauth";
import { logMcpOAuthException, logMcpOAuthResponse } from "@/lib/mcp/oauth-observability";

const handlers = toNextJsHandler(auth);

function mcpUnavailable() {
  return new Response(null, { status: 404 });
}

async function handle(request: Request, method: "GET" | "POST") {
  const pathname = new URL(request.url).pathname;
  const isMcpOAuthRequest = isMcpAuthPath(pathname);
  try {
    let response: Response;
    if (isMcpOAuthRequest && !isMcpEnabled()) response = mcpUnavailable();
    else if (pathname === "/api/auth/oauth2/register" && !(await hasAllowedMcpRegistrationRedirects(request))) {
      response = Response.json(
        { error: "invalid_redirect_uri", error_description: "Redirect-URIs müssen HTTPS oder lokale Loopback-Adressen sein." },
        { status: 400 },
      );
    } else {
      if (isMcpOAuthRequest) {
        const session = await auth.api.getSession({ headers: request.headers });
        if (session?.user && !isDiscordIdAllowed(session.user.discordId)) {
          response = Response.json({ error: "access_denied" }, { status: 403 });
          await logMcpOAuthResponse(request, response);
          return response;
        }
        const grantFailure = await mcpTokenGrantFailure(request);
        if (grantFailure) {
          response = Response.json({ error: grantFailure }, { status: 400 });
          await logMcpOAuthResponse(request, response);
          return response;
        }
      }
      response = await handlers[method](request);
    }
    if (isMcpOAuthRequest) await logMcpOAuthResponse(request, response);
    return response;
  } catch (error) {
    if (isMcpOAuthRequest) await logMcpOAuthException(request, error);
    throw error;
  }
}

export function GET(request: Request) {
  return handle(request, "GET");
}

export function POST(request: Request) {
  return handle(request, "POST");
}
