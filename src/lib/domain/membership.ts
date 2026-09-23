import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, worlds } from "@/db/schema";
import { denyIfNoMembership, fail, ok, type AuthzResult, type MembershipRow } from "@/lib/authz";

export type WorldContext = {
  world: { id: string; name: string; createdBy: string };
  membership: MembershipRow;
};

/**
 * Loads the world and the actor's active membership. A missing world is 404,
 * an archived or missing membership 403 (APP-AUTHZ).
 */
export async function loadWorldContext(
  worldId: string,
  userId: string,
): Promise<AuthzResult<WorldContext>> {
  const [row] = await db
    .select({
      worldId: worlds.id,
      worldName: worlds.name,
      worldCreatedBy: worlds.createdBy,
      membershipId: memberships.id,
      role: memberships.role,
      archivedAt: memberships.archivedAt,
    })
    .from(worlds)
    .leftJoin(
      memberships,
      and(eq(memberships.worldId, worlds.id), eq(memberships.userId, userId)),
    )
    .where(eq(worlds.id, worldId))
    .limit(1);

  if (!row) return fail(404, "Diese Welt gibt es nicht.");

  const membership: MembershipRow | null =
    row.membershipId && row.role
      ? {
          id: row.membershipId,
          worldId: row.worldId,
          userId,
          role: row.role,
          archivedAt: row.archivedAt,
        }
      : null;
  const denied = denyIfNoMembership(membership);
  if (denied || !membership) return denied ?? fail(403, "Kein aktives Mitglied dieser Welt.");

  return ok({
    world: { id: row.worldId, name: row.worldName, createdBy: row.worldCreatedBy },
    membership,
  });
}
