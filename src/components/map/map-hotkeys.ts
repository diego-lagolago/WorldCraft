export type MapHotkeyAction = "pin" | "monster" | "cancel" | null;

export type MapHotkeyInput = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  staff: boolean;
  /** True when a sheet/dialog is open. */
  sheetOpen: boolean;
  /** Tag name of document.activeElement (lowercase), or null. */
  focusTag: string | null;
  /** True when activeElement is contenteditable. */
  focusEditable: boolean;
};

/** Pure gate for map place-mode hotkeys (Plan 006 K10 / T-010). */
export function mapHotkeyAction(input: MapHotkeyInput): MapHotkeyAction {
  if (!input.staff) return null;
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  if (input.sheetOpen) return null;
  if (input.focusEditable) return null;
  const tag = input.focusTag ?? "";
  if (tag === "input" || tag === "textarea" || tag === "select") return null;

  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  if (key === "Escape") return "cancel";
  if (key === "p") return "pin";
  if (key === "m") return "monster";
  return null;
}
