import type { MonsterMarkerDto } from "./types";

export const MAP_TAP_STACK_OFFSET = 0.005;

export type MapMode =
  | { kind: "none" }
  | { kind: "pin" }
  | { kind: "monster" }
  | { kind: "character" }
  | { kind: "copy"; source: MonsterMarkerDto };

export type MapModeAction = "pin" | "monster" | "character" | "cancel";
export type MapToolKind = "pin" | "monster" | "character";
/** What a tap does in the current mode (K12: in any active mode a tap on an item places, too). */
export type MapTapResolution = "create-pin" | "pick-character" | "pick-monster" | "copy" | "none";

/** Cancel hint shared by all modes (K9: ❌ button, desktop also Esc). */
export const MAP_MODE_CANCEL_HINT = "❌ oder Esc = Abbrechen.";

/** Toolbar buttons and hints per place mode, in toolbar order (K9, K10, K13). */
export const MAP_TOOLS: ReadonlyArray<{
  kind: MapToolKind;
  icon: string;
  label: string;
  cancelLabel: string;
  hint: string;
  /** Hotkey (K10), staff only; the character mode has none (K13). */
  hotkey: string | null;
  staffOnly: boolean;
}> = [
  {
    kind: "character",
    icon: "🧝",
    label: "Charakter platzieren",
    cancelLabel: "Charaktermodus abbrechen",
    hint: "Tippe auf die Karte – danach Charakter wählen.",
    hotkey: null,
    staffOnly: false,
  },
  {
    kind: "monster",
    icon: "👹",
    label: "Monster platzieren",
    cancelLabel: "Monstermodus abbrechen",
    hint: "Tippe auf die Karte – danach Monster wählen. Startet als „nur ich“.",
    hotkey: "M",
    staffOnly: true,
  },
  {
    kind: "pin",
    icon: "📍",
    label: "Pin setzen",
    cancelLabel: "Pinmodus abbrechen",
    hint: "Tippe auf die Karte, um den Pin zu setzen.",
    hotkey: "P",
    staffOnly: true,
  },
];

export function mapModeHint(mode: MapMode): string | null {
  if (mode.kind === "none") return null;
  if (mode.kind === "copy") return `Tippe, um Kopien von „${mode.source.name}“ zu setzen. ${MAP_MODE_CANCEL_HINT}`;
  const tool = MAP_TOOLS.find((row) => row.kind === mode.kind);
  return tool ? `${tool.hint} ${MAP_MODE_CANCEL_HINT}` : null;
}

export function nextMapMode(current: MapMode, action: MapModeAction): MapMode {
  if (action === "cancel") return { kind: "none" };
  return current.kind === action ? { kind: "none" } : { kind: action };
}

/** Same result for a tap on the map and on an existing item (K12). */
export function resolveMapTap(mode: MapMode): MapTapResolution {
  if (mode.kind === "pin") return "create-pin";
  if (mode.kind === "monster") return "pick-monster";
  if (mode.kind === "character") return "pick-character";
  if (mode.kind === "copy") return "copy";
  return "none";
}

export function tapOnItemPosition(posX: number, posY: number): { x: number; y: number } {
  return {
    x: posX + MAP_TAP_STACK_OFFSET > 1 ? posX - MAP_TAP_STACK_OFFSET : posX + MAP_TAP_STACK_OFFSET,
    y: posY,
  };
}
