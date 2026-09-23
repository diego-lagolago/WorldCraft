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

/**
 * Inside a world the viewer is already an active member (`loadWorldContext`),
 * so only the participation decides; archived hides it from everyone (R-3.9-4).
 */
export function canSeeCharacterInWorld(participation: { archivedAt: Date | null } | null): boolean {
  return participation !== null && participation.archivedAt === null;
}

/** Only the owner changes a character, its images and its world participations. */
export function requireCharacterOwner(actorId: string, ownerId: string): AuthzResult<true> {
  return actorId === ownerId ? ok(true) : fail(403, "Nur der Besitzer darf diesen Charakter ändern.");
}

/** CR-019 b: journal entries need the owner and an active participation in this world. */
export function authorizeJournalWrite(input: {
  actorId: string;
  ownerId: string;
  participation: { archivedAt: Date | null } | null;
}): AuthzResult<true> {
  const owner = requireCharacterOwner(input.actorId, input.ownerId);
  if (!owner.ok) return fail(403, "Nur der Besitzer des Charakters schreibt ins Tagebuch.");
  if (!canSeeCharacterInWorld(input.participation)) {
    return fail(400, "Der Charakter ist nicht in diese Welt mitgebracht.");
  }
  return ok(true);
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

/** APP-CHAT-DELETE: author or staff may delete text; dice and thread openers never. */
export function authorizeDeleteChatMessage(
  actor: MembershipRow | null,
  message: { authorId: string; hasDice: boolean; opensThread: boolean } | null,
): AuthzResult<true> {
  const denied = denyIfNoMembership(actor);
  if (denied || !actor) return denied ?? fail(403, "Kein aktives Mitglied dieser Welt.");
  if (!message) return fail(404, "Diese Nachricht gibt es nicht.");
  if (message.hasDice) return fail(403, "Würfelwürfe kann niemand löschen.");
  if (message.opensThread) {
    return fail(403, "Eine Nachricht, die einen Thread eröffnet, kann nicht gelöscht werden.");
  }
  if (message.authorId === actor.userId || isStaff(actor.role)) return ok(true);
  return fail(403, "Nur der Autor oder die Spielleitung darf diese Nachricht löschen.");
}
