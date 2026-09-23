import { describe, expect, it } from "vitest";
import { extractMentions, plainTextOf, sanitizeRichDoc, type RichDoc } from "./rich-text";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function mention(id: string, kind: string, label: string) {
  return { type: "mention", attrs: { id, kind, label, mentionSuggestionChar: "@" } };
}

const sample = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Wertheim" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Die ", marks: [{ type: "bold" }, { type: "bold" }] },
        mention(A, "article", "Tore von Wertheim"),
        { type: "text", text: " und " },
        mention(B.toUpperCase(), "character", "Mira"),
        { type: "text", text: " wieder ", marks: [{ type: "code" }] },
        mention(A, "article", "Tore von Wertheim"),
      ],
    },
    { type: "image", attrs: { src: "https://example.com/x.png" } },
    { type: "table", content: [] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Punkt" }] }] },
        { type: "paragraph", content: [{ type: "text", text: "verirrt" }] },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "böse", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
        { type: "text", text: " gut", marks: [{ type: "link", attrs: { href: "example.com", target: "_self" } }] },
      ],
    },
  ],
};

describe("sanitizeRichDoc", () => {
  it("keeps allowed nodes and marks and drops images, tables and code", () => {
    const result = sanitizeRichDoc(sample, { mentions: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { doc } = result.value;
    expect(doc.content.map((node) => node.type)).toEqual(["heading", "paragraph", "bulletList", "paragraph"]);
    expect(doc.content[0].attrs).toEqual({ level: 2 });
    const para = doc.content[1].content ?? [];
    expect(para[0]).toEqual({ type: "text", text: "Die ", marks: [{ type: "bold" }] });
    expect(para[4]).toEqual({ type: "text", text: " wieder " });
    expect(doc.content[2].content).toHaveLength(1);
  });

  it("drops javascript: links and normalizes others (CR-022)", () => {
    const result = sanitizeRichDoc(sample, { mentions: true });
    if (!result.ok) throw new Error(result.error);
    const last = result.value.doc.content[3].content ?? [];
    expect(last[0]).toEqual({ type: "text", text: "böse" });
    expect(last[1].marks).toEqual([{ type: "link", attrs: { href: "https://example.com" } }]);
  });

  it("derives plain text with mention labels and the mention list", () => {
    const result = sanitizeRichDoc(sample, { mentions: true });
    if (!result.ok) throw new Error(result.error);
    expect(result.value.plain).toBe(
      "Wertheim\nDie Tore von Wertheim und Mira wieder Tore von Wertheim\nPunkt\nböse gut",
    );
    expect(result.value.mentions).toEqual([
      { kind: "article", id: A },
      { kind: "character", id: B },
    ]);
  });

  it("drops mentions with unknown kinds or ids", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [mention(A, "artikel", "Alt"), mention("nope", "article", "X"), mention(A, "pin", "Pin")],
        },
      ],
    };
    const result = sanitizeRichDoc(doc, { mentions: true });
    if (!result.ok) throw new Error(result.error);
    expect(result.value.mentions).toEqual([]);
  });

  it("rejects mentions in the world description (APP-WORLD-NO-MENTIONS)", () => {
    const result = sanitizeRichDoc(sample, { mentions: false });
    expect(result).toEqual({ ok: false, error: "Die Weltbeschreibung darf keine Erwähnungen enthalten." });
  });

  it("accepts a plain @ in the world description", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "@Tore" }] }] };
    const result = sanitizeRichDoc(doc, { mentions: false });
    expect(result.ok && result.value.plain).toBe("@Tore");
  });

  it("rejects non-documents and oversized input", () => {
    expect(sanitizeRichDoc(null, { mentions: true }).ok).toBe(false);
    expect(sanitizeRichDoc({ type: "paragraph" }, { mentions: true }).ok).toBe(false);
    const huge = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(400_001) }] }],
    };
    expect(sanitizeRichDoc(huge, { mentions: true })).toEqual({ ok: false, error: "Der Text ist zu lang." });
  });

  it("returns an empty paragraph for an empty document", () => {
    const result = sanitizeRichDoc({ type: "doc", content: [] }, { mentions: true });
    expect(result.ok && result.value.doc).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});

describe("plainTextOf / extractMentions", () => {
  it("handles hard breaks and nested blocks", () => {
    const doc: RichDoc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }] }],
        },
      ],
    };
    expect(plainTextOf(doc)).toBe("a\nb");
    expect(extractMentions(doc)).toEqual([]);
  });
});
