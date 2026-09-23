import { describe, expect, it } from "vitest";
import { confirmDialogKey, confirmMode, nextFocusIndex } from "./confirm-dialog";

describe("confirmMode", () => {
  it("deletes immediately when Shift is held", () => {
    expect(confirmMode({ shiftKey: true })).toBe("immediate");
  });

  it("opens confirm dialog without Shift", () => {
    expect(confirmMode({ shiftKey: false })).toBe("confirm");
  });
});

describe("confirmDialogKey", () => {
  it("cancels on Escape", () => {
    expect(confirmDialogKey("Escape", true)).toBe("cancel");
    expect(confirmDialogKey("Escape", false)).toBe("cancel");
  });

  it("returns none when Enter is pressed with confirm focused (native click)", () => {
    expect(confirmDialogKey("Enter", true)).toBe("none");
  });

  it("cancels when Enter is pressed without confirm focused", () => {
    expect(confirmDialogKey("Enter", false)).toBe("cancel");
  });

  it("ignores other keys", () => {
    expect(confirmDialogKey("Tab", false)).toBe("none");
    expect(confirmDialogKey("a", true)).toBe("none");
  });
});

describe("nextFocusIndex", () => {
  it("cycles forward and backward", () => {
    expect(nextFocusIndex(0, 2, false)).toBe(1);
    expect(nextFocusIndex(1, 2, false)).toBe(0);
    expect(nextFocusIndex(0, 2, true)).toBe(1);
    expect(nextFocusIndex(1, 2, true)).toBe(0);
  });
});
