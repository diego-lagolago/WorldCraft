/** Pure decision helpers for ConfirmDialog (Plan 007 C5 / C11; CR-004, CR-014). */

export function confirmMode(event: { shiftKey: boolean }): "immediate" | "confirm" {
  return event.shiftKey ? "immediate" : "confirm";
}

/**
 * Keyboard handling inside the confirm dialog.
 * Esc always cancels. Enter confirms only via the native confirm button
 * (returns "none" when focusedConfirm); otherwise Enter cancels.
 */
export function confirmDialogKey(
  key: string,
  focusedConfirm: boolean,
): "cancel" | "confirm" | "none" {
  if (key === "Escape") return "cancel";
  if (key === "Enter") return focusedConfirm ? "none" : "cancel";
  return "none";
}

/** Focus trap: Tab on last → first, Shift+Tab on first → last. */
export function nextFocusIndex(current: number, count: number, shift: boolean): number {
  if (count <= 0) return 0;
  if (shift) return current <= 0 ? count - 1 : current - 1;
  return current >= count - 1 ? 0 : current + 1;
}
