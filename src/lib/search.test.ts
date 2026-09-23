import { describe, expect, it } from "vitest";
import { clampSearchLimit, searchSnippet, SEARCH_SNIPPET_MAX } from "@/lib/search";

describe("clampSearchLimit", () => {
  it("defaults to 20 and caps at 50", () => {
    expect(clampSearchLimit(undefined)).toBe(20);
    expect(clampSearchLimit("")).toBe(20);
    expect(clampSearchLimit(100)).toBe(50);
    expect(clampSearchLimit("7")).toBe(7);
    expect(clampSearchLimit(0)).toBe(20);
  });
});

describe("searchSnippet", () => {
  it("cuts around the first hit and stays within 300 chars", () => {
    const plain = `${"a".repeat(50)} Gottschleim ${"b".repeat(200)}`;
    const snip = searchSnippet(plain, "schleim");
    expect(snip).toContain("Gottschleim");
    expect(snip.length).toBeLessThanOrEqual(SEARCH_SNIPPET_MAX);
    expect(snip.startsWith("…")).toBe(true);
  });

  it("returns an empty string for empty plain text", () => {
    expect(searchSnippet(null, "x")).toBe("");
    expect(searchSnippet("   ", "x")).toBe("");
  });
});
