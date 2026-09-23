import { describe, expect, it } from "vitest";
import {
  DEFAULT_DICE_DRAFT,
  addTerm,
  parseDraftInt,
  removeTerm,
  setModifier,
  setTermCount,
  setTermSides,
  toRollPayload,
} from "./dice-draft";

describe("dice-draft", () => {
  it("adds a 1d4 term and refuses a seventh", () => {
    let draft = DEFAULT_DICE_DRAFT;
    draft = addTerm(draft);
    expect(draft.terms).toEqual([
      { n: 1, m: 20 },
      { n: 1, m: 4 },
    ]);
    for (let i = 0; i < 4; i += 1) draft = addTerm(draft);
    expect(draft.terms).toHaveLength(6);
    expect(addTerm(draft)).toBe(draft);
  });

  it("removes term 2+ but keeps term 1", () => {
    const two = addTerm(DEFAULT_DICE_DRAFT);
    expect(removeTerm(two, 0)).toBe(two);
    expect(removeTerm(two, 1).terms).toEqual([{ n: 1, m: 20 }]);
  });

  it("clamps count to 1–20 and bonus to −99…99", () => {
    expect(setTermCount(DEFAULT_DICE_DRAFT, 0, 0).terms[0]?.n).toBe(1);
    expect(setTermCount(DEFAULT_DICE_DRAFT, 0, 21).terms[0]?.n).toBe(20);
    expect(setModifier(DEFAULT_DICE_DRAFT, -100).modifier).toBe(-99);
    expect(setModifier(DEFAULT_DICE_DRAFT, 100).modifier).toBe(99);
  });

  it("ignores invalid sides and builds the roll payload", () => {
    expect(setTermSides(DEFAULT_DICE_DRAFT, 0, 7)).toBe(DEFAULT_DICE_DRAFT);
    const withSides = setTermSides(DEFAULT_DICE_DRAFT, 0, 6);
    expect(withSides.terms[0]?.m).toBe(6);
    const draft = setModifier(addTerm(DEFAULT_DICE_DRAFT), 2);
    expect(toRollPayload(draft)).toEqual({
      terms: [
        { n: 1, m: 20 },
        { n: 1, m: 4 },
      ],
      modifier: 2,
    });
  });

  it("parses typed stepper values for inline editing", () => {
    expect(parseDraftInt("7")).toBe(7);
    expect(parseDraftInt(" 12 ")).toBe(12);
    expect(parseDraftInt("-5")).toBe(-5);
    expect(parseDraftInt("\u22123")).toBe(-3);
    expect(parseDraftInt("-0")).toBe(0);
    expect(parseDraftInt("")).toBeNull();
    expect(parseDraftInt("-")).toBeNull();
    expect(parseDraftInt("1.5")).toBeNull();
    expect(parseDraftInt("abc")).toBeNull();
    expect(parseDraftInt("12345")).toBeNull();
  });

  it("clamps typed values through the setters", () => {
    expect(setTermCount(DEFAULT_DICE_DRAFT, 0, parseDraftInt("50")!).terms[0]?.n).toBe(20);
    expect(setTermCount(DEFAULT_DICE_DRAFT, 0, parseDraftInt("0")!).terms[0]?.n).toBe(1);
    expect(setModifier(DEFAULT_DICE_DRAFT, parseDraftInt("-150")!).modifier).toBe(-99);
  });
});
