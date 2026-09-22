/** Spike T-009 — Sitzungspflicht für Spike-Seiten und APIs. */

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function getSpikeSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSpikeSession() {
  const session = await getSpikeSession();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Anmeldung erforderlich." },
        { status: 401 },
      ),
    };
  }
  return { session, response: null };
}
