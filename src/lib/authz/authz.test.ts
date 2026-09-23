import { describe, expect, it } from "vitest";
import {
  authorizeDeleteChatMessage,
  authorizeJournalWrite,
  authorizeLeave,
  requireCharacterOwner,
  authorizeMemberAdmin,
  type MembershipRow,
  canEditMarker,
  canSeeCharacterInWorld,
  canSeeJournal,
  canSeePublishedLayer,
  canSeeVisibility,
  isGm,
  isStaff,
  relationVisible,
} from "@/lib/authz";

describe("APP-AUTHZ Sichtbarkeit", () => {
  it("staff sees gm_only, players do not", () => {
    expect(canSeeVisibility("player", "published")).toBe(true);
    expect(canSeeVisibility("player", "gm_only")).toBe(false);
    expect(canSeeVisibility("master", "gm_only")).toBe(true);
    expect(canSeeVisibility("game_master", "gm_only")).toBe(true);
  });

  it("inherits universe → map → pin", () => {
    expect(canSeePublishedLayer("player", ["gm_only", "published", "published"])).toBe(false);
    expect(canSeePublishedLayer("master", ["gm_only", "published", "published"])).toBe(true);
    expect(canSeePublishedLayer("player", ["published", "published", "gm_only"])).toBe(false);
    expect(canSeePublishedLayer("player", ["published", "published", "published"])).toBe(true);
  });

  it("journals: B never sees A's; staff only shared", () => {
    expect(canSeeJournal({
        actorId: "b",
        role: "player",
        ownerId: "a",
        visibility: "private",
        participationArchived: false,
      })).toBe(false);
    expect(canSeeJournal({
        actorId: "b",
        role: "player",
        ownerId: "a",
        visibility: "shared_with_gm",
        participationArchived: false,
      })).toBe(false);
    expect(canSeeJournal({
        actorId: "gm",
        role: "game_master",
        ownerId: "a",
        visibility: "private",
        participationArchived: false,
      })).toBe(false);
    expect(canSeeJournal({
        actorId: "master",
        role: "master",
        ownerId: "a",
        visibility: "shared_with_gm",
        participationArchived: false,
      })).toBe(true);
    expect(canSeeJournal({
        actorId: "gm",
        role: "game_master",
        ownerId: "a",
        visibility: "shared_with_gm",
        participationArchived: true,
      })).toBe(false);
  });

  it("archived or missing participation hides the character from the world", () => {
    expect(canSeeCharacterInWorld({ archivedAt: new Date() })).toBe(false);
    expect(canSeeCharacterInWorld(null)).toBe(false);
    expect(canSeeCharacterInWorld({ archivedAt: null })).toBe(true);
  });

  it("CR-019 b: journal writes need the owner and an active participation", () => {
    const active = { archivedAt: null };
    expect(authorizeJournalWrite({ actorId: "a", ownerId: "a", participation: active }).ok).toBe(true);
    expect(authorizeJournalWrite({ actorId: "b", ownerId: "a", participation: active })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(
      authorizeJournalWrite({ actorId: "a", ownerId: "a", participation: { archivedAt: new Date() } }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(authorizeJournalWrite({ actorId: "a", ownerId: "a", participation: null })).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("only the owner changes a character", () => {
    expect(requireCharacterOwner("a", "a").ok).toBe(true);
    expect(requireCharacterOwner("b", "a")).toMatchObject({ ok: false, status: 403 });
  });

  it("player moves own marker, staff both, owner only on visible map", () => {
    expect(canEditMarker({
        role: "player",
        actorId: "a",
        ownerId: "a",
        mapVisibleToActor: true,
      })).toBe(true);
    expect(canEditMarker({
        role: "player",
        actorId: "a",
        ownerId: "b",
        mapVisibleToActor: true,
      })).toBe(false);
    expect(canEditMarker({
        role: "master",
        actorId: "m",
        ownerId: "b",
        mapVisibleToActor: true,
      })).toBe(true);
    expect(canEditMarker({
        role: "player",
        actorId: "a",
        ownerId: "a",
        mapVisibleToActor: false,
      })).toBe(false);
  });

  it("relations need both ends visible", () => {
    expect(relationVisible({ sourceVisible: true, targetVisible: false })).toBe(false);
    expect(relationVisible({ sourceVisible: true, targetVisible: true })).toBe(true);
  });

  it("GM vs Master helpers", () => {
    expect(isGm("game_master")).toBe(true);
    expect(isGm("master")).toBe(false);
    expect(isStaff("master")).toBe(true);
    expect(isStaff("player")).toBe(false);
  });
});

function row(role: MembershipRow["role"], overrides: Partial<MembershipRow> = {}): MembershipRow {
  return { id: `m-${role}`, worldId: "w", userId: role, role, archivedAt: null, ...overrides };
}

describe("APP-MEMBER-ADMIN", () => {
  it("only the game master changes roles or removes members", () => {
    expect(authorizeMemberAdmin(row("game_master"), row("player")).ok).toBe(true);
    expect(authorizeMemberAdmin(row("master"), row("player"))).toMatchObject({ ok: false, status: 403 });
    expect(authorizeMemberAdmin(row("player"), row("master"))).toMatchObject({ ok: false, status: 403 });
    expect(authorizeMemberAdmin(null, row("player"))).toMatchObject({ ok: false, status: 403 });
  });

  it("never touches the game master row, archived or foreign members", () => {
    expect(authorizeMemberAdmin(row("game_master"), row("game_master"))).toMatchObject({ ok: false, status: 409 });
    expect(authorizeMemberAdmin(row("game_master"), row("player", { archivedAt: new Date() }))).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(authorizeMemberAdmin(row("game_master"), row("player", { worldId: "other" }))).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(authorizeMemberAdmin(row("game_master"), null)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("APP-CHAT-DELETE", () => {
  const text = { authorId: "player", hasDice: false, opensThread: false };

  it("lets the author and staff delete text, and nobody delete dice or thread openers", () => {
    expect(authorizeDeleteChatMessage(row("player"), text).ok).toBe(true);
    expect(authorizeDeleteChatMessage(row("master"), { ...text, authorId: "someone" }).ok).toBe(true);
    expect(authorizeDeleteChatMessage(row("player"), { ...text, authorId: "master" })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizeDeleteChatMessage(row("game_master"), { ...text, hasDice: true })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizeDeleteChatMessage(row("master"), { ...text, opensThread: true })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizeDeleteChatMessage(null, text)).toMatchObject({ ok: false, status: 403 });
    expect(authorizeDeleteChatMessage(row("player"), null)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("leaving a world", () => {
  it("allows master and player, refuses the game master and non-members", () => {
    expect(authorizeLeave(row("player")).ok).toBe(true);
    expect(authorizeLeave(row("master")).ok).toBe(true);
    expect(authorizeLeave(row("game_master"))).toMatchObject({ ok: false, status: 409 });
    expect(authorizeLeave(row("player", { archivedAt: new Date() }))).toMatchObject({ ok: false, status: 403 });
  });
});
