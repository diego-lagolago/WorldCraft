import { z } from "zod";
import { updateChannel } from "@/lib/chat/repository";
import { CHANNEL_NAME_MAX } from "@/lib/chat/types";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; channelId: string }> };

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), name: z.string().trim().min(1).max(CHANNEL_NAME_MAX) }).strict(),
  z.object({ action: z.literal("archive") }).strict(),
  z.object({ action: z.literal("restore") }).strict(),
]);

export async function PATCH(request: Request, ctx: Ctx) {
  const { worldId: rawWorldId, channelId: rawChannelId } = await ctx.params;
  const req = await openWorldRequest(rawWorldId);
  if (!req.ok) return req.response;
  const channelId = parseUuid(rawChannelId);
  if (!channelId) return notFoundResponse("Kanal nicht gefunden.");
  const body = await parseJsonBody(request, patchSchema);
  if (!body.ok) return failResponse(body);
  const updated = await updateChannel({
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    channelId,
    action: body.data.action,
    name: body.data.action === "rename" ? body.data.name : undefined,
  });
  return resultResponse(updated);
}
