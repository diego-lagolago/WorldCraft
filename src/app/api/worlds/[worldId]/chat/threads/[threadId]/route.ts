import { z } from "zod";
import { renameChatThread } from "@/lib/chat/repository";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; threadId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { worldId: rawWorldId, threadId: rawThreadId } = await ctx.params;
  const req = await openWorldRequest(rawWorldId);
  if (!req.ok) return req.response;
  const threadId = parseUuid(rawThreadId);
  if (!threadId) return notFoundResponse("Diesen Thread gibt es nicht.");
  const body = await parseJsonBody(request, z.object({ title: z.string() }).strict());
  if (!body.ok) return failResponse(body);
  const renamed = await renameChatThread({
    worldId: req.context.world.id,
    threadId,
    membership: req.context.membership,
    title: body.data.title,
  });
  return resultResponse(renamed);
}
