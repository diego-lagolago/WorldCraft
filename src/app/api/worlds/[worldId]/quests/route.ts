import { NextResponse } from "next/server";
import { createQuest, listQuests, questCreateSchema } from "@/lib/domain/quests";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  return NextResponse.json({
    quests: await listQuests(req.context.world.id, req.context.membership.role),
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, questCreateSchema);
  if (!body.ok) return failResponse(body);
  const created = await createQuest({
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    ...body.data,
  });
  return resultResponse(created.ok ? { ok: true as const, data: { quest: created.data } } : created, 201);
}
