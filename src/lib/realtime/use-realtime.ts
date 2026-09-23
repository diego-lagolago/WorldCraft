"use client";

import { useEffect, useRef } from "react";
import { isHelloEvent, isWorldRealtimeEvent, type WorldRealtimeEvent } from "./events";
import { nextHello } from "./resync";

type Handlers = {
  onEvent: (event: WorldRealtimeEvent) => void;
  onResync: () => void;
};

/**
 * One EventSource per world. A `hello` after the first reconnects and resyncs (CR-006).
 * `JSON.parse` failures are ignored (CR-014).
 */
export function useWorldRealtime(worldId: string, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const source = new EventSource(`/api/worlds/${worldId}/events`);
    let seenHello = false;
    source.onmessage = (message) => {
      let data: unknown;
      try {
        data = JSON.parse(message.data);
      } catch {
        return;
      }
      if (isHelloEvent(data)) {
        const next = nextHello(seenHello);
        seenHello = next.seenHello;
        if (next.resync) handlersRef.current.onResync();
        return;
      }
      if (isWorldRealtimeEvent(data) && data.worldId === worldId) {
        handlersRef.current.onEvent(data);
      }
    };
    return () => source.close();
  }, [worldId]);
}
