import { chapterOrderSchema, reorderChapters } from "@/lib/domain/quest-chapters";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; questId: string }> };

const QUEST_NOT_FOUND = "Diese Quest gibt es nicht.";

export async function PUT(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const questId = parseUuid(params.questId);
  if (!questId) return notFoundResponse(QUEST_NOT_FOUND);
  const body = await parseJsonBody(request, chapterOrderSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await reorderChapters({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      questId,
      chapterIds: body.data.chapterIds,
    }),
  );
}
