import { NextResponse } from "next/server";
import { searchWorld } from "@/lib/domain/search";
import { openWorldRequest } from "@/lib/route";
import { isSearchKind, SEARCH_QUERY_MAX, SEARCH_QUERY_MIN } from "@/lib/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length > SEARCH_QUERY_MAX) {
    return NextResponse.json({ error: "Suchbegriff zu lang." }, { status: 400 });
  }
  if (query.length > 0 && query.length < SEARCH_QUERY_MIN) {
    return NextResponse.json({ hits: [] });
  }

  const kindRaw = url.searchParams.get("kind");
  const kind = kindRaw && isSearchKind(kindRaw) ? kindRaw : "all";
  const limit = url.searchParams.get("limit");

  const hits = await searchWorld({
    worldId: req.context.world.id,
    role: req.context.membership.role,
    query,
    limit: limit === null ? undefined : Number(limit),
    kind,
  });
  return NextResponse.json({ hits });
}
