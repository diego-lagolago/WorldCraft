import { describe, expect, it } from "vitest";
import { inviteCodeFrom } from "./invite-code";

describe("inviteCodeFrom", () => {
  it("accepts a full link or the bare code", () => {
    expect(inviteCodeFrom("https://worldcraft.example.com/invite/k7Qz9vA2")).toBe("k7Qz9vA2");
    expect(inviteCodeFrom("  k7Qz9vA2 ")).toBe("k7Qz9vA2");
  });

  it("rejects empty or odd input", () => {
    expect(inviteCodeFrom("")).toBeNull();
    expect(inviteCodeFrom("a b")).toBeNull();
    expect(inviteCodeFrom("https://example.com/x")).toBeNull();
  });
});
