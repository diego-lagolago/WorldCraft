// @vitest-environment happy-dom

import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAP_FILTER_CATS, isMapFilterVisible } from "@/lib/map/map-filter";
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

  it("hides every category with hideAll and keeps a highlighted pin visible", async () => {
    let api: ReturnType<typeof useMapFilter> | undefined;
    const host = document.createElement("div");
    const root = createRoot(host);

    function Probe() {
      const filter = useMapFilter(WORLD_ID);
      useEffect(() => {
        api = filter;
      });
      return null;
    }

    document.body.append(host);
    await act(async () => {
      root.render(createElement(Probe));
    });
    await act(async () => {
      api?.hideAll();
    });

    const all = MAP_FILTER_CATS.map((category) => category.key);
    expect(getMapFilterSnapshot(WORLD_ID)).toEqual(all);
    expect(api?.hidden).toEqual(all);
    expect(isMapFilterVisible({ kind: "monster" }, api!.hidden)).toBe(false);
    expect(isMapFilterVisible({ kind: "pin", pinType: "city", highlighted: true }, api!.hidden)).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });
});
