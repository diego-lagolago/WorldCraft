import { NextResponse } from "next/server";
import { z } from "zod";
import { visibilityStatusSchema } from "@/lib/authz";
import { createUniverse, listUniverses, universeNameSchema } from "@/lib/domain/universes";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const createSchema = z.object({
  name: universeNameSchema,
  description: z.unknown().optional(),
  visibility: visibilityStatusSchema.optional(),
});

export async function GET(_request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const { world, membership } = req.context;
  return NextResponse.json({ universes: await listUniverses(world.id, membership.role, membership.userId) });
}

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, createSchema);
  if (!body.ok) return failResponse(body);
  const created = await createUniverse({
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    ...body.data,
  });
  return resultResponse(created, 201);
}
