import { NextResponse } from "next/server";
import { loadWorldContext } from "@/lib/domain/membership";
import { searchMentionTargets } from "@/lib/domain/mention-search";
import { MENTION_QUERY_MAX } from "@/lib/editor/mentions";
import { parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse } from "@/lib/route";
import { requireProductSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ worldId: string }> }) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;

  const worldId = parseUuid((await ctx.params).worldId);
  if (!worldId) return notFoundResponse("Diese Welt gibt es nicht.");

  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.length > MENTION_QUERY_MAX) {
    return NextResponse.json({ error: "Der Suchbegriff ist zu lang." }, { status: 400 });
  }

  const context = await loadWorldContext(worldId, session.user.id);
  if (!context.ok) return failResponse(context);

  const hits = await searchMentionTargets({
    worldId,
    role: context.data.membership.role,
    query,
  });
  return NextResponse.json({ hits });
}
