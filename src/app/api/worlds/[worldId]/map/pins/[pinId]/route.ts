import { z } from "zod";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { contentVisibilitySchema } from "@/lib/authz";
import {
  deletePin,
  getPinDetails,
  pinTitleSchema,
  pinTypeSchema,
  positionSchema,
  updatePin,
} from "@/lib/map/repository";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; pinId: string }> };

const patchSchema = z
  .object({
    title: pinTitleSchema.optional(),
    pinType: pinTypeSchema.optional(),
    description: z.unknown().optional(),
    posX: positionSchema.optional(),
    posY: positionSchema.optional(),
    visibility: contentVisibilitySchema.optional(),
    locked: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

async function openPin(ctx: Ctx) {
  const { worldId, pinId: raw } = await ctx.params;
  const req = await openWorldRequest(worldId);
  if (!req.ok) return { ok: false as const, response: req.response };
  const pinId = parseUuid(raw);
  if (!pinId) return { ok: false as const, response: notFoundResponse("Diesen Pin gibt es nicht.") };
  return { ok: true as const, req, pinId };
}

export async function GET(_request: Request, ctx: Ctx) {
  const opened = await openPin(ctx);
  if (!opened.ok) return opened.response;
  return resultResponse(
    await getPinDetails({
      worldId: opened.req.context.world.id,
      role: opened.req.context.membership.role,
      actorId: opened.req.user.id,
      pinId: opened.pinId,
    }),
  );
}

export async function PATCH(request: Request, ctx: Ctx) {
  const opened = await openPin(ctx);
  if (!opened.ok) return opened.response;
  const body = await parseJsonBody(request, patchSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await updatePin({
      membership: opened.req.context.membership,
      actorId: opened.req.user.id,
      worldId: opened.req.context.world.id,
      pinId: opened.pinId,
      ...body.data,
    }),
  );
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const opened = await openPin(ctx);
  if (!opened.ok) return opened.response;
  return resultResponse(
    await deletePin({
      membership: opened.req.context.membership,
      worldId: opened.req.context.world.id,
      pinId: opened.pinId,
    }),
  );
}
