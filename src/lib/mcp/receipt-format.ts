import { formatDelta, RECEIPT_INSTRUCTION, type FieldChange } from "./change-format";

/** Lightweight receipt formatter for routes that must not import database-backed MCP readers. */
export function formatRouteReceipt(input: {
  art: string; id: string; title: string; stand?: string; extraLines: readonly string[]; changes: readonly FieldChange[];
}) {
  return [
    RECEIPT_INSTRUCTION, "Gespeichert.", `Art: ${input.art}`, `ID: ${input.id}`, `Titel: ${input.title}`,
    ...(input.stand ? [`Stand: ${input.stand}`] : []), ...input.extraLines,
    ...formatDelta(input.changes, "Gespeicherte Änderungen (vorher → nachher):"),
  ].join("\n");
}
