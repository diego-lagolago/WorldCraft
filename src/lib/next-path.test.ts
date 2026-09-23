import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("accepts invite and world paths", () => {
    expect(safeNextPath("/invite/abcdefghijklmnopqrstuv")).toBe("/invite/abcdefghijklmnopqrstuv");
    expect(safeNextPath("/w/0b5c9c1e-2f7a-4d1b-9a55-1f2e3d4c5b6a/menu")).toBe(
      "/w/0b5c9c1e-2f7a-4d1b-9a55-1f2e3d4c5b6a/menu",
    );
  });

  it("rejects foreign origins and unknown paths", () => {
    for (const value of ["//evil.example", "https://evil.example", "/invite/../admin", "/api/x", "", null, 5]) {
      expect(safeNextPath(value)).toBeNull();
    }
  });
});
