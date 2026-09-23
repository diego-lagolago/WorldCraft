import { z } from "zod";
import { changeMemberRole, removeMember } from "@/lib/domain/members";
import { parseJsonBody, parseUuid } from "@/lib/http";
import { failResponse, notFoundResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string; membershipId: string }> };

const NOT_FOUND = "Dieses Mitglied gibt es nicht.";
const roleSchema = z.object({ role: z.enum(["master", "player"]) });

export async function PATCH(request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const membershipId = parseUuid(params.membershipId);
  if (!membershipId) return notFoundResponse(NOT_FOUND);
  const body = await parseJsonBody(request, roleSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await changeMemberRole({
      actor: req.context.membership,
      actorId: req.user.id,
      membershipId,
      role: body.data.role,
    }),
  );
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const params = await ctx.params;
  const req = await openWorldRequest(params.worldId);
  if (!req.ok) return req.response;
  const membershipId = parseUuid(params.membershipId);
  if (!membershipId) return notFoundResponse(NOT_FOUND);
  return resultResponse(
    await removeMember({ actor: req.context.membership, actorId: req.user.id, membershipId }),
  );
}
