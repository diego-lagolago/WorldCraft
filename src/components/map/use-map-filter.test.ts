// @vitest-environment happy-dom

import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMapFilterSnapshot, useMapFilter } from "./use-map-filter";

const WORLD_ID = "world-filter-test";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

describe("useMapFilter", () => {
  it("uses a cached snapshot and rerenders once when the filter changes", async () => {
    const renders: string[][] = [];
    let toggle: ((category: "monsters") => void) | undefined;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const host = document.createElement("div");
    const root = createRoot(host);

    function Probe() {
      const filter = useMapFilter(WORLD_ID);
      renders.push([...filter.hidden]);
      useEffect(() => {
        toggle = filter.toggle;
      }, [filter.toggle]);
      return null;
    }

    document.body.append(host);
    await act(async () => {
      root.render(createElement(Probe));
    });

    expect(renders).toHaveLength(1);
    expect(getMapFilterSnapshot(WORLD_ID)).toBe(getMapFilterSnapshot(WORLD_ID));

    await act(async () => {
      toggle?.("monsters");
    });

    expect(renders).toHaveLength(2);
    expect(renders.at(-1)).toEqual(["monsters"]);
    expect(error).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    error.mockRestore();
  });
});
