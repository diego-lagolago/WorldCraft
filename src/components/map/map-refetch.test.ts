import { describe, expect, it } from "vitest";
import {
  clearDeletedOnSync,
  forgetDeleted,
  interpretRefetchResult,
  isDeleted,
  nextRefetchSeq,
  rememberDeleted,
  resolveRefetchResponse,
  shouldApplyRefetch,
  isEventForCurrentMap,
  shouldScheduleReload,
} from "./map-refetch";

describe("interpretRefetchResult", () => {
  it("treats 2xx as ok", () => {
    expect(interpretRefetchResult(200)).toBe("ok");
    expect(interpretRefetchResult(204)).toBe("ok");
  });

  it("removes only on 404", () => {
    expect(interpretRefetchResult(404)).toBe("remove");
  });

  it("waits for resync on status 0", () => {
    expect(interpretRefetchResult(0)).toBe("keep_and_wait_resync");
  });

  it("keeps state and schedules reload on other errors", () => {
    expect(interpretRefetchResult(401)).toBe("keep_and_reload");
    expect(interpretRefetchResult(500)).toBe("keep_and_reload");
    expect(interpretRefetchResult(502)).toBe("keep_and_reload");
  });
});

describe("isEventForCurrentMap", () => {
  it("skips when no map is open", () => {
    expect(isEventForCurrentMap("map-a", undefined)).toBe(false);
  });

  it("skips when the event targets another map", () => {
    expect(isEventForCurrentMap("map-b", "map-a")).toBe(false);
  });

  it("fetches when the event matches the open map", () => {
    expect(isEventForCurrentMap("map-a", "map-a")).toBe(true);
  });
});

describe("refetch sequence", () => {
  it("ignores stale responses", () => {
    expect(shouldApplyRefetch(1, 2)).toBe(false);
    expect(shouldApplyRefetch(2, 2)).toBe(true);
  });

  it("two events for the same pin: first response last keeps second data", () => {
    const pin = { id: "p1", title: "Second" };
    const first = resolveRefetchResponse({
      seq: 1,
      latestSeq: 2,
      status: 200,
      data: { id: "p1", title: "First" },
      deleted: new Set(),
      id: "p1",
    });
    const second = resolveRefetchResponse({
      seq: 2,
      latestSeq: 2,
      status: 200,
      data: pin,
      deleted: new Set(),
      id: "p1",
    });

    expect(first.action).toBe("ignore");
    expect(second).toEqual({ action: "upsert", data: pin });
  });
});

describe("deleted set", () => {
  it("discards late upserts after delete", () => {
    const deleted = rememberDeleted(new Set(), "p1");
    const outcome = resolveRefetchResponse({
      seq: 1,
      latestSeq: 1,
      status: 200,
      data: { id: "p1", title: "Late" },
      deleted,
      id: "p1",
    });

    expect(outcome.action).toBe("ignore");
    expect(isDeleted(deleted, "p1")).toBe(true);
  });

  it("allows upsert after forgetDeleted (republish after hide)", () => {
    const deleted = rememberDeleted(new Set(), "p1");
    const cleared = forgetDeleted(deleted, "p1");
    const pin = { id: "p1", title: "Published again" };
    expect(
      resolveRefetchResponse({
        seq: 2,
        latestSeq: 2,
        status: 200,
        data: pin,
        deleted: cleared,
        id: "p1",
      }),
    ).toEqual({ action: "upsert", data: pin });
  });

  it("clears deleted ids on full sync", () => {
    const deleted = rememberDeleted(new Set(), "p1");
    expect(clearDeletedOnSync()).toEqual(new Set());
    expect(deleted.has("p1")).toBe(true);
  });

  it("404 removes and can be tracked via rememberDeleted", () => {
    expect(interpretRefetchResult(404)).toBe("remove");
    const deleted = rememberDeleted(new Set(), "p1");
    expect(resolveRefetchResponse({
      seq: 1,
      latestSeq: 1,
      status: 404,
      data: undefined,
      deleted,
      id: "p1",
    })).toEqual({ action: "remove" });
  });
});

describe("reload debounce", () => {
  it("schedules only one reload while pending", () => {
    expect(shouldScheduleReload(false)).toBe(true);
    expect(shouldScheduleReload(true)).toBe(false);
  });
});

describe("nextRefetchSeq", () => {
  it("increments per id", () => {
    expect(nextRefetchSeq(0)).toBe(1);
    expect(nextRefetchSeq(1)).toBe(2);
  });
});

describe("error outcomes keep pin in state (no remove action)", () => {
  it("status 0 waits for resync", () => {
    expect(resolveRefetchResponse({
      seq: 1,
      latestSeq: 1,
      status: 0,
      data: undefined,
      deleted: new Set(),
      id: "p1",
    })).toEqual({ action: "keep_and_wait_resync" });
  });

  it("status 500 triggers reload without remove", () => {
    expect(resolveRefetchResponse({
      seq: 1,
      latestSeq: 1,
      status: 500,
      data: undefined,
      deleted: new Set(),
      id: "p1",
    })).toEqual({ action: "keep_and_reload" });
  });
});
