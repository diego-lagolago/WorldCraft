/** APP-AUTHZ / APP-VIS-INHERIT / APP-REL-VISIBLE — one layer for HTTP, UI loaders, and later MCP. */

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
} from "./types";

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
  if (denied || !membership) {
    return denied ?? fail(403, "Kein aktives Mitglied dieser Welt.");
  }
  if (!isStaff(membership.role)) {
    return fail(403, "Nur die Spielleitung darf das.");
  }
  return ok(membership);
}

export function requireGm(membership: MembershipRow | null): AuthzResult<MembershipRow> {
  const denied = denyIfNoMembership(membership);
  if (denied || !membership) {
    return denied ?? fail(403, "Kein aktives Mitglied dieser Welt.");
  }
  if (!isGm(membership.role)) {
    return fail(403, "Nur der Game Master darf das.");
  }
  return ok(membership);
}

/**
 * APP-MEMBER-ADMIN: role change and removal only by the game master, never on
 * the game master row, only on active members of the same world.
 */
export function authorizeMemberAdmin(
  actor: MembershipRow | null,
  target: MembershipRow | null,
): AuthzResult<MembershipRow> {
  const gm = requireGm(actor);
  if (!gm.ok) return gm;
  if (!target || target.worldId !== gm.data.worldId || target.archivedAt) {
    return fail(404, "Dieses Mitglied gibt es nicht.");
  }
  if (isGm(target.role)) return fail(409, "Am Game Master lässt sich nichts ändern.");
  return ok(target);
}

/** Every active member may leave, except the game master (R-3.3-3). */
export function authorizeLeave(membership: MembershipRow | null): AuthzResult<MembershipRow> {
  const denied = denyIfNoMembership(membership);
  if (denied || !membership) return denied ?? fail(403, "Kein aktives Mitglied dieser Welt.");
  if (isGm(membership.role)) {
    return fail(409, "Der Game Master kann die Welt nicht verlassen. Er kann sie nur löschen.");
  }
  return ok(membership);
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
