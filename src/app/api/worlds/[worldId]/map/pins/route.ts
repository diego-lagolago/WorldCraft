import { z } from "zod";
import { parseJsonBody } from "@/lib/http";
import {
  createPin,
  pinTitleSchema,
  pinTypeSchema,
  positionSchema,
  contentVisibilitySchema,
} from "@/lib/map/repository";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const createSchema = z
  .object({
    mapId: z.uuid(),
    pinType: pinTypeSchema,
    title: pinTitleSchema,
    description: z.unknown().optional(),
    posX: positionSchema,
    posY: positionSchema,
    visibility: contentVisibilitySchema.optional(),
  })
  .strict();

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, createSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await createPin({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      ...body.data,
    }),
    201,
  );
}
