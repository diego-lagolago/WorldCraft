export type InhaltArt = 'artikel' | 'quest' | 'charakter' | 'universum';

export type MentionItem = {
  id: string;
  art: InhaltArt;
  title: string;
  /** Nur bei Artikeln, z. B. „Ort“. */
  vorlagentyp?: string;
};

export type Inhaltsverweis = {
  art: InhaltArt;
  id: string;
};

export const ART_LABEL: Record<InhaltArt, string> = {
  artikel: 'Artikel',
  quest: 'Quest',
  charakter: 'Charakter',
  universum: 'Universum',
};

export function categoryLabel(item: MentionItem): string {
  if (item.art === 'artikel' && item.vorlagentyp) {
    return `Artikel · ${item.vorlagentyp}`;
  }
  return ART_LABEL[item.art];
}
