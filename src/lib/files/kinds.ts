/** Image targets accepted by the file endpoint. Kept dependency-free for client use. */
export const IMAGE_KINDS = [
  "world_title",
  "map",
  "article_title",
  "monster_portrait",
  "character_portrait",
  "character_image",
] as const;

export type ImageKind = (typeof IMAGE_KINDS)[number];
