/** Spike T-009 — In-Process-SSE-Bus (ein Next-Prozess, lokal ausreichend). */

import type { SpikeRealtimeEvent } from "./types";

type Listener = (event: SpikeRealtimeEvent) => void;

const globalForBus = globalThis as typeof globalThis & {
  __spikeKarteListeners?: Set<Listener>;
};

function listeners(): Set<Listener> {
  if (!globalForBus.__spikeKarteListeners) {
    globalForBus.__spikeKarteListeners = new Set();
  }
  return globalForBus.__spikeKarteListeners;
}

export function publishSpikeEvent(event: SpikeRealtimeEvent): void {
  for (const listener of listeners()) {
    listener(event);
  }
}

export function subscribeSpikeEvents(listener: Listener): () => void {
  listeners().add(listener);
  return () => {
    listeners().delete(listener);
  };
}

export function spikeSubscriberCount(): number {
  return listeners().size;
}
