import { z } from "zod";
import { articleTitleSchema, createArticleStub } from "@/lib/domain/articles";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stubSchema = z.object({ title: articleTitleSchema });

export async function POST(request: Request, ctx: { params: Promise<{ worldId: string }> }) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, stubSchema);
  if (!body.ok) return failResponse(body);

  const created = await createArticleStub({
    membership: req.context.membership,
    actorId: req.user.id,
    worldId: req.context.world.id,
    title: body.data.title,
  });
  return resultResponse(created.ok ? { ok: true as const, data: { article: created.data } } : created, 201);
}
