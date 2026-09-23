/** contentEditable ↔ markdown for the chat composer (bold/italic only). */

import { markdownToEditorHtml } from "@/lib/chat/markdown";

export { markdownToEditorHtml };
export const COMPOSER_MAX_LENGTH = 2000;

/** Serialize editor DOM to markdown plain text (markers are already in the DOM). */
export function serializeEditor(root: HTMLElement): string {
  return textFromNode(root).replace(/\u00a0/g, " ");
}

function textFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") return "\n";
  // Some platforms insert emoji as <img alt="…"> — keep them in markdown.
  if (tag === "img") return el.getAttribute("alt") ?? el.getAttribute("title") ?? "";
  let out = "";
  for (const child of Array.from(node.childNodes)) {
    out += textFromNode(child);
  }
  return out;
}

/** Markdown character offset of the current caret inside `root`. */
export function getCaretMarkdownOffset(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) {
    return serializeEditor(root).length;
  }
  const { startContainer, startOffset } = sel.getRangeAt(0);
  let total = 0;
  let found = false;

  if (startContainer === root) {
    const children = Array.from(root.childNodes);
    for (let i = 0; i < startOffset && i < children.length; i++) {
      total += textFromNode(children[i]!).length;
    }
    return total;
  }

  function walk(node: Node): void {
    if (found) return;

    if (node.nodeType === Node.TEXT_NODE) {
      if (node === startContainer) {
        total += Math.min(startOffset, (node.textContent ?? "").length);
        found = true;
        return;
      }
      total += (node.textContent ?? "").length;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      if (node === startContainer) {
        found = true;
        return;
      }
      total += 1;
      return;
    }

    if (node === startContainer) {
      const children = Array.from(node.childNodes);
      for (let i = 0; i < startOffset && i < children.length; i++) {
        total += textFromNode(children[i]!).length;
      }
      found = true;
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
      if (found) return;
    }
  }

  for (const child of Array.from(root.childNodes)) {
    walk(child);
    if (found) break;
  }
  return total;
}

/** Place caret so markdown offset matches (best-effort after re-parse). */
export function setCaretMarkdownOffset(root: HTMLElement, offset: number): void {
  let remaining = Math.max(0, offset);

  function place(node: Node, at: number): boolean {
    const range = document.createRange();
    range.setStart(node, at);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  }

  function placeAtEndOf(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      return place(node, (node.textContent ?? "").length);
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  }

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? "").length;
      if (remaining <= len) return place(node, remaining);
      remaining -= len;
      return false;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      if (remaining <= 0) return placeAtEndOf(node);
      remaining -= 1;
      return false;
    }

    for (const child of Array.from(node.childNodes)) {
      if (walk(child)) return true;
    }
    return false;
  }

  for (const child of Array.from(root.childNodes)) {
    if (walk(child)) return;
  }
  placeAtEndOf(root);
}

/** Insert plain text at the caret (used for paste / length clamp). */
export function insertPlainTextAtCaret(root: HTMLElement, text: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) {
    root.focus();
    const end = serializeEditor(root).length;
    root.appendChild(document.createTextNode(text));
    setCaretMarkdownOffset(root, end + text.length);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
