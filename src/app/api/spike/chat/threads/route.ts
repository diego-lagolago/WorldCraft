/** Spike T-010 — Thread in einem Kanal anlegen. */

import { NextResponse } from "next/server";
import { z } from "zod";
import { publishChatEvent } from "@/spike/chat/realtime-bus";
import {
  createThreadWithParentPost,
  ensureDefaultChannel,
  getChannel,
  listThreads,
} from "@/spike/chat/repository";
import { requireSpikeSession } from "@/spike/karte/session";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    channelId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(80),
    createdFromMessageId: z.string().uuid().nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const { response } = await requireSpikeSession();
  if (response) return response;
  const url = new URL(request.url);
  const requested = url.searchParams.get("channelId");
  const channel = requested ? await getChannel(requested) : await ensureDefaultChannel();
  if (!channel) {
    return NextResponse.json({ error: "Kanal nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ threads: await listThreads(channel.id) });
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

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Thread-Daten." }, { status: 400 });
  }

  const channel = parsed.data.channelId
    ? await getChannel(parsed.data.channelId)
    : await ensureDefaultChannel();
  if (!channel) {
    return NextResponse.json({ error: "Kanal nicht gefunden." }, { status: 404 });
  }

  const { thread, message } = await createThreadWithParentPost({
    channelId: channel.id,
    title: parsed.data.title,
    authorId: session.user.id,
    authorName: session.user.name,
  });
  publishChatEvent({ type: "thread.created", thread });
  publishChatEvent({ type: "message", message });
  return NextResponse.json({ thread, message }, { status: 201 });
}
