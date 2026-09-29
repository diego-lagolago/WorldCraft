import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getArticle } from "@/lib/domain/articles";
import { getMonster } from "@/lib/domain/monsters";
import { getWorldDetails } from "@/lib/domain/worlds";
import { listMcpWorldMemberships } from "@/lib/mcp/context";
import { standOf } from "@/lib/mcp/write-rich";

type UploadTicketTarget = { userId: string; worldId: string; targetKind: string; targetId: string };

export type UploadTargetState = { title: string; stand: string; hasImage: boolean };

/**
 * Title, stand and existing image of the upload target, loaded through the domain layer with
 * the ticket owner's role (011 Review 2 CR-002). `null` when the target is gone or invisible.
 */
export async function loadUploadTargetState(ticket: UploadTicketTarget): Promise<UploadTargetState | null> {
  const world = (await listMcpWorldMemberships(ticket.userId)).find((entry) => entry.id === ticket.worldId);
  if (!world) return null;
  if (ticket.targetKind === "welt") {
    const details = await getWorldDetails(ticket.worldId);
    return details ? { title: details.name, stand: standOf(world.updatedAt), hasImage: Boolean(details.titleImageId) } : null;
  }
  if (ticket.targetKind === "artikel") {
    const row = await getArticle(ticket.worldId, ticket.targetId, world.role, ticket.userId);
    return row ? { title: row.title, stand: standOf(row.updatedAt), hasImage: Boolean(row.titleImageId) } : null;
  }
  if (ticket.targetKind === "monster") {
    const row = await getMonster(ticket.worldId, ticket.targetId, world.role, ticket.userId);
    return row ? { title: row.name, stand: standOf(row.updatedAt), hasImage: Boolean(row.portraitId) } : null;
  }
  return null;
}

/** Identity lookup for the Discord allowlist, as in the /mcp route (no content table involved). */
export async function ticketOwnerDiscordId(userId: string): Promise<string | null> {
  const [user] = await db.select({ discordId: users.discordId }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.discordId ?? null;
}
