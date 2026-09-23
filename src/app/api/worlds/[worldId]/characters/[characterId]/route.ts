import { NextResponse } from "next/server";
import { getWorldCharacter } from "@/lib/domain/characters";
import { parseUuid } from "@/lib/http";
import { notFoundResponse, openWorldRequest } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ worldId: string; characterId: string }> }) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const characterId = parseUuid(params.characterId);
  const character = characterId ? await getWorldCharacter(req.context.world.id, characterId) : null;
  if (!character) return notFoundResponse("Diesen Charakter gibt es in dieser Welt nicht.");
  return NextResponse.json({ character });
}
