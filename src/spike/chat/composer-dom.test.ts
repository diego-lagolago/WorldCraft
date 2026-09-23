// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { getCaretMarkdownOffset } from "./composer-dom";

function placeCaret(root: HTMLElement, childIndex: number): void {
  const range = document.createRange();
  range.setStart(root, childIndex);
  range.collapse(true);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe("getCaretMarkdownOffset", () => {
  it("counts markdown length before a caret between element children", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<span class="md-syntax">**</span><strong>fett</strong><span class="md-syntax">**</span>';
    placeCaret(root, 2);

    expect(getCaretMarkdownOffset(root)).toBe("**fett".length);
  });

  it("counts markdown length when the caret sits inside a nested element", () => {
    const root = document.createElement("div");
    const wrapper = document.createElement("span");
    wrapper.innerHTML =
      '<span class="md-syntax">**</span><strong>fett</strong><span class="md-syntax">**</span>';
    root.appendChild(wrapper);
    placeCaret(wrapper, 2);

    expect(getCaretMarkdownOffset(root)).toBe("**fett".length);
  });
});
