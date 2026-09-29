import { describe, expect, it } from "vitest";
import {
  MCP_WRITE_ENUMS_COMPLETE,
  mapMonsterDanger,
  mapMonsterKind,
  mapMonsterRarity,
  mapMonsterSize,
  normalizeMonsterSheet,
  normalizeTemplateFieldsInput,
} from "./write-fields";

describe("MCP write field mapping", () => {
  it("keeps German and English enum coverage complete", () => {
    expect(MCP_WRITE_ENUMS_COMPLETE).toEqual({
      kinds: true,
      rarities: true,
      dangers: true,
      sizes: true,
      skillLevels: true,
    });
  });

  it("accepts German labels and English keys for template fields", () => {
    const fields = normalizeTemplateFieldsInput("person", {
      Rasse: "@[Elf]",
      status: "lebendig",
      occupation: "Hauptmann",
    });
    expect(fields).toMatchObject({
      race: "@[Elf]",
      status: "alive",
      occupation: "Hauptmann",
    });
  });

  it("rejects unknown template field keys", () => {
    expect(() => normalizeTemplateFieldsInput("person", { Unbekannt: "x" })).toThrow("Unbekanntes Vorlagenfeld");
  });

  it("maps monster enums and character sheet fields from German labels", () => {
    expect(mapMonsterKind("Bestie")).toBe("beast");
    expect(mapMonsterRarity("Selten")).toBe("rare");
    expect(mapMonsterDanger("Tödlich")).toBe("deadly");
    expect(mapMonsterSize("Groß")).toBe("large");
    expect(normalizeMonsterSheet({
      klasse: "Krieger",
      attribute: { Stärke: 16, GES: 14 },
      Übungsbonus: 3,
      fertigkeiten: [{ name: "Athletik", stufe: "geübt", attribut: "STÄ" }],
      fähigkeiten: [{ text: "Sprint", attribut: "Geschicklichkeit" }],
      persönlichkeit: "hart",
    })).toMatchObject({
      class: "Krieger",
      attributes: { str: 16, dex: 14 },
      proficiencyBonus: 3,
      skills: [{ name: "Athletik", level: "trained", attr: "str" }],
      abilities: [{ text: "Sprint", attr: "dex" }],
      personality: "hart",
    });
  });
});
