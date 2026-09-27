import { and, desc, eq, max } from "drizzle-orm";
import { db } from "@/db/client";
import { mcpAuditLogs, oauthAccessTokens, oauthClients, oauthConsents, oauthRefreshTokens } from "@/db/schema";

export type ConnectedApplication = {
  clientId: string;
  name: string;
  redirectDomain: string;
  consentedAt: Date;
  lastUsedAt: Date | null;
};

export async function listConnectedApplications(userId: string): Promise<ConnectedApplication[]> {
  const [consents, lastUsage] = await Promise.all([
    db
    .select({ clientId: oauthConsents.clientId, name: oauthClients.name, redirectUris: oauthClients.redirectUris, consentedAt: oauthConsents.createdAt })
    .from(oauthConsents)
    .innerJoin(oauthClients, eq(oauthClients.clientId, oauthConsents.clientId))
    .where(eq(oauthConsents.userId, userId))
    .orderBy(desc(oauthConsents.updatedAt)),
    db.select({ clientId: mcpAuditLogs.clientId, lastUsedAt: max(mcpAuditLogs.createdAt) })
      .from(mcpAuditLogs).where(eq(mcpAuditLogs.userId, userId)).groupBy(mcpAuditLogs.clientId),
  ]);
  const lastUsageByClient = new Map(lastUsage.map((entry) => [entry.clientId, entry.lastUsedAt]));
  return consents.map((consent) => {
    let redirectDomain = "Unbekannt";
    try { redirectDomain = new URL(consent.redirectUris[0] ?? "").host || "Unbekannt"; } catch { /* valid registration has a URI */ }
    return { clientId: consent.clientId, name: consent.name?.trim() || "Unbenannte Anwendung", redirectDomain, consentedAt: consent.consentedAt, lastUsedAt: lastUsageByClient.get(consent.clientId) ?? null };
  });
}

/** A missing consent means the user revoked this client's access immediately. */
export async function hasActiveMcpConsent(userId: string, clientId: string): Promise<boolean> {
  const [consent] = await db.select({ id: oauthConsents.id }).from(oauthConsents)
    .where(and(eq(oauthConsents.userId, userId), eq(oauthConsents.clientId, clientId))).limit(1);
  return Boolean(consent);
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
