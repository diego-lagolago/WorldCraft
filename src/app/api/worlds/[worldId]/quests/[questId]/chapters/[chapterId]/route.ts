import {
  chapterUpdateSchema,
  deleteChapter,
  updateChapter,
} from "@/lib/domain/quest-chapters";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; questId: string; chapterId: string }> };

const CHAPTER_NOT_FOUND = "Dieses Kapitel gibt es nicht.";

export async function PATCH(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const questId = parseUuid(params.questId);
  const chapterId = parseUuid(params.chapterId);
  if (!questId || !chapterId) return notFoundResponse(CHAPTER_NOT_FOUND);
  const body = await parseJsonBody(request, chapterUpdateSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await updateChapter({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      questId,
      chapterId,
      ...body.data,
    }),
  );
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const questId = parseUuid(params.questId);
  const chapterId = parseUuid(params.chapterId);
  if (!questId || !chapterId) return notFoundResponse(CHAPTER_NOT_FOUND);
  return resultResponse(
    await deleteChapter({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      questId,
      chapterId,
    }),
  );
}
