import { deleteManualRelation } from "@/lib/domain/relations";
import { notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";
import { parseUuid } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; relationId: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const relationId = parseUuid(params.relationId);
  if (!relationId) return notFoundResponse("Diese Verknüpfung gibt es nicht.");
  return resultResponse(
    await deleteManualRelation({
      membership: req.context.membership,
      worldId: req.context.world.id,
      relationId,
    }),
  );
}
