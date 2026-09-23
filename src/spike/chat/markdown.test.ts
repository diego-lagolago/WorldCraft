import { describe, expect, it } from "vitest";
import { mdNodesToPlain, markdownToEditorHtml, parseChatMarkdown, type MdNode } from "./markdown";

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
    expect(summarize(parseChatMarkdown("*kursiv*"))).toEqual([{ italic: ["kursiv"] }]);
    expect(summarize(parseChatMarkdown("**fett**"))).toEqual([{ bold: ["fett"] }]);
    expect(summarize(parseChatMarkdown("Hallo **Welt** und *Freund*"))).toEqual([
      "Hallo ",
      { bold: ["Welt"] },
      " und ",
      { italic: ["Freund"] },
    ]);
  });

  it("prefers ** before * (bold wraps italic)", () => {
    expect(summarize(parseChatMarkdown("***beide***"))).toEqual([
      { bold: [{ italic: ["beide"] }] },
    ]);
    expect(summarize(parseChatMarkdown("**fett *kursiv* weiter**"))).toEqual([
      { bold: ["fett ", { italic: ["kursiv"] }, " weiter"] },
    ]);
  });

  it("allows bold inside italic", () => {
    expect(summarize(parseChatMarkdown("*kursiv **fett** weiter*"))).toEqual([
      { italic: ["kursiv ", { bold: ["fett"] }, " weiter"] },
    ]);
  });

  it("leaves unmatched markers as text", () => {
    expect(summarize(parseChatMarkdown("**offen"))).toEqual(["*", "*", "offen"]);
    expect(summarize(parseChatMarkdown("*offen"))).toEqual(["*", "offen"]);
    expect(summarize(parseChatMarkdown("2*3=6"))).toEqual(["2", "*", "3=6"]);
  });

  it("live mode styles unclosed markers through EOF", () => {
    expect(summarize(parseChatMarkdown("*offen", { live: true }))).toEqual([
      { italic: ["offen"], incomplete: true },
    ]);
    expect(summarize(parseChatMarkdown("**offen", { live: true }))).toEqual([
      { bold: ["offen"], incomplete: true },
    ]);
  });

  it("does not invent HTML and preserves surrounding text", () => {
    const nodes = parseChatMarkdown("Sag <b>nein</b> und **ja**");
    expect(summarize(nodes)).toEqual(["Sag <b>nein</b> und ", { bold: ["ja"] }]);
    expect(mdNodesToPlain(nodes)).toBe("Sag <b>nein</b> und ja");
  });

  it("handles empty input", () => {
    expect(parseChatMarkdown("")).toEqual([]);
  });
});

describe("markdownToEditorHtml", () => {
  it("keeps Discord-style visible markers around bold/italic", () => {
    expect(markdownToEditorHtml("*kursiv*")).toBe('<span class="md-syntax">*</span><em>kursiv</em><span class="md-syntax">*</span>');
    expect(markdownToEditorHtml("**fett**")).toBe('<span class="md-syntax">**</span><strong>fett</strong><span class="md-syntax">**</span>');
    expect(markdownToEditorHtml("*kursiver Text* und **fetter Text**, ohne")).toBe('<span class="md-syntax">*</span><em>kursiver Text</em><span class="md-syntax">*</span> und <span class="md-syntax">**</span><strong>fetter Text</strong><span class="md-syntax">**</span>, ohne');
  });

  it("escapes raw HTML (XSS-safe)", () => {
    expect(markdownToEditorHtml("Sag <img src=x onerror=alert(1)> und **ja**")).toBe('Sag &lt;img src=x onerror=alert(1)&gt; und <span class="md-syntax">**</span><strong>ja</strong><span class="md-syntax">**</span>');
  });

  it("preserves emoji and incomplete live markers", () => {
    expect(markdownToEditorHtml("")).toBe("");
    expect(markdownToEditorHtml("😱")).toBe("😱");
    expect(markdownToEditorHtml("*offen")).toBe('<span class="md-syntax">*</span><em>offen</em>');
    expect(markdownToEditorHtml("**offen")).toBe('<span class="md-syntax">**</span><strong>offen</strong>');
  });
});
