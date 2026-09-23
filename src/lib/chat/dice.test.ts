import { describe, expect, it } from "vitest";
import { formatDiceRoll } from "./dice-format";
import { parseDiceExpression, rollTerms } from "./dice";

function rollFixed(expression: string, faces: number[]) {
  const parsed = parseDiceExpression(expression);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error("parse");
  let index = 0;
  return rollTerms(parsed, () => faces[index++] ?? 1);
}

describe("formatDiceRoll", () => {
  it("groups faces per term for the three reference rolls", () => {
    const negative = rollFixed("1d20-1d4", [15, 3]);
    expect(formatDiceRoll(negative.expression, negative.terms)).toBe("1d20-1d4 → [15] − [3] = 12");

    const modifier = rollFixed("2d6+3", [4, 2]);
    expect(formatDiceRoll(modifier.expression, modifier.terms)).toBe("2d6+3 → [4, 2] + 3 = 9");

    const multi = rollFixed("1d20+1d4+2", [11, 2]);
    expect(formatDiceRoll(multi.expression, multi.terms)).toBe("1d20+1d4+2 → [11] + [2] + 2 = 15");
  });
});

describe("parseDiceExpression", () => {
  it("rejects 2d7 without rolling", () => {
    const parsed = parseDiceExpression("2d7");
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/7/);
  });
});
