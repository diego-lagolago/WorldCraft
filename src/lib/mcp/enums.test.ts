import { describe, expect, it } from "vitest";
import { MCP_ENUMS_COMPLETE, MCP_QUEST_STATUS, MCP_QUEST_STATUS_LABEL } from "./enums";
import { unionError } from "./validation";

describe("MCP enum mappings", () => {
  it("covers every exposed database enum in both directions", () => {
    expect(MCP_ENUMS_COMPLETE).toEqual({
      templateTypes: true,
      monsterKinds: true,
      monsterRarities: true,
      questStatuses: true,
    });
    for (const [label, value] of Object.entries(MCP_QUEST_STATUS)) {
      expect(MCP_QUEST_STATUS_LABEL[value]).toBe(label);
    }
  });
});

describe("unionError", () => {
  it("returns the fallback for absent or empty union errors", () => {
    const error = unionError("felder", [], "X");
    expect(error({})).toMatch(/^Die Schlüssel in „felder“/);
    expect(error({ errors: [] })).toMatch(/^Die Schlüssel in „felder“/);
  });
});
