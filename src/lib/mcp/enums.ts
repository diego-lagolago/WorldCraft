import { MONSTER_KINDS, MONSTER_KIND_LABEL, MONSTER_RARITIES, MONSTER_RARITY_LABEL } from "@/lib/monsters/labels";
import { TEMPLATE_TYPES, type TemplateType } from "@/lib/templates/registry";

export const MCP_CONTENT_KIND = {
  artikel: "article",
  quest: "quest",
  charakter: "character",
  pin: "pin",
  monster: "monster",
  universum: "universe",
} as const;

export const MCP_CONTENT_KIND_LABEL = {
  artikel: "Artikel",
  quest: "Quest",
  charakter: "Charakter",
  pin: "Pin",
  monster: "Monster",
  universum: "Universum",
} as const;

export const MCP_CONTENT_KIND_FROM_INTERNAL = Object.fromEntries(
  Object.entries(MCP_CONTENT_KIND).map(([label, value]) => [value, label]),
) as Record<(typeof MCP_CONTENT_KIND)[keyof typeof MCP_CONTENT_KIND], keyof typeof MCP_CONTENT_KIND>;

export const MCP_TEMPLATE_TYPE = {
  person: "person",
  ort: "place",
  organisation: "organization",
  gegenstand: "item",
  rasse: "race",
  ohne: "none",
} as const satisfies Record<string, TemplateType>;

export const MCP_QUEST_STATUS = {
  offen: "open",
  aktiv: "active",
  abgeschlossen: "completed",
  gescheitert: "failed",
} as const;

export const MCP_QUEST_STATUS_LABEL = Object.fromEntries(
  Object.entries(MCP_QUEST_STATUS).map(([label, value]) => [value, label]),
) as Record<(typeof MCP_QUEST_STATUS)[keyof typeof MCP_QUEST_STATUS], keyof typeof MCP_QUEST_STATUS>;

export const MCP_MONSTER_KIND_LABELS = Object.values(MONSTER_KIND_LABEL) as [string, ...string[]];

/** Keeps MCP's labels complete whenever a domain enum gets extended. */
export const MCP_ENUMS_COMPLETE = {
  templateTypes: TEMPLATE_TYPES.length === 6,
  monsterKinds: MONSTER_KINDS.every((kind) => Boolean(MONSTER_KIND_LABEL[kind])),
  monsterRarities: MONSTER_RARITIES.every((rarity) => Boolean(MONSTER_RARITY_LABEL[rarity])),
  questStatuses: Object.keys(MCP_QUEST_STATUS).length === 4,
};
