import { describe, expect, it } from "vitest";
import {
  EXPANDED_COOKIE_MAX,
  expandedCookiePath,
  parseExpanded,
  serializeExpanded,
} from "./expanded-state";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function channelId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

describe("expanded-state", () => {
  it("round-trips open and closed channels", () => {
    const value = serializeExpanded({ [A]: true, [B]: false });
    expect(value).toBe(`${A}.1~${B}.0`);
    expect(parseExpanded(value)).toEqual({ [A]: true, [B]: false });
  });

  it("returns an empty map for missing or broken values", () => {
    expect(parseExpanded(undefined)).toEqual({});
    expect(parseExpanded("")).toEqual({});
    expect(parseExpanded("{not-a-cookie}")).toEqual({});
    expect(parseExpanded(`not-a-uuid.1~${A}.2~${B}.1`)).toEqual({ [B]: true });
  });

  it("skips ids that are not UUIDs when writing", () => {
    expect(serializeExpanded({ "ch-1": true, [A]: false })).toBe(`${A}.0`);
  });

  it("drops the oldest entries to stay below the cookie limit", () => {
    const map: Record<string, boolean> = {};
    for (let i = 0; i < 200; i += 1) map[channelId(i)] = true;
    const value = serializeExpanded(map);
    expect(value.length).toBeLessThanOrEqual(EXPANDED_COOKIE_MAX);
    const parsed = parseExpanded(value);
    expect(parsed[channelId(199)]).toBe(true);
    expect(parsed[channelId(0)]).toBeUndefined();
  });

  it("scopes the cookie to the world's chat page", () => {
    expect(expandedCookiePath(A)).toBe(`/w/${A}/chat`);
  });
});
