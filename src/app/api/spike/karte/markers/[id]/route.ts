/** Spike T-009 — Charakter-Marker-Position nach Drop speichern. */

import { NextResponse } from "next/server";
import { z } from "zod";
import { publishSpikeEvent } from "@/spike/karte/realtime-bus";
import { serializeMarker, updateSpikeMarkerPosition } from "@/spike/karte/repository";
import { requireSpikeSession } from "@/spike/karte/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  posX: z.number().min(0).max(1),
  posY: z.number().min(0).max(1),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requireSpikeSession();
  if (response) return response;

  const { id } = await context.params;
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Position." }, { status: 400 });
  }

  const row = await updateSpikeMarkerPosition(id, parsed.data.posX, parsed.data.posY);
  if (!row) {
    return NextResponse.json({ error: "Marker nicht gefunden." }, { status: 404 });
  }

  const marker = serializeMarker(row);
  publishSpikeEvent({ type: "marker.upsert", marker });
  return NextResponse.json({ marker });
}
