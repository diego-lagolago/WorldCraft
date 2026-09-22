/** Spike T-009 — GET aktueller Kartenstand. */

import { NextResponse } from "next/server";
import { loadSpikeState } from "@/spike/karte/repository";
import { requireSpikeSession } from "@/spike/karte/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireSpikeSession();
  if (response) return response;
  return NextResponse.json(await loadSpikeState());
}
