/** Spike T-010 — erlaubte Würfel, client- und serverseitig. */

export const ALLOWED_SIDES = [2, 4, 6, 8, 10, 12, 20, 100] as const;
export type AllowedSides = (typeof ALLOWED_SIDES)[number];

export const MAX_DICE_PER_TERM = 100;
export const MAX_DICE_TERMS = 6;

export function isAllowedSides(value: number): value is AllowedSides {
  return (ALLOWED_SIDES as readonly number[]).includes(value);
}

export type StructuredDiceTerm = {
  n: number;
  m: number;
};

export type StructuredRoll = {
  terms: StructuredDiceTerm[];
  modifier?: number;
};

export function formatCompactFromDto(dice: {
  expression: string;
  values: number[];
  sum: number;
}): string {
  const faces = dice.values.join(", ");
  const modifier = dice.sum - dice.values.reduce((total, face) => total + face, 0);
  let mid = faces;
  if (modifier > 0) mid += ` + ${modifier}`;
  if (modifier < 0) mid += ` − ${Math.abs(modifier)}`;
  return `${dice.expression} → ${mid} = ${dice.sum}`;
}

export function formatStructuredPreview(roll: StructuredRoll): string {
  const dice = roll.terms.map((term) => `${term.n}d${term.m}`).join("+");
  const modifier = roll.modifier ?? 0;
  if (modifier > 0) return `${dice}+${modifier}`;
  if (modifier < 0) return `${dice}${modifier}`;
  return dice;
}
