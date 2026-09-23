import { createSseResponse } from "@/lib/realtime/sse";
import { worldEvents } from "@/lib/realtime/events";
import { openWorldRequest } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

/** Shared SSE route for this world. Chat publishes here; the map will too (CR-012). */
export async function GET(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const worldId = req.context.world.id;
  return createSseResponse(request, (send) =>
    worldEvents.subscribe((event) => {
      if (event.worldId !== worldId) return;
      send(event);
    }),
  );
}
