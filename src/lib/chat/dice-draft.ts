import { ALLOWED_SIDES, MAX_DICE_TERMS, type StructuredDiceTerm } from "./dice-format";

export type DiceDraft = {
  terms: StructuredDiceTerm[];
  modifier: number;
};

export const DEFAULT_DICE_DRAFT: DiceDraft = {
  terms: [{ n: 1, m: 20 }],
  modifier: 0,
};

const MIN_COUNT = 1;
const MAX_COUNT = 20;
const MIN_MODIFIER = -99;
const MAX_MODIFIER = 99;

function clampCount(value: number): number {
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, value));
}

function clampModifier(value: number): number {
  return Math.min(MAX_MODIFIER, Math.max(MIN_MODIFIER, value));
}

function withTerm(
  draft: DiceDraft,
  index: number,
  patch: Partial<StructuredDiceTerm>,
): DiceDraft {
  if (index < 0 || index >= draft.terms.length) return draft;
  return {
    ...draft,
    terms: draft.terms.map((term, i) => (i === index ? { ...term, ...patch } : term)),
  };
}

export function addTerm(draft: DiceDraft): DiceDraft {
  if (draft.terms.length >= MAX_DICE_TERMS) return draft;
  return { ...draft, terms: [...draft.terms, { n: 1, m: 4 }] };
}

export function removeTerm(draft: DiceDraft, index: number): DiceDraft {
  if (index <= 0 || index >= draft.terms.length) return draft;
  return { ...draft, terms: draft.terms.filter((_, i) => i !== index) };
}

export function setTermCount(draft: DiceDraft, index: number, n: number): DiceDraft {
  return withTerm(draft, index, { n: clampCount(n) });
}

export function setTermSides(draft: DiceDraft, index: number, m: number): DiceDraft {
  if (!(ALLOWED_SIDES as readonly number[]).includes(m)) return draft;
  return withTerm(draft, index, { m });
}

export function setModifier(draft: DiceDraft, modifier: number): DiceDraft {
  return { ...draft, modifier: clampModifier(modifier) };
}

/** Parses a typed stepper value (inline edit): whole number, optional leading minus
 * (ASCII or U+2212). Returns null for empty or invalid input; clamping is left to the setters. */
export function parseDraftInt(text: string): number | null {
  const match = /^\s*([-\u2212]?)(\d{1,4})\s*$/.exec(text);
  if (!match) return null;
  const value = Number(match[2]);
  return match[1] && value !== 0 ? -value : value;
}

export type RollPayload = {
  terms: StructuredDiceTerm[];
  modifier: number;
};

export type RollResult =
  | { ok: true; posted: true }
  | { ok: true; posted: false; text: string; sum: number }
  | { ok: false; error: string };

export function toRollPayload(draft: DiceDraft): RollPayload {
  return { terms: draft.terms, modifier: draft.modifier };
}
