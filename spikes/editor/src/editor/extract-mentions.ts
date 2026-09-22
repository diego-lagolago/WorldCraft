import type { InhaltArt, Inhaltsverweis } from './types';

const ARTEN: InhaltArt[] = ['artikel', 'quest', 'charakter', 'universum'];

function isArt(value: unknown): value is InhaltArt {
  return typeof value === 'string' && (ARTEN as string[]).includes(value);
}

type JsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
};

/** Alle Erwähnungen (Art + ID) in Dokumentreihenfolge. */
export function extractMentions(doc: unknown): Inhaltsverweis[] {
  const out: Inhaltsverweis[] = [];
  walk(doc, out);
  return out;
}

function walk(node: unknown, out: Inhaltsverweis[]) {
  if (!node || typeof node !== 'object') return;
  const n = node as JsonNode;
  if (n.type === 'mention') {
    const id = n.attrs?.id;
    const art = n.attrs?.art;
    if (typeof id === 'string' && isArt(art)) {
      out.push({ art, id });
    }
  }
  n.content?.forEach((child) => walk(child, out));
}
