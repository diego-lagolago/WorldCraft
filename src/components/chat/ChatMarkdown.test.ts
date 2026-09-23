import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";

describe("ChatMarkdown", () => {
  it("renders paragraph breaks as <br>", () => {
    const html = renderToStaticMarkup(createElement(ChatMarkdown, { text: "Zeile 1\nZeile 2" }));
    expect(html).toContain("Zeile 1");
    expect(html).toContain("<br/>");
    expect(html).toContain("Zeile 2");
  });

  it("still renders bold", () => {
    const html = renderToStaticMarkup(createElement(ChatMarkdown, { text: "**fett**" }));
    expect(html).toBe("<strong>fett</strong>");
  });
});
