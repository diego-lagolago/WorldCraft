/** Spike T-010 — SSE nach Speichern, kein Zeichen-Stream (ADR-002). */

import { subscribeChatEvents } from "@/spike/chat/realtime-bus";
import type { SpikeChatRealtimeEvent } from "@/spike/chat/types";
import { requireSpikeSession } from "@/spike/karte/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { response } = await requireSpikeSession();
  if (response) return response;

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: SpikeChatRealtimeEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      unsubscribe = subscribeChatEvents(send);
      send({ type: "hello" });
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);
      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
