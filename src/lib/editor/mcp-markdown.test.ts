import { describe, expect, it } from "vitest";
import { mcpMarkdownToTiptap, resolveMcpMarkdown } from "./mcp-markdown";
import { sanitizeRichDoc } from "./rich-text";
import { tiptapJsonToMcpMarkdown } from "./tiptap-mcp-markdown";

const ID = "11111111-1111-4111-8111-111111111111";

describe("mcpMarkdownToTiptap", () => {
  it("maps the permitted block formats and discards unsupported code, tables and images", () => {
    const parsed = mcpMarkdownToTiptap("## Titel\n\n**Fett** und *kursiv*, <u>unterstrichen</u>, ~~gestrichen~~ und [Link](https://example.com).\n\n- Eins\n- Zwei\n\n> Zitat\n\n---\n\n```\nverwerfen\n```\n\n![Bild](x.png)\n\n| a | b |", { mentions: true });
    expect(parsed.doc.content.map((node) => node.type)).toEqual(["heading", "paragraph", "bulletList", "blockquote", "horizontalRule"]);
    const json = JSON.stringify(parsed.doc);
    expect(json).toContain('"bold"');
    expect(json).toContain('"italic"');
    expect(json).toContain('"underline"');
    expect(json).toContain('"strike"');
    expect(json).toContain('"link"');
    expect(json).not.toContain("verwerfen");
    expect(json).not.toContain("Bild");
  });

  it("keeps bare @ text, records bracketed mentions and materializes them safely", () => {
    const parsed = mcpMarkdownToTiptap(`Hallo @alle und @[Burg](${"artikel"}:${ID}) sowie @[Neu].`, { mentions: true });
    expect(parsed.mentions).toEqual([{ key: "m0", title: "Burg", target: { kind: "article", id: ID } }, { key: "m1", title: "Neu" }]);
    const doc = resolveMcpMarkdown(parsed, [{ ...parsed.mentions[0], kind: "article", id: ID }, { ...parsed.mentions[1], kind: "article", id: ID }], { mentions: true });
    expect(JSON.stringify(doc)).toContain("mention");
    expect(JSON.stringify(doc)).toContain("@alle");
  });

  it("rejects mentions where they are forbidden and malformed explicit targets", () => {
    expect(() => mcpMarkdownToTiptap("@[Burg]", { mentions: false })).toThrow("keine Erwähnungen");
    expect(() => mcpMarkdownToTiptap("@[Burg](artikel:keine-id)", { mentions: true })).toThrow("gültiges Ziel");
  });

  it("round-trips permitted non-mention editor content through MCP Markdown", () => {
    const original = { type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Titel" }] },
      { type: "paragraph", content: [
        { type: "text", text: "fett", marks: [{ type: "bold" }] },
        { type: "text", text: " " },
        { type: "text", text: "unter", marks: [{ type: "underline" }] },
        { type: "text", text: " " },
        { type: "text", text: "Link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
      ] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Punkt" }] }] }] },
      { type: "horizontalRule" },
    ] };
    const parsed = mcpMarkdownToTiptap(tiptapJsonToMcpMarkdown(original), { mentions: true });
    const actual = resolveMcpMarkdown(parsed, [], { mentions: true });
    expect(actual).toEqual(sanitizeRichDoc(original, { mentions: true }).value.doc);
  });

  it("preserves hard breaks and nested marks without interpreting punctuation inside words", () => {
    const parsed = mcpMarkdownToTiptap("# Titel\n\n**[Link](https://example.com)** und <u>*unter*</u>  \nzweite Zeile\n\nsnake_case_name und 2*3*4\n\n#### Klein", { mentions: true });
    const json = JSON.stringify(parsed.doc);
    expect(json).toContain('"hardBreak"');
    expect(json).toContain('"bold"');
    expect(json).toContain('"link"');
    expect(json).toContain('"underline"');
    expect(json).toContain('"italic"');
    expect(json).toContain("snake_case_name");
    expect(json).toContain("2*3*4");
    expect(parsed.doc.content[0].attrs).toEqual({ level: 2 });
    expect(parsed.doc.content.at(-1)?.attrs).toEqual({ level: 3 });
    expect(json).not.toContain("\\\\n");
  });

  it("groups adjacent quote lines into one blockquote", () => {
    const parsed = mcpMarkdownToTiptap("> erste Zeile\n> zweite Zeile", { mentions: true });
    expect(parsed.doc.content).toHaveLength(1);
    expect(parsed.doc.content[0].type).toBe("blockquote");
    expect(JSON.stringify(parsed.doc)).toContain("erste Zeile zweite Zeile");
  });
});
