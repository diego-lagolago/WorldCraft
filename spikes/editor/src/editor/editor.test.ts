import { describe, expect, it } from 'vitest';
import { extractMentions } from './extract-mentions';
import { sanitizePastedHtml } from './sanitize-paste';
import { searchMentions } from './search-mentions';
import { TEST_INHALTE } from './test-data';
import { categoryLabel } from './types';

describe('searchMentions', () => {
  it('findet Gottschleim und Töte den Gottschleim bei @schleim', () => {
    const hits = searchMentions(TEST_INHALTE, 'schleim');
    const titles = hits.map((h) => h.title);
    expect(titles).toContain('Gottschleim');
    expect(titles).toContain('Töte den Gottschleim');
    expect(categoryLabel(hits.find((h) => h.title === 'Gottschleim')!)).toBe('Artikel · Ort');
    expect(categoryLabel(hits.find((h) => h.title === 'Töte den Gottschleim')!)).toBe('Quest');
  });

  it('ist unabhängig von Groß-/Kleinschreibung und begrenzt auf 10', () => {
    expect(searchMentions(TEST_INHALTE, 'SCHLEIM').length).toBeGreaterThanOrEqual(2);
    expect(searchMentions(TEST_INHALTE, '').length).toBeLessThanOrEqual(10);
  });
});

describe('extractMentions', () => {
  it('liest Art und ID aus Mention-Nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: 'art-gottschleim', art: 'artikel', label: 'Gottschleim' } },
            { type: 'text', text: ' und ' },
            {
              type: 'mention',
              attrs: { id: 'quest-gottschleim', art: 'quest', label: 'Töte den Gottschleim' },
            },
          ],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual([
      { art: 'artikel', id: 'art-gottschleim' },
      { art: 'quest', id: 'quest-gottschleim' },
    ]);
  });
});

describe('sanitizePastedHtml', () => {
  it('verwirft Bild und Tabelle, behält übrigen Text', () => {
    const html =
      '<p>Vor </p><img src="x.png" alt="x"><table><tr><td>Zelltext</td></tr></table><p> nach</p>';
    const cleaned = sanitizePastedHtml(html);
    expect(cleaned.toLowerCase()).not.toContain('<img');
    expect(cleaned.toLowerCase()).not.toContain('<table');
    expect(cleaned).toContain('Vor');
    expect(cleaned).toContain('Zelltext');
    expect(cleaned).toContain('nach');
  });
});
