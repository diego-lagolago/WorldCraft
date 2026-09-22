const REMOVE_TAGS = new Set([
  'IMG',
  'PICTURE',
  'SOURCE',
  'VIDEO',
  'AUDIO',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'SVG',
  'CANVAS',
  'FIGURE',
  'FIGCAPTION',
]);

const TABLE_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'COLGROUP', 'COL']);

/**
 * Entfernt Bilder, Tabellen und eingebettete Medien aus eingefügtem HTML.
 * Tabellenzellen werden durch ihren Text ersetzt, damit der übrige Inhalt bleibt.
 */
export function sanitizePastedHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('*').forEach((el) => {
    if (REMOVE_TAGS.has(el.tagName)) {
      el.remove();
    }
  });

  // Innere Zellen zuerst, dann Zeilen, dann Tabelle.
  const tables = Array.from(doc.querySelectorAll('table'));
  for (const table of tables) {
    const text = (table.textContent ?? '').replace(/\s+/g, ' ').trim();
    table.replaceWith(text ? doc.createTextNode(text) : doc.createTextNode(''));
  }

  doc.querySelectorAll('*').forEach((el) => {
    if (TABLE_TAGS.has(el.tagName)) {
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      el.replaceWith(text ? doc.createTextNode(text) : doc.createTextNode(''));
    }
  });

  return doc.body.innerHTML;
}

export function clipboardContainsOnlyImage(data: DataTransfer | null): boolean {
  if (!data) return false;
  const types = Array.from(data.types);
  const hasImage = types.some((t) => t.startsWith('Files') || t.startsWith('image/'))
    || Array.from(data.items).some((i) => i.type.startsWith('image/'));
  const hasText = Boolean(data.getData('text/html') || data.getData('text/plain'));
  return hasImage && !hasText;
}
