import { z } from "zod";
import { fail } from "@/lib/authz";
import { renameChatThread } from "@/lib/chat/repository";
import { THREAD_TITLE_MAX } from "@/lib/chat/types";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; threadId: string }> };

const bodySchema = z
  .object({
    title: z.string().trim().min(1).max(THREAD_TITLE_MAX),
  })
  .strict();

export async function PATCH(request: Request, ctx: Ctx) {
  const { worldId: rawWorldId, threadId: rawThreadId } = await ctx.params;
  const req = await openWorldRequest(rawWorldId);
  if (!req.ok) return req.response;
  const threadId = parseUuid(rawThreadId);
  if (!threadId) return notFoundResponse("Diesen Thread gibt es nicht.");
  const raw = await parseJsonBody(request, z.unknown());
  if (!raw.ok) return failResponse(raw);
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) {
    return failResponse(
      fail(422, `Der Thread-Titel muss 1 bis ${THREAD_TITLE_MAX} Zeichen haben.`),
    );
  }
  const renamed = await renameChatThread({
    worldId: req.context.world.id,
    threadId,
    membership: req.context.membership,
    actorId: req.user.id,
    title: parsed.data.title,
  });
  return resultResponse(renamed);
}
