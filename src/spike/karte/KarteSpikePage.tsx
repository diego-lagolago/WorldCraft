"use client";

import dynamic from "next/dynamic";
import type { SpikeKarteState } from "./types";

const KarteBoard = dynamic(() => import("./KarteBoard"), {
  ssr: false,
  loading: () => (
    <p className="px-4 py-8 text-sm text-zinc-400">Karte wird geladen…</p>
  ),
});

export function KarteSpikePage({
  highlightPinId,
  initialState,
}: {
  highlightPinId?: string;
  initialState: SpikeKarteState;
}) {
  return <KarteBoard highlightPinId={highlightPinId} initialState={initialState} />;
}
