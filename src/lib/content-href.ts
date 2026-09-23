import type { ContentKind } from "@/lib/authz";

/** Canonical in-app path for a content row, including pin deep-links. */
export function contentHref(worldId: string, kind: ContentKind, id: string): string {
  switch (kind) {
    case "pin":
      return `/w/${worldId}/map?pin=${id}`;
    case "article":
      return `/w/${worldId}/articles/${id}`;
    case "quest":
      return `/w/${worldId}/quests/${id}`;
    case "character":
      return `/w/${worldId}/characters/${id}`;
    case "universe":
      return `/w/${worldId}/universes/${id}`;
    case "monster":
      return `/w/${worldId}/monsters/${id}`;
  }
}
