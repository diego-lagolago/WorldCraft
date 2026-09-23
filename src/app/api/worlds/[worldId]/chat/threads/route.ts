import { z } from "zod";
import { createThreadWithOpening } from "@/lib/chat/repository";
import { THREAD_TITLE_MAX } from "@/lib/chat/types";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const bodySchema = z
  .object({
    channelId: z.uuid(),
    title: z.string().trim().min(1).max(THREAD_TITLE_MAX),
  })
  .strict();

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, bodySchema);
  if (!body.ok) return failResponse(body);
  const created = await createThreadWithOpening({
    worldId: req.context.world.id,
    channelId: body.data.channelId,
    actorId: req.user.id,
    title: body.data.title,
  });
  return resultResponse(created, 201);
}
