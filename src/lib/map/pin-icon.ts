/** Shared Leaflet pin/marker size: tip at (24, 56) in a 48×58 graphic (Plan 006 K8). */
export const PIN_ICON = {
  size: [48, 58] as const,
  /** Leaflet iconAnchor = tip of the pin. */
  anchor: [24, 56] as const,
};

export type PinIconSize = (typeof PIN_ICON)["size"];
export type PinIconAnchor = (typeof PIN_ICON)["anchor"];
