/** Spike T-009 — JSON-Form für API und Client. */

import type { SpikePinType } from "./pin-types";

export type SpikeMapDto = {
  id: string;
  name: string;
  imageWidth: number;
  imageHeight: number;
  imageUrl: string;
  updatedAt: string;
};

export type SpikePinDto = {
  id: string;
  mapId: string;
  pinType: SpikePinType;
  title: string;
  description: string | null;
  locked: boolean;
  posX: number;
  posY: number;
};

export type SpikeMarkerDto = {
  id: string;
  mapId: string;
  name: string;
  posX: number;
  posY: number;
};

export type SpikeKarteState = {
  map: SpikeMapDto | null;
  pins: SpikePinDto[];
  marker: SpikeMarkerDto | null;
};

export type SpikeRealtimeEvent =
  | { type: "hello" }
  | { type: "map.updated" }
  | { type: "pin.upsert"; pin: SpikePinDto }
  | { type: "marker.upsert"; marker: SpikeMarkerDto };
