import type { ContentKind } from "@/lib/authz";

type ContentKindForm = "one" | "other";
export type ContentKindLabelKey = {
  [Kind in ContentKind]: `contentKind.${Kind}.${ContentKindForm}`;
}[ContentKind];

/** Client-safe German system labels. A missing content kind/form is a TS error. */
export const de: Record<ContentKindLabelKey, string> = {
  "contentKind.article.one": "Artikel",
  "contentKind.article.other": "Artikel",
  "contentKind.quest.one": "Quest",
  "contentKind.quest.other": "Quests",
  "contentKind.character.one": "Charakter",
  "contentKind.character.other": "Charaktere",
  "contentKind.pin.one": "Pin",
  "contentKind.pin.other": "Pins",
  "contentKind.universe.one": "Universum",
  "contentKind.universe.other": "Universen",
  "contentKind.monster.one": "Monster",
  "contentKind.monster.other": "Monster",
};
