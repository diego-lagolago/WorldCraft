import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractRollExpression,
  formatCompactRoll,
  isRollCommand,
  parseDiceExpression,
  parseStructuredRoll,
  rollOnServer,
  rollTerms,
} from "./dice.ts";
import { formatStructuredPreview } from "./dice-sides.ts";

describe("parseDiceExpression", () => {
  it("parses NdM, NdM+K, NdM-K and multiple terms", () => {
    const plus = parseDiceExpression("2d6+3");
    assert.equal(plus.ok, true);
    if (!plus.ok) return;
    assert.equal(plus.expression, "2d6+3");
    assert.deepEqual(plus.terms, [
      { kind: "dice", count: 2, sides: 6, sign: 1 },
      { kind: "mod", value: 3 },
    ]);

    const minus = parseDiceExpression("2d6-1");
    assert.equal(minus.ok, true);
    if (!minus.ok) return;
    assert.equal(minus.expression, "2d6-1");

    const multi = parseDiceExpression("1d20 + 1d4 + 2");
    assert.equal(multi.ok, true);
    if (!multi.ok) return;
    assert.equal(multi.expression, "1d20+1d4+2");
  });

  it("rejects invalid sides such as 2d7", () => {
    const parsed = parseDiceExpression("2d7");
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.match(parsed.error, /7/);
    assert.match(parsed.error, /2, 4, 6, 8, 10, 12, 20 und 100/);
  });

  it("rejects N > 100 and missing dice", () => {
    const tooMany = parseDiceExpression("101d20");
    assert.equal(tooMany.ok, false);

    const onlyMod = parseDiceExpression("3");
    assert.equal(onlyMod.ok, false);

    const empty = parseDiceExpression("   ");
    assert.equal(empty.ok, false);
  });
});

describe("parseStructuredRoll", () => {
  it("accepts picker terms plus optional modifier", () => {
    const parsed = parseStructuredRoll({
      terms: [{ n: 2, m: 6 }],
      modifier: 3,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.expression, "2d6+3");
    assert.equal(formatStructuredPreview({ terms: [{ n: 2, m: 6 }], modifier: 3 }), "2d6+3");
  });

  it("rejects illegal sides such as 7", () => {
    const parsed = parseStructuredRoll({ terms: [{ n: 2, m: 7 }] });
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.match(parsed.error, /7/);
  });
});

describe("/roll command", () => {
  it("detects /roll case-insensitively and extracts the expression", () => {
    assert.equal(isRollCommand("/roll 2d6+3"), true);
    assert.equal(isRollCommand("  /ROLL 1d20"), true);
    assert.equal(isRollCommand("hello"), false);
    assert.equal(extractRollExpression("/roll 2d6+3"), "2d6+3");
  });
});

describe("rollTerms", () => {
  it("stores per-die faces and sums modifiers", () => {
    const parsed = parseDiceExpression("2d6+3");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const faces = [4, 2];
    const rolled = rollTerms(parsed, () => faces.shift() ?? 0);
    assert.deepEqual(rolled.values, [4, 2]);
    assert.equal(rolled.sum, 9);
    assert.equal(rolled.expression, "2d6+3");
  });

  it("applies a minus modifier", () => {
    const parsed = parseDiceExpression("2d6-1");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const faces = [6, 6];
    const rolled = rollTerms(parsed, () => faces.shift() ?? 0);
    assert.equal(rolled.sum, 11);
  });
});

describe("formatCompactRoll", () => {
  it("prints expression, faces, modifier and sum", () => {
    const parsed = parseDiceExpression("2d6+3");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const faces = [4, 2];
    const rolled = rollTerms(parsed, () => faces.shift() ?? 0);
    assert.equal(formatCompactRoll(parsed, rolled), "2d6+3 → 4, 2 + 3 = 9");
  });
});

describe("rollOnServer", () => {
  it("returns faces in 1..M and a matching sum", () => {
    const parsed = parseDiceExpression("2d6+3");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const rolled = rollOnServer(parsed);
    assert.equal(rolled.values.length, 2);
    for (const face of rolled.values) {
      assert.ok(face >= 1 && face <= 6);
    }
    assert.equal(rolled.sum, rolled.values[0] + rolled.values[1] + 3);
  });
});
