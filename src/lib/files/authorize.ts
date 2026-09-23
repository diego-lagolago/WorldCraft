import {
  fail,
  ok,
  requireGm,
  requireStaff,
  type AuthzResult,
  type MembershipRow,
} from "@/lib/authz";
import { MAX_CHARACTER_IMAGES } from "./inspect";

export const IMAGE_KINDS = [
  "world_title",
  "map",
  "article_title",
  "character_portrait",
  "character_image",
] as const;

export type ImageKind = (typeof IMAGE_KINDS)[number];

export function authorizeImageWrite(input: {
  kind: ImageKind;
  actorId: string;
  membership: MembershipRow | null;
  ownerId: string | null;
  existingCharacterImages: number;
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
