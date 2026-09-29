import type { ZodSafeParseResult } from "zod";
import type { MembershipRow } from "@/lib/authz";
import type { RichDoc } from "@/lib/editor/rich-text";
import type { McpWorldContext } from "../../context";
import type { MaterializedStubs, StubPlan } from "../../write-shared";
import { resolveRichText } from "../../write-rich";
import type { ToolContext } from "../shared";

export type CollectContext = { world: McpWorldContext; stubs: StubPlan };

export type CreateContext = {
  ctx: ToolContext;
  world: McpWorldContext;
  membership: MembershipRow;
  stubs: MaterializedStubs;
};

export type CreateResult = { id: string; title: string; stand: string; visibility: string };

export type CreateHandler = {
  schema: { safeParse: (value: unknown) => ZodSafeParseResult<Record<string, unknown>> };
  titleOf: (felder: Record<string, unknown>) => string;
  /** Phase a: validates parents and field values before any stub exists. */
  check: (felder: Record<string, unknown>, world: McpWorldContext) => Promise<void>;
  /** Plans the stub articles the confirmation would create. */
  collect: (felder: Record<string, unknown>, context: CollectContext) => Promise<void>;
  /** Phase c: the single domain write. */
  execute: (felder: Record<string, unknown>, context: CreateContext) => Promise<CreateResult>;
};

/** Binds a typed handler to the erased table; `felder` is always the parsed schema output. */
export function defineCreateHandler<F>(spec: {
  schema: { safeParse: (value: unknown) => ZodSafeParseResult<F> };
  titleOf: (felder: F) => string;
  check?: (felder: F, world: McpWorldContext) => Promise<void>;
  collect: (felder: F, context: CollectContext) => Promise<void>;
  execute: (felder: F, context: CreateContext) => Promise<CreateResult>;
}): CreateHandler {
  return {
    schema: spec.schema as CreateHandler["schema"],
    titleOf: (felder) => spec.titleOf(felder as F),
    check: async (felder, world) => spec.check?.(felder as F, world),
    collect: (felder, context) => spec.collect(felder as F, context),
    execute: (felder, context) => spec.execute(felder as F, context),
  };
}

export async function collectRich(context: CollectContext, markdown: string | undefined) {
  const resolution = await resolveRichText({
    markdown,
    worldId: context.world.id,
    role: context.world.role,
    viewerId: context.world.userId,
    mentions: true,
  });
  context.stubs.add(resolution.stubs);
}

/** New content stores no document for missing or blank text. */
export async function createRich(context: CreateContext, markdown: string | undefined): Promise<RichDoc | undefined> {
  return (await context.stubs.richDoc(markdown)) ?? undefined;
}
