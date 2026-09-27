import { afterEach, describe, expect, it } from "vitest";
import { consumeMcpCall, hasMcpRateLimitEntryForTests, McpRateLimitError, pruneMcpRateLimitForTests, resetMcpRateLimitForTests } from "./audit";

afterEach(resetMcpRateLimitForTests);

describe("MCP rate limit", () => {
  it("allows sixty calls in one sliding minute and rejects the next", () => {
    const now = 1_000_000;
    for (let index = 0; index < 60; index += 1) consumeMcpCall("user", now + index);
    expect(() => consumeMcpCall("user", now + 61)).toThrow(McpRateLimitError);
  });

  it("opens the window again after one minute", () => {
    const now = 1_000_000;
    for (let index = 0; index < 60; index += 1) consumeMcpCall("user", now);
    expect(() => consumeMcpCall("user", now + 60_001)).not.toThrow();
  });

  it("removes an inactive user's window entry", () => {
    const now = 1_000_000;
    consumeMcpCall("user", now);
    expect(hasMcpRateLimitEntryForTests("user")).toBe(true);
    pruneMcpRateLimitForTests(now + 60_001);
    expect(hasMcpRateLimitEntryForTests("user")).toBe(false);
  });
});
