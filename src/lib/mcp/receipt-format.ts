import { formatDelta, RECEIPT_INSTRUCTION, type FieldChange } from "./change-format";

/**
 * Data-free receipt formatter shared by MCP tools and the upload route. Readers which build
 * snapshots live in receipt.ts; keeping the final rendering here avoids a second wire format.
 */
export function formatReceipt(input: {
  art: string;
  id: string;
  after: { title: string; visibility?: string; stand?: string };
  changes: readonly FieldChange[] | null;
  stubs?: readonly { id: string; title: string }[];
  extraLines?: readonly string[];
  notes?: readonly string[];
}): string {
  return [
    RECEIPT_INSTRUCTION,
    "Gespeichert.",
    `Art: ${input.art}`,
    `ID: ${input.id}`,
    `Titel: ${input.after.title}`,
    ...(input.after.stand ? [`Stand: ${input.after.stand}`] : []),
    ...(input.after.visibility ? [`Sichtbarkeit: ${input.after.visibility}`] : []),
    ...(input.extraLines ?? []),
    ...(input.changes === null
      ? ["Die Änderungsübersicht konnte nach dem Speichern nicht geladen werden; die Änderung ist gespeichert."]
      : input.changes.length
        ? formatDelta(input.changes, "Gespeicherte Änderungen (vorher → nachher):")
        : ["Keine Feldänderung gespeichert."]),
    ...(input.stubs?.length ? ["Neu angelegte Stub-Artikel:", ...input.stubs.map((stub) => `- ${stub.title} (${stub.id})`)] : []),
    ...(input.notes ?? []),
  ].join("\n");
}
