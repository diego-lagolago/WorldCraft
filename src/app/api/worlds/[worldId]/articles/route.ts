import { NextResponse } from "next/server";
import { articleCreateSchema, createArticle, listArticles } from "@/lib/domain/articles";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";
import { isTemplateType } from "@/lib/templates/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const raw = new URL(request.url).searchParams.get("templateType");
  const templateType = raw && isTemplateType(raw) ? raw : "all";
  return NextResponse.json({
    articles: await listArticles(req.context.world.id, req.context.membership.role, req.context.membership.userId, templateType),
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, articleCreateSchema);
  if (!body.ok) return failResponse(body);
  const created = await createArticle({
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    ...body.data,
  });
  return resultResponse(created.ok ? { ok: true as const, data: { article: created.data } } : created, 201);
}
