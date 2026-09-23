/** Shared authorization types. One layer for HTTP, loaders, and later MCP. */

export const MEMBERSHIP_ROLES = ["game_master", "master", "player"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const VISIBILITY_STATUSES = ["published", "gm_only"] as const;
export type VisibilityStatus = (typeof VISIBILITY_STATUSES)[number];

/** Dreistufige Sichtbarkeit (Artikel, Quest, Pin, Kapitel). Plan 004. */
export const CONTENT_VISIBILITIES = ["owner_only", "gm_only", "published"] as const;
export type ContentVisibility = (typeof CONTENT_VISIBILITIES)[number];

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

/** Column patch for Drizzle updates. Prefer this over `Record<string, unknown>`. */
export type ColumnPatch<T> = {
  [K in keyof T]?: T[K];
};

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

/** APP-VIS-OWNER: published → member; gm_only → staff; owner_only → owner AND staff (R1: player rights rest). */
export function canSeeVisibility(input: {
  role: MembershipRole;
  visibility: VisibilityStatus | ContentVisibility;
  viewerId: string;
  /** Required for owner_only; ignored for two-tier VisibilityStatus. */
  ownerId?: string | null;
}): boolean {
  if (input.visibility === "published") return true;
  if (input.visibility === "gm_only") return isStaff(input.role);
  // owner_only
  if (!isStaff(input.role)) return false;
  return input.ownerId != null && input.viewerId === input.ownerId;
}
