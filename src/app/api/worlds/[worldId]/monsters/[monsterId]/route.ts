import { NextResponse } from "next/server";
import { deleteMonster, getMonster, monsterUpdateSchema, updateMonster } from "@/lib/domain/monsters";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; monsterId: string }> };

const NOT_FOUND = "Dieses Monster gibt es nicht.";

export async function GET(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const monsterId = parseUuid(params.monsterId);
  if (!monsterId) return notFoundResponse(NOT_FOUND);
  const monster = await getMonster(
    req.context.world.id,
    monsterId,
    req.context.membership.role,
    req.context.membership.userId,
  );
  if (!monster) return notFoundResponse(NOT_FOUND);
  return NextResponse.json({ monster });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const monsterId = parseUuid(params.monsterId);
  if (!monsterId) return notFoundResponse(NOT_FOUND);
  const body = await parseJsonBody(request, monsterUpdateSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await updateMonster({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      monsterId,
      ...body.data,
    }),
  );
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const monsterId = parseUuid(params.monsterId);
  if (!monsterId) return notFoundResponse(NOT_FOUND);
  return resultResponse(
    await deleteMonster({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      monsterId,
    }),
  );
}
