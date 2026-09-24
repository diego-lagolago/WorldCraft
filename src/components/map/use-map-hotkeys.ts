"use client";

import { useEffect } from "react";
import { mapHotkeyAction } from "./map-hotkeys";

type PlaceMode = "none" | "pin" | "monster" | "copy";

export function useMapHotkeys(opts: {
  enabled: boolean;
  staff: boolean;
  sheetOpen: boolean;
  placeMode: PlaceMode;
  setPlaceMode: (mode: PlaceMode | ((current: PlaceMode) => PlaceMode)) => void;
}) {
  const { enabled, staff, sheetOpen, setPlaceMode } = opts;

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
      if (action === "cancel") {
        setPlaceMode("none");
        return;
      }
      setPlaceMode((current) => (current === action ? "none" : action));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, staff, sheetOpen, setPlaceMode]);
}
