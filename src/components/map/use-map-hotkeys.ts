"use client";

import { useEffect } from "react";
import { nextMapMode, type MapMode } from "@/lib/map/map-mode";
import { mapHotkeyAction } from "./map-hotkeys";

export function useMapHotkeys(opts: {
  enabled: boolean;
  staff: boolean;
  sheetOpen: boolean;
  setMode: (mode: MapMode | ((current: MapMode) => MapMode)) => void;
}) {
  const { enabled, staff, sheetOpen, setMode } = opts;

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const action = mapHotkeyAction({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        staff,
        sheetOpen,
        focusTag: target?.tagName?.toLowerCase() ?? null,
        focusEditable: Boolean(target?.isContentEditable),
      });
      if (!action) return;
      event.preventDefault();
      setMode((current) => nextMapMode(current, action));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, staff, sheetOpen, setMode]);
}
