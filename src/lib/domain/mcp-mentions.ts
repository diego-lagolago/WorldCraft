import { isStaff, type MembershipRole } from "@/lib/authz";
import { getArticle } from "./articles";
import { getWorldCharacter } from "./characters";
import { getMonster } from "./monsters";
import { getQuest } from "./quests";
import { getUniverse } from "./universes";
import {
  resolveMcpMarkdown,
  type ParsedMcpMarkdown,
  type ResolvedMcpMarkdownMention,
} from "@/lib/editor/mcp-markdown";
import { searchMentionTargets } from "./mention-search";

export class McpMentionError extends Error {}

export type McpMentionResolution = {
  doc: ReturnType<typeof resolveMcpMarkdown> | null;
  stubs: string[];
  resolved: ResolvedMcpMarkdownMention[];
};

async function explicitTarget(input: {
  kind: NonNullable<ParsedMcpMarkdown["mentions"][number]["target"]>["kind"];
  id: string;
  worldId: string;
  role: MembershipRole;
  viewerId: string;
}) {
  if (input.kind === "article") {
    const row = await getArticle(input.worldId, input.id, input.role, input.viewerId);
    return row ? { kind: input.kind, id: row.id, title: row.title } : null;
  }
  if (input.kind === "quest") {
    const row = await getQuest(input.worldId, input.id, input.role, input.viewerId);
    return row ? { kind: input.kind, id: row.id, title: row.title } : null;
  }
  if (input.kind === "monster") {
    const row = await getMonster(input.worldId, input.id, input.role, input.viewerId);
    return row ? { kind: input.kind, id: row.id, title: row.name } : null;
  }
  if (input.kind === "universe") {
    const row = await getUniverse(input.worldId, input.id, input.role, input.viewerId);
    return row ? { kind: input.kind, id: row.id, title: row.name } : null;
  }
  const row = await getWorldCharacter(input.worldId, input.id);
  return row ? { kind: input.kind, id: row.id, title: row.name } : null;
}

async function plausibleTarget(input: Parameters<typeof searchMentionTargets>[0], title: string) {
  const words = title.split(/\s+/).filter(Boolean);
  for (let length = words.length - 1; length >= 1; length -= 1) {
    const hits = await searchMentionTargets({ ...input, query: words.slice(0, length).join(" ") });
    const match = hits.find((candidate) => {
      const proposed = candidate.title.toLocaleLowerCase("de");
      const requested = title.toLocaleLowerCase("de");
      return requested.includes(proposed) || proposed.startsWith(requested);
    });
    if (match) return match;
  }
  return null;
}

/**
 * Resolves the deliberately explicit MCP syntax through the same visibility-aware
 * mention search as the editor. Stubs are only described here; their creator runs
 * later inside the confirmed domain transaction.
 */
export async function resolveMcpMarkdownMentions(input: {
  parsed: ParsedMcpMarkdown;
  worldId: string;
  role: MembershipRole;
  viewerId: string;
}): Promise<McpMentionResolution> {
  const resolved: ResolvedMcpMarkdownMention[] = [];
  const stubs: string[] = [];
  const byMention = new Map<string, Awaited<ReturnType<typeof resolveOne>>>();
  async function resolveOne(mention: ParsedMcpMarkdown["mentions"][number]) {
    if (mention.target) {
      const hit = await explicitTarget({ ...mention.target, worldId: input.worldId, role: input.role, viewerId: input.viewerId });
      if (!hit) throw new McpMentionError("Erwähntes Ziel nicht gefunden.");
      return { type: "resolved" as const, hit };
    }
    const hits = await searchMentionTargets({
      worldId: input.worldId, role: input.role, viewerId: input.viewerId, query: mention.title,
    });
    const exact = hits.filter((candidate) => candidate.title.localeCompare(mention.title, "de", { sensitivity: "accent" }) === 0);
    if (exact.length === 1) return { type: "resolved" as const, hit: exact[0] };
    if (exact.length > 1) {
      throw new McpMentionError(`Die Erwähnung „${mention.title}“ ist mehrdeutig: ${exact.map((candidate) => `${candidate.title} (${candidate.kind})`).join(", ")}.`);
    }
    const proposed = await plausibleTarget({ worldId: input.worldId, role: input.role, viewerId: input.viewerId, query: "" }, mention.title);
    if (proposed) throw new McpMentionError(`Für „${mention.title}“ gibt es bereits „${proposed.title}". Bitte diesen Titel verwenden.`);
    if (mention.title.split(/\s+/).filter(Boolean).length > 8 || mention.title.length > 80) {
      throw new McpMentionError("Ein Stub-Titel darf höchstens 8 Wörter und 80 Zeichen haben.");
    }
    if (!isStaff(input.role)) throw new McpMentionError(`Unbekannte Erwähnung: „${mention.title}“.`);
    return { type: "stub" as const };
  }
  for (const mention of input.parsed.mentions) {
    const key = mention.target ? `${mention.target.kind}:${mention.target.id}` : mention.title.toLocaleLowerCase("de");
    let outcome = byMention.get(key);
    if (!outcome) {
      outcome = await resolveOne(mention);
      byMention.set(key, outcome);
    }
    if (outcome.type === "resolved") resolved.push({ ...mention, kind: outcome.hit.kind, id: outcome.hit.id, title: outcome.hit.title });
    else if (!stubs.some((title) => title.localeCompare(mention.title, "de", { sensitivity: "accent" }) === 0)) stubs.push(mention.title);
  }
  return {
    doc: stubs.length ? null : resolveMcpMarkdown(input.parsed, resolved, { mentions: true }),
    stubs,
    resolved,
  };
}
