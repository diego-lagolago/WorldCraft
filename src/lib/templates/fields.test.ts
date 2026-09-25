import { describe, expect, it } from "vitest";
import { keepCompatibleFields, parseTemplateFields, templateFieldsHaveValue } from "./fields";

describe("parseTemplateFields (APP-TEMPLATE-VALIDATE)", () => {
  it("keeps valid values and drops unknown keys and blanks", () => {
    const parsed = parseTemplateFields("place", {
      kind: "city",
      ruler: { kind: "article", id: "00000000-0000-4000-8000-0000000000aa" },
      leftover: "x",
      parent: "",
    });
    expect(parsed).toEqual({
      ok: true,
      data: {
        kind: "city",
        ruler: { kind: "article", id: "00000000-0000-4000-8000-0000000000aa" },
      },
    });
  });

  it("rejects a select or ref that the registry does not allow", () => {
    expect(parseTemplateFields("place", { kind: "planet" })).toMatchObject({ ok: false, status: 400 });
    expect(parseTemplateFields("place", { ruler: { kind: "universe", id: "x" } })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(
      parseTemplateFields("item", {
        owner: { kind: "character", id: "00000000-0000-4000-8000-0000000000cc" },
      }).ok,
    ).toBe(true);
    expect(parseTemplateFields("person", { location: { kind: "article", id: "abc" } })).toMatchObject({
      ok: false,
      status: 400,
      error: expect.stringMatching(/akzeptiert dieses Ziel nicht/),
    });
  });

  it("accepts the new select values and rejects values outside their template", () => {
    expect(parseTemplateFields("person", { status: "sealed" })).toMatchObject({
      ok: true,
      data: { status: "sealed" },
    });
    expect(parseTemplateFields("person", { status: "incapacitated" })).toMatchObject({ ok: true });
    expect(
      parseTemplateFields("place", { kind: "continent", danger: "deadly", reputation: "beloved" }),
    ).toMatchObject({ ok: true });
    expect(parseTemplateFields("organization", { size: "over_100", danger: "apocalyptic" })).toMatchObject({
      ok: true,
    });
    expect(parseTemplateFields("item", { kind: "fish", rarity: "legendary" })).toMatchObject({ ok: true });
    expect(parseTemplateFields("item", { kind: "plant" })).toMatchObject({ ok: true });
    expect(parseTemplateFields("place", { danger: "apocalyptic" })).toMatchObject({ ok: false, status: 400 });
    expect(parseTemplateFields("place", { reputation: "adored" })).toMatchObject({ ok: false, status: 400 });
    expect(parseTemplateFields("organization", { size: "huge" })).toMatchObject({ ok: false, status: 400 });
    expect(parseTemplateFields("item", { rarity: "mythic" })).toMatchObject({ ok: false, status: 400 });
  });

  it("none has no fields, so any payload becomes empty", () => {
    const parsed = parseTemplateFields("none", { kind: "city" });
    expect(parsed).toEqual({ ok: true, data: {} });
    expect(templateFieldsHaveValue({})).toBe(false);
  });

  it("only accepts race articles in the person race reference", () => {
    expect(
      parseTemplateFields("person", { race: { kind: "article", id: "00000000-0000-4000-8000-0000000000dd" } }),
    ).toMatchObject({ ok: true });
    expect(
      parseTemplateFields("person", { race: { kind: "character", id: "00000000-0000-4000-8000-0000000000dd" } }),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it("keeps only compatible stored fields during a template switch", () => {
    expect(keepCompatibleFields("place", { kind: "other", danger: "divine" })).toEqual({ kind: "other" });
    expect(
      keepCompatibleFields("person", {
        race: { kind: "character", id: "00000000-0000-4000-8000-0000000000dd" },
      }),
    ).toEqual({});
    expect(keepCompatibleFields("race", { aliases: "Waldelfen" })).toEqual({});
  });
});
