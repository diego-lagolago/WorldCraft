// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetWorld,
  pickLastWorld,
  pickUniverse,
  readLastUniverse,
  readLastWorld,
  rememberUniverse,
  rememberWorld,
} from "./last-context";

beforeEach(() => localStorage.clear());

describe("last world / universe", () => {
  it("remembers and forgets per device", () => {
    rememberWorld("w1");
    rememberUniverse("w1", "u1");
    expect(readLastWorld()).toBe("w1");
    expect(readLastUniverse("w1")).toBe("u1");
    forgetWorld("w1");
    expect(readLastWorld()).toBeNull();
    expect(readLastUniverse("w1")).toBeNull();
  });

  it("falls back for invalid ids", () => {
    expect(pickLastWorld("w1", ["w1", "w2"])).toBe("w1");
    expect(pickLastWorld("gone", ["w1"])).toBeNull();
    expect(pickLastWorld(null, ["w1"])).toBeNull();
    expect(pickUniverse("u2", ["u1", "u2"])).toBe("u2");
    expect(pickUniverse("hidden", ["u1", "u2"])).toBe("u1");
    expect(pickUniverse(null, [])).toBeNull();
  });
});
