import { deleteChatMessage } from "@/lib/chat/repository";
import { parseUuid } from "@/lib/http";
import { notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; messageId: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  const { worldId: rawWorldId, messageId: rawMessageId } = await ctx.params;
  const req = await openWorldRequest(rawWorldId);
  if (!req.ok) return req.response;
  const messageId = parseUuid(rawMessageId);
  if (!messageId) return notFoundResponse("Diese Nachricht gibt es nicht.");
  const deleted = await deleteChatMessage({
    worldId: req.context.world.id,
    messageId,
    membership: req.context.membership,
  });
  return resultResponse(deleted);
}
