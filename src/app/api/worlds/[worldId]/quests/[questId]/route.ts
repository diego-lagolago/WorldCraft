import { NextResponse } from "next/server";
import { deleteQuest, getQuest, questUpdateSchema, updateQuest } from "@/lib/domain/quests";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; questId: string }> };

const NOT_FOUND = "Diese Quest gibt es nicht.";

export async function GET(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const questId = parseUuid(params.questId);
  if (!questId) return notFoundResponse(NOT_FOUND);
  const quest = await getQuest(req.context.world.id, questId, req.context.membership.role, req.context.membership.userId);
  if (!quest) return notFoundResponse(NOT_FOUND);
  return NextResponse.json({ quest });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const questId = parseUuid(params.questId);
  if (!questId) return notFoundResponse(NOT_FOUND);
  const body = await parseJsonBody(request, questUpdateSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await updateQuest({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      questId,
      ...body.data,
    }),
  );
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const questId = parseUuid(params.questId);
  if (!questId) return notFoundResponse(NOT_FOUND);
  return resultResponse(
    await deleteQuest({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      questId,
    }),
  );
}
