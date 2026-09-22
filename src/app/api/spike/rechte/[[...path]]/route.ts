/** Spike T-011 — Rechte-API. Session-Cookie wie Test-Login / curl. */

import { handleRechteRequest } from "@/spike/rechte/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRechteRequest(request);
}

export async function POST(request: Request) {
  return handleRechteRequest(request);
}

export async function PATCH(request: Request) {
  return handleRechteRequest(request);
}

export async function DELETE(request: Request) {
  return handleRechteRequest(request);
}
