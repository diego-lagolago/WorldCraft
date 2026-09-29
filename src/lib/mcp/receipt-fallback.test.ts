import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("./write-shared", () => ({
  visibleArticle: async () => { throw new Error("connection lost"); },
  visibleMonster: vi.fn(),
  visibleQuest: vi.fn(),
  visibleUniverse: vi.fn(),
  findVisibleChapter: vi.fn(),
  worldStand: vi.fn(),
}));

import { receiptAfterWrite } from "./receipt";

describe("receiptAfterWrite (Review 012 CR-001)", () => {
  it("reports a saved write even when the stored state cannot be read back", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const text = await receiptAfterWrite({
      world: { id: "world-1" } as never,
      art: "artikel",
      id: "article-1",
      before: null,
      result: { title: "Schwert", stand: "2026-09-29T10:00:00.000Z", visibility: "nur ich" },
      stubs: [{ id: "stub-1", title: "Schmiede" }],
    });
    expect(text).toContain("Gespeichert.");
    expect(text).toContain("die Änderung ist gespeichert");
    expect(text).toContain("- Schmiede (stub-1)");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("mcp_receipt_error"));
    error.mockRestore();
  });
});
