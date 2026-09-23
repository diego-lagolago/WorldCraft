/** One SSE response helper for chat and, later, the map (CR-012). */

const HEARTBEAT_MS = 15_000;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/**
 * `subscribe` receives `send` (no-op once closed) and `stop` (CR-002/CR-017: close
 * on membership.changed). Heartbeat and `send` both check the closed flag before enqueue.
 */
export function createSseResponse(
  request: Request,
  subscribe: (send: (event: unknown) => void, stop: () => void) => () => void,
  hello: unknown = { type: "hello" },
): Response {
  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const stop = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const send = (event: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };
      unsubscribe = subscribe(send, stop);
      send(hello);
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          unsubscribe();
        }
      }, HEARTBEAT_MS);
      request.signal.addEventListener("abort", stop);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
