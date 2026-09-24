import type { ContentKind } from "@/lib/authz";

export type EditableContentKind = Extract<ContentKind, "article" | "quest" | "universe" | "monster">;

/** Canonical in-app path for a content row, including pin deep-links. */
export function contentHref(worldId: string, kind: ContentKind, id: string): string;
export function contentHref(worldId: string, kind: EditableContentKind, id: string, action: "edit"): string;
export function contentHref(
  worldId: string,
  kind: ContentKind,
  id: string,
  action?: "edit",
): string {
  if (action === "edit") return `/w/${worldId}/${kind}s/${id}/edit`;
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

/** Canonical create path for content types that have an editor route. */
export function contentNewHref(worldId: string, kind: EditableContentKind): string {
  return `/w/${worldId}/${kind}s/new`;
}
