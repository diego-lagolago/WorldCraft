import type { MonsterMarkerDto } from "./types";

export const MAP_TAP_STACK_OFFSET = 0.005;

export type MapMode =
  | { kind: "none" }
  | { kind: "pin" }
  | { kind: "monster" }
  | { kind: "character" }
  | { kind: "copy"; source: MonsterMarkerDto };

export type MapModeAction = "pin" | "monster" | "character" | "cancel";
export type MapTapTarget = "map" | "pin" | "marker" | "monster-marker";
export type MapTapResolution = "create-pin" | "pick-character" | "pick-monster" | "copy" | "open-sheet";

export function nextMapMode(current: MapMode, action: MapModeAction): MapMode {
  if (action === "cancel") return { kind: "none" };
  return current.kind === action ? { kind: "none" } : { kind: action };
}

export function resolveMapTap(mode: MapMode, target: MapTapTarget): MapTapResolution {
  if (mode.kind === "pin") return "create-pin";
  if (mode.kind === "monster") return "pick-monster";
  if (mode.kind === "character") return "pick-character";
  if (mode.kind === "copy") return "copy";
  void target;
  return "open-sheet";
}

export function tapOnItemPosition(posX: number, posY: number): { x: number; y: number } {
  return {
    x: posX + MAP_TAP_STACK_OFFSET > 1 ? posX - MAP_TAP_STACK_OFFSET : posX + MAP_TAP_STACK_OFFSET,
    y: posY,
  };
}
