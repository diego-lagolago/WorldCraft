import type { MembershipRow, MembershipRole } from "@/lib/authz";
import { CONTENT_VISIBILITY_LABEL, type ContentVisibility } from "@/lib/authz";
import {
  McpMentionError,
  resolveMcpMarkdownMentions,
  type McpMentionResolution,
} from "@/lib/domain/mcp-mentions";
import {
  mcpMarkdownToTiptap,
  resolveMcpMarkdown,
  type ResolvedMcpMarkdownMention,
} from "@/lib/editor/mcp-markdown";
import type { TemplateRefValue } from "@/lib/templates/registry";
import type { McpWorldContext } from "./context";
import { McpToolError } from "./context";

export function mcpMembership(world: McpWorldContext): MembershipRow {
  return {
    id: "mcp",
    worldId: world.id,
    userId: world.userId,
    role: world.role,
    archivedAt: null,
  };
}

export function standOf(updatedAt: Date | string | number): string {
  return updatedAt instanceof Date ? updatedAt.toISOString() : new Date(updatedAt).toISOString();
}

export function assertStand(actual: Date | string | number, expected: string) {
  if (standOf(actual) !== expected) {
    throw new McpToolError("Inhalt wurde inzwischen geändert, bitte neu lesen.");
  }
}

export function visibilityLabel(value: ContentVisibility | "gm_only" | "published" | "owner_only"): string {
  return CONTENT_VISIBILITY_LABEL[value as ContentVisibility] ?? value;
}

export function throwAuthz(result: { ok: false; error: string }): never {
  throw new McpToolError(result.error);
}

export async function resolveRichText(input: {
  markdown: string | undefined;
  worldId: string;
  role: MembershipRole;
  viewerId: string;
  mentions: boolean;
}): Promise<McpMentionResolution & { parsedMentions: number }> {
  if (!input.markdown?.trim()) {
    return { doc: null, stubs: [], resolved: [], parsedMentions: 0 };
  }
  try {
    const parsed = mcpMarkdownToTiptap(input.markdown, { mentions: input.mentions });
    if (!input.mentions && parsed.mentions.length) {
      throw new McpToolError("Dieser Text darf keine Erwähnungen enthalten.");
    }
    if (!input.mentions) {
      return {
        doc: resolveMcpMarkdown(parsed, [], { mentions: false }),
        stubs: [],
        resolved: [],
        parsedMentions: 0,
      };
    }
    const resolution = await resolveMcpMarkdownMentions({
      parsed,
      worldId: input.worldId,
      role: input.role,
      viewerId: input.viewerId,
    });
    return { ...resolution, parsedMentions: parsed.mentions.length };
  } catch (error) {
    if (error instanceof McpMentionError || error instanceof McpToolError) throw error;
    throw new McpToolError(error instanceof Error ? error.message : "Markdown konnte nicht verarbeitet werden.");
  }
}

/** Resolves a single mention string used in template refs / habitat. */
export async function resolveMentionRef(input: {
  value: unknown;
  worldId: string;
  role: MembershipRole;
  viewerId: string;
  allowedKinds?: ReadonlyArray<ResolvedMcpMarkdownMention["kind"]>;
}): Promise<{ ref: TemplateRefValue | { kind: "article"; id: string }; stubs: string[]; resolved?: ResolvedMcpMarkdownMention }> {
  if (input.value && typeof input.value === "object") {
    throw new McpToolError("Verweis muss in Erwähnungssyntax angegeben werden, z. B. @[Titel](artikel:id).");
  }
  if (typeof input.value !== "string" || !input.value.trim()) {
    throw new McpToolError("Verweis muss in Erwähnungssyntax angegeben werden.");
  }
  const resolution = await resolveRichText({
    markdown: input.value.trim(),
    worldId: input.worldId,
    role: input.role,
    viewerId: input.viewerId,
    mentions: true,
  });
  if (resolution.parsedMentions !== 1) {
    throw new McpToolError("Verweis muss genau eine Erwähnung enthalten.");
  }
  if (resolution.stubs.length) {
    return { ref: { kind: "article", id: "pending" }, stubs: resolution.stubs };
  }
  const mention = resolution.resolved[0];
  if (!mention) throw new McpToolError("Verweis konnte nicht aufgelöst werden.");
  if (input.allowedKinds && !input.allowedKinds.includes(mention.kind)) {
    throw new McpToolError("Dieser Verweis zeigt auf einen unzulässigen Inhaltstyp.");
  }
  if (mention.kind !== "article" && mention.kind !== "character") {
    throw new McpToolError("Vorlagenverweise akzeptieren nur Artikel oder Charaktere.");
  }
  return {
    ref: { kind: mention.kind, id: mention.id },
    stubs: [],
    resolved: mention,
  };
}

export function formatCreateResult(input: {
  art: string;
  id: string;
  title: string;
  stand: string;
  visibility: string;
  stubs?: { id: string; title: string }[];
  ignoredVisibility?: boolean;
}): string {
  const lines = [
    `Art: ${input.art}`,
    `ID: ${input.id}`,
    `Titel: ${input.title}`,
    `Stand: ${input.stand}`,
    `Sichtbarkeit: ${input.visibility}`,
  ];
  if (input.ignoredVisibility) {
    lines.push("Hinweis: Eine übergebene Sichtbarkeit wurde ignoriert; neue Inhalte starten privat (Universen: nur Spielleitung).");
  }
  if (input.stubs?.length) {
    lines.push("Neu angelegte Stubs:");
    for (const stub of input.stubs) lines.push(`- ${stub.title} (${stub.id})`);
  }
  return lines.join("\n");
}

/** One delta row (Begriffe „Delta“); captions replace „vorher“/„nachher“, e.g. for rich text. */
export type FieldChange = { label: string; oldValue: string; newValue: string; oldCaption?: string; newCaption?: string };

export const PREVIEW_INSTRUCTION = "Zeige dem Benutzer diese Vorschau vollständig und unverändert. "
  + "Rufe aenderung_bestaetigen erst auf, wenn der Benutzer ausdrücklich zugestimmt hat.";

function indented(caption: string, value: string): string[] {
  const [first, ...rest] = value.split("\n");
  return [`  ${caption}: ${first}`, ...rest.map((line) => `    ${line}`)];
}

/** Delta „vorher → nachher“ per changed field; long or multi-line values get their own lines. */
export function formatDelta(changes: readonly FieldChange[], heading = "Änderungen:"): string[] {
  if (!changes.length) return [];
  return [heading, ...changes.flatMap((change) => {
    const inline = !change.oldCaption && !change.newCaption
      && !`${change.oldValue}${change.newValue}`.includes("\n")
      && change.oldValue.length + change.newValue.length <= 160;
    return inline
      ? [`- ${change.label}: ${change.oldValue} → ${change.newValue}`]
      : [
        `- ${change.label}:`,
        ...indented(change.oldCaption ?? "vorher", change.oldValue),
        ...indented(change.newCaption ?? "nachher", change.newValue),
      ];
  })];
}

/** Shared preview format of every confirmation path (012 T-007, E2). */
export function formatConfirmationPreview(input: {
  art: string;
  title: string;
  visibility?: string;
  changes?: readonly FieldChange[];
  lines?: string[];
  stubTitles?: string[];
  token: string;
  expiresAt: Date;
}): string {
  return [
    PREVIEW_INSTRUCTION,
    "Änderung noch nicht ausgeführt.",
    `Art: ${input.art}`,
    `Titel: ${input.title}`,
    ...(input.visibility ? [`Sichtbarkeit: ${input.visibility}`] : []),
    ...formatDelta(input.changes ?? []),
    ...(input.lines ?? []),
    ...formatStubLines(input.stubTitles ?? []),
    `Bestätigungs-Token: ${input.token}`,
    `Gültig bis: ${input.expiresAt.toISOString()}`,
  ].join("\n");
}

/** Preview lines listing the stub articles a confirmation would create. */
export function formatStubLines(stubTitles: string[]): string[] {
  if (!stubTitles.length) return [];
  return ["Geplante Stub-Artikel:", ...stubTitles.map((title) => `- ${title}`)];
}
