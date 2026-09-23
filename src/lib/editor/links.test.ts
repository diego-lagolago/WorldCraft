import { describe, expect, it } from "vitest";
import { isAllowedLinkHref, normalizeLinkHref } from "./links";

describe("normalizeLinkHref", () => {
  it("keeps http and https links", () => {
    expect(normalizeLinkHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(normalizeLinkHref("  http://example.com ")).toBe("http://example.com");
  });

  it("adds https to scheme-less addresses", () => {
    expect(normalizeLinkHref("example.com/wiki")).toBe("https://example.com/wiki");
    expect(normalizeLinkHref("example.com:8080/x")).toBe("https://example.com:8080/x");
    expect(normalizeLinkHref("//cdn.example.com")).toBe("https://cdn.example.com");
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<b>x</b>",
    "vbscript:msgbox",
    "mailto:a@example.com",
    "file:///etc/passwd",
    "/relative",
    "#anchor",
    "?q=1",
    "",
    "https://exa mple.com",
  ])("rejects %j", (href) => {
    expect(normalizeLinkHref(href)).toBeNull();
    expect(isAllowedLinkHref(href)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(normalizeLinkHref(undefined)).toBeNull();
    expect(normalizeLinkHref(42)).toBeNull();
  });
});
