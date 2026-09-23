import { describe, expect, it } from "vitest";
import { parseTemplateFields, templateFieldsHaveValue } from "./fields";

describe("parseTemplateFields (APP-TEMPLATE-VALIDATE)", () => {
  it("keeps valid values and drops unknown keys and blanks", () => {
    const parsed = parseTemplateFields("place", {
      kind: "city",
      ruler: { kind: "article", id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
      leftover: "x",
      parent: "",
    });
    expect(parsed).toEqual({
      ok: true,
      data: {
        kind: "city",
        ruler: { kind: "article", id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
      },
    });
  });

  it("rejects a select or ref that the registry does not allow", () => {
    expect(parseTemplateFields("place", { kind: "planet" })).toMatchObject({ ok: false, status: 400 });
    expect(parseTemplateFields("place", { ruler: { kind: "universe", id: "x" } })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(parseTemplateFields("item", { owner: { kind: "character", id: "c" } }).ok).toBe(true);
  });

  it("none has no fields, so any payload becomes empty", () => {
    const parsed = parseTemplateFields("none", { kind: "city" });
    expect(parsed).toEqual({ ok: true, data: {} });
    expect(templateFieldsHaveValue({})).toBe(false);
  });
});
