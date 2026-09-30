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

/** Rich text in previews and receipts: the existing text is shortened to this many characters. */
export const RICH_EXCERPT = 500;
/** Per rich-text value; keeps confirmation metadata below the global transport limit. */
export const RICH_CHANGE_BUDGET = 6_000;

function abbreviated(value: string, budget = RICH_CHANGE_BUDGET) {
  if (value.length <= budget) return value;
  const head = Math.floor(budget / 2);
  const omitted = value.length - (head * 2);
  return `${value.slice(0, head)}\n… (${omitted} Zeichen nicht dargestellt; gespeichert wird der vollständige Text) …\n${value.slice(-head)}`;
}

/** Text for a rich-field delta; never takes an arbitrary head-only excerpt. */
export function richChangeValues(before: string, after: string, modus: "anhaengen" | "ersetzen") {
  if (modus === "anhaengen") {
    return {
      oldValue: before ? tailExcerpt(before) : "(leer)",
      oldCaption: before.length > RICH_EXCERPT ? "bisher (letzte 500 Zeichen)" : "bisher",
      newValue: abbreviated(after), newCaption: "wird angehängt",
    };
  }
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix
    && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix += 1;
  const context = 200;
  const excerpt = (value: string) => {
    const start = Math.max(0, prefix - context);
    const end = Math.min(value.length - suffix + context, value.length);
    const body = abbreviated(value.slice(start, end));
    return `${start ? `… (${start} Zeichen davor unverändert)\n` : ""}${body}${end < value.length ? `\n(${value.length - end} Zeichen danach unverändert) …` : ""}`;
  };
  return { oldValue: excerpt(before), oldCaption: "bisher", newValue: excerpt(after), newCaption: "neu" };
}

/** The last `RICH_EXCERPT` characters, marked with „…“ when shortened. */
export function tailExcerpt(value: string) {
  return value.length > RICH_EXCERPT ? `…${value.slice(-RICH_EXCERPT)}` : value;
}

/** The first `RICH_EXCERPT` characters, marked with „…“ when shortened. */
export function headExcerpt(value: string) {
  return value.length > RICH_EXCERPT ? `${value.slice(0, RICH_EXCERPT)}…` : value;
}
