/** Spike T-009 — Kartenbild ausliefern (nur mit Sitzung). */

import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSpikeMap } from "@/spike/karte/repository";
import { requireSpikeSession } from "@/spike/karte/session";
import { spikeImageAbsolutePath } from "@/spike/karte/storage";

export const dynamic = "force-dynamic";

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET() {
  const { response } = await requireSpikeSession();
  if (response) return response;

  const map = await getSpikeMap();
  if (!map) {
    return NextResponse.json({ error: "Keine Karte." }, { status: 404 });
  }

  try {
    const bytes = await readFile(spikeImageAbsolutePath(map.imageFilename));
    const ext = map.imageFilename.slice(map.imageFilename.lastIndexOf("."));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPE[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Bilddatei fehlt." }, { status: 404 });
  }
}
