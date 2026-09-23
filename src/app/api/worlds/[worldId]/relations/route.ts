import { NextResponse } from "next/server";
import { CONTENT_KINDS } from "@/lib/authz";
import { createManualRelation, listLinked, manualRelationSchema } from "@/lib/domain/relations";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const url = new URL(request.url);
  const kindRaw = url.searchParams.get("kind");
  const id = parseUuid(url.searchParams.get("id"));
  if (!kindRaw || !CONTENT_KINDS.includes(kindRaw as (typeof CONTENT_KINDS)[number]) || !id) {
    return notFoundResponse("Quelle nicht gefunden.");
  }
  const kind = kindRaw as (typeof CONTENT_KINDS)[number];
  return NextResponse.json({
    items: await listLinked({
      worldId: req.context.world.id,
      role: req.context.membership.role,
      kind,
      id,
    }),
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, manualRelationSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await createManualRelation({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      ...body.data,
    }),
    201,
  );
}
