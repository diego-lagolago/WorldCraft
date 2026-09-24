import { uploadImage } from "./api";
import type { ImageKind } from "@/lib/files/kinds";

/** Shared post-create path: retain the record and navigate to its settings on upload failure. */
export async function finishCreateWithImage(input: {
  file: File | null;
  kind: ImageKind;
  worldId?: string;
  targetId: string;
  onFailureHref: string;
  navigate: (href: string) => void;
}): Promise<boolean> {
  if (!input.file) return true;
  const result = await uploadImage({
    file: input.file,
    kind: input.kind,
    worldId: input.worldId,
    targetId: input.targetId,
  });
  if (result.ok) return true;
  input.navigate(input.onFailureHref);
  return false;
}
