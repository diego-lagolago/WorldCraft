import { describe, expect, it } from "vitest";
import { escapeEditorText, markdownToEditorHtml, parseChatMarkdown } from "@/lib/chat/markdown";

describe("escapeEditorText", () => {
  it("keeps a trailing space as nbsp so contentEditable does not collapse it", () => {
    expect(escapeEditorText("Wort ")).toBe("Wort&nbsp;");
  });

  it("encodes runs of spaces and newlines", () => {
    expect(escapeEditorText("a  b\nc")).toBe("a&nbsp;&nbsp;b<br>c");
  });
});

describe("markdownToEditorHtml", () => {
  it("preserves trailing space after plain text", () => {
    expect(markdownToEditorHtml("Hey ")).toBe("Hey&nbsp;");
  });

  it("still wraps live bold markers", () => {
    expect(markdownToEditorHtml("**x")).toContain("<strong>");
  });
});

describe("parseChatMarkdown newlines", () => {
  it("keeps newline characters inside text nodes", () => {
    expect(parseChatMarkdown("a\nb")).toEqual([{ type: "text", value: "a\nb" }]);
  });
});
