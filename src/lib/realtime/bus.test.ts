import { describe, expect, it } from "vitest";
import { createRealtimeBus } from "./bus";

describe("createRealtimeBus", () => {
  it("isolates a throwing listener and still delivers the event", () => {
    const bus = createRealtimeBus<{ n: number }>(`test-${crypto.randomUUID()}`);
    const received: number[] = [];
    bus.subscribe(() => {
      throw new Error("closed stream");
    });
    bus.subscribe((event) => {
      received.push(event.n);
    });
    expect(() => bus.publish({ n: 1 })).not.toThrow();
    expect(received).toEqual([1]);
    bus.publish({ n: 2 });
    expect(received).toEqual([1, 2]);
  });
});
