import type { MentionItem } from './types';

/**
 * Erwähnungssuche nach fachlichem Modell 2.4:
 * Teilwort, ohne Groß-/Kleinschreibung, höchstens 10 Treffer.
 * Sortierung: Treffer am Wortanfang vor Treffern mitten im Wort, danach alphabetisch.
 */
export function searchMentions(items: MentionItem[], query: string): MentionItem[] {
  const q = query.trim().toLowerCase();
  const pool = q
    ? items.filter((item) => item.title.toLowerCase().includes(q))
    : [...items];

  const wordStart = (title: string) =>
    title
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.startsWith(q));

  pool.sort((a, b) => {
    if (q) {
      const aStart = wordStart(a.title);
      const bStart = wordStart(b.title);
      if (aStart !== bStart) return aStart ? -1 : 1;
    }
    return a.title.localeCompare(b.title, 'de');
  });

  return pool.slice(0, 10);
}
