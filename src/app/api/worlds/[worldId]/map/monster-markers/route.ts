import { z } from "zod";
import { parseJsonBody } from "@/lib/http";
import { copyMonsterMarker, placeMonsterMarker, positionSchema } from "@/lib/map/repository";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

/** visibility in body is ignored (K6: always owner_only on create). */
const createSchema = z
  .object({
    mapId: z.uuid(),
    monsterId: z.uuid(),
    posX: positionSchema,
    posY: positionSchema,
    visibility: z.string().optional(),
  })
  .strict();

const copySchema = z
  .object({
    sourceMarkerId: z.uuid(),
    posX: positionSchema,
    posY: positionSchema,
  })
  .strict();

const postSchema = z.union([copySchema, createSchema]);

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, postSchema);
  if (!body.ok) return failResponse(body);
  if ("sourceMarkerId" in body.data) {
    return resultResponse(
      await copyMonsterMarker({
        membership: req.context.membership,
        actorId: req.user.id,
        worldId: req.context.world.id,
        sourceMarkerId: body.data.sourceMarkerId,
        posX: body.data.posX,
        posY: body.data.posY,
      }),
      201,
    );
  }
  return resultResponse(
    await placeMonsterMarker({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      mapId: body.data.mapId,
      monsterId: body.data.monsterId,
      posX: body.data.posX,
      posY: body.data.posY,
    }),
    201,
  );
}
