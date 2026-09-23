// @vitest-environment happy-dom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorExtensions, type MentionExtensionConfig } from "./extensions";

const ID = "11111111-1111-4111-8111-111111111111";
const editors: Editor[] = [];

function makeEditor(mentions: MentionExtensionConfig | null, content = "<p></p>") {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: createEditorExtensions({ placeholder: "Text", mentions }),
    content,
  });
  editors.push(editor);
  return editor;
}

function mentionConfig(queries: string[] = [], state: "linked" | "stub" = "linked"): MentionExtensionConfig {
  return {
    resolveState: () => state,
    suggestion: {
      char: "@",
      allowSpaces: true,
      items: ({ query }) => {
        queries.push(query);
        return [];
      },
    },
  };
}

/** Position right after the first occurrence of `needle` in the first paragraph. */
function posAfter(editor: Editor, needle: string): number {
  const text = editor.state.doc.firstChild?.textContent ?? "";
  const index = text.indexOf(needle);
  if (index < 0) throw new Error(`"${needle}" not found`);
  return 1 + index + needle.length;
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
  vi.restoreAllMocks();
});

describe("createEditorExtensions (CR-022)", () => {
  it("registers link and underline exactly once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const editor = makeEditor(mentionConfig());
    const names = editor.extensionManager.extensions.map((extension) => extension.name);
    expect(names.filter((name) => name === "link")).toHaveLength(1);
    expect(names.filter((name) => name === "underline")).toHaveLength(1);
    expect(new Set(names).size).toBe(names.length);
    expect(warn.mock.calls.flat().join(" ")).not.toMatch(/duplicate/i);
  });

  it("rejects javascript: links", () => {
    const editor = makeEditor(null, "<p>Klick mich</p>");
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.commands.setLink({ href: "javascript:alert(1)" });
    expect(editor.getHTML()).not.toContain("javascript:");
    expect(editor.isActive("link")).toBe(false);

    editor.commands.setContent('<p><a href="javascript:alert(1)">böse</a></p>');
    expect(editor.getHTML()).not.toContain("javascript:");

    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setLink({ href: "https://example.com" });
    expect(editor.getHTML()).toContain('href="https://example.com"');
  });

  it("offers headings 2 and 3 only and no code", () => {
    const editor = makeEditor(null);
    expect(editor.schema.nodes.codeBlock).toBeUndefined();
    expect(editor.schema.marks.code).toBeUndefined();
    editor.commands.setContent("<h1>Eins</h1><h4>Vier</h4>");
    const levels = (editor.getJSON().content ?? []).map((node) => node.attrs?.level ?? null);
    expect(levels.every((level) => level === 2 || level === 3 || level === null)).toBe(true);
  });
});

describe("mentions", () => {
  it("stores the kind attribute with CONTENT_KINDS values", () => {
    const editor = makeEditor(mentionConfig());
    editor.commands.insertContent({ type: "mention", attrs: { id: ID, kind: "article", label: "Wertheim" } });
    const paragraph = editor.getJSON().content?.[0];
    expect(paragraph?.content?.[0]).toMatchObject({
      type: "mention",
      attrs: { id: ID, kind: "article", label: "Wertheim" },
    });
    expect(editor.getHTML()).toContain('data-kind="article"');
    expect(editor.getHTML()).not.toContain("mention-stub");
  });

  it("renders stubs red via the state resolver", () => {
    const editor = makeEditor(mentionConfig([], "stub"));
    editor.commands.insertContent({ type: "mention", attrs: { id: ID, kind: "article", label: "Neu" } });
    expect(editor.getHTML()).toContain('class="mention mention-stub"');
  });

  it("searches only from @ up to the caret, spaces allowed", async () => {
    const queries: string[] = [];
    const editor = makeEditor(mentionConfig(queries), "<p>Wir reiten zu @Tore von Wer und dann weiter.</p>");
    editor.commands.setTextSelection(posAfter(editor, "@Tore von Wer"));
    await vi.waitFor(() => expect(queries.length).toBeGreaterThan(0));
    expect(queries.at(-1)).toBe("Tore von Wer");
  });

  it("has no mention node without mention config (world description)", () => {
    const editor = makeEditor(null, "<p>@Tore</p>");
    expect(editor.schema.nodes.mention).toBeUndefined();
    expect(editor.getText()).toBe("@Tore");
  });
});
