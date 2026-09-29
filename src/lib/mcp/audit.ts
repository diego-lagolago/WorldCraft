const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 60;
const MAX_UPLOAD_REDEEMS_PER_WINDOW = 10;
const callsByUser = new Map<string, number[]>();
const uploadRedeemsByUser = new Map<string, number[]>();

export class McpRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Zu viele MCP-Werkzeugaufrufe. Bitte kurz warten.");
  }
}

export class McpUploadRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Zu viele Uploads. Bitte kurz warten.");
  }
}

function pruneWindow(map: Map<string, number[]>, now: number): void {
  const since = now - WINDOW_MS;
  for (const [key, calls] of map) {
    const recent = calls.filter((at) => at > since);
    if (recent.length === 0) map.delete(key);
    else map.set(key, recent);
  }
}

function consumeWindow(
  map: Map<string, number[]>,
  key: string,
  limit: number,
  ErrorType: typeof McpRateLimitError | typeof McpUploadRateLimitError,
  now: number,
): void {
  pruneWindow(map, now);
  const since = now - WINDOW_MS;
  const recent = (map.get(key) ?? []).filter((at) => at > since);
  if (recent.length >= limit) {
    map.set(key, recent);
    throw new ErrorType(Math.max(1, Math.ceil((recent[0]! + WINDOW_MS - now) / 1000)));
  }
  recent.push(now);
  map.set(key, recent);
}

/** Single-process sliding window; ADR-005 deliberately assumes one app replica. */
export function consumeMcpCall(userId: string, now = Date.now()): void {
  consumeWindow(callsByUser, userId, MAX_CALLS_PER_WINDOW, McpRateLimitError, now);
}

/** Upload ticket redemption limit: 10 per minute per ticket owner (Plan 011 T-009). */
export function consumeMcpUploadRedeem(userId: string, now = Date.now()): void {
  consumeWindow(uploadRedeemsByUser, userId, MAX_UPLOAD_REDEEMS_PER_WINDOW, McpUploadRateLimitError, now);
}

export type McpAuditWriteMeta = {
  targetKind?: string | null;
  targetId?: string | null;
  confirmed?: boolean | null;
  origin?: string;
};

export async function writeMcpAuditLog(input: {
  userId: string;
  clientId: string;
  toolName: string;
  worldId?: string | null;
  durationMs: number;
  result: string;
} & McpAuditWriteMeta): Promise<void> {
  const [{ db }, { mcpAuditLogs }] = await Promise.all([import("@/db/client"), import("@/db/schema")]);
  await db.insert(mcpAuditLogs).values({
    userId: input.userId,
    clientId: input.clientId,
    toolName: input.toolName,
    worldId: input.worldId ?? null,
    targetKind: input.targetKind ?? null,
    targetId: input.targetId ?? null,
    confirmed: input.confirmed ?? null,
    origin: input.origin ?? "mcp",
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
  uploadRedeemsByUser.clear();
}

export function hasMcpRateLimitEntryForTests(userId: string): boolean {
  return callsByUser.has(userId);
}

export function pruneMcpRateLimitForTests(now: number): void {
  pruneWindow(callsByUser, now);
  pruneWindow(uploadRedeemsByUser, now);
}
