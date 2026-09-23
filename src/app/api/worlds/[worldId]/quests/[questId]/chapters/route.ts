import { NextResponse } from "next/server";
import {
  chapterCreateSchema,
  createChapter,
  listVisibleChapters,
} from "@/lib/domain/quest-chapters";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; questId: string }> };

const QUEST_NOT_FOUND = "Diese Quest gibt es nicht.";

export async function GET(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const questId = parseUuid(params.questId);
  if (!questId) return notFoundResponse(QUEST_NOT_FOUND);
  const chapters = await listVisibleChapters(
    req.context.world.id,
    questId,
    req.context.membership.role,
    req.context.membership.userId,
  );
  if (!chapters) return notFoundResponse(QUEST_NOT_FOUND);
  return NextResponse.json({ chapters });
}

export async function POST(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const questId = parseUuid(params.questId);
  if (!questId) return notFoundResponse(QUEST_NOT_FOUND);
  const body = await parseJsonBody(request, chapterCreateSchema);
  if (!body.ok) return failResponse(body);
  const created = await createChapter({
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    questId,
    ...body.data,
  });
  return resultResponse(created.ok ? { ok: true as const, data: { chapter: created.data } } : created, 201);
}
