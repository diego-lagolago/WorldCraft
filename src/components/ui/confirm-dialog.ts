/** Pure decision helpers for ConfirmDialog (Plan 007 C5 / C11). */

export function deleteAction(event: { shiftKey: boolean }): "immediate" | "confirm" {
  return event.shiftKey ? "immediate" : "confirm";
}

/**
 * Keyboard handling inside the confirm dialog.
 * Esc always cancels. Enter on the cancel button must not delete (returns "none");
 * Enter when confirm is focused (or cancel is not) confirms.
 */
export function confirmDialogKey(
  key: string,
  focusedCancel: boolean,
): "cancel" | "confirm" | "none" {
  if (key === "Escape") return "cancel";
  if (key === "Enter") return focusedCancel ? "none" : "confirm";
  return "none";
}
