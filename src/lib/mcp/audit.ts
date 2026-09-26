const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 60;
const callsByUser = new Map<string, number[]>();

export class McpRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Zu viele MCP-Werkzeugaufrufe. Bitte kurz warten.");
  }
}

/** Single-process sliding window; ADR-005 deliberately assumes one app replica. */
export function consumeMcpCall(userId: string, now = Date.now()): void {
  const since = now - WINDOW_MS;
  const recent = (callsByUser.get(userId) ?? []).filter((at) => at > since);
  if (recent.length >= MAX_CALLS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000));
    callsByUser.set(userId, recent);
    throw new McpRateLimitError(retryAfterSeconds);
  }
  recent.push(now);
  callsByUser.set(userId, recent);
}

export async function writeMcpAuditLog(input: {
  userId: string;
  clientId: string;
  toolName: string;
  worldId?: string | null;
  durationMs: number;
  result: string;
}): Promise<void> {
  const [{ db }, { mcpAuditLogs }] = await Promise.all([import("@/db/client"), import("@/db/schema")]);
  await db.insert(mcpAuditLogs).values({
    userId: input.userId,
    clientId: input.clientId,
    toolName: input.toolName,
    worldId: input.worldId ?? null,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    result: input.result.slice(0, 120),
  });
}

export async function purgeMcpAuditLog(now = new Date()): Promise<void> {
  const [{ lt }, { db }, { mcpAuditLogs }] = await Promise.all([import("drizzle-orm"), import("@/db/client"), import("@/db/schema")]);
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await db.delete(mcpAuditLogs).where(lt(mcpAuditLogs.createdAt, cutoff));
}

/** Test-only reset; never exported from a route. */
export function resetMcpRateLimitForTests(): void {
  callsByUser.clear();
}
