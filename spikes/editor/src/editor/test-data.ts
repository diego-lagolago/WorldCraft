import type { MentionItem } from './types';

/** Testdaten gemäß T-005 / fachliches Modell 2.4. */
export const TEST_INHALTE: MentionItem[] = [
  { id: 'art-gottschleim', art: 'artikel', title: 'Gottschleim', vorlagentyp: 'Ort' },
  { id: 'quest-gottschleim', art: 'quest', title: 'Töte den Gottschleim' },
  { id: 'char-mira', art: 'charakter', title: 'Mira Schleier' },
  { id: 'uni-material', art: 'universum', title: 'Materielle Ebene' },
  { id: 'art-rabenstein', art: 'artikel', title: 'Burg Rabenstein', vorlagentyp: 'Ort' },
  { id: 'quest-offen', art: 'quest', title: 'Die offene Tür' },
];
