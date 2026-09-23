import { describe, expect, it } from "vitest";
import { nextHello } from "./resync";

describe("nextHello", () => {
  it("does not resync on the first hello and does on every later one", () => {
    const first = nextHello(false);
    expect(first).toEqual({ seenHello: true, resync: false });
    expect(nextHello(first.seenHello)).toEqual({ seenHello: true, resync: true });
  });
});
