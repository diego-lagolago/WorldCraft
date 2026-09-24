import { describe, expect, it } from "vitest";
import { mapHotkeyAction, type MapHotkeyInput } from "./map-hotkeys";

function base(over: Partial<MapHotkeyInput> = {}): MapHotkeyInput {
  return {
    key: "p",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    staff: true,
    sheetOpen: false,
    focusTag: "body",
    focusEditable: false,
    ...over,
  };
}

describe("mapHotkeyAction", () => {
  it("fires p/P/m/M for staff", () => {
    expect(mapHotkeyAction(base({ key: "p" }))).toBe("pin");
    expect(mapHotkeyAction(base({ key: "P" }))).toBe("pin");
    expect(mapHotkeyAction(base({ key: "m" }))).toBe("monster");
    expect(mapHotkeyAction(base({ key: "M" }))).toBe("monster");
    expect(mapHotkeyAction(base({ key: "Escape" }))).toBe("cancel");
  });

  it("does not fire for players, modifiers, focus, or open sheet", () => {
    expect(mapHotkeyAction(base({ staff: false }))).toBeNull();
    expect(mapHotkeyAction(base({ ctrlKey: true }))).toBeNull();
    expect(mapHotkeyAction(base({ metaKey: true }))).toBeNull();
    expect(mapHotkeyAction(base({ altKey: true }))).toBeNull();
    expect(mapHotkeyAction(base({ focusTag: "input" }))).toBeNull();
    expect(mapHotkeyAction(base({ focusTag: "textarea" }))).toBeNull();
    expect(mapHotkeyAction(base({ focusEditable: true }))).toBeNull();
    expect(mapHotkeyAction(base({ sheetOpen: true }))).toBeNull();
  });
});
