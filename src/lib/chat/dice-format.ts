import { z } from "zod";

export const ALLOWED_SIDES = [2, 4, 6, 8, 10, 12, 20, 100] as const;
export const MAX_DICE_PER_TERM = 100;
export const MAX_DICE_TERMS = 6;

export type StructuredDiceTerm = { n: number; m: number };
export type StructuredRoll = { terms: StructuredDiceTerm[]; modifier?: number };

export function formatStructuredPreview(roll: StructuredRoll): string {
  const dice = roll.terms.map((term) => `${term.n}d${term.m}`).join("+");
  const modifier = roll.modifier ?? 0;
  if (modifier > 0) return `${dice}+${modifier}`;
  if (modifier < 0) return `${dice}${modifier}`;
  return dice;
}

/** One term of a stored roll. Dice faces stay grouped; modifiers are separate. */
export type StoredDiceTerm =
  | { sides: number; sign: 1 | -1; values: number[] }
  | { modifier: number };

const storedDiceTermSchema = z.union([
  z.object({
    sides: z.number().int(),
    sign: z.union([z.literal(1), z.literal(-1)]),
    values: z.array(z.number().int()),
  }),
  z.object({ modifier: z.number().int() }),
]);

export function parseStoredDiceTerms(value: unknown): StoredDiceTerm[] | null {
  const parsed = z.array(storedDiceTermSchema).safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Sum from the stored terms, never from a flat face list minus a guessed modifier. */
export function sumDiceTerms(terms: StoredDiceTerm[]): number {
  let sum = 0;
  for (const term of terms) {
    if ("modifier" in term) {
      sum += term.modifier;
      continue;
    }
    const faces = term.values.reduce((total, face) => total + face, 0);
    sum += term.sign * faces;
  }
  return sum;
}

/**
 * `<Ausdruck> → <Term> <op> <Term> = <Summe>`.
 * Dice terms are `[faces]`, modifiers are bare numbers, operators are ` + ` / ` − `.
 */
export function formatDiceRoll(expression: string, terms: StoredDiceTerm[]): string {
  const mid = terms
    .map((term, index) => {
      const negative = "modifier" in term ? term.modifier < 0 : term.sign < 0;
      const text =
        "modifier" in term
          ? String(Math.abs(term.modifier))
          : `[${term.values.join(", ")}]`;
      if (index === 0) return negative ? `− ${text}` : text;
      return `${negative ? "−" : "+"} ${text}`;
    })
    .join(" ");
  return `${expression} → ${mid} = ${sumDiceTerms(terms)}`;
}
