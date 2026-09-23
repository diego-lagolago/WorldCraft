import { eventForViewer } from "@/lib/authz";
import { createSseResponse } from "@/lib/realtime/sse";
import { worldEvents } from "@/lib/realtime/events";
import { openWorldRequest } from "@/lib/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ worldId: string }> };

/** Shared SSE route: map events filtered (CR-001); membership.changed closes the stream (CR-002/CR-017). */
export async function GET(request: Request, ctx: Ctx) {
  const req = await openWorldRequest((await ctx.params).worldId);
  if (!req.ok) return req.response;
  const worldId = req.context.world.id;
  const viewer = {
    role: req.context.membership.role,
    userId: req.context.membership.userId,
  };
  return createSseResponse(request, (send, stop) =>
    worldEvents.subscribe((event) => {
      if (event.worldId !== worldId) return;
      if (event.type === "membership.changed") {
        if (event.userId === viewer.userId) stop();
        return;
      }
      const out = eventForViewer(viewer, event);
      if (out) send(out);
    }),
  );
}
