/** Pure text formats shared by write tools and the upload link (Plan 012 T-007/T-008). */

/** One delta row (Begriffe „Delta“); captions replace „vorher“/„nachher“, e.g. for rich text. */
export type FieldChange = { label: string; oldValue: string; newValue: string; oldCaption?: string; newCaption?: string };

export const RECEIPT_INSTRUCTION = "Zeige dem Benutzer diese Quittung.";

export const PREVIEW_INSTRUCTION = "Zeige dem Benutzer diese Vorschau vollständig und unverändert. "
  + "Rufe aenderung_bestaetigen erst auf, wenn der Benutzer ausdrücklich zugestimmt hat.";

function indented(caption: string, value: string): string[] {
  const [first, ...rest] = value.split("\n");
  return [`  ${caption}: ${first}`, ...rest.map((line) => `    ${line}`)];
}

/** Delta „vorher → nachher“ per changed field; long or multi-line values get their own lines. */
export function formatDelta(changes: readonly FieldChange[], heading = "Änderungen:"): string[] {
  if (!changes.length) return [];
  return [heading, ...changes.flatMap((change) => {
    const inline = !change.oldCaption && !change.newCaption
      && !`${change.oldValue}${change.newValue}`.includes("\n")
      && change.oldValue.length + change.newValue.length <= 160;
    return inline
      ? [`- ${change.label}: ${change.oldValue} → ${change.newValue}`]
      : [
        `- ${change.label}:`,
        ...indented(change.oldCaption ?? "vorher", change.oldValue),
        ...indented(change.newCaption ?? "nachher", change.newValue),
      ];
  })];
}
