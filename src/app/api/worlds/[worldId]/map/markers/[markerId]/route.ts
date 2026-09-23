import { z } from "zod";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { deleteMarker, getMarkerDetails, moveMarker, positionSchema } from "@/lib/map/repository";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; markerId: string }> };

const patchSchema = z
  .object({
    posX: positionSchema,
    posY: positionSchema,
  })
  .strict();

async function openMarker(ctx: Ctx) {
  const { worldId, markerId: raw } = await ctx.params;
  const req = await openWorldRequest(worldId);
  if (!req.ok) return { ok: false as const, response: req.response };
  const markerId = parseUuid(raw);
  if (!markerId) return { ok: false as const, response: notFoundResponse("Diesen Marker gibt es nicht.") };
  return { ok: true as const, req, markerId };
}

export async function GET(_request: Request, ctx: Ctx) {
  const opened = await openMarker(ctx);
  if (!opened.ok) return opened.response;
  return resultResponse(
    await getMarkerDetails({
      worldId: opened.req.context.world.id,
      role: opened.req.context.membership.role,
      actorId: opened.req.user.id,
      markerId: opened.markerId,
    }),
  );
}

export async function PATCH(request: Request, ctx: Ctx) {
  const opened = await openMarker(ctx);
  if (!opened.ok) return opened.response;
  const body = await parseJsonBody(request, patchSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await moveMarker({
      membership: opened.req.context.membership,
      actorId: opened.req.user.id,
      worldId: opened.req.context.world.id,
      markerId: opened.markerId,
      ...body.data,
    }),
  );
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const opened = await openMarker(ctx);
  if (!opened.ok) return opened.response;
  return resultResponse(
    await deleteMarker({
      membership: opened.req.context.membership,
      worldId: opened.req.context.world.id,
      markerId: opened.markerId,
    }),
  );
}
