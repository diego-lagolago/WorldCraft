import { z } from "zod";
import { setDicePostToChat } from "@/lib/chat/repository";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest } from "@/lib/route";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const bodySchema = z.object({ dicePostToChat: z.boolean() }).strict();

export async function PATCH(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, bodySchema);
  if (!body.ok) return failResponse(body);
  const dicePostToChat = await setDicePostToChat(req.user.id, body.data.dicePostToChat);
  return NextResponse.json({ dicePostToChat });
}
