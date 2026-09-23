import { NextResponse } from "next/server";
import { z } from "zod";
import { optionalUuid } from "@/lib/chat/query";
import { parseJsonBody } from "@/lib/http";
import { visibilityStatusSchema } from "@/lib/authz";
import {
  createMap,
  deleteMap,
  loadMapState,
  mapNameSchema,
  updateMap,
} from "@/lib/map/repository";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const patchSchema = z
  .object({
    mapId: z.uuid(),
    name: mapNameSchema.optional(),
    visibility: visibilityStatusSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.visibility !== undefined);

const createSchema = z.object({
  universeId: z.uuid(),
  name: mapNameSchema,
});

const deleteSchema = z.object({
  mapId: z.uuid(),
});

export async function GET(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const url = new URL(request.url);
  const universe = optionalUuid(url.searchParams.get("universe"));
  const map = optionalUuid(url.searchParams.get("map"));
  const pin = optionalUuid(url.searchParams.get("pin"));
  if (!universe.ok) return failResponse(universe);
  if (!map.ok) return failResponse(map);
  if (!pin.ok) return failResponse(pin);
  const state = await loadMapState({
    worldId: req.context.world.id,
    actorId: req.user.id,
    role: req.context.membership.role,
    universeId: universe.id,
    mapId: map.id,
    pinId: pin.id,
  });
  return resultResponse(state);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, patchSchema);
  if (!body.ok) return failResponse(body);
  const { mapId, ...rest } = body.data;
  return resultResponse(
    await updateMap({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      mapId,
      ...rest,
    }),
  );
}

export async function DELETE(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, deleteSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await deleteMap({
      membership: req.context.membership,
      worldId: req.context.world.id,
      mapId: body.data.mapId,
    }),
  );
}

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Nur JSON wird akzeptiert. Bilder bitte über /api/files hochladen." },
      { status: 415 },
    );
  }

  const body = await parseJsonBody(request, createSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await createMap({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      universeId: body.data.universeId,
      name: body.data.name,
    }),
    201,
  );
}
