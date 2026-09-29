import { describe, expect, it } from "vitest";
import {
  assertFieldCatalogComplete,
  fieldsFor,
  labelFor,
  templateFieldsFor,
  writeKeyForLabel,
  writeKeyTable,
} from "./field-catalog";
import { TEMPLATES } from "@/lib/templates/registry";

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

  it("rejects a simulated registry field that lacks a catalog entry", () => {
    const templates = structuredClone(TEMPLATES);
    templates.item.fields = [...templates.item.fields, { key: "new", label: "Neu", type: "text" }];
    expect(() => assertFieldCatalogComplete(templates)).toThrow("Feldkatalog fehlt Vorlagenfeld: Neu");
  });
});
