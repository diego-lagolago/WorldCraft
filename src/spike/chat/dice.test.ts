import { describe, expect, it } from "vitest";
import {
  extractRollExpression,
  formatCompactRoll,
  isRollCommand,
  parseDiceExpression,
  parseStructuredRoll,
  rollOnServer,
  rollTerms,
} from "./dice";
import { formatStructuredPreview } from "./dice-sides";

describe("parseDiceExpression", () => {
  it("parses NdM, NdM+K, NdM-K and multiple terms", () => {
    const plus = parseDiceExpression("2d6+3");
    expect(plus.ok).toBe(true);
    if (!plus.ok) return;
    expect(plus.expression).toBe("2d6+3");
    expect(plus.terms).toEqual([
      { kind: "dice", count: 2, sides: 6, sign: 1 },
      { kind: "mod", value: 3 },
    ]);

    const minus = parseDiceExpression("2d6-1");
    expect(minus.ok).toBe(true);
    if (!minus.ok) return;
    expect(minus.expression).toBe("2d6-1");

    const multi = parseDiceExpression("1d20 + 1d4 + 2");
    expect(multi.ok).toBe(true);
    if (!multi.ok) return;
    expect(multi.expression).toBe("1d20+1d4+2");
  });

  it("rejects invalid sides such as 2d7", () => {
    const parsed = parseDiceExpression("2d7");
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/7/);
    expect(parsed.error).toMatch(/2, 4, 6, 8, 10, 12, 20 und 100/);
  });

  it("rejects N > 100 and missing dice", () => {
    const tooMany = parseDiceExpression("101d20");
    expect(tooMany.ok).toBe(false);

    const onlyMod = parseDiceExpression("3");
    expect(onlyMod.ok).toBe(false);

    const empty = parseDiceExpression("   ");
    expect(empty.ok).toBe(false);
  });
});

describe("parseStructuredRoll", () => {
  it("accepts picker terms plus optional modifier", () => {
    const parsed = parseStructuredRoll({
      terms: [{ n: 2, m: 6 }],
      modifier: 3,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.expression).toBe("2d6+3");
    expect(formatStructuredPreview({ terms: [{ n: 2, m: 6 }], modifier: 3 })).toBe("2d6+3");
  });

  it("rejects illegal sides such as 7", () => {
    const parsed = parseStructuredRoll({ terms: [{ n: 2, m: 7 }] });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/7/);
  });
});

describe("/roll command", () => {
  it("detects /roll case-insensitively and extracts the expression", () => {
    expect(isRollCommand("/roll 2d6+3")).toBe(true);
    expect(isRollCommand("  /ROLL 1d20")).toBe(true);
    expect(isRollCommand("hello")).toBe(false);
    expect(extractRollExpression("/roll 2d6+3")).toBe("2d6+3");
  });
});

describe("rollTerms", () => {
  it("stores per-die faces and sums modifiers", () => {
    const parsed = parseDiceExpression("2d6+3");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const faces = [4, 2];
    const rolled = rollTerms(parsed, () => faces.shift() ?? 0);
    expect(rolled.values).toEqual([4, 2]);
    expect(rolled.sum).toBe(9);
    expect(rolled.expression).toBe("2d6+3");
  });

  it("applies a minus modifier", () => {
    const parsed = parseDiceExpression("2d6-1");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const faces = [6, 6];
    const rolled = rollTerms(parsed, () => faces.shift() ?? 0);
    expect(rolled.sum).toBe(11);
  });
});

describe("formatCompactRoll", () => {
  it("prints expression, faces, modifier and sum", () => {
    const parsed = parseDiceExpression("2d6+3");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const faces = [4, 2];
    const rolled = rollTerms(parsed, () => faces.shift() ?? 0);
    expect(formatCompactRoll(parsed, rolled)).toBe("2d6+3 → 4, 2 + 3 = 9");
  });
});

describe("rollOnServer", () => {
  it("returns faces in 1..M and a matching sum", () => {
    const parsed = parseDiceExpression("2d6+3");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const rolled = rollOnServer(parsed);
    expect(rolled.values.length).toBe(2);
    for (const face of rolled.values) {
      expect(face >= 1 && face <= 6).toBeTruthy();
    }
    expect(rolled.sum).toBe(rolled.values[0] + rolled.values[1] + 3);
  });
});
