import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import { PREVIEW_INSTRUCTION, formatConfirmationPreview, formatDelta } from "./write-rich";
import { clearedTemplateFieldKeys } from "./write-fields";
import { pushEntryChanges, type PreviewContext } from "./tools/update/common";
import { RICH_CHANGE_BUDGET, richChangeValues } from "./change-format";

function context(): PreviewContext {
  return { art: "monster", world: {} as PreviewContext["world"], modus: "anhaengen", changes: [], stubs: {} as PreviewContext["stubs"] };
}

describe("change preview format (012 T-007)", () => {
  it("starts with the instruction and lists art, title, visibility, delta, stubs, token", () => {
    const preview = formatConfirmationPreview({
      art: "artikel",
      title: "Schwert",
      visibility: "nur ich",
      changes: [{ label: "Seltenheit", oldValue: "–", newValue: "Selten" }],
      stubTitles: ["Schmiede"],
      token: "token-123",
      expiresAt: new Date("2026-09-29T12:00:00Z"),
    }).split("\n");
    expect(preview[0]).toBe(PREVIEW_INSTRUCTION);
    expect(preview).toEqual(expect.arrayContaining([
      "Art: artikel", "Titel: Schwert", "Sichtbarkeit: nur ich", "Änderungen:", "- Seltenheit: – → Selten",
      "Geplante Stub-Artikel:", "- Schmiede", "Bestätigungs-Token: token-123", "Gültig bis: 2026-09-29T12:00:00.000Z",
    ]));
  });

  it("shows rich text with captions on their own lines", () => {
    expect(formatDelta([{ label: "Text (anhängen)", oldValue: "Alt", newValue: "Neu\nZeile 2", oldCaption: "bisher", newCaption: "wird angehängt" }]))
      .toEqual(["Änderungen:", "- Text (anhängen):", "  bisher: Alt", "  wird angehängt: Neu", "    Zeile 2"]);
  });

  it("records one row per changed sheet entry and omits unchanged ones", () => {
    const ctx = context();
    pushEntryChanges(ctx, {
      prefix: "Charakterblatt – ",
      before: [["Klasse", "Späher"], ["Übungsbonus", "+2"]],
      after: [["Klasse", "Wächter"], ["Übungsbonus", "+2"], ["Makel", "Gierig"]],
    });
    expect(ctx.changes).toEqual([
      { label: "Charakterblatt – Klasse", oldValue: "Späher", newValue: "Wächter" },
      { label: "Charakterblatt – Makel", oldValue: "–", newValue: "Gierig" },
    ]);
  });

  it("keeps a multi-paragraph sheet value as one delta entry", () => {
    const ctx = context();
    pushEntryChanges(ctx, {
      prefix: "Charakterblatt – ",
      before: [["Persönlichkeitsmerkmale", "Ruhig"]],
      after: [["Persönlichkeitsmerkmale", "Ruhig\n\nZweiter Absatz: bleibt Teil des Felds."]],
    });
    expect(ctx.changes).toEqual([{
      label: "Charakterblatt – Persönlichkeitsmerkmale",
      oldValue: "Ruhig",
      newValue: "Ruhig\n\nZweiter Absatz: bleibt Teil des Felds.",
    }]);
  });

  it("clears only template fields named with null, empty, „–“ or false", () => {
    expect([...clearedTemplateFieldKeys("item", { Seltenheit: "Selten", Besitzer: "–", Art: null, "Quest-Gegenstand": false })])
      .toEqual(["owner", "kind", "quest"]);
  });

  it("Review 012 CR-003: keeps the changed rich-text area and reports omitted characters", () => {
    const before = `${"A".repeat(25_000)}alter Satz${"Z".repeat(5_000)}`;
    const after = `${"A".repeat(25_000)}neuer Satz${"Z".repeat(5_000)}`;
    const delta = richChangeValues(before, after, "ersetzen");
    expect(delta.oldValue).toContain("alter Satz");
    expect(delta.newValue).toContain("neuer Satz");
    expect(delta.newValue).toMatch(/Zeichen davor unverändert/);

    const append = richChangeValues("Alt", "B".repeat(RICH_CHANGE_BUDGET + 20), "anhaengen");
    expect(append.newValue).toContain("20 Zeichen nicht dargestellt");
    expect(append.newValue).toContain("BBBB");
  });

  it("Review 012 CR-003: preserves confirmation metadata for very long rich-text previews", () => {
    const longAppend = richChangeValues("A".repeat(30_000), "Neue Notiz", "anhaengen");
    const preview = formatConfirmationPreview({
      art: "artikel", title: "Langtext", visibility: "nur ich",
      changes: [{ label: "Text (anhängen)", ...longAppend }],
      token: "token-fuer-langtext", expiresAt: new Date("2026-09-30T12:00:00.000Z"),
    });
    expect(preview).toContain("Neue Notiz");
    expect(preview).toContain("Bestätigungs-Token: token-fuer-langtext");
    expect(preview).toContain("Gültig bis: 2026-09-30T12:00:00.000Z");
    expect(preview.length).toBeLessThan(20_000);
  });
});
