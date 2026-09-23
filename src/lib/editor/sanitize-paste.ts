const REMOVE_TAGS = new Set([
  "IMG",
  "PICTURE",
  "SOURCE",
  "VIDEO",
  "AUDIO",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "CANVAS",
  "FIGURE",
  "FIGCAPTION",
]);

const TABLE_TAGS = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "COLGROUP", "COL"]);

/**
 * Drops images, tables and embedded media from pasted HTML. A table is
 * replaced by its cell text so the rest of the content survives (ADR-004).
 */
export function sanitizePastedHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll("*").forEach((el) => {
    if (REMOVE_TAGS.has(el.tagName)) el.remove();
  });

  for (const table of Array.from(doc.querySelectorAll("table"))) {
    const text = (table.textContent ?? "").replace(/\s+/g, " ").trim();
    table.replaceWith(doc.createTextNode(text));
  }

  doc.querySelectorAll("*").forEach((el) => {
    if (TABLE_TAGS.has(el.tagName)) {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      el.replaceWith(doc.createTextNode(text));
    }
  });

  return doc.body.innerHTML;
}

export function clipboardContainsOnlyImage(data: DataTransfer | null): boolean {
  if (!data) return false;
  const types = Array.from(data.types);
  const hasImage =
    types.some((type) => type.startsWith("Files") || type.startsWith("image/")) ||
    Array.from(data.items).some((item) => item.type.startsWith("image/"));
  const hasText = Boolean(data.getData("text/html") || data.getData("text/plain"));
  return hasImage && !hasText;
}
