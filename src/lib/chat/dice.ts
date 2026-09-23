/** Server-side dice. The client shares only `dice-format.ts` (CR-021). */

import { randomInt } from "node:crypto";
import {
  ALLOWED_SIDES,
  formatDiceRoll,
  MAX_DICE_PER_TERM,
  MAX_DICE_TERMS,
  sumDiceTerms,
  type StoredDiceTerm,
  type StructuredRoll,
} from "./dice-format";

export {
  ALLOWED_SIDES,
  formatDiceRoll,
  formatStructuredPreview,
  MAX_DICE_PER_TERM,
  MAX_DICE_TERMS,
  sumDiceTerms,
} from "./dice-format";
export type { StoredDiceTerm, StructuredDiceTerm, StructuredRoll } from "./dice-format";

export type AllowedSides = (typeof ALLOWED_SIDES)[number];

const ALLOWED_SIDES_SET = new Set<number>(ALLOWED_SIDES);
const DICE_RE = /^(\d+)d(\d+)/i;
const INT_RE = /^(\d+)/;

export type DiceTerm =
  | { kind: "dice"; count: number; sides: number; sign: 1 | -1 }
  | { kind: "mod"; value: number };

export type ParseOk = { ok: true; expression: string; terms: DiceTerm[] };
export type ParseErr = { ok: false; error: string };
export type ParseResult = ParseOk | ParseErr;

export type RolledDice = {
  expression: string;
  terms: StoredDiceTerm[];
  sum: number;
};

function invalidSyntax(): ParseErr {
  return {
    ok: false,
    error: "Ungültiger Würfelausdruck. Beispiele: 2d6, 2d6+3, 1d20+1d4+2.",
  };
}

function formatExpression(terms: DiceTerm[]): string {
  return terms
    .map((term, index) => {
      if (term.kind === "dice") {
        const core = `${term.count}d${term.sides}`;
        if (index === 0) return term.sign === -1 ? `-${core}` : core;
        return term.sign === -1 ? `-${core}` : `+${core}`;
      }
      const abs = Math.abs(term.value);
      if (index === 0) return term.value < 0 ? `-${abs}` : `${abs}`;
      return term.value < 0 ? `-${abs}` : `+${abs}`;
    })
    .join("");
}

export function isAllowedSides(value: number): value is AllowedSides {
  return ALLOWED_SIDES_SET.has(value);
}

export function parseDiceExpression(raw: string): ParseResult {
  const compact = raw.replace(/\s+/g, "");
  if (!compact) return { ok: false, error: "Einen Würfelausdruck angeben, z. B. 2d6+3." };

  let rest = /^[+-]/.test(compact) ? compact : `+${compact}`;
  const terms: DiceTerm[] = [];

  while (rest.length > 0) {
    const signChar = rest[0];
    if (signChar !== "+" && signChar !== "-") return invalidSyntax();
    const sign: 1 | -1 = signChar === "-" ? -1 : 1;
    rest = rest.slice(1);
    if (!rest) return invalidSyntax();

    const dice = rest.match(DICE_RE);
    if (dice) {
      const count = Number(dice[1]);
      const sides = Number(dice[2]);
      if (count < 1) return { ok: false, error: "Mindestens ein Würfel pro Term." };
      if (count > MAX_DICE_PER_TERM) return { ok: false, error: "Höchstens 100 Würfel pro Term." };
      if (!ALLOWED_SIDES_SET.has(sides)) {
        return {
          ok: false,
          error: `Ungültige Würfelseiten: ${sides}. Erlaubt sind 2, 4, 6, 8, 10, 12, 20 und 100.`,
        };
      }
      terms.push({ kind: "dice", count, sides, sign });
      rest = rest.slice(dice[0].length);
      continue;
    }

    const intMatch = rest.match(INT_RE);
    if (intMatch) {
      terms.push({ kind: "mod", value: sign * Number(intMatch[1]) });
      rest = rest.slice(intMatch[0].length);
      continue;
    }
    return invalidSyntax();
  }

  if (terms.length === 0) return invalidSyntax();
  if (!terms.some((term) => term.kind === "dice")) {
    return { ok: false, error: "Der Ausdruck braucht mindestens einen Würfel (z. B. 2d6)." };
  }
  return { ok: true, expression: formatExpression(terms), terms };
}

export function parseStructuredRoll(input: StructuredRoll): ParseResult {
  const terms = input.terms ?? [];
  if (terms.length < 1) return { ok: false, error: "Mindestens einen Würfel wählen." };
  if (terms.length > MAX_DICE_TERMS) {
    return { ok: false, error: `Höchstens ${MAX_DICE_TERMS} Würfelterme.` };
  }

  const parsedTerms: DiceTerm[] = [];
  for (const term of terms) {
    if (!Number.isInteger(term.n) || term.n < 1) {
      return { ok: false, error: "Mindestens ein Würfel pro Term." };
    }
    if (term.n > MAX_DICE_PER_TERM) return { ok: false, error: "Höchstens 100 Würfel pro Term." };
    if (!Number.isInteger(term.m) || !isAllowedSides(term.m)) {
      return {
        ok: false,
        error: `Ungültige Würfelseiten: ${term.m}. Erlaubt sind 2, 4, 6, 8, 10, 12, 20 und 100.`,
      };
    }
    parsedTerms.push({ kind: "dice", count: term.n, sides: term.m, sign: 1 });
  }

  const modifier = input.modifier ?? 0;
  if (!Number.isInteger(modifier) || Math.abs(modifier) > 999) {
    return { ok: false, error: "Der Bonus muss eine ganze Zahl zwischen −999 und 999 sein." };
  }
  if (modifier !== 0) parsedTerms.push({ kind: "mod", value: modifier });
  return { ok: true, expression: formatExpression(parsedTerms), terms: parsedTerms };
}

export function isRollCommand(body: string): boolean {
  return /^\s*\/roll(?:\s|$)/i.test(body);
}

export function extractRollExpression(body: string): string {
  return body.replace(/^\s*\/roll\s*/i, "");
}

export function rollTerms(parsed: ParseOk, randomFace: (sides: number) => number): RolledDice {
  const stored: StoredDiceTerm[] = [];
  for (const term of parsed.terms) {
    if (term.kind === "mod") {
      stored.push({ modifier: term.value });
      continue;
    }
    const values: number[] = [];
    for (let i = 0; i < term.count; i += 1) values.push(randomFace(term.sides));
    stored.push({ sides: term.sides, sign: term.sign, values });
  }
  return { expression: parsed.expression, terms: stored, sum: sumDiceTerms(stored) };
}

export function rollOnServer(parsed: ParseOk): RolledDice {
  return rollTerms(parsed, (sides) => randomInt(1, sides + 1));
}

export function formatRolled(rolled: RolledDice): string {
  return formatDiceRoll(rolled.expression, rolled.terms);
}
