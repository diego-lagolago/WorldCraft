import { revokeInvite } from "@/lib/domain/invites";
import { parseUuid } from "@/lib/http";
import { notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Revokes the link; the row stays for the use count. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ worldId: string; inviteId: string }> }) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const inviteId = parseUuid(params.inviteId);
  if (!inviteId) return notFoundResponse("Diese Einladung gibt es nicht.");
  return resultResponse(
    await revokeInvite({ membership: req.context.membership, actorId: req.user.id, inviteId }),
  );
}
