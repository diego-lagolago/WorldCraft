import type { ZodSafeParseResult } from "zod";
import type { MembershipRow } from "@/lib/authz";
import { asRichDoc, plainTextOf, type RichDoc } from "@/lib/editor/rich-text";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import { McpToolError, type McpWorldContext } from "../../context";
import type { MaterializedStubs, StubPlan } from "../../write-shared";
import { resolveRichText } from "../../write-rich";
import type { ToolContext } from "../shared";

export type RichModus = "anhaengen" | "ersetzen";

export type FieldChange = { label: string; oldValue: string; newValue: string };

export type PreviewContext = {
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

export type UpdateResult = { id: string; title: string; stand: string; visibility: string };

export type PreviewSummary = { title: string; skipConfirmation?: boolean };

/** A loaded, visible target whose stand already matched (phase a). */
export type UpdateTarget = {
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
        preview: (felder, context) => spec.preview(row, felder as F, context),
        execute: (felder, context) => spec.execute(row, felder as F, context),
      };
    },
  };
}

export function staleError(): McpToolError {
  return new McpToolError("Inhalt wurde inzwischen geändert, bitte neu lesen.");
}

export function pushChange(context: PreviewContext, label: string, oldValue: string, newValue: string) {
  context.changes.push({ label, oldValue, newValue });
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

function richChange(label: string, oldJson: unknown, markdown: string, modus: RichModus): FieldChange {
  const oldValue = tiptapJsonToMcpMarkdown(oldJson).trim() || "(leer)";
  const next = markdown.trim();
  if (modus === "anhaengen") return { label, oldValue, newValue: `Anhängen: ${next || "(leer)"}` };
  const excerpt = `${next.slice(0, 120)}${next.length > 120 ? "…" : ""}`;
  return {
    label,
    oldValue,
    newValue: `ersetzt ${plainOfJson(oldJson).length} Zeichen durch ${next.length} Zeichen: ${excerpt}`,
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
  context.changes.push(richChange(input.label, input.oldJson, input.markdown, context.modus));
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
