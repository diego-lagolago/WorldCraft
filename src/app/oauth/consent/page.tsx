import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { OAuthConsent } from "@/components/auth/OAuthConsent";
import { db } from "@/db/client";
import { oauthClients } from "@/db/schema";
import { isDiscordIdAllowed, isMcpEnabled } from "@/lib/env";
import { getOptionalSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function serializeSearchParams(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else for (const item of value ?? []) query.append(key, item);
  }
  return query.toString();
}

export default async function OAuthConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  if (!isMcpEnabled()) notFound();
  const params = await searchParams;
  const oauthQuery = serializeSearchParams(params);
  const session = await getOptionalSession();
  if (!session?.user) redirect(`/?${oauthQuery}`);

  const clientId = typeof params.client_id === "string" ? params.client_id : null;
  const client = clientId
    ? (await db.select({ name: oauthClients.name }).from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1))[0]
    : null;
  const scope = typeof params.scope === "string" ? params.scope.split(" ").filter(Boolean) : [];
  const redirectUri = typeof params.redirect_uri === "string" ? params.redirect_uri : "";
  let redirectDomain = "Unbekannt";
  try {
    redirectDomain = new URL(redirectUri).host;
  } catch {
    // The provider validates the URI before this page can grant access.
  }

  return (
    <OAuthConsent
      clientName={client?.name?.trim() || "Unbekannte Anwendung"}
      redirectDomain={redirectDomain}
      oauthQuery={oauthQuery}
      scopes={scope}
      accessAllowed={isDiscordIdAllowed(session.user.discordId)}
    />
  );
}
