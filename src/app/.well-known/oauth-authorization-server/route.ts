import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";
import { isMcpEnabled } from "@/lib/env";

const metadata = oauthProviderAuthServerMetadata(auth);

export async function GET(request: Request) {
  if (!isMcpEnabled()) return new Response(null, { status: 404 });
  return metadata(request);
}
