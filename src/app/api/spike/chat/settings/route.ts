/** Spike T-010 — Würfel-Schalter am Benutzerprofil (default: posten). */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getDicePostToChat, setDicePostToChat } from "@/spike/chat/repository";
import { requireSpikeSession } from "@/spike/karte/session";

export const dynamic = "force-dynamic";

const Body = z.object({ dicePostToChat: z.boolean() }).strict();

export async function GET() {
  const { session, response } = await requireSpikeSession();
  if (response || !session) return response;
  return NextResponse.json({
    dicePostToChat: await getDicePostToChat(session.user.id),
  });
}

export async function PATCH(request: Request) {
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
    return NextResponse.json({ error: "Ungültige Einstellung." }, { status: 400 });
  }

  const dicePostToChat = await setDicePostToChat(session.user.id, parsed.data.dicePostToChat);
  return NextResponse.json({ dicePostToChat });
}
