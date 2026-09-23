import { NextResponse } from "next/server";
import { z } from "zod";
import { bringCharacter, listWorldCharacters } from "@/lib/domain/characters";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const bringSchema = z.object({ characterId: z.uuid() });

export async function GET(_request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  return NextResponse.json({ characters: await listWorldCharacters(req.context.world.id) });
}

/** Bring an own character into the world (or reactivate its old participation). */
export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, bringSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await bringCharacter({ actorId: req.user.id, worldId: req.context.world.id, characterId: body.data.characterId }),
  );
}
