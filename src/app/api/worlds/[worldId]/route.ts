import { NextResponse } from "next/server";
import { z } from "zod";
import { listUniverses } from "@/lib/domain/universes";
import { deleteWorld, getWorldDetails, updateWorld, worldNameSchema } from "@/lib/domain/worlds";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const patchSchema = z
  .object({
    name: worldNameSchema.optional(),
    description: z.unknown().optional(),
    removeTitleImage: z.literal(true).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function GET(_request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const { world, membership } = req.context;
  const [details, universes] = await Promise.all([
    getWorldDetails(world.id),
    listUniverses(world.id, membership.role),
  ]);
  return NextResponse.json({ world: details, role: membership.role, universes });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, patchSchema);
  if (!body.ok) return failResponse(body);
  const updated = await updateWorld({
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    ...body.data,
  });
  return resultResponse(updated);
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const deleted = await deleteWorld({ membership: req.context.membership, worldId: req.context.world.id });
  return resultResponse(deleted);
}
