import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteUniverse,
  getUniverse,
  moveUniverse,
  universeNameSchema,
  updateUniverse,
  visibilitySchema,
} from "@/lib/domain/universes";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; universeId: string }> };

const NOT_FOUND = "Dieses Universum gibt es nicht.";

const patchSchema = z
  .object({
    name: universeNameSchema.optional(),
    description: z.unknown().optional(),
    visibility: visibilitySchema.optional(),
    move: z.enum(["up", "down"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function GET(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const universeId = parseUuid(params.universeId);
  if (!universeId) return notFoundResponse(NOT_FOUND);
  const universe = await getUniverse(req.context.world.id, universeId, req.context.membership.role, req.context.membership.userId);
  if (!universe) return notFoundResponse(NOT_FOUND);
  return NextResponse.json({ universe });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const universeId = parseUuid(params.universeId);
  if (!universeId) return notFoundResponse(NOT_FOUND);
  const body = await parseJsonBody(request, patchSchema);
  if (!body.ok) return failResponse(body);

  const base = {
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    universeId,
  };
  const { move, ...fields } = body.data;
  if (move) {
    const moved = await moveUniverse({ ...base, direction: move });
    if (!moved.ok || Object.keys(fields).length === 0) return resultResponse(moved);
  }
  return resultResponse(await updateUniverse({ ...base, ...fields }));
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const universeId = parseUuid(params.universeId);
  if (!universeId) return notFoundResponse(NOT_FOUND);
  return resultResponse(
    await deleteUniverse({ membership: req.context.membership, worldId: req.context.world.id, universeId }),
  );
}
