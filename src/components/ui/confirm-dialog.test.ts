import { describe, expect, it } from "vitest";
import { confirmDialogKey, deleteAction } from "./confirm-dialog";

describe("deleteAction", () => {
  it("deletes immediately when Shift is held", () => {
    expect(deleteAction({ shiftKey: true })).toBe("immediate");
  });

  it("opens confirm dialog without Shift", () => {
    expect(deleteAction({ shiftKey: false })).toBe("confirm");
  });
});

describe("confirmDialogKey", () => {
  it("cancels on Escape", () => {
    expect(confirmDialogKey("Escape", true)).toBe("cancel");
    expect(confirmDialogKey("Escape", false)).toBe("cancel");
  });

  it("does not delete when Enter is pressed with cancel focused", () => {
    expect(confirmDialogKey("Enter", true)).toBe("none");
  });

  it("confirms when Enter is pressed without cancel focused", () => {
    expect(confirmDialogKey("Enter", false)).toBe("confirm");
  });

  it("ignores other keys", () => {
    expect(confirmDialogKey("Tab", false)).toBe("none");
    expect(confirmDialogKey("a", true)).toBe("none");
  });
});
