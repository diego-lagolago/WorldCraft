import { z } from "zod";
import {
  extractRollExpression,
  formatRolled,
  isRollCommand,
  MAX_DICE_TERMS,
  parseDiceExpression,
  parseStructuredRoll,
  rollOnServer,
} from "@/lib/chat/dice";
import { getDicePostToChat, listOlderMessages, loadChatState, postChatMessage } from "@/lib/chat/repository";
import { optionalUuid } from "@/lib/chat/query";
import { fail, type AuthzFail } from "@/lib/authz";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const FORGED_DICE_KEYS = ["dice", "diceExpression", "diceValues", "diceTerms", "diceSum", "result", "rolls", "sum"] as const;

/**
 * `.strict()` below also rejects unknown keys. This check stays so a client-supplied
 * result gets a specific message instead of the generic validation error (CR-021).
 */
function forgedDice(raw: unknown): AuthzFail | null {
  if (!raw || typeof raw !== "object") return null;
  const keys = Object.keys(raw);
  if (keys.some((key) => (FORGED_DICE_KEYS as readonly string[]).includes(key))) {
    return fail(400, "Würfelergebnis darf nur der Server setzen.");
  }
  return null;
}

const textBody = z
  .object({
    body: z.string().trim().min(1).max(2000),
    channelId: z.uuid(),
    threadId: z.uuid().nullable().optional(),
  })
  .strict();

const rollBody = z
  .object({
    kind: z.literal("roll"),
    terms: z.array(z.object({ n: z.number(), m: z.number() }).strict()).min(1).max(MAX_DICE_TERMS),
    modifier: z.number().optional(),
    channelId: z.uuid(),
    threadId: z.uuid().nullable().optional(),
  })
  .strict();

export async function GET(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const url = new URL(request.url);
  const channelId = optionalUuid(url.searchParams.get("channelId"));
  if (!channelId.ok) return failResponse(channelId);
  const threadId = optionalUuid(url.searchParams.get("threadId"));
  if (!threadId.ok) return failResponse(threadId);
  const before = optionalUuid(url.searchParams.get("before"));
  if (!before.ok) return failResponse(before);

  if (before.id) {
    if (!channelId.id) return failResponse(fail(400, "Die Eingaben sind ungültig."));
    const page = await listOlderMessages({
      worldId: req.context.world.id,
      channelId: channelId.id,
      threadId: threadId.id,
      beforeMessageId: before.id,
    });
    return resultResponse(page);
  }

  const state = await loadChatState({
    worldId: req.context.world.id,
    actorId: req.user.id,
    role: req.context.membership.role,
    channelId: channelId.id,
    threadId: threadId.id,
  });
  return resultResponse(state);
}

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, z.unknown());
  if (!body.ok) return failResponse(body);
  const forged = forgedDice(body.data);
  if (forged) return failResponse(forged);

  const roll = rollBody.safeParse(body.data);
  if (roll.success) {
    const expression = parseStructuredRoll(roll.data);
    if (!expression.ok) return failResponse(fail(400, expression.error));
    return respondWithRoll(req, expression, roll.data.channelId, roll.data.threadId ?? null);
  }

  const text = textBody.safeParse(body.data);
  if (!text.success) return failResponse(fail(400, "Ungültige Nachricht."));

  if (isRollCommand(text.data.body)) {
    const expression = parseDiceExpression(extractRollExpression(text.data.body));
    if (!expression.ok) return failResponse(fail(400, expression.error));
    return respondWithRoll(req, expression, text.data.channelId, text.data.threadId ?? null);
  }

  const posted = await postChatMessage({
    worldId: req.context.world.id,
    channelId: text.data.channelId,
    threadId: text.data.threadId ?? null,
    authorId: req.user.id,
    body: text.data.body,
  });
  return resultResponse(posted, 201);
}

async function respondWithRoll(
  req: Extract<Awaited<ReturnType<typeof openWorldRequest>>, { ok: true }>,
  expression: Extract<ReturnType<typeof parseStructuredRoll>, { ok: true }>,
  channelId: string,
  threadId: string | null,
) {
  const rolled = rollOnServer(expression);
  const postToChat = await getDicePostToChat(req.user.id);
  if (!postToChat) {
    return resultResponse({
      ok: true,
      data: { posted: false as const, dice: { ...rolled, text: formatRolled(rolled) } },
    });
  }
  const posted = await postChatMessage({
    worldId: req.context.world.id,
    channelId,
    threadId,
    authorId: req.user.id,
    body: formatRolled(rolled),
    dice: rolled,
  });
  if (!posted.ok) return failResponse(posted);
  return resultResponse({ ok: true, data: { posted: true as const, message: posted.data.message } }, 201);
}
