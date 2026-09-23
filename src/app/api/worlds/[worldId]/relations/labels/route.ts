import { NextResponse } from "next/server";
import { listManualLabels } from "@/lib/domain/relations";
import { openWorldRequest } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  return NextResponse.json({ labels: await listManualLabels(req.context.world.id) });
}
