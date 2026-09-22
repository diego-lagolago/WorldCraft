import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mdNodesToPlain, markdownToEditorHtml, parseChatMarkdown, type MdNode } from "./markdown.ts";

function summarize(nodes: MdNode[]): unknown {
  return nodes.map((node) => {
    if (node.type === "text") return node.value;
    return { [node.type]: summarize(node.children) };
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

  it("does not invent HTML and preserves surrounding text", () => {
    const nodes = parseChatMarkdown('Sag <b>nein</b> und **ja**');
    assert.deepEqual(summarize(nodes), ["Sag <b>nein</b> und ", { bold: ["ja"] }]);
    assert.equal(mdNodesToPlain(nodes), "Sag <b>nein</b> und ja");
  });

  it("handles empty input", () => {
    assert.deepEqual(parseChatMarkdown(""), []);
  });
});

describe("markdownToEditorHtml", () => {
  it("renders bold and italic as strong/em", () => {
    assert.equal(markdownToEditorHtml("*kursiv*"), "<em>kursiv</em>");
    assert.equal(markdownToEditorHtml("**fett**"), "<strong>fett</strong>");
    assert.equal(
      markdownToEditorHtml("Hallo **Welt** und *Freund*"),
      "Hallo <strong>Welt</strong> und <em>Freund</em>",
    );
  });

  it("escapes raw HTML (XSS-safe)", () => {
    assert.equal(
      markdownToEditorHtml("Sag <img src=x onerror=alert(1)> und **ja**"),
      "Sag &lt;img src=x onerror=alert(1)&gt; und <strong>ja</strong>",
    );
  });

  it("handles empty and unmatched markers as text", () => {
    assert.equal(markdownToEditorHtml(""), "");
    assert.equal(markdownToEditorHtml("**offen"), "**offen");
    assert.equal(markdownToEditorHtml("*offen"), "*offen");
  });
});
