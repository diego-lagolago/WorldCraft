import { NextResponse } from "next/server";
import { searchMentionTargets } from "@/lib/domain/mention-search";
import { MENTION_QUERY_MAX } from "@/lib/editor/mentions";
import { openWorldRequest } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ worldId: string }> }) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;

  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.length > MENTION_QUERY_MAX) {
    return NextResponse.json({ error: "Der Suchbegriff ist zu lang." }, { status: 400 });
  }

  const hits = await searchMentionTargets({
    worldId: req.context.world.id,
    role: req.context.membership.role,
    query,
  });
  return NextResponse.json({ hits });
}
