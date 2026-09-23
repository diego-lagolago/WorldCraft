"use client";

import { useEffect, useRef } from "react";
import { useWorldRealtime } from "@/lib/realtime/use-realtime";
import type { WorldRealtimeEvent } from "@/lib/realtime/events";

/** SSE for the open world. The component that renders chat does not touch EventSource. */
export function useChatRealtime(
  worldId: string,
  onEvent: (event: WorldRealtimeEvent) => void,
  onResync: () => void,
) {
  const onEventRef = useRef(onEvent);
  const onResyncRef = useRef(onResync);
  useEffect(() => {
    onEventRef.current = onEvent;
    onResyncRef.current = onResync;
  });
  useWorldRealtime(worldId, {
    onEvent: (event) => onEventRef.current(event),
    onResync: () => onResyncRef.current(),
  });
}
