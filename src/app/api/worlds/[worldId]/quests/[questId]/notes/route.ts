import { NextResponse } from "next/server";
import { getQuestNote, noteUpdateSchema, saveQuestNote } from "@/lib/domain/quest-notes";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; questId: string }> };

const QUEST_NOT_FOUND = "Diese Quest gibt es nicht.";

export async function GET(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const questId = parseUuid(params.questId);
  if (!questId) return notFoundResponse(QUEST_NOT_FOUND);
  const note = await getQuestNote({
    worldId: req.context.world.id,
    questId,
    role: req.context.membership.role,
    viewerId: req.context.membership.userId,
  });
  return resultResponse(note.ok ? { ok: true as const, data: { note: note.data } } : note);
}

export async function PUT(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const questId = parseUuid(params.questId);
  if (!questId) return notFoundResponse(QUEST_NOT_FOUND);
  const body = await parseJsonBody(request, noteUpdateSchema);
  if (!body.ok) return failResponse(body);
  const saved = await saveQuestNote({
    actorId: req.user.id,
    worldId: req.context.world.id,
    questId,
    role: req.context.membership.role,
    bodyJson: body.data.bodyJson,
    version: body.data.version,
  });
  if (!saved.ok) {
    if (saved.status === 409 && "version" in saved) {
      return NextResponse.json(
        { error: saved.error, version: saved.version },
        { status: 409 },
      );
    }
    return failResponse(saved);
  }
  return NextResponse.json({ note: saved.data });
}
