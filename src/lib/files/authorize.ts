import {
  authorizeOwnedContentWrite,
  fail,
  ok,
  requireGm,
  requireStaff,
  type AuthzResult,
  type ContentVisibility,
  type MembershipRow,
} from "@/lib/authz";
import { MAX_CHARACTER_IMAGES } from "./inspect";
import { MONSTER_NOT_FOUND } from "@/lib/monsters/messages";
import type { ImageKind } from "./kinds";

export { IMAGE_KINDS, type ImageKind } from "./kinds";

export function authorizeImageWrite(input: {
  kind: ImageKind;
  actorId: string;
  membership: MembershipRow | null;
  ownerId: string | null;
  existingCharacterImages: number;
  /** Required for `monster_portrait`: visibility + owner of the target monster. */
  content?: { ownerId: string; visibility: ContentVisibility } | null;
}): AuthzResult<true> {
  if (input.kind === "world_title") {
    const gm = requireGm(input.membership);
    if (!gm.ok) return gm;
    return ok(true);
  }
  if (input.kind === "map" || input.kind === "article_title") {
    const staff = requireStaff(input.membership);
    if (!staff.ok) return staff;
    return ok(true);
  }
  if (input.kind === "monster_portrait") {
    return authorizeOwnedContentWrite({
      membership: input.membership,
      content: input.content ?? null,
      notFoundError: MONSTER_NOT_FOUND,
    });
  }

  if (!input.ownerId || input.ownerId !== input.actorId) {
    return fail(403, "Nur der Besitzer darf Bilder an diesem Charakter ändern.");
  }
  if (
    input.kind === "character_image" &&
    input.existingCharacterImages >= MAX_CHARACTER_IMAGES
  ) {
    return fail(400, "Ein Charakter kann höchstens 10 Bildanhänge haben.");
  }
  return ok(true);
}
