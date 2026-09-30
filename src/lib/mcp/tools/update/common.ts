import type { ZodSafeParseResult } from "zod";
import type { MembershipRow } from "@/lib/authz";
import { asRichDoc, plainTextOf, type RichDoc } from "@/lib/editor/rich-text";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import { McpToolError, type McpWorldContext } from "../../context";
import { MCP_NOT_SET } from "../../enums";
import { fieldFor, type FieldArt } from "../../field-catalog";
import type { MaterializedStubs, StubPlan } from "../../write-shared";
import { headExcerpt, RICH_EXCERPT, tailExcerpt } from "../../change-format";
import { resolveRichText, type FieldChange } from "../../write-rich";
import type { ToolContext } from "../shared";

export type RichModus = "anhaengen" | "ersetzen";

export type { FieldChange };

export type PreviewContext = {
  art: FieldArt;
  world: McpWorldContext;
  modus: RichModus;
  changes: FieldChange[];
  stubs: StubPlan;
};

export type ExecuteContext = {
  ctx: ToolContext;
  world: McpWorldContext;
  membership: MembershipRow;
  modus: RichModus;
  stand: string;
  expectedUpdatedAt: Date;
  stubs: MaterializedStubs;
};

/** A write handler must not read the target after persisting it: that read runs inside stub compensation. */
export type UpdateResult = { id: string; stand?: string };

export type PreviewSummary = { title: string; visibility?: string; skipConfirmation?: boolean };

/** A loaded, visible target whose stand already matched (phase a). */
export type UpdateTarget = {
  /** The already loaded target, reused for the pre-write receipt snapshot. */
  source: unknown;
  preview: (felder: Record<string, unknown>, context: PreviewContext) => Promise<PreviewSummary>;
  execute: (felder: Record<string, unknown>, context: ExecuteContext) => Promise<UpdateResult>;
};

export type UpdateHandler = {
  schema: { safeParse: (value: unknown) => ZodSafeParseResult<Record<string, unknown>> };
  allowStubs: boolean;
  load: (world: McpWorldContext, id: string, stand: string) => Promise<UpdateTarget>;
};

/**
 * Binds a typed handler to the erased handler table. `felder` is always the output
 * of `parseFelder(schema, …)`, both for previews and for stored confirmation payloads.
 */
export function defineUpdateHandler<F, Row>(spec: {
  schema: { safeParse: (value: unknown) => ZodSafeParseResult<F> };
  allowStubs?: boolean;
  load: (world: McpWorldContext, id: string, stand: string) => Promise<Row>;
  preview: (row: Row, felder: F, context: PreviewContext) => Promise<PreviewSummary>;
  execute: (row: Row, felder: F, context: ExecuteContext) => Promise<UpdateResult>;
}): UpdateHandler {
  return {
    schema: spec.schema as UpdateHandler["schema"],
    allowStubs: spec.allowStubs ?? true,
    load: async (world, id, stand) => {
      const row = await spec.load(world, id, stand);
      return {
        source: row,
        preview: (felder, context) => spec.preview(row, felder as F, context),
        execute: (felder, context) => spec.execute(row, felder as F, context),
      };
    },
  };
}

export function staleError(): McpToolError {
  return new McpToolError("Inhalt wurde inzwischen geändert, bitte neu lesen.");
}

/** Display label of a `felder` key (E6); keys outside the catalog are already labels. */
function displayLabel(art: FieldArt, key: string) {
  return fieldFor(art, key)?.label ?? key;
}

export function pushChange(context: PreviewContext, key: string, oldValue: string, newValue: string) {
  if (oldValue !== newValue) context.changes.push({ label: displayLabel(context.art, key), oldValue, newValue });
}

/** Pushes one delta row per changed rendered entry (template fields, sheet sub-fields). */
export function pushEntryChanges(context: PreviewContext, input: {
  prefix: string;
  before: readonly (readonly [string, string])[];
  after: readonly (readonly [string, string])[];
  skip?: readonly string[];
}) {
  const before = new Map(input.before);
  const after = new Map(input.after);
  for (const label of new Set([...after.keys(), ...before.keys()])) {
    if (input.skip?.includes(label)) continue;
    const oldValue = before.get(label) ?? MCP_NOT_SET;
    const newValue = after.get(label) ?? MCP_NOT_SET;
    if (oldValue !== newValue) context.changes.push({ label: `${input.prefix}${label}`, oldValue, newValue });
  }
}

export function pushRenamed(context: PreviewContext, label: string, current: string, next: string | undefined) {
  if (next !== undefined && next !== current) pushChange(context, label, current, next);
}

function plainOfJson(json: unknown): string {
  const doc = asRichDoc(json);
  return doc ? plainTextOf(doc).trim() : "";
}

export function isEmptyRichText(json: unknown): boolean {
  return !plainOfJson(json);
}

/** Rich-text delta (T-007): the existing text shortened to 500 characters, the new text in full. */
function richChange(label: string, oldJson: unknown, markdown: string, modus: RichModus): FieldChange {
  const old = tiptapJsonToMcpMarkdown(oldJson).trim();
  const next = markdown.trim() || "(leer)";
  const cut = old.length > RICH_EXCERPT;
  if (modus === "anhaengen") {
    return {
      label: `${label} (anhängen)`,
      oldValue: old ? tailExcerpt(old) : "(leer)",
      oldCaption: cut ? "bisher (letzte 500 Zeichen)" : "bisher",
      newValue: next,
      newCaption: "wird angehängt",
    };
  }
  return {
    label: `${label} (ersetzen)`,
    oldValue: old ? headExcerpt(old) : "(leer)",
    oldCaption: cut ? "bisher (erste 500 Zeichen)" : "bisher",
    newValue: next,
    newCaption: "neu",
  };
}

/** Validates a rich-text field for the preview, plans its stubs and records the change. */
export async function previewRich(context: PreviewContext, input: {
  label: string;
  oldJson: unknown;
  markdown: string | undefined;
  mentions?: boolean;
  allowStubs?: boolean;
}) {
  if (input.markdown === undefined) return;
  const resolution = await resolveRichText({
    markdown: input.markdown,
    worldId: context.world.id,
    role: context.world.role,
    viewerId: context.world.userId,
    mentions: input.mentions ?? true,
  });
  if (input.allowStubs === false && resolution.stubs.length) {
    throw new McpToolError(`Unbekannte Erwähnung: „${resolution.stubs[0]}“.`);
  }
  context.stubs.add(resolution.stubs);
  // Compare in the rendered form: inhalt_lesen escapes Markdown („Befüllt\.“), clients may send either form.
  const rendered = resolution.doc && !resolution.stubs.length
    ? tiptapJsonToMcpMarkdown(resolution.doc).trim()
    : input.markdown.trim();
  const unchanged = context.modus === "ersetzen"
    ? rendered === tiptapJsonToMcpMarkdown(input.oldJson).trim()
    : !input.markdown.trim();
  if (unchanged) return;
  context.changes.push(richChange(displayLabel(context.art, input.label), input.oldJson, input.markdown, context.modus));
}

/** Builds the stored document for `anhaengen`/`ersetzen`; `undefined` keeps the field. */
export async function executeRich(
  context: ExecuteContext,
  existing: unknown,
  markdown: string | undefined,
  mentions = true,
): Promise<RichDoc | null | undefined> {
  if (markdown === undefined) return undefined;
  const next = (await context.stubs.richDoc(markdown, mentions)) ?? null;
  if (context.modus === "ersetzen") return next;
  const current = asRichDoc(existing);
  if (!next) return current;
  if (!current?.content?.length) return next;
  return { type: "doc", content: [...current.content, ...next.content] };
}
