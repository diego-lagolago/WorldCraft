import { NextResponse } from "next/server";
import { z } from "zod";
import { articleTitleSchema, createArticleStub } from "@/lib/domain/articles";
import { loadWorldContext } from "@/lib/domain/membership";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse } from "@/lib/route";
import { requireProductSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stubSchema = z.object({ title: articleTitleSchema });

export async function POST(request: Request, ctx: { params: Promise<{ worldId: string }> }) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;

  const worldId = parseUuid((await ctx.params).worldId);
  if (!worldId) return notFoundResponse("Diese Welt gibt es nicht.");

  const body = await parseJsonBody(request, stubSchema);
  if (!body.ok) return failResponse(body);

  const context = await loadWorldContext(worldId, session.user.id);
  if (!context.ok) return failResponse(context);

  const created = await createArticleStub({
    membership: context.data.membership,
    actorId: session.user.id,
    worldId,
    title: body.data.title,
  });
  if (!created.ok) return failResponse(created);
  return NextResponse.json({ article: created.data }, { status: 201 });
}
