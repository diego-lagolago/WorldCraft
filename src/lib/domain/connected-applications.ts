import { and, desc, eq, max } from "drizzle-orm";
import { db } from "@/db/client";
import { oauthAccessTokens, oauthClients, oauthConsents, oauthRefreshTokens } from "@/db/schema";

export type ConnectedApplication = {
  clientId: string;
  name: string;
  redirectDomain: string;
  consentedAt: Date;
  lastUsedAt: Date | null;
};

export async function listConnectedApplications(userId: string): Promise<ConnectedApplication[]> {
  const consents = await db
    .select({ clientId: oauthConsents.clientId, name: oauthClients.name, redirectUris: oauthClients.redirectUris, consentedAt: oauthConsents.createdAt })
    .from(oauthConsents)
    .innerJoin(oauthClients, eq(oauthClients.clientId, oauthConsents.clientId))
    .where(eq(oauthConsents.userId, userId))
    .orderBy(desc(oauthConsents.updatedAt));
  return Promise.all(consents.map(async (consent) => {
    const [lastAccess] = await db.select({ lastUsedAt: max(oauthAccessTokens.createdAt) }).from(oauthAccessTokens)
      .where(and(eq(oauthAccessTokens.userId, userId), eq(oauthAccessTokens.clientId, consent.clientId)));
    let redirectDomain = "Unbekannt";
    try { redirectDomain = new URL(consent.redirectUris[0] ?? "").host || "Unbekannt"; } catch { /* valid registration has a URI */ }
    return { clientId: consent.clientId, name: consent.name?.trim() || "Unbenannte Anwendung", redirectDomain, consentedAt: consent.consentedAt, lastUsedAt: lastAccess?.lastUsedAt ?? null };
  }));
}

/** Revocation is scoped to the authenticated user's consent and client only. */
export async function revokeConnectedApplication(userId: string, clientId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [consent] = await tx.select({ id: oauthConsents.id }).from(oauthConsents)
      .where(and(eq(oauthConsents.userId, userId), eq(oauthConsents.clientId, clientId))).limit(1);
    if (!consent) return false;
    const revokedAt = new Date();
    await tx.update(oauthAccessTokens).set({ revoked: revokedAt }).where(and(eq(oauthAccessTokens.userId, userId), eq(oauthAccessTokens.clientId, clientId)));
    await tx.update(oauthRefreshTokens).set({ revoked: revokedAt }).where(and(eq(oauthRefreshTokens.userId, userId), eq(oauthRefreshTokens.clientId, clientId)));
    await tx.delete(oauthConsents).where(eq(oauthConsents.id, consent.id));
    return true;
  });
}
