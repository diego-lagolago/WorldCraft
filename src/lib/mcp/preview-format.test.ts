import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import { PREVIEW_INSTRUCTION, formatConfirmationPreview, formatDelta } from "./write-rich";
import { clearedTemplateFieldKeys } from "./write-fields";
import { pushEntryChanges, type PreviewContext } from "./tools/update/common";

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
      oldText: "Klasse: Späher\n\nÜbungsbonus: +2",
      newText: "Klasse: Wächter\n\nÜbungsbonus: +2\n\nMakel: Gierig",
      separator: "\n\n",
    });
    expect(ctx.changes).toEqual([
      { label: "Charakterblatt – Klasse", oldValue: "Späher", newValue: "Wächter" },
      { label: "Charakterblatt – Makel", oldValue: "–", newValue: "Gierig" },
    ]);
  });

  it("clears only template fields named with null, empty, „–“ or false", () => {
    expect([...clearedTemplateFieldKeys("item", { Seltenheit: "Selten", Besitzer: "–", Art: null, "Quest-Gegenstand": false })])
      .toEqual(["owner", "kind", "quest"]);
  });
});
