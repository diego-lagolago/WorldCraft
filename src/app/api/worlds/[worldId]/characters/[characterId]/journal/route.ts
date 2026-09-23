import { createJournalEntry, journalCreateSchema, listJournal } from "@/lib/domain/journal";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; characterId: string }> };

const NOT_FOUND = "Diesen Charakter gibt es in dieser Welt nicht.";

export async function GET(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const characterId = parseUuid(params.characterId);
  if (!characterId) return notFoundResponse(NOT_FOUND);
  const entries = await listJournal({
    worldId: req.context.world.id,
    characterId,
    viewerId: req.user.id,
    role: req.context.membership.role,
  });
  return resultResponse(entries.ok ? { ok: true as const, data: { entries: entries.data } } : entries);
}

export async function POST(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const characterId = parseUuid(params.characterId);
  if (!characterId) return notFoundResponse(NOT_FOUND);
  const body = await parseJsonBody(request, journalCreateSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await createJournalEntry({ actorId: req.user.id, worldId: req.context.world.id, characterId, ...body.data }),
    201,
  );
}
