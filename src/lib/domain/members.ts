import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type DB } from "@/db/client";
import { characters, memberships, users, worldParticipations } from "@/db/schema";
import {
  authorizeLeave,
  authorizeMemberAdmin,
  ok,
  type AuthzResult,
  type MembershipRole,
  type MembershipRow,
} from "@/lib/authz";
import { worldEvents } from "@/lib/realtime/events";

export type MemberSummary = {
  membershipId: string;
  userId: string;
  name: string;
  image: string | null;
  role: MembershipRole;
  joinedAt: Date;
};

const ROLE_ORDER = sql`CASE ${memberships.role} WHEN 'game_master' THEN 0 WHEN 'master' THEN 1 ELSE 2 END`;

/** Active members: game master, masters, players, each alphabetical. */
export async function listMembers(worldId: string): Promise<MemberSummary[]> {
  return db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      name: users.name,
      image: users.image,
      role: memberships.role,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.worldId, worldId), isNull(memberships.archivedAt)))
    .orderBy(ROLE_ORDER, asc(users.name));
}

async function loadMembership(membershipId: string): Promise<MembershipRow | null> {
  const [row] = await db
    .select({
      id: memberships.id,
      worldId: memberships.worldId,
      userId: memberships.userId,
      role: memberships.role,
      archivedAt: memberships.archivedAt,
    })
    .from(memberships)
    .where(eq(memberships.id, membershipId))
    .limit(1);
  return row ?? null;
}

function publishMembershipChanged(worldId: string, userId: string) {
  worldEvents.publish({ type: "membership.changed", worldId, userId });
}

/** Player ↔ Master, only by the game master. */
export async function changeMemberRole(input: {
  actor: MembershipRow | null;
  actorId: string;
  membershipId: string;
  role: "master" | "player";
}): Promise<AuthzResult<{ membershipId: string; role: MembershipRole }>> {
  const allowed = authorizeMemberAdmin(input.actor, await loadMembership(input.membershipId));
  if (!allowed.ok) return allowed;
  await db
    .update(memberships)
    .set({ role: input.role, updatedAt: new Date(), updatedBy: input.actorId })
    .where(eq(memberships.id, allowed.data.id));
  publishMembershipChanged(allowed.data.worldId, allowed.data.userId);
  return ok({ membershipId: allowed.data.id, role: input.role });
}

/**
 * APP-MEMBER-ARCHIVE in one transaction: membership and all own participations
 * of the world are archived with one statement each (CR-008, CR-011). Markers,
 * relations and journal entries stay untouched.
 */
async function archiveMembership(tx: Pick<DB, "update" | "select">, target: MembershipRow, actorId: string) {
  const now = new Date();
  await tx
    .update(memberships)
    .set({ archivedAt: now, updatedAt: now, updatedBy: actorId })
    .where(eq(memberships.id, target.id));
  const ownCharacters = tx
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.ownerId, target.userId));
  await tx
    .update(worldParticipations)
    .set({ archivedAt: now, updatedAt: now, updatedBy: actorId })
    .where(
      and(
        eq(worldParticipations.worldId, target.worldId),
        isNull(worldParticipations.archivedAt),
        inArray(worldParticipations.characterId, ownCharacters),
      ),
    );
}

export async function removeMember(input: {
  actor: MembershipRow | null;
  actorId: string;
  membershipId: string;
}): Promise<AuthzResult<{ membershipId: string }>> {
  const allowed = authorizeMemberAdmin(input.actor, await loadMembership(input.membershipId));
  if (!allowed.ok) return allowed;
  await db.transaction((tx) => archiveMembership(tx, allowed.data, input.actorId));
  publishMembershipChanged(allowed.data.worldId, allowed.data.userId);
  return ok({ membershipId: allowed.data.id });
}

export async function leaveWorld(input: {
  membership: MembershipRow | null;
  actorId: string;
}): Promise<AuthzResult<{ worldId: string }>> {
  const allowed = authorizeLeave(input.membership);
  if (!allowed.ok) return allowed;
  await db.transaction((tx) => archiveMembership(tx, allowed.data, input.actorId));
  publishMembershipChanged(allowed.data.worldId, allowed.data.userId);
  return ok({ worldId: allowed.data.worldId });
}
