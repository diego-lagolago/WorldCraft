/** Spike T-011 — Rechteprüfung. Namen folgen `.ai/architecture/datenmodell.md`. */

export const MEMBERSHIP_ROLES = ["game_master", "master", "player"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const VISIBILITY_STATUSES = ["published", "gm_only"] as const;
export type VisibilityStatus = (typeof VISIBILITY_STATUSES)[number];

export const JOURNAL_VISIBILITIES = ["private", "shared_with_gm"] as const;
export type JournalVisibility = (typeof JOURNAL_VISIBILITIES)[number];

export const CONTENT_KINDS = [
  "article",
  "quest",
  "character",
  "pin",
  "universe",
] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const RELATION_ORIGINS = [
  "mention",
  "template_field",
  "participation",
  "manual",
] as const;
export type RelationOrigin = (typeof RELATION_ORIGINS)[number];

export const PIN_TYPES = [
  "danger",
  "boss",
  "house",
  "city",
  "treasure",
  "landmark",
  "fishing",
  "plants",
  "dungeon",
  "quest",
  "teleporter",
  "shop",
] as const;
export type PinType = (typeof PIN_TYPES)[number];

export const INVITE_VALIDITIES = ["one_day", "seven_days", "unlimited"] as const;
export type InviteValidity = (typeof INVITE_VALIDITIES)[number];

export const SKILL_KEYS = [
  "athletics",
  "acrobatics",
  "sleight_of_hand",
  "stealth",
  "arcana",
  "history",
  "investigation",
  "nature",
  "religion",
  "animal_handling",
  "insight",
  "medicine",
  "perception",
  "survival",
  "deception",
  "intimidation",
  "performance",
  "persuasion",
] as const;

export const DEFAULT_SKILLS: Record<(typeof SKILL_KEYS)[number], "untrained"> =
  Object.fromEntries(SKILL_KEYS.map((key) => [key, "untrained"])) as Record<
    (typeof SKILL_KEYS)[number],
    "untrained"
  >;

export const FIRST_UNIVERSE_NAME = "Hauptuniversum";

export type Actor = {
  id: string;
  name: string;
};

export type MembershipRow = {
  id: string;
  worldId: string;
  userId: string;
  role: MembershipRole;
  archivedAt: Date | null;
};

export type AuthzFail = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 409;
  error: string;
};

export type AuthzOk<T> = { ok: true; data: T };
export type AuthzResult<T> = AuthzOk<T> | AuthzFail;

export function fail(
  status: AuthzFail["status"],
  error: string,
): AuthzFail {
  return { ok: false, status, error };
}

export function ok<T>(data: T): AuthzOk<T> {
  return { ok: true, data };
}

export function isStaff(role: MembershipRole): boolean {
  return role === "game_master" || role === "master";
}

export function isGm(role: MembershipRole): boolean {
  return role === "game_master";
}

export function canSeeVisibility(
  role: MembershipRole,
  visibility: VisibilityStatus,
): boolean {
  return visibility === "published" || isStaff(role);
}
