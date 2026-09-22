/** Spike T-009 — Kartenbild hochladen (kein Seed-Bild). */

import { randomUUID } from "node:crypto";
import { imageSize } from "image-size";
import { NextResponse } from "next/server";
import { publishSpikeEvent } from "@/spike/karte/realtime-bus";
import { getSpikeMap, upsertSpikeMap } from "@/spike/karte/repository";
import { requireSpikeSession } from "@/spike/karte/session";
import {
  ALLOWED_MAP_TYPES,
  MAX_MAP_BYTES,
  removeSpikeImage,
  saveSpikeImage,
} from "@/spike/karte/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { response } = await requireSpikeSession();
  if (response) return response;

  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Bitte ein Kartenbild wählen." }, { status: 400 });
  }

  const extension = ALLOWED_MAP_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Nur JPEG, PNG oder WebP." },
      { status: 400 },
    );
  }

  if (file.size > MAX_MAP_BYTES) {
    return NextResponse.json(
      { error: "Kartenbild darf höchstens 20 MB groß sein." },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let width: number | undefined;
  let height: number | undefined;
  try {
    const size = imageSize(bytes);
    width = size.width;
    height = size.height;
  } catch {
    return NextResponse.json({ error: "Bild konnte nicht gelesen werden." }, { status: 400 });
  }

  if (!width || !height) {
    return NextResponse.json({ error: "Bildgröße unbekannt." }, { status: 400 });
  }

  const existing = await getSpikeMap();
  const mapId = existing?.id ?? randomUUID();
  const previousFilename = existing?.imageFilename ?? null;
  const imageFilename = await saveSpikeImage(mapId, extension, bytes);

  const map = await upsertSpikeMap({
    id: mapId,
    existingId: existing?.id,
    name: file.name.replace(/\.[^.]+$/, "") || "Spike-Karte",
    imageFilename,
    imageWidth: width,
    imageHeight: height,
  });

  if (previousFilename && previousFilename !== imageFilename) {
    await removeSpikeImage(previousFilename);
  }

  publishSpikeEvent({ type: "map.updated" });

  const large = width >= 8000 || height >= 6000;
  return NextResponse.json({
    mapId: map.id,
    imageWidth: width,
    imageHeight: height,
    warning: large
      ? "Großes Kartenbild — bei Ruckeln auf dem Handy später Kacheln (ADR-003)."
      : null,
  });
}
