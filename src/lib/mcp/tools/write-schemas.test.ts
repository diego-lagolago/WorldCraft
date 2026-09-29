import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import { createFieldSchemas, createFieldsInput, parseFelder, updateFieldSchemas } from "./write-schemas";

describe("MCP write field schemas", () => {
  it("CR-011: derived create and update schemas stay strict", () => {
    const questId = "00000000-0000-4000-8000-000000000000";
    expect(createFieldSchemas.kapitel.safeParse({ quest_id: questId, titel: "x", fremd: 1 }).success).toBe(false);
    expect(updateFieldSchemas.artikel.safeParse({ unbekannt: "x" }).success).toBe(false);
    expect(updateFieldSchemas.kapitel.safeParse({ quest_id: questId }).success).toBe(false);
    expect(updateFieldSchemas.welt.safeParse({ name: "Neu" }).success).toBe(true);
  });

  it("CR-017: names unknown and invalid fields in a tool error", () => {
    expect(() => parseFelder(updateFieldSchemas.artikel, { unbekannt: "x" })).toThrow("Unbekanntes Feld „unbekannt“.");
    expect(() => parseFelder(updateFieldSchemas.artikel, { sichtbarkeit: "veröffentlicht" })).toThrow("„sichtbarkeit“");
    expect(() => parseFelder(updateFieldSchemas.quest, { status: "egal" })).toThrow("Feld „status“ ist ungültig.");
  });

  it("exposes strict catalog-derived field objects as an anyOf schema", () => {
    const json = z.toJSONSchema(createFieldsInput) as { anyOf: { additionalProperties?: boolean; description?: string }[] };
    expect(json.anyOf).toHaveLength(5);
    expect(json.anyOf.every((entry) => entry.additionalProperties === false)).toBe(true);
    expect(json.anyOf.map((entry) => entry.description)).toContain("Felder für art = artikel.");
  });
});
