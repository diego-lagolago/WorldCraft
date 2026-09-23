import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, worlds } from "@/db/schema";
import type { MembershipRole } from "@/lib/authz";

export type MyWorld = { id: string; name: string; role: MembershipRole };

/** Worlds with an active membership of the user, alphabetical. */
export async function listMyWorlds(userId: string): Promise<MyWorld[]> {
  return db
    .select({ id: worlds.id, name: worlds.name, role: memberships.role })
    .from(memberships)
    .innerJoin(worlds, eq(worlds.id, memberships.worldId))
    .where(and(eq(memberships.userId, userId), isNull(memberships.archivedAt)))
    .orderBy(asc(worlds.name));
}
