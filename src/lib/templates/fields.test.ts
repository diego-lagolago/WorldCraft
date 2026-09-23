import { describe, expect, it } from "vitest";
import { parseTemplateFields, templateFieldsHaveValue } from "./fields";

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

  it("none has no fields, so any payload becomes empty", () => {
    const parsed = parseTemplateFields("none", { kind: "city" });
    expect(parsed).toEqual({ ok: true, data: {} });
    expect(templateFieldsHaveValue({})).toBe(false);
  });
});
