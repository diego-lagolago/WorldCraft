import { isStaff, type MembershipRole } from "@/lib/authz";
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
  for (const mention of input.parsed.mentions) {
    const hits = await searchMentionTargets({
      worldId: input.worldId,
      role: input.role,
      viewerId: input.viewerId,
      query: mention.title,
    });
    if (mention.target) {
      const hit = hits.find((candidate) => candidate.kind === mention.target!.kind && candidate.id === mention.target!.id);
      if (!hit) throw new McpMentionError("Erwähntes Ziel nicht gefunden.");
      resolved.push({ ...mention, kind: hit.kind, id: hit.id, title: hit.title });
      continue;
    }
    const exact = hits.filter((candidate) => candidate.title.localeCompare(mention.title, "de", { sensitivity: "accent" }) === 0);
    if (exact.length === 1) {
      resolved.push({ ...mention, kind: exact[0].kind, id: exact[0].id, title: exact[0].title });
      continue;
    }
    if (exact.length > 1) {
      throw new McpMentionError(`Die Erwähnung „${mention.title}“ ist mehrdeutig: ${exact.map((candidate) => `${candidate.title} (${candidate.kind})`).join(", ")}.`);
    }
    const proposed = hits.find((candidate) => mention.title.toLocaleLowerCase("de").includes(candidate.title.toLocaleLowerCase("de")));
    if (proposed) throw new McpMentionError(`Für „${mention.title}“ gibt es bereits „${proposed.title}". Bitte diesen Titel verwenden.`);
    if (mention.title.split(/\s+/).filter(Boolean).length > 8 || mention.title.length > 80) {
      throw new McpMentionError("Ein Stub-Titel darf höchstens 8 Wörter und 80 Zeichen haben.");
    }
    if (!isStaff(input.role)) throw new McpMentionError(`Unbekannte Erwähnung: „${mention.title}“.`);
    stubs.push(mention.title);
  }
  return {
    doc: stubs.length ? null : resolveMcpMarkdown(input.parsed, resolved, { mentions: true }),
    stubs,
    resolved,
  };
}
