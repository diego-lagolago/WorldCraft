import { afterEach, describe, expect, it } from "vitest";
import { consumeMcpCall, McpRateLimitError, resetMcpRateLimitForTests } from "./audit";

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
});
