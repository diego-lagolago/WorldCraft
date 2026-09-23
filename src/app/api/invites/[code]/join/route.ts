import { joinByInvite } from "@/lib/domain/invites";
import { resultResponse } from "@/lib/route";
import { requireProductSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { session, response } = await requireProductSession();
  if (response || !session) return response;
  const { code } = await ctx.params;
  return resultResponse(await joinByInvite({ code, userId: session.user.id }));
}
