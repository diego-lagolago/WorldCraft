import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import { formatReceipt, snapshotDelta, type Snapshot } from "./receipt";
import { RECEIPT_INSTRUCTION } from "./change-format";

function snapshot(rows: [string, string][], visibility = "nur ich"): Snapshot {
  return { title: "Schwert", stand: "2026-09-29T10:00:00.000Z", visibility, entries: new Map(rows), richLabels: new Set(["Text"]) };
}

describe("receipt (012 T-008)", () => {
  it("shows only stored changes and the appended text", () => {
    const before = snapshot([["Seltenheit", "–"], ["Art", "Waffe"], ["Text", "Alt."]]);
    const after = snapshot([["Seltenheit", "Selten"], ["Art", "Waffe"], ["Text", "Alt.\n\nNeu."]]);
    expect(snapshotDelta(before, after)).toEqual([
      { label: "Seltenheit", oldValue: "–", newValue: "Selten" },
      { label: "Text", oldValue: "Alt.", oldCaption: "vorher", newValue: "Neu.", newCaption: "angehängt" },
    ]);
  });

  it("lists every set field with „–“ as before when content was created", () => {
    const after = snapshot([["Titel", "Schwert"], ["Seltenheit", "–"], ["Text", "Scharf."]]);
    expect(snapshotDelta(null, after)).toEqual([
      { label: "Titel", oldValue: "–", newValue: "Schwert" },
      { label: "Text", oldValue: "–", newValue: "Scharf." },
      { label: "Sichtbarkeit", oldValue: "–", newValue: "nur ich" },
    ]);
  });

  it("starts with the instruction and names ID, stand, delta and stubs", () => {
    const text = formatReceipt({
      art: "artikel",
      id: "article-1",
      after: snapshot([]),
      changes: [{ label: "Seltenheit", oldValue: "–", newValue: "Selten" }],
      stubs: [{ id: "stub-1", title: "Schmiede" }],
    }).split("\n");
    expect(text[0]).toBe(RECEIPT_INSTRUCTION);
    expect(text).toEqual(expect.arrayContaining([
      "ID: article-1", "Stand: 2026-09-29T10:00:00.000Z", "- Seltenheit: – → Selten", "- Schmiede (stub-1)",
    ]));
  });
});
