import { NextResponse } from "next/server";
import { z } from "zod";
import { optionalUuid } from "@/lib/chat/query";
import { parseJsonBody, parseUuid } from "@/lib/http";
import {
  MAP_IMAGE_MAX_BYTES,
  createMapWithImage,
  loadMapState,
  mapNameSchema,
  updateMap,
  visibilitySchema,
} from "@/lib/map/repository";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const patchSchema = z
  .object({
    mapId: z.uuid(),
    name: mapNameSchema.optional(),
    visibility: visibilitySchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.visibility !== undefined);

export async function GET(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const url = new URL(request.url);
  const universe = optionalUuid(url.searchParams.get("universe"));
  const pin = optionalUuid(url.searchParams.get("pin"));
  if (!universe.ok) return failResponse(universe);
  if (!pin.ok) return failResponse(pin);
  const state = await loadMapState({
    worldId: req.context.world.id,
    actorId: req.user.id,
    role: req.context.membership.role,
    universeId: universe.id,
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

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Bitte ein Bild als Formular senden." }, { status: 400 });
  }
  const file = form.get("image");
  const universeId = parseUuid(form.get("universeId"));
  if (!universeId) {
    return NextResponse.json({ error: "Die Universum-ID ist ungültig." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Bitte ein Kartenbild wählen." }, { status: 400 });
  }
  if (file.size > MAP_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Das Bild darf höchstens 20 MB groß sein." }, { status: 400 });
  }
  const rawName = form.get("name");
  const parsedName = typeof rawName === "string" && rawName.trim() ? mapNameSchema.safeParse(rawName) : null;
  if (parsedName && !parsedName.success) {
    return NextResponse.json({ error: "Der Kartenname ist ungültig." }, { status: 400 });
  }
  const fromFile = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 120);
  const name = parsedName?.data ?? (fromFile || "Karte");
  const created = await createMapWithImage({
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    universeId,
    name,
    bytes: Buffer.from(await file.arrayBuffer()),
  });
  return resultResponse(created, 201);
}
