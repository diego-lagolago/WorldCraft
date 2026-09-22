/** Spike T-010 — Nachrichten im aktuellen Kanal/Thread, Text oder strukturierter Wurf. */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractRollExpression,
  formatCompactRoll,
  isRollCommand,
  parseDiceExpression,
  parseStructuredRoll,
  rollOnServer,
} from "@/spike/chat/dice";
import { MAX_DICE_TERMS } from "@/spike/chat/dice-sides";
import { publishChatEvent } from "@/spike/chat/realtime-bus";
import {
  ensureDefaultChannel,
  getChannel,
  getThread,
  getDicePostToChat,
  insertChatMessage,
  loadSpikeChatState,
} from "@/spike/chat/repository";
import { requireSpikeSession } from "@/spike/karte/session";

export const dynamic = "force-dynamic";

const FORGED_DICE_KEYS = [
  "dice",
  "diceExpression",
  "diceValues",
  "diceSum",
  "result",
  "rolls",
  "sum",
] as const;

const Scope = {
  channelId: z.string().uuid().optional(),
  threadId: z.string().uuid().nullable().optional(),
};

const TextBody = z
  .object({
    body: z.string().trim().min(1).max(2000),
    ...Scope,
  })
  .strict();

const RollBody = z
  .object({
    kind: z.literal("roll"),
    terms: z
      .array(
        z
          .object({
            n: z.number(),
            m: z.number(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_DICE_TERMS),
    modifier: z.number().optional(),
    ...Scope,
  })
  .strict();

function rejectForgedDice(raw: unknown): NextResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const keys = Object.keys(raw);
  if (keys.some((key) => (FORGED_DICE_KEYS as readonly string[]).includes(key))) {
    return NextResponse.json(
      { error: "Würfelergebnis darf nur der Server setzen." },
      { status: 400 },
    );
  }
  return null;
}

async function resolveScope(input: { channelId?: string; threadId?: string | null }) {
  const fallback = await ensureDefaultChannel();
  const channel = input.channelId ? await getChannel(input.channelId) : fallback;
  if (!channel) {
    return { error: NextResponse.json({ error: "Kanal nicht gefunden." }, { status: 404 }) };
  }
  if (!input.threadId) {
    return { channel, threadId: null as string | null, error: null };
  }
  const thread = await getThread(input.threadId);
  if (!thread || thread.channelId !== channel.id) {
    return { error: NextResponse.json({ error: "Thread nicht gefunden." }, { status: 404 }) };
  }
  return { channel, threadId: thread.id, error: null };
}

export async function GET(request: Request) {
  const { session, response } = await requireSpikeSession();
  if (response || !session) return response;
  const url = new URL(request.url);
  return NextResponse.json(
    await loadSpikeChatState({
      channelId: url.searchParams.get("channelId") ?? undefined,
      threadId: url.searchParams.get("threadId") ?? undefined,
      userId: session.user.id,
    }),
  );
}

export async function POST(request: Request) {
  const { session, response } = await requireSpikeSession();
  if (response || !session) return response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  const forged = rejectForgedDice(raw);
  if (forged) return forged;

  const roll = RollBody.safeParse(raw);
  if (roll.success) {
    const expression = parseStructuredRoll(roll.data);
    if (!expression.ok) {
      return NextResponse.json({ error: expression.error }, { status: 400 });
    }
    const scope = await resolveScope(roll.data);
    if (scope.error) return scope.error;
    const postToChat = await getDicePostToChat(session.user.id);
    return respondWithRoll(
      session.user.id,
      session.user.name,
      expression,
      scope.channel.id,
      scope.threadId,
      postToChat,
    );
  }

  const text = TextBody.safeParse(raw);
  if (!text.success) {
    return NextResponse.json({ error: "Ungültige Nachricht." }, { status: 400 });
  }

  const scope = await resolveScope(text.data);
  if (scope.error) return scope.error;

  // Hidden test path: `/roll` still works for curl/API checks, not shown in the UI.
  if (isRollCommand(text.data.body)) {
    const expression = parseDiceExpression(extractRollExpression(text.data.body));
    if (!expression.ok) {
      return NextResponse.json({ error: expression.error }, { status: 400 });
    }
    return respondWithRoll(
      session.user.id,
      session.user.name,
      expression,
      scope.channel.id,
      scope.threadId,
      true,
    );
  }

  const message = await insertChatMessage({
    channelId: scope.channel.id,
    threadId: scope.threadId,
    authorId: session.user.id,
    authorName: session.user.name,
    body: text.data.body,
  });
  publishChatEvent({ type: "message", message });
  return NextResponse.json({ message }, { status: 201 });
}

async function respondWithRoll(
  authorId: string,
  authorName: string,
  expression: Extract<ReturnType<typeof parseStructuredRoll>, { ok: true }>,
  channelId: string,
  threadId: string | null,
  postToChat: boolean,
) {
  const rolled = rollOnServer(expression);
  const compact = formatCompactRoll(expression, rolled);
  if (!postToChat) {
    return NextResponse.json({ posted: false, dice: { ...rolled, compact } });
  }
  const message = await insertChatMessage({
    channelId,
    threadId,
    authorId,
    authorName,
    body: compact,
    dice: rolled,
  });
  publishChatEvent({ type: "message", message });
  return NextResponse.json({ posted: true, message }, { status: 201 });
}
