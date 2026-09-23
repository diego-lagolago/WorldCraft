import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { inviteLinks, memberships, worlds } from "@/db/schema";
import { fail, ok, requireGm, type AuthzResult, type MembershipRow } from "@/lib/authz";

export const INVITE_VALIDITIES = ["one_day", "seven_days", "unlimited"] as const;
export type InviteValidity = (typeof INVITE_VALIDITIES)[number];
export const inviteValiditySchema = z.enum(INVITE_VALIDITIES);

/** APP-INVITE-ENTROPY: 32 random bytes, url-safe. */
export const INVITE_CODE_BYTES = 32;
export const inviteCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

const DAY_MS = 24 * 60 * 60 * 1000;
const VALIDITY_MS: Record<InviteValidity, number | null> = {
  one_day: DAY_MS,
  seven_days: 7 * DAY_MS,
  unlimited: null,
};

export function inviteExpiresAt(validity: InviteValidity, now: Date): Date | null {
  const ms = VALIDITY_MS[validity];
  return ms === null ? null : new Date(now.getTime() + ms);
}

export type InviteStatus = "valid" | "expired" | "revoked";

/** APP-INVITE-VALID: not revoked and not expired. */
export function inviteStatus(
  invite: { revokedAt: Date | null; expiresAt: Date | null },
  now: Date,
): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

const validNow = () =>
  and(isNull(inviteLinks.revokedAt), or(isNull(inviteLinks.expiresAt), gt(inviteLinks.expiresAt, sql`now()`)));

export type InviteSummary = {
  id: string;
  code: string;
  validity: InviteValidity;
  expiresAt: Date | null;
  revokedAt: Date | null;
  useCount: number;
  createdAt: Date;
  status: InviteStatus;
};

export async function listInvites(membership: MembershipRow | null): Promise<AuthzResult<InviteSummary[]>> {
  const gm = requireGm(membership);
  if (!gm.ok) return gm;
  const rows = await db
    .select({
      id: inviteLinks.id,
      code: inviteLinks.code,
      validity: inviteLinks.validity,
      expiresAt: inviteLinks.expiresAt,
      revokedAt: inviteLinks.revokedAt,
      useCount: inviteLinks.useCount,
      createdAt: inviteLinks.createdAt,
    })
    .from(inviteLinks)
    .where(eq(inviteLinks.worldId, gm.data.worldId))
    .orderBy(desc(inviteLinks.createdAt));
  const now = new Date();
  return ok(rows.map((row) => ({ ...row, status: inviteStatus(row, now) })));
}

export async function createInvite(input: {
  membership: MembershipRow | null;
  actorId: string;
  validity: InviteValidity;
}): Promise<AuthzResult<InviteSummary>> {
  const gm = requireGm(input.membership);
  if (!gm.ok) return gm;
  const now = new Date();
  const [row] = await db
    .insert(inviteLinks)
    .values({
      worldId: gm.data.worldId,
      code: randomBytes(INVITE_CODE_BYTES).toString("base64url"),
      validity: input.validity,
      expiresAt: inviteExpiresAt(input.validity, now),
      createdBy: input.actorId,
      updatedBy: input.actorId,
    })
    .returning({
      id: inviteLinks.id,
      code: inviteLinks.code,
      validity: inviteLinks.validity,
      expiresAt: inviteLinks.expiresAt,
      revokedAt: inviteLinks.revokedAt,
      useCount: inviteLinks.useCount,
      createdAt: inviteLinks.createdAt,
    });
  return ok({ ...row, status: "valid" });
}

export async function revokeInvite(input: {
  membership: MembershipRow | null;
  actorId: string;
  inviteId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const gm = requireGm(input.membership);
  if (!gm.ok) return gm;
  const now = new Date();
  const updated = await db
    .update(inviteLinks)
    .set({ revokedAt: now, updatedAt: now, updatedBy: input.actorId })
    .where(and(eq(inviteLinks.id, input.inviteId), eq(inviteLinks.worldId, gm.data.worldId)))
    .returning({ id: inviteLinks.id, revokedAt: inviteLinks.revokedAt });
  if (updated.length === 0) return fail(404, "Diese Einladung gibt es nicht.");
  return ok({ id: input.inviteId });
}

export type InvitePreview = {
  worldId: string;
  worldName: string;
  status: InviteStatus;
  membership: "active" | "archived" | "none";
};

/** For `/invite/[code]`: never reveals anything but the world name of a real code. */
export async function getInvitePreview(code: string, userId: string): Promise<InvitePreview | null> {
  if (!inviteCodeSchema.safeParse(code).success) return null;
  const [row] = await db
    .select({
      worldId: worlds.id,
      worldName: worlds.name,
      revokedAt: inviteLinks.revokedAt,
      expiresAt: inviteLinks.expiresAt,
      membershipId: memberships.id,
      archivedAt: memberships.archivedAt,
    })
    .from(inviteLinks)
    .innerJoin(worlds, eq(worlds.id, inviteLinks.worldId))
    .leftJoin(memberships, and(eq(memberships.worldId, worlds.id), eq(memberships.userId, userId)))
    .where(eq(inviteLinks.code, code))
    .limit(1);
  if (!row) return null;
  return {
    worldId: row.worldId,
    worldName: row.worldName,
    status: inviteStatus(row, new Date()),
    membership: !row.membershipId ? "none" : row.archivedAt ? "archived" : "active",
  };
}

/**
 * APP-INVITE-JOIN (CR-008): one transaction; insert or reactivate as player
 * via `ON CONFLICT`, an active membership stays untouched (no-op), the counter
 * rises atomically only when someone actually joined.
 */
export async function joinByInvite(input: {
  code: string;
  userId: string;
}): Promise<AuthzResult<{ worldId: string; joined: boolean }>> {
  if (!inviteCodeSchema.safeParse(input.code).success) {
    return fail(404, "Diese Einladung gibt es nicht.");
  }
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select({ id: inviteLinks.id, worldId: inviteLinks.worldId })
      .from(inviteLinks)
      .where(and(eq(inviteLinks.code, input.code), validNow()))
      .limit(1);
    if (!invite) {
      const [known] = await tx
        .select({ id: inviteLinks.id })
        .from(inviteLinks)
        .where(eq(inviteLinks.code, input.code))
        .limit(1);
      return known
        ? fail(409, "Diese Einladung ist abgelaufen oder wurde widerrufen.")
        : fail(404, "Diese Einladung gibt es nicht.");
    }

    const now = new Date();
    const joined = await tx
      .insert(memberships)
      .values({
        worldId: invite.worldId,
        userId: input.userId,
        role: "player",
        joinedAt: now,
        joinedViaInviteId: invite.id,
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .onConflictDoUpdate({
        target: [memberships.worldId, memberships.userId],
        set: {
          archivedAt: null,
          role: "player",
          joinedAt: now,
          joinedViaInviteId: invite.id,
          updatedAt: now,
          updatedBy: input.userId,
        },
        setWhere: sql`${memberships.archivedAt} IS NOT NULL`,
      })
      .returning({ id: memberships.id });

    if (joined.length > 0) {
      await tx
        .update(inviteLinks)
        .set({ useCount: sql`${inviteLinks.useCount} + 1` })
        .where(eq(inviteLinks.id, invite.id));
    }
    return ok({ worldId: invite.worldId, joined: joined.length > 0 });
  });
}
