import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mcpUploadTickets } from "@/db/schema";

const TTL_MS = 15 * 60 * 1000;

function hash(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

/** Stores only a hash of the random bearer token; the original is returned once. */
export async function createMcpUploadTicket(input: {
  userId: string;
  worldId: string;
  targetKind: string;
  targetId: string;
  imageKind: string;
  expectedStand: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(mcpUploadTickets).values({
    tokenHash: hash(token),
    userId: input.userId,
    worldId: input.worldId,
    targetKind: input.targetKind,
    targetId: input.targetId,
    imageKind: input.imageKind,
    expectedStand: input.expectedStand,
    expiresAt,
  });
  return { token, expiresAt };
}

/** Peek a still-valid, unused ticket without consuming it (GET upload page). */
export async function peekMcpUploadTicket(token: string) {
  const [row] = await db
    .select()
    .from(mcpUploadTickets)
    .where(and(
      eq(mcpUploadTickets.tokenHash, hash(token)),
      isNull(mcpUploadTickets.consumedAt),
      gt(mcpUploadTickets.expiresAt, new Date()),
    ))
    .limit(1);
  return row ?? null;
}

/** Atomically consumes a valid upload ticket. */
export async function consumeMcpUploadTicket(token: string) {
  const [row] = await db.update(mcpUploadTickets)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(mcpUploadTickets.tokenHash, hash(token)),
      isNull(mcpUploadTickets.consumedAt),
      gt(mcpUploadTickets.expiresAt, new Date()),
    ))
    .returning();
  return row ?? null;
}

export async function purgeMcpUploadTickets(now = new Date()) {
  await db.delete(mcpUploadTickets).where(sql`${mcpUploadTickets.expiresAt} < ${now}`);
}
