import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mcpChangeConfirmations } from "@/db/schema";

const TTL_MS = 10 * 60 * 1000;
type ConfirmationRow = Awaited<ReturnType<typeof consumeMcpConfirmation>>;
type ConfirmationHandler = (row: NonNullable<ConfirmationRow>) => Promise<{ value: string; worldId?: string }>;
const handlers = new Map<string, ConfirmationHandler>();

export function registerMcpConfirmationHandler(operation: string, handler: ConfirmationHandler) {
  handlers.set(operation, handler);
}

export async function executeMcpConfirmation(row: NonNullable<ConfirmationRow>) {
  const operation = typeof (row.payload as { operation?: unknown }).operation === "string"
    ? (row.payload as { operation: string }).operation
    : "";
  const handler = handlers.get(operation);
  if (!handler) throw new Error("Die vorgemerkte Änderung kann nicht ausgeführt werden.");
  return handler(row);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

/** Stores only a hash of the random bearer token; the original is returned once. */
export async function createMcpConfirmation(input: {
  userId: string;
  clientId: string;
  worldId: string;
  targetKind: string;
  targetId: string;
  expectedStand: string;
  payload: unknown;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  const changeHash = hash(JSON.stringify(input.payload));
  await db.insert(mcpChangeConfirmations).values({
    tokenHash: hash(token), userId: input.userId, clientId: input.clientId,
    worldId: input.worldId, targetKind: input.targetKind, targetId: input.targetId,
    expectedStand: input.expectedStand, changeHash, payload: input.payload, expiresAt,
  });
  return { token, expiresAt };
}

/** Atomically consumes a valid confirmation belonging to this OAuth client. */
export async function consumeMcpConfirmation(input: { token: string; userId: string; clientId: string }) {
  const [row] = await db.update(mcpChangeConfirmations)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(mcpChangeConfirmations.tokenHash, hash(input.token)),
      eq(mcpChangeConfirmations.userId, input.userId),
      eq(mcpChangeConfirmations.clientId, input.clientId),
      isNull(mcpChangeConfirmations.consumedAt),
      gt(mcpChangeConfirmations.expiresAt, new Date()),
    ))
    .returning();
  return row ?? null;
}

export async function purgeMcpChangeConfirmations(now = new Date()) {
  await db.delete(mcpChangeConfirmations).where(sql`${mcpChangeConfirmations.expiresAt} < ${now}`);
}
