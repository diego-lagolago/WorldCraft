/** APP-AUTHZ / APP-VIS-INHERIT / APP-REL-VISIBLE — eine Schicht für HTTP und Tests. */

import {
  canSeeVisibility,
  fail,
  isGm,
  isStaff,
  ok,
  type AuthzFail,
  type AuthzResult,
  type MembershipRole,
  type MembershipRow,
  type VisibilityStatus,
} from "./types.ts";

export function denyIfNoMembership(
  membership: MembershipRow | null,
): AuthzFail | null {
  if (!membership || membership.archivedAt) {
    return fail(403, "Kein aktives Mitglied dieser Welt.");
  }
  return null;
}

export function requireStaff(membership: MembershipRow | null): AuthzResult<MembershipRow> {
  const denied = denyIfNoMembership(membership);
  if (denied) return denied;
  if (!isStaff(membership!.role)) {
    return fail(403, "Nur die Spielleitung darf das.");
  }
  return ok(membership!);
}

export function requireGm(membership: MembershipRow | null): AuthzResult<MembershipRow> {
  const denied = denyIfNoMembership(membership);
  if (denied) return denied;
  if (!isGm(membership!.role)) {
    return fail(403, "Nur der Game Master darf das.");
  }
  return ok(membership!);
}

export function canSeePublishedLayer(
  role: MembershipRole,
  layers: VisibilityStatus[],
): boolean {
  return layers.every((layer) => canSeeVisibility(role, layer));
}

export function canSeeJournal(input: {
  actorId: string;
  role: MembershipRole;
  ownerId: string;
  visibility: "private" | "shared_with_gm";
  participationArchived: boolean;
}): boolean {
  if (input.participationArchived) return false;
  if (input.actorId === input.ownerId) return true;
  if (input.visibility === "private") return false;
  return isStaff(input.role);
}

export function canSeeCharacterInWorld(input: {
  actorId: string;
  isMember: boolean;
  ownerId: string;
  participationArchived: boolean;
}): boolean {
  if (input.actorId === input.ownerId && !input.participationArchived) return true;
  return input.isMember && !input.participationArchived;
}

export function canEditMarker(input: {
  role: MembershipRole;
  actorId: string;
  ownerId: string;
  mapVisibleToActor: boolean;
}): boolean {
  if (isStaff(input.role)) return input.mapVisibleToActor;
  return input.actorId === input.ownerId && input.mapVisibleToActor;
}

export function relationVisible(input: {
  sourceVisible: boolean;
  targetVisible: boolean;
}): boolean {
  return input.sourceVisible && input.targetVisible;
}
