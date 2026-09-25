/** Client-safe monster enums and German/English labels (Plan 005 Begriffe). */

export const MONSTER_KINDS = [
  "beast",
  "undead",
  "demon",
  "dragon",
  "humanoid",
  "construct",
  "aberration",
  "plant",
  "magical",
  "other",
] as const;
export type MonsterKind = (typeof MONSTER_KINDS)[number];

export const MONSTER_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type MonsterRarity = (typeof MONSTER_RARITIES)[number];

export const MONSTER_DANGERS = [
  "harmless",
  "dangerous",
  "deadly",
  "devastating",
  "divine",
  "apocalyptic",
] as const;
export type MonsterDanger = (typeof MONSTER_DANGERS)[number];

export const MONSTER_SIZES = ["tiny", "small", "medium", "large", "gigantic"] as const;
export type MonsterSize = (typeof MONSTER_SIZES)[number];

export const MONSTER_KIND_LABEL: Record<MonsterKind, string> = {
  beast: "Bestie",
  undead: "Untoter",
  demon: "Dämon",
  dragon: "Drache",
  humanoid: "Humanoid",
  construct: "Konstrukt",
  aberration: "Aberration",
  plant: "Pflanze",
  magical: "Magisch",
  other: "sonstiges",
};

/** Seltenheits-Pill: deutsche Labels (Owner 2026-09-24; zuvor englisch). */
export const MONSTER_RARITY_LABEL: Record<MonsterRarity, string> = {
  common: "Gewöhnlich",
  uncommon: "Ungewöhnlich",
  rare: "Selten",
  epic: "Episch",
  legendary: "Legendär",
};

export const MONSTER_DANGER_LABEL: Record<MonsterDanger, string> = {
  harmless: "Harmlos",
  dangerous: "Gefährlich",
  deadly: "Tödlich",
  devastating: "Verheerend",
  divine: "Göttlich",
  apocalyptic: "Apokalyptisch",
};

export const MONSTER_SIZE_LABEL: Record<MonsterSize, string> = {
  tiny: "Winzig",
  small: "Klein",
  medium: "Durchschnitt",
  large: "Groß",
  gigantic: "Gigantisch",
};

export function isMonsterKind(value: string): value is MonsterKind {
  return (MONSTER_KINDS as readonly string[]).includes(value);
}

export function isMonsterRarity(value: unknown): value is MonsterRarity {
  return typeof value === "string" && (MONSTER_RARITIES as readonly string[]).includes(value);
}
