import { leaveWorld } from "@/lib/domain/members";
import { openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_request: Request, ctx: { params: Promise<{ worldId: string }> }) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  return resultResponse(await leaveWorld({ membership: req.context.membership, actorId: req.user.id }));
}
