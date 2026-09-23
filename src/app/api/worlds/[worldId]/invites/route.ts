import { z } from "zod";
import { createInvite, inviteValiditySchema, listInvites } from "@/lib/domain/invites";
import { parseJsonBody } from "@/lib/http";
import { failResponse, openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

const createSchema = z.object({ validity: inviteValiditySchema });

export async function GET(_request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const invites = await listInvites(req.context.membership);
  return resultResponse(invites.ok ? { ok: true as const, data: { invites: invites.data } } : invites);
}

export async function POST(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const body = await parseJsonBody(request, createSchema);
  if (!body.ok) return failResponse(body);
  return resultResponse(
    await createInvite({ membership: req.context.membership, actorId: req.user.id, validity: body.data.validity }),
    201,
  );
}
