import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mdNodesToPlain, markdownToEditorHtml, parseChatMarkdown, type MdNode } from "./markdown.ts";

function summarize(nodes: MdNode[]): unknown {
  return nodes.map((node) => {
    if (node.type === "text") return node.value;
    const summary: Record<string, unknown> = { [node.type]: summarize(node.children) };
    if (node.incomplete) summary.incomplete = true;
    return summary;
  });
}

describe("parseChatMarkdown", () => {
  it("renders *kursiv* and **fett**", () => {
    assert.deepEqual(summarize(parseChatMarkdown("*kursiv*")), [{ italic: ["kursiv"] }]);
    assert.deepEqual(summarize(parseChatMarkdown("**fett**")), [{ bold: ["fett"] }]);
    assert.deepEqual(summarize(parseChatMarkdown("Hallo **Welt** und *Freund*")), [
      "Hallo ",
      { bold: ["Welt"] },
      " und ",
      { italic: ["Freund"] },
    ]);
  });

  it("prefers ** before * (bold wraps italic)", () => {
    assert.deepEqual(summarize(parseChatMarkdown("***beide***")), [
      { bold: [{ italic: ["beide"] }] },
    ]);
    assert.deepEqual(summarize(parseChatMarkdown("**fett *kursiv* weiter**")), [
      { bold: ["fett ", { italic: ["kursiv"] }, " weiter"] },
    ]);
  });

  it("allows bold inside italic", () => {
    assert.deepEqual(summarize(parseChatMarkdown("*kursiv **fett** weiter*")), [
      { italic: ["kursiv ", { bold: ["fett"] }, " weiter"] },
    ]);
  });

  it("leaves unmatched markers as text", () => {
    assert.deepEqual(summarize(parseChatMarkdown("**offen")), ["*", "*", "offen"]);
    assert.deepEqual(summarize(parseChatMarkdown("*offen")), ["*", "offen"]);
    assert.deepEqual(summarize(parseChatMarkdown("2*3=6")), ["2", "*", "3=6"]);
  });

  it("live mode styles unclosed markers through EOF", () => {
    assert.deepEqual(summarize(parseChatMarkdown("*offen", { live: true })), [
      { italic: ["offen"], incomplete: true },
    ]);
    assert.deepEqual(summarize(parseChatMarkdown("**offen", { live: true })), [
      { bold: ["offen"], incomplete: true },
    ]);
  });

  it("does not invent HTML and preserves surrounding text", () => {
    const nodes = parseChatMarkdown("Sag <b>nein</b> und **ja**");
    assert.deepEqual(summarize(nodes), ["Sag <b>nein</b> und ", { bold: ["ja"] }]);
    assert.equal(mdNodesToPlain(nodes), "Sag <b>nein</b> und ja");
  });

  it("handles empty input", () => {
    assert.deepEqual(parseChatMarkdown(""), []);
  });
});

describe("markdownToEditorHtml", () => {
  it("keeps Discord-style visible markers around bold/italic", () => {
    assert.equal(
      markdownToEditorHtml("*kursiv*"),
      '<span class="md-syntax">*</span><em>kursiv</em><span class="md-syntax">*</span>',
    );
    assert.equal(
      markdownToEditorHtml("**fett**"),
      '<span class="md-syntax">**</span><strong>fett</strong><span class="md-syntax">**</span>',
    );
    assert.equal(
      markdownToEditorHtml("*kursiver Text* und **fetter Text**, ohne"),
      '<span class="md-syntax">*</span><em>kursiver Text</em><span class="md-syntax">*</span> und <span class="md-syntax">**</span><strong>fetter Text</strong><span class="md-syntax">**</span>, ohne',
    );
  });

  it("escapes raw HTML (XSS-safe)", () => {
    assert.equal(
      markdownToEditorHtml("Sag <img src=x onerror=alert(1)> und **ja**"),
      'Sag &lt;img src=x onerror=alert(1)&gt; und <span class="md-syntax">**</span><strong>ja</strong><span class="md-syntax">**</span>',
    );
  });

  it("preserves emoji and incomplete live markers", () => {
    assert.equal(markdownToEditorHtml(""), "");
    assert.equal(markdownToEditorHtml("😱"), "😱");
    assert.equal(
      markdownToEditorHtml("*offen"),
      '<span class="md-syntax">*</span><em>offen</em>',
    );
    assert.equal(
      markdownToEditorHtml("**offen"),
      '<span class="md-syntax">**</span><strong>offen</strong>',
    );
  });
});
