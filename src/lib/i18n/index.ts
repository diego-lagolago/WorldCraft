import type { ContentKind } from "@/lib/authz";
import { de, type ContentKindLabelKey } from "./de";

export function label(key: ContentKindLabelKey): string {
  return de[key];
}

export function contentKindLabel(kind: ContentKind, form: "one" | "other" = "one"): string {
  return label(`contentKind.${kind}.${form}` as ContentKindLabelKey);
}
