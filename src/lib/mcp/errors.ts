/** Tool-facing errors shown as German MCP text responses. */
export class McpToolError extends Error {}

const MAX_LISTED_VALUES = 20;

/** Allowed values for an error text: at most 20, then „…“ (Plan 012 T-005). */
export function allowedList(values: readonly string[]): string {
  const shown = values.slice(0, MAX_LISTED_VALUES).join(", ");
  return values.length > MAX_LISTED_VALUES ? `${shown}, …` : shown;
}
