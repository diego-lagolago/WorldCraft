import { describe, expect, it } from "vitest";
import {
  fieldsFor,
  labelFor,
  templateFieldsFor,
  writeKeyForLabel,
  writeKeyTable,
} from "./field-catalog";
import { TEMPLATES } from "@/lib/templates/registry";
import { MCP_QUEST_STATUS } from "./enums";
import { MCP_SHEET_FIELDS, SHEET_KEY_MAP } from "./write-fields";

describe("MCP field catalog", () => {
  it("derives item template fields and their labels from the registry", () => {
    const fields = templateFieldsFor("item");
    expect(fields.find((field) => field.label === "Art")?.allowedValues?.map((value) => value.label)).toContain("Waffe");
    expect(fields.find((field) => field.label === "Seltenheit")?.allowedValues?.map((value) => value.label)).toEqual([
      "Gewöhnlich", "Ungewöhnlich", "Selten", "Episch", "Legendär",
    ]);
    expect(fields.find((field) => field.label === "Besitzer")?.referenceTargets).toEqual(["artikel:person", "charakter"]);
    expect(fields.find((field) => field.label === "Quest-Gegenstand")?.type).toBe("boolean");
  });

  it("lists exactly the writable note field and maps labels back to write keys", () => {
    expect(fieldsFor("aendern", "notizblock").map((field) => field.key)).toEqual(["text"]);
    expect(writeKeyTable("monster")).toEqual(expect.arrayContaining([
      { label: "Gefahrenstufe", key: "gefahr" },
      { label: "Makel", key: "charakterblatt.schwaechen" },
    ]));
    expect(writeKeyForLabel("monster", "gefahrenstufe")).toBe("gefahr");
  });

  it("uses German labels for stored enum values", () => {
    const rarity = templateFieldsFor("item").find((field) => field.label === "Seltenheit");
    expect(rarity).toBeDefined();
    expect(labelFor(rarity!, "common")).toBe("Gewöhnlich");
  });

  it("keeps the sheet, quest status and template registry mappings in sync", () => {
    const expectedSheet = {
      klasse: "class", attribute: "attributes", uebungsbonus: "proficiencyBonus", fertigkeiten: "skills",
      faehigkeiten: "abilities", persoenlichkeit: "personality", ideale: "ideals", bindungen: "bonds", schwaechen: "flaws",
    };
    for (const entry of MCP_SHEET_FIELDS) expect(SHEET_KEY_MAP[entry.key]).toBe(expectedSheet[entry.key]);
    expect(Object.keys(MCP_QUEST_STATUS)).toHaveLength(4);
    for (const definition of Object.values(TEMPLATES)) {
      expect(templateFieldsFor(definition.type).map((field) => field.label))
        .toEqual(definition.fields.map((field) => field.type === "boolean" && field.key === "quest" ? "Quest-Gegenstand" : field.label));
    }
  });
});
