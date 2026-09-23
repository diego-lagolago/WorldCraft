import { deleteCharacterImage, imageUpdateSchema, updateCharacterImage } from "@/lib/domain/characters";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, resultResponse } from "@/lib/route";
import { requireProductSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ characterId: string; imageId: string }> };

async function ids(ctx: Ctx) {
  const params = await ctx.params;
  return { characterId: parseUuid(params.characterId), imageId: parseUuid(params.imageId) };
}

/** Upload goes through `POST /api/files` with `kind=character_image`. */
export async function PATCH(request: Request, ctx: Ctx) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;
  const { characterId, imageId } = await ids(ctx);
  if (!characterId || !imageId) return notFoundResponse("Dieses Bild gibt es nicht.");
  const body = await parseJsonBody(request, imageUpdateSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(await updateCharacterImage({ actorId: session.user.id, characterId, imageId, ...body.data }));
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;
  const { characterId, imageId } = await ids(ctx);
  if (!characterId || !imageId) return notFoundResponse("Dieses Bild gibt es nicht.");
  return resultResponse(await deleteCharacterImage({ actorId: session.user.id, characterId, imageId }));
}
