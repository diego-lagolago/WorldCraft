/** Spike T-011 — Rechteprüfung. Gemeinsame Typen leben in `src/lib/authz`. */

export {
  CONTENT_KINDS,
  JOURNAL_VISIBILITIES,
  MEMBERSHIP_ROLES,
  RELATION_ORIGINS,
  VISIBILITY_STATUSES,
  canSeeVisibility,
  fail,
  isGm,
  isStaff,
  ok,
  type Actor,
  type AuthzFail,
  type AuthzOk,
  type AuthzResult,
  type ContentKind,
  type JournalVisibility,
  type MembershipRole,
  type MembershipRow,
  type RelationOrigin,
  type VisibilityStatus,
} from "@/lib/authz";

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

export const FIRST_UNIVERSE_NAME = "Hauptuniversum";
