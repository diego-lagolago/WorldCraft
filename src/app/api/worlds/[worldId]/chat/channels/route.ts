import { z } from "zod";
import { createChannel, reorderChannels } from "@/lib/chat/repository";
import { CHANNEL_NAME_MAX } from "@/lib/chat/types";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const createSchema = z.object({ name: z.string().trim().min(1).max(CHANNEL_NAME_MAX) }).strict();
const orderSchema = z.object({ channelIds: z.array(z.uuid()).min(1) }).strict();

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, createSchema);
  if (!body.ok) return failResponse(body);
  const created = await createChannel({
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    name: body.data.name,
  });
  return resultResponse(created, 201);
}

export async function PUT(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, orderSchema);
  if (!body.ok) return failResponse(body);
  const ordered = await reorderChannels({
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    channelIds: body.data.channelIds,
  });
  return resultResponse(ordered);
}
