import { z } from "zod";
import { fail } from "@/lib/authz";
import { deleteChatMessage, editChatMessage } from "@/lib/chat/repository";
import { MESSAGE_MAX } from "@/lib/chat/types";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; messageId: string }> };

const editBody = z.object({
  body: z.string().trim().min(1).max(MESSAGE_MAX),
});

export async function PATCH(request: Request, ctx: Ctx) {
  const { worldId: rawWorldId, messageId: rawMessageId } = await ctx.params;
  const req = await openWorldRequest(rawWorldId);
  if (!req.ok) return req.response;
  const messageId = parseUuid(rawMessageId);
  if (!messageId) return notFoundResponse("Diese Nachricht gibt es nicht.");
  const raw = await parseJsonBody(request, z.unknown());
  if (!raw.ok) return failResponse(raw);
  const parsed = editBody.safeParse(raw.data);
  if (!parsed.success) {
    return failResponse(fail(422, "Zum Entfernen löschen."));
  }
  const edited = await editChatMessage({
    worldId: req.context.world.id,
    messageId,
    membership: req.context.membership,
    body: parsed.data.body,
  });
  return resultResponse(edited);
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { worldId: rawWorldId, messageId: rawMessageId } = await ctx.params;
  const req = await openWorldRequest(rawWorldId);
  if (!req.ok) return req.response;
  const messageId = parseUuid(rawMessageId);
  if (!messageId) return notFoundResponse("Diese Nachricht gibt es nicht.");
  const deleted = await deleteChatMessage({
    worldId: req.context.world.id,
    messageId,
    membership: req.context.membership,
  });
  return resultResponse(deleted);
}
