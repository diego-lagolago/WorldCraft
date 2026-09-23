import { NextResponse } from "next/server";
import { listMembers } from "@/lib/domain/members";
import { openWorldRequest } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ worldId: string }> }) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  return NextResponse.json({ members: await listMembers(req.context.world.id) });
}
