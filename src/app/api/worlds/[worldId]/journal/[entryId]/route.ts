import { deleteJournalEntry, journalUpdateSchema, updateJournalEntry } from "@/lib/domain/journal";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; entryId: string }> };

const NOT_FOUND = "Diesen Tagebucheintrag gibt es nicht.";

export async function PATCH(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const entryId = parseUuid(params.entryId);
  if (!entryId) return notFoundResponse(NOT_FOUND);
  const body = await parseJsonBody(request, journalUpdateSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await updateJournalEntry({ actorId: req.user.id, worldId: req.context.world.id, entryId, ...body.data }),
  );
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const entryId = parseUuid(params.entryId);
  if (!entryId) return notFoundResponse(NOT_FOUND);
  return resultResponse(await deleteJournalEntry({ actorId: req.user.id, worldId: req.context.world.id, entryId }));
}
