import { describe, expect, it } from "vitest";
import { tiptapJsonToMcpMarkdown } from "./tiptap-mcp-markdown";

describe("tiptapJsonToMcpMarkdown", () => {
  it("serializes permitted editor nodes without passing raw JSON through", () => {
    expect(tiptapJsonToMcpMarkdown({ type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Titel" }] },
      { type: "paragraph", content: [
        { type: "text", text: "Siehe " },
        { type: "mention", attrs: { kind: "article", id: "abc", label: "Burg" } },
      ] },
    ] })).toBe("## Titel\n\nSiehe @[Burg](artikel:abc)");
  });
});
