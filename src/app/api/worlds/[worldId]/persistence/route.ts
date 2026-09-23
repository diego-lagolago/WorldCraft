import { persistenceSnapshot } from "@/lib/domain/persistence";
import { openWorldRequest, resultResponse } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

/** Test-Login only: staff diagnostic after leave/archive (CR-019a). */
export async function GET(_request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  return resultResponse(
    await persistenceSnapshot({
      membership: req.context.membership,
      worldId: req.context.world.id,
    }),
  );
}
