import { z } from "zod";
import { createThreadWithOpening } from "@/lib/chat/repository";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(
    request,
    z.object({ channelId: z.uuid(), title: z.string() }).strict(),
  );
  if (!body.ok) return failResponse(body);
  const created = await createThreadWithOpening({
    worldId: req.context.world.id,
    channelId: body.data.channelId,
    actorId: req.user.id,
    title: body.data.title,
  });
  return resultResponse(created, 201);
}
