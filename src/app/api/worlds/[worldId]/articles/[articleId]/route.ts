import { NextResponse } from "next/server";
import { articleUpdateSchema, deleteArticle, getArticle, updateArticle } from "@/lib/domain/articles";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; articleId: string }> };

const NOT_FOUND = "Diesen Artikel gibt es nicht.";

export async function GET(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const articleId = parseUuid(params.articleId);
  if (!articleId) return notFoundResponse(NOT_FOUND);
  const article = await getArticle(req.context.world.id, articleId, req.context.membership.role, req.context.membership.userId);
  if (!article) return notFoundResponse(NOT_FOUND);
  return NextResponse.json({ article });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const articleId = parseUuid(params.articleId);
  if (!articleId) return notFoundResponse(NOT_FOUND);
  const body = await parseJsonBody(request, articleUpdateSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await updateArticle({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      articleId,
      ...body.data,
    }),
  );
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const articleId = parseUuid(params.articleId);
  if (!articleId) return notFoundResponse(NOT_FOUND);
  return resultResponse(
    await deleteArticle({
      membership: req.context.membership,
      actorId: req.user.id,
      worldId: req.context.world.id,
      articleId,
    }),
  );
}
