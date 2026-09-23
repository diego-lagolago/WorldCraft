import { NextResponse } from "next/server";
import {
  characterUpdateSchema,
  deleteCharacter,
  getOwnCharacter,
  updateCharacter,
} from "@/lib/domain/characters";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, resultResponse } from "@/lib/route";
import { requireProductSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ characterId: string }> };

const NOT_FOUND = "Diesen Charakter gibt es nicht.";

/** World-independent owner view; members read brought characters via the world route. */
export async function GET(_request: Request, ctx: Ctx) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;
  const characterId = parseUuid((await ctx.params).characterId);
  if (!characterId) return notFoundResponse(NOT_FOUND);
  const character = await getOwnCharacter(session.user.id, characterId);
  if (!character) return notFoundResponse(NOT_FOUND);
  return NextResponse.json({ character });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;
  const characterId = parseUuid((await ctx.params).characterId);
  if (!characterId) return notFoundResponse(NOT_FOUND);
  const body = await parseJsonBody(request, characterUpdateSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(await updateCharacter(session.user.id, characterId, body.data));
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;
  const characterId = parseUuid((await ctx.params).characterId);
  if (!characterId) return notFoundResponse(NOT_FOUND);
  return resultResponse(await deleteCharacter(session.user.id, characterId));
}
