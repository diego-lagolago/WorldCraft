import type { ContentKind } from "@/lib/authz";
import { contentKindLabel } from "@/lib/i18n";
import { templateOf } from "@/lib/templates/registry";

export type RelationTargetOption = { kind: ContentKind; id: string; title: string };

export type LinkedItem = {
  kind: ContentKind;
  id: string;
  title: string;
  href: string;
  originLabels: string[];
  manualLabel: string | null;
  pinType?: string;
  mapName?: string;
  templateType?: string;
  portraitId?: string | null;
};

export const LINKED_KIND_ORDER: readonly ContentKind[] = [
  "pin",
  "article",
  "quest",
  "character",
  "universe",
  "monster",
];

export function linkedGroupLabel(kind: ContentKind, templateType?: string): string {
  if (kind === "article") {
    const template = templateOf(templateType ?? "none");
    return template.type === "none" ? "Artikel" : template.plural;
  }
  return contentKindLabel(kind, "other");
}

/** Fachmodell 2.5: kind groups, articles split by template; empty groups omitted. */
export function groupLinkedItems(items: LinkedItem[]): { label: string; items: LinkedItem[] }[] {
  const groups: { label: string; items: LinkedItem[] }[] = [];
  for (const kind of LINKED_KIND_ORDER) {
    const ofKind = items.filter((item) => item.kind === kind);
    if (ofKind.length === 0) continue;
    if (kind === "article") {
      const byTemplate = new Map<string, LinkedItem[]>();
      for (const item of ofKind) {
        const key = item.templateType ?? "none";
        const list = byTemplate.get(key) ?? [];
        list.push(item);
        byTemplate.set(key, list);
      }
      const ordered = [...byTemplate.entries()].sort((a, b) =>
        linkedGroupLabel("article", a[0]).localeCompare(linkedGroupLabel("article", b[0]), "de"),
      );
      for (const [template, rows] of ordered) {
        groups.push({ label: linkedGroupLabel("article", template), items: rows });
      }
      continue;
    }
    groups.push({ label: linkedGroupLabel(kind), items: ofKind });
  }
  return groups;
}
