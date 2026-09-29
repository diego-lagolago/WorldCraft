import { describe, expect, it } from "vitest";
import {
  MCP_WRITE_ENUMS_COMPLETE,
  mapMonsterDanger,
  mapMonsterKind,
  mapMonsterRarity,
  mapMonsterSize,
  normalizeMonsterSheet,
  normalizeTemplateFieldsInput,
  requiredMonsterEnum,
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
    expect(() => normalizeTemplateFieldsInput("person", { Unbekannt: "x" })).toThrow("Unbekanntes Feld „felder.vorlagenfelder.Unbekannt“. Gültige Vorlagenfelder für diesen Vorlagentyp:");
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

  it("012 T-005: invalid template values name the path and all allowed labels", () => {
    expect(() => normalizeTemplateFieldsInput("item", { Seltenheit: "super selten" }))
      .toThrow(/Feld „felder\.vorlagenfelder\.Seltenheit“ hat den ungültigen Wert „super selten“\. Erlaubte Werte: Gewöhnlich, .*Legendär/);
    expect(() => mapMonsterDanger("ungefährlich-ish")).toThrow(/Feld „felder\.gefahr“ .* Erlaubte Werte:/);
  });

  it("011 Review 2 CR-001: an empty monster select value is an error with path and allowed values", () => {
    expect(() => requiredMonsterEnum.gefahr("")).toThrow(/Feld „felder\.gefahr“ fehlt oder ist kein Text\. Erlaubte Werte: Harmlos/);
  });
});
