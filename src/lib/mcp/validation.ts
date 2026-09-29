import { z } from "zod";
import { allowedList } from "./errors";
import { writeKeyHints, type FieldArt } from "./field-catalog";

/** Shared German validation texts for MCP tools (Plan 012 T-005). */

type Issue = z.core.$ZodIssue;
type RawIssue = { input?: unknown; errors?: Issue[][] };

export { allowedList };

export function joinPath(base: string, path: readonly PropertyKey[] = []): string {
  return [base, ...path.map(String)].filter(Boolean).join(".");
}

function enumMessage(path: string, input: unknown, values: readonly string[]) {
  const problem = input === undefined ? "fehlt" : `hat den ungültigen Wert „${String(input)}“`;
  return `Feld „${path}“ ${problem}. Erlaubte Werte: ${allowedList(values)}.`;
}

/** Fixed MCP enum (E5): the SDK validates it and returns our German text with path and values. */
export function mcpEnum<const T extends readonly [string, ...string[]]>(values: T, path: string) {
  return z.enum(values, { error: (issue) => enumMessage(path, (issue as RawIssue).input, values) });
}

/** Names the write key when a client sent an Anzeige-Label or a known mistaken key (E6). */
export function writeKeyHint(key: string, arts: readonly FieldArt[]): string {
  const hints = writeKeyHints(key, arts);
  if (!hints.length) return "";
  const targets = hints
    .map((hint) => `\`${hint.writeKey}\`${arts.length > 1 ? ` (bei art = ${hint.art})` : ""}`)
    .join(", ");
  return hints.some((hint) => hint.isLabel)
    ? ` „${key}“ ist ein Anzeige-Label; der Schreibschlüssel ist ${targets}.`
    : ` Statt „${key}“ bitte den Schreibschlüssel ${targets} verwenden.`;
}

export type IssueContext = {
  /** Path prefix of the validated value, e.g. `felder`. */
  base: string;
  /** Content arts used for write-key hints on unknown keys. */
  arts?: readonly FieldArt[];
  /** Valid keys of the validated object, listed after unknown keys. */
  validKeys?: readonly string[];
};

const TYPE_TEXT: Record<string, string> = {
  boolean: "true oder false",
  string: "Text",
  number: "eine Zahl",
  array: "eine Liste",
  object: "ein Objekt",
};

/** All texts produced here start with one of these; Zod's own texts never do (Review 012 CR-003). */
const OWN_PREFIXES = ["Feld „", "Unbekanntes Feld „", "Die Schlüssel in „"];

function isOwnMessage(issue: Issue) {
  return OWN_PREFIXES.some((prefix) => issue.message.startsWith(prefix));
}

const NO_INPUT = Symbol("no input");

/** German text for one value issue; `input` is only known inside a schema's error function. */
function valueIssueText(issue: Issue, path: string, input: unknown): string {
  switch (issue.code) {
  case "invalid_type":
    if (input === undefined) return `Feld „${path}“ fehlt.`;
    return input === NO_INPUT
      ? `Feld „${path}“ fehlt oder ist nicht ${TYPE_TEXT[issue.expected] ?? issue.expected}.`
      : `Feld „${path}“ muss ${TYPE_TEXT[issue.expected] ?? issue.expected} sein.`;
  case "invalid_value":
    return `Feld „${path}“ hat einen ungültigen Wert. Erlaubte Werte: ${allowedList(issue.values.map(String))}.`;
  case "too_small":
    return issue.origin === "string"
      ? `Feld „${path}“ darf nicht leer sein.`
      : `Feld „${path}“ muss mindestens ${String(issue.minimum)} sein.`;
  case "too_big":
    return issue.origin === "string"
      ? `Feld „${path}“ ist zu lang (höchstens ${String(issue.maximum)} Zeichen).`
      : `Feld „${path}“ darf höchstens ${String(issue.maximum)} sein.`;
  case "invalid_format":
    return issue.format === "uuid" ? `Feld „${path}“ muss eine gültige ID (UUID) sein.` : `Feld „${path}“ hat kein gültiges Format.`;
  default:
    return `Feld „${path}“ ist ungültig.`;
  }
}

/**
 * Zod `error` option for a catalog field: Zod passes the raw issue including the input, so
 * „fehlt“ and type errors are told apart without relying on Zod's English texts.
 */
export function germanError(path: string) {
  return (raw: unknown) => {
    const issue = raw as Issue & RawIssue;
    // The raw issue's path may already contain the field key; the given path is authoritative.
    return valueIssueText(issue, path, "input" in issue ? issue.input : NO_INPUT);
  };
}

/** Formats one Zod issue as a German tool error part with field path and allowed values. */
export function issueMessage(issue: Issue, context: IssueContext): string {
  const path = joinPath(context.base, issue.path);
  if (issue.code !== "unrecognized_keys" && isOwnMessage(issue)) return issue.message;
  if (issue.code !== "unrecognized_keys") return valueIssueText(issue, path, NO_INPUT);
  const unknown = issue.keys
    .map((key) => `Unbekanntes Feld „${joinPath(path, [key])}“.${writeKeyHint(key, context.arts ?? [])}`)
    .join(" ");
  return context.validKeys?.length && !issue.path.length
    ? `${unknown} Gültige Felder: ${context.validKeys.join(", ")}.`
    : unknown;
}

export function issuesMessage(issues: readonly Issue[], context: IssueContext): string {
  return [...new Set(issues.map((issue) => issueMessage(issue, context)))].join(" ");
}

/**
 * Error for a union of strict objects (one per art or template type). The options whose keys fit
 * explain the problem; if no option knows a key, the key is unknown and the fallback lists all keys.
 */
export function unionError(base: string, arts: readonly FieldArt[], fallback: string) {
  return (raw: unknown) => {
    const options = (raw as RawIssue).errors ?? [];
    const rootUnknown = (option: Issue[]) => option
      .filter((issue) => issue.code === "unrecognized_keys" && issue.path.length === 0)
      .flatMap((issue) => (issue.code === "unrecognized_keys" ? issue.keys : []));
    const fitting = options.filter((option) => rootUnknown(option).length === 0);
    if (fitting.length) {
      const fewest = Math.min(...fitting.map((option) => option.length));
      return issuesMessage(fitting.filter((option) => option.length === fewest).flat(), { base, arts });
    }
    const unknownEverywhere = options.map(rootUnknown)
      .reduce((common, keys) => common.filter((key) => keys.includes(key)));
    const unknown = unknownEverywhere
      .map((key) => `Unbekanntes Feld „${joinPath(base, [key])}“.${writeKeyHint(key, arts)}`)
      .join(" ");
    return `${unknown || `Die Schlüssel in „${base}“ passen zu keiner einzelnen Variante.`} ${fallback}`;
  };
}
