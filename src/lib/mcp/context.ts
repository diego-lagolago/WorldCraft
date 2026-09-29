import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, worlds } from "@/db/schema";
import type { MembershipRole } from "@/lib/authz";
import { McpToolError } from "./errors";

export { McpToolError } from "./errors";

export type McpWorldContext = {
  id: string;
  name: string;
  role: MembershipRole;
  userId: string;
};

export type McpWorldSummary = McpWorldContext & { mcpEnabled: boolean; updatedAt: Date };
async function enabledWorlds(userId: string) {
  return db
    .select({ id: worlds.id, name: worlds.name, role: memberships.role })
    .from(memberships)
    .innerJoin(worlds, eq(worlds.id, memberships.worldId))
    .where(and(eq(memberships.userId, userId), isNull(memberships.archivedAt), eq(worlds.mcpEnabled, true)))
    .orderBy(asc(worlds.name));
}

export async function listMcpWorldMemberships(userId: string): Promise<McpWorldSummary[]> {
  const rows = await db
    .select({ id: worlds.id, name: worlds.name, role: memberships.role, mcpEnabled: worlds.mcpEnabled, updatedAt: worlds.updatedAt })
    .from(memberships)
    .innerJoin(worlds, eq(worlds.id, memberships.worldId))
    .where(and(eq(memberships.userId, userId), isNull(memberships.archivedAt)))
    .orderBy(asc(worlds.name));
  return rows.map((row) => ({ ...row, userId }));
}

/** Resolves ID or case-insensitive name without ever searching across worlds. */
export async function resolveMcpWorld(userId: string, value?: string): Promise<McpWorldContext> {
  const candidates = await enabledWorlds(userId);
  if (!value?.trim()) {
    if (candidates.length === 1) return { ...candidates[0], userId };
    if (candidates.length === 0) throw new McpToolError("Es gibt keine für MCP freigegebene Welt.");
    throw new McpToolError(`Bitte nenne eine Welt: ${candidates.map((world) => `${world.name} (${world.id})`).join(", ")}`);
  }
  return resolveMcpWorldIncludingDisabled(userId, value);
}

/** Membership is checked first so a foreign ID remains indistinguishable from absent. */
export async function resolveMcpWorldIncludingDisabled(userId: string, value: string): Promise<McpWorldContext> {
  const needle = value.trim();
  const rows = await db
    .select({ id: worlds.id, name: worlds.name, role: memberships.role, mcpEnabled: worlds.mcpEnabled })
    .from(memberships)
    .innerJoin(worlds, eq(worlds.id, memberships.worldId))
    .where(and(eq(memberships.userId, userId), isNull(memberships.archivedAt)))
    .orderBy(asc(worlds.name));
  const matches = rows.filter((world) => world.id === needle || world.name.localeCompare(needle, "de", { sensitivity: "accent" }) === 0);
  if (matches.length !== 1) throw new McpToolError("Welt nicht gefunden.");
  if (!matches[0].mcpEnabled) throw new McpToolError("MCP ist für diese Welt nicht freigegeben.");
  return { id: matches[0].id, name: matches[0].name, role: matches[0].role, userId };
}
