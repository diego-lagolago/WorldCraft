import { describe, expect, it } from "vitest";
import {
  EMPTY_ATTRIBUTES,
  abilitiesSchema,
  attributeModifier,
  firstDuplicate,
  formatSigned,
  readSkills,
  skillBonus,
  skillsSchema,
} from "./sheet";

describe("attributeModifier", () => {
  it("rounds down and treats empty as 0", () => {
    expect(attributeModifier(10)).toBe(0);
    expect(attributeModifier(11)).toBe(0);
    expect(attributeModifier(9)).toBe(-1);
    expect(attributeModifier(1)).toBe(-5);
    expect(attributeModifier(30)).toBe(10);
    expect(attributeModifier(null)).toBe(0);
  });
});

describe("skillBonus (datenmodell 3.8.1)", () => {
  const attributes = { ...EMPTY_ATTRIBUTES, dex: 17, cha: 9 };

  it("adds −4 / −2 / +prof / +2×prof to the modifier (T-008 (4a): GES 17, Übungsbonus 2)", () => {
    expect(skillBonus({ level: "untalented", attr: "dex" }, attributes, 2)).toBe(-1);
    expect(skillBonus({ level: "untrained", attr: "dex" }, attributes, 2)).toBe(1);
    expect(skillBonus({ level: "trained", attr: "dex" }, attributes, 2)).toBe(5);
    expect(skillBonus({ level: "expertise", attr: "dex" }, attributes, 2)).toBe(7);
    expect(skillBonus({ level: "expertise", attr: "dex" }, attributes, 3)).toBe(9);
  });

  it("abilities use only the attribute modifier (T-008 (4b): CHA 9)", () => {
    expect(attributeModifier(attributes.cha)).toBe(-1);
  });

  it("uses modifier 0 for an empty attribute", () => {
    expect(skillBonus({ level: "trained", attr: "str" }, attributes, 2)).toBe(2);
  });

  it("formats with a sign", () => {
    expect(formatSigned(3)).toBe("+3");
    expect(formatSigned(0)).toBe("+0");
    expect(formatSigned(-2)).toBe("-2");
  });
});

describe("skill and ability lists", () => {
  it("rejects case-insensitive duplicates", () => {
    expect(firstDuplicate(["Schlösser knacken", "Reiten", "schlösser KNACKEN"])).toBe("schlösser KNACKEN");
    const skills = skillsSchema.safeParse([
      { name: "Reiten", level: "trained", attr: "dex" },
      { name: " reiten ", level: "untrained", attr: "str" },
    ]);
    expect(skills.success).toBe(false);
    expect(abilitiesSchema.safeParse([{ text: "A", attr: "dex" }, { text: "a", attr: "cha" }]).success).toBe(false);
  });

  it("limits length and count", () => {
    expect(skillsSchema.safeParse([{ name: "x".repeat(61), level: "trained", attr: "dex" }]).success).toBe(false);
    const thirtyOne = Array.from({ length: 31 }, (_, index) => ({ name: `S${index}`, level: "trained", attr: "dex" }));
    expect(skillsSchema.safeParse(thirtyOne).success).toBe(false);
    expect(skillsSchema.safeParse(thirtyOne.slice(0, 30)).success).toBe(true);
    expect(abilitiesSchema.safeParse([{ text: "y".repeat(121), attr: "dex" }]).success).toBe(false);
  });

  it("reads broken stored JSON as an empty list", () => {
    expect(readSkills({ athletics: "untrained" })).toEqual([]);
    expect(readSkills([{ name: "Reiten", level: "trained", attr: "dex" }])).toHaveLength(1);
  });
});

describe("sheetSchema", () => {
  it("accepts a full shared sheet payload", async () => {
    const { sheetSchema, EMPTY_ATTRIBUTES, PROFICIENCY_DEFAULT } = await import("./sheet");
    const parsed = sheetSchema.safeParse({
      class: "Waldläuferin",
      attributes: { ...EMPTY_ATTRIBUTES, dex: 17 },
      proficiencyBonus: PROFICIENCY_DEFAULT,
      skills: [{ name: "Heimlichkeit", level: "trained", attr: "dex" }],
      abilities: [{ text: "Zwei Pfeile", attr: "dex" }],
      personality: "ruhig",
      ideals: "",
      bonds: null,
      flaws: "  ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ideals).toBeNull();
      expect(parsed.data.flaws).toBeNull();
      expect(parsed.data.bonds).toBeNull();
    }
  });
});
