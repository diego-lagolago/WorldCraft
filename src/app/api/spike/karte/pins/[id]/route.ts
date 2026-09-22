/** Spike T-009 — Pin verschieben, bearbeiten oder sperren. */

import { NextResponse } from "next/server";
import { z } from "zod";
import { isUnlockOnlyPatch } from "@/spike/karte/pin-lock";
import { SPIKE_PIN_TYPES } from "@/spike/karte/pin-types";
import { publishSpikeEvent } from "@/spike/karte/realtime-bus";
import {
  getSpikePin,
  serializePin,
  updateSpikePin,
} from "@/spike/karte/repository";
import { requireSpikeSession } from "@/spike/karte/session";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    posX: z.number().min(0).max(1).optional(),
    posY: z.number().min(0).max(1).optional(),
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    pinType: z.enum(SPIKE_PIN_TYPES).optional(),
    locked: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "empty",
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requireSpikeSession();
  if (response) return response;

  const { id } = await context.params;
  const json: unknown = await request.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Pin-Daten." }, { status: 400 });
  }

  const existing = await getSpikePin(id);
  if (!existing) {
    return NextResponse.json({ error: "Pin nicht gefunden." }, { status: 404 });
  }

  if (existing.locked && !isUnlockOnlyPatch(parsed.data as Record<string, unknown>)) {
    return NextResponse.json({ error: "Pin ist gesperrt." }, { status: 409 });
  }

  const row = await updateSpikePin(id, {
    ...parsed.data,
    description:
      parsed.data.description === undefined
        ? undefined
        : parsed.data.description?.length
          ? parsed.data.description
          : null,
  });
  if (!row) {
    return NextResponse.json({ error: "Pin nicht gefunden." }, { status: 404 });
  }

  const pin = serializePin(row);
  publishSpikeEvent({ type: "pin.upsert", pin });
  return NextResponse.json({ pin });
}
