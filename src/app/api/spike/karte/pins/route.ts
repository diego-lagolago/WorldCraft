/** Spike T-009 — Pin anlegen. */

import { NextResponse } from "next/server";
import { z } from "zod";
import { SPIKE_PIN_TYPES } from "@/spike/karte/pin-types";
import { publishSpikeEvent } from "@/spike/karte/realtime-bus";
import { getSpikeMap, insertSpikePin, serializePin } from "@/spike/karte/repository";
import { requireSpikeSession } from "@/spike/karte/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  pinType: z.enum(SPIKE_PIN_TYPES),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(8000).optional(),
  posX: z.number().min(0).max(1),
  posY: z.number().min(0).max(1),
});

export async function POST(request: Request) {
  const { response } = await requireSpikeSession();
  if (response) return response;

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Pin-Daten." }, { status: 400 });
  }

  const map = await getSpikeMap();
  if (!map) {
    return NextResponse.json({ error: "Zuerst ein Kartenbild hochladen." }, { status: 400 });
  }

  const row = await insertSpikePin({
    mapId: map.id,
    pinType: parsed.data.pinType,
    title: parsed.data.title,
    description: parsed.data.description?.length ? parsed.data.description : null,
    posX: parsed.data.posX,
    posY: parsed.data.posY,
  });
  const pin = serializePin(row);
  publishSpikeEvent({ type: "pin.upsert", pin });
  return NextResponse.json({ pin }, { status: 201 });
}
