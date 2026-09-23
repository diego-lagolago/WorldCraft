import { describe, expect, it } from "vitest";
import {
  authorizeDeleteChatMessage,
  authorizeEditChatMessage,
  authorizeRenameChatThread,
  authorizeJournalWrite,
  authorizeLeave,
  authorizeMarkerAction,
  authorizeMemberAdmin,
  authorizeOwnedContentWrite,
  authorizePinWrite,
  requireCharacterOwner,
  type ContentVisibility,
  type MembershipRole,
  type MembershipRow,
  canEditMarker,
  canReceiveWorldEvent,
  canReadArticleTitleFile,
  canReadMonsterPortraitFile,
  canReadCharacterFile,
  canReadMapFile,
  canReadUnreferencedFile,
  canReadWorldTitleFile,
  canSeeCharacterInWorld,
  canSeeJournal,
  canSeeContent,
  canSeePublishedLayer,
  canSeeVisibility,
  eventForViewer,
  isGm,
  isStaff,
  isUnlockOnlyPatch,
  relationVisible,
} from "@/lib/authz";
import type { WorldRealtimeEvent } from "@/lib/realtime/events";

const OWNER = "owner-a";
const OTHER = "other-b";
const VISIBILITIES: ContentVisibility[] = ["owner_only", "gm_only", "published"];
const ROLES: MembershipRole[] = ["game_master", "master", "player"];

describe("APP-AUTHZ Sichtbarkeit", () => {
  it("canSeeContent delegates to canSeeVisibility", () => {
    expect(canSeeContent({ role: "master", userId: OWNER }, { visibility: "owner_only", ownerId: OWNER })).toBe(
      true,
    );
    expect(canSeeContent({ role: "player", userId: OWNER }, { visibility: "owner_only", ownerId: OWNER })).toBe(
      false,
    );
  });

  it("staff sees gm_only, players do not", () => {
    expect(canSeeVisibility({ role: "player", visibility: "published", viewerId: OTHER })).toBe(true);
    expect(canSeeVisibility({ role: "player", visibility: "gm_only", viewerId: OTHER })).toBe(false);
    expect(canSeeVisibility({ role: "master", visibility: "gm_only", viewerId: OTHER })).toBe(true);
    expect(canSeeVisibility({ role: "game_master", visibility: "gm_only", viewerId: OTHER })).toBe(true);
  });

  it("inherits universe → map → pin", () => {
    const player = { role: "player" as const, userId: OTHER };
    const master = { role: "master" as const, userId: OTHER };
    expect(
      canSeePublishedLayer(player, [
        { visibility: "gm_only" },
        { visibility: "published" },
        { visibility: "published" },
      ]),
    ).toBe(false);
    expect(
      canSeePublishedLayer(master, [
        { visibility: "gm_only" },
        { visibility: "published" },
        { visibility: "published" },
      ]),
    ).toBe(true);
    expect(
      canSeePublishedLayer(player, [
        { visibility: "published" },
        { visibility: "published" },
        { visibility: "gm_only" },
      ]),
    ).toBe(false);
    expect(
      canSeePublishedLayer(player, [
        { visibility: "published" },
        { visibility: "published" },
        { visibility: "published" },
      ]),
    ).toBe(true);
  });

  it("APP-VIS-OWNER matrix: 3 × GM/Master/Player × owner yes/no (R1: player owner still false)", () => {
    for (const visibility of VISIBILITIES) {
      for (const role of ROLES) {
        for (const isOwner of [true, false]) {
          const viewerId = isOwner ? OWNER : OTHER;
          const actual = canSeeVisibility({
            role,
            visibility,
            viewerId,
            ownerId: OWNER,
          });
          let expected: boolean;
          if (visibility === "published") expected = true;
          else if (visibility === "gm_only") expected = role === "game_master" || role === "master";
          else {
            // owner_only: staff AND owner; player as owner still false (R1)
            expected = (role === "game_master" || role === "master") && isOwner;
          }
          expect(actual, `${visibility}/${role}/owner=${isOwner}`).toBe(expected);
        }
      }
    }
  });

  it("owner_only pin layer requires matching ownerId", () => {
    const viewer = { role: "master" as const, userId: OWNER };
    expect(
      canSeePublishedLayer(viewer, [
        { visibility: "published" },
        { visibility: "published" },
        { visibility: "owner_only", ownerId: OWNER },
      ]),
    ).toBe(true);
    expect(
      canSeePublishedLayer(viewer, [
        { visibility: "published" },
        { visibility: "published" },
        { visibility: "owner_only", ownerId: OTHER },
      ]),
    ).toBe(false);
  });

  it("authorizeOwnedContentWrite: visible content, R2 for owner_only", () => {
    const masterA = row("master", { userId: OWNER });
    const gm = row("game_master", { userId: "gm" });
    const ownerOnly = { ownerId: OWNER, visibility: "owner_only" as const };
    const gmOnly = { ownerId: OWNER, visibility: "gm_only" as const };

    expect(
      authorizeOwnedContentWrite({
        membership: gm,
        content: ownerOnly,
        notFoundError: "missing",
      }),
    ).toMatchObject({ ok: false, status: 404 });
    expect(
      authorizeOwnedContentWrite({
        membership: masterA,
        content: ownerOnly,
        notFoundError: "missing",
      }).ok,
    ).toBe(true);
    expect(
      authorizeOwnedContentWrite({
        membership: gm,
        content: gmOnly,
        notFoundError: "missing",
      }).ok,
    ).toBe(true);
    expect(
      authorizeOwnedContentWrite({
        membership: gm,
        content: gmOnly,
        nextVisibility: "owner_only",
        notFoundError: "missing",
      }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      authorizeOwnedContentWrite({
        membership: masterA,
        content: gmOnly,
        nextVisibility: "owner_only",
        notFoundError: "missing",
      }).ok,
    ).toBe(true);
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
    expect(authorizeMarkerAction(row("player", { userId: "a" }), { ownerId: "a" }, true).ok).toBe(true);
    expect(authorizeMarkerAction(row("player", { userId: "a" }), { ownerId: "b" }, true)).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizeMarkerAction(row("master"), { ownerId: "b" }, true).ok).toBe(true);
    expect(authorizeMarkerAction(row("player"), null, true)).toMatchObject({ ok: false, status: 404 });
    expect(authorizeMarkerAction(null, { ownerId: "a" }, true)).toMatchObject({ ok: false, status: 403 });
  });

  it("APP-PIN-LOCK: staff lock and unlock, locked pins only unlock", () => {
    const unlocked = { locked: false, ownerId: "master", visibility: "gm_only" as const };
    const locked = { locked: true, ownerId: "master", visibility: "gm_only" as const };
    expect(isUnlockOnlyPatch({ locked: false })).toBe(true);
    expect(isUnlockOnlyPatch({ locked: false, title: undefined })).toBe(true);
    expect(isUnlockOnlyPatch({ locked: false, title: "X" })).toBe(false);
    expect(authorizePinWrite(row("player"), unlocked, "create")).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizePinWrite(row("master"), null, "create").ok).toBe(true);
    expect(authorizePinWrite(row("master"), locked, { posX: 0.2 })).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(authorizePinWrite(row("game_master"), locked, { locked: false }).ok).toBe(true);
    expect(authorizePinWrite(row("master"), locked, "delete")).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(authorizePinWrite(row("master"), unlocked, "delete").ok).toBe(true);
    expect(authorizePinWrite(row("player"), unlocked, { locked: true })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizePinWrite(row("master"), null, { title: "x" })).toMatchObject({ ok: false, status: 404 });
    expect(
      authorizePinWrite(row("game_master", { userId: "gm" }), unlocked, { visibility: "owner_only" }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      authorizePinWrite(row("master", { userId: OTHER }), {
        locked: false,
        ownerId: OWNER,
        visibility: "owner_only",
      }, { title: "x" }),
    ).toMatchObject({ ok: false, status: 404 });
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

  it("lets the author and staff delete text; only staff delete dice; nobody delete thread openers", () => {
    expect(authorizeDeleteChatMessage(row("player"), text).ok).toBe(true);
    expect(authorizeDeleteChatMessage(row("master"), { ...text, authorId: "someone" }).ok).toBe(true);
    expect(authorizeDeleteChatMessage(row("player"), { ...text, authorId: "master" })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizeDeleteChatMessage(row("game_master"), { ...text, hasDice: true }).ok).toBe(true);
    expect(authorizeDeleteChatMessage(row("master"), { ...text, hasDice: true }).ok).toBe(true);
    expect(authorizeDeleteChatMessage(row("player"), { ...text, hasDice: true })).toMatchObject({
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

describe("APP-CHAT-EDIT", () => {
  const text = { authorId: "player", hasDice: false, opensThread: false };

  it("lets only the author edit text; rejects dice and openers with 422; staff cannot edit foreign", () => {
    expect(authorizeEditChatMessage(row("player"), text).ok).toBe(true);
    expect(authorizeEditChatMessage(row("game_master"), text)).toMatchObject({ ok: false, status: 403 });
    expect(authorizeEditChatMessage(row("master"), { ...text, authorId: "someone" })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizeEditChatMessage(row("player"), { ...text, hasDice: true })).toMatchObject({
      ok: false,
      status: 422,
    });
    expect(authorizeEditChatMessage(row("player"), { ...text, opensThread: true })).toMatchObject({
      ok: false,
      status: 422,
    });
    expect(
      authorizeEditChatMessage(row("game_master"), { authorId: "someone", hasDice: true, opensThread: false }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(authorizeEditChatMessage(null, text)).toMatchObject({ ok: false, status: 403 });
    expect(authorizeEditChatMessage(row("player"), null)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("APP-THREAD-RENAME", () => {
  const thread = { createdBy: "player" };

  it("lets the creator and staff rename; rejects other members", () => {
    expect(authorizeRenameChatThread(row("player"), thread).ok).toBe(true);
    expect(authorizeRenameChatThread(row("master"), thread).ok).toBe(true);
    expect(authorizeRenameChatThread(row("game_master"), thread).ok).toBe(true);
    expect(authorizeRenameChatThread(row("player", { userId: "other" }), thread)).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizeRenameChatThread(null, thread)).toMatchObject({ ok: false, status: 403 });
    expect(authorizeRenameChatThread(row("player"), null)).toMatchObject({ ok: false, status: 404 });
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

describe("CR-001 canReceiveWorldEvent / eventForViewer", () => {
  const player = { role: "player" as const, userId: OTHER };
  const master = { role: "master" as const, userId: OTHER };
  const ownerMaster = { role: "master" as const, userId: OWNER };
  const publishedLayers = [{ visibility: "published" as const }, { visibility: "published" as const }];
  const gmMapLayers = [{ visibility: "published" as const }, { visibility: "gm_only" as const }];
  const gmPinLayers = [
    { visibility: "published" as const },
    { visibility: "published" as const },
    { visibility: "gm_only" as const, ownerId: OWNER },
  ];
  const ownerPinLayers = [
    { visibility: "published" as const },
    { visibility: "published" as const },
    { visibility: "owner_only" as const, ownerId: OWNER },
  ];
  const publishedPinLayers = [
    { visibility: "published" as const },
    { visibility: "published" as const },
    { visibility: "published" as const, ownerId: OWNER },
  ];

  it("always delivers chat events", () => {
    const chat = {
      type: "chat.channels",
      worldId: "w",
    } satisfies WorldRealtimeEvent;
    expect(canReceiveWorldEvent(player, chat)).toBe(true);
    expect(eventForViewer(player, chat)).toEqual(chat);
  });

  it("matrix: map.* × role × visibility", () => {
    const cases: Array<{
      name: string;
      event: WorldRealtimeEvent;
      playerOk: boolean;
      masterOk: boolean;
      ownerMasterOk: boolean;
    }> = [
      {
        name: "map.updated published",
        event: { type: "map.updated", worldId: "w", universeId: "u", layers: publishedLayers },
        playerOk: true,
        masterOk: true,
        ownerMasterOk: true,
      },
      {
        name: "map.updated gm_only map",
        event: { type: "map.updated", worldId: "w", universeId: "u", layers: gmMapLayers },
        playerOk: false,
        masterOk: true,
        ownerMasterOk: true,
      },
      {
        name: "map.pin gm_only",
        event: { type: "map.pin", worldId: "w", pinId: "p", mapId: "m", layers: gmPinLayers },
        playerOk: false,
        masterOk: true,
        ownerMasterOk: true,
      },
      {
        name: "map.pin on gm_only map",
        event: {
          type: "map.pin",
          worldId: "w",
          pinId: "p",
          mapId: "m",
          layers: [
            { visibility: "published" },
            { visibility: "gm_only" },
            { visibility: "published", ownerId: OWNER },
          ],
        },
        playerOk: false,
        masterOk: true,
        ownerMasterOk: true,
      },
      {
        name: "map.pin owner_only",
        event: { type: "map.pin", worldId: "w", pinId: "p", mapId: "m", layers: ownerPinLayers },
        playerOk: false,
        masterOk: false,
        ownerMasterOk: true,
      },
      {
        name: "map.pin published",
        event: { type: "map.pin", worldId: "w", pinId: "p", mapId: "m", layers: publishedPinLayers },
        playerOk: true,
        masterOk: true,
        ownerMasterOk: true,
      },
      {
        name: "map.marker on gm_only map",
        event: { type: "map.marker", worldId: "w", markerId: "mk", mapId: "m", layers: gmMapLayers },
        playerOk: false,
        masterOk: true,
        ownerMasterOk: true,
      },
      {
        name: "map.marker.deleted on gm_only map",
        event: {
          type: "map.marker.deleted",
          worldId: "w",
          markerId: "mk",
          mapId: "m",
          layers: gmMapLayers,
        },
        playerOk: false,
        masterOk: true,
        ownerMasterOk: true,
      },
      {
        name: "map.pin.deleted gm_only",
        event: {
          type: "map.pin.deleted",
          worldId: "w",
          pinId: "p",
          mapId: "m",
          layers: gmPinLayers,
        },
        playerOk: false,
        masterOk: true,
        ownerMasterOk: true,
      },
    ];

    for (const row of cases) {
      expect(canReceiveWorldEvent(player, row.event), `${row.name}/player`).toBe(row.playerOk);
      expect(canReceiveWorldEvent(master, row.event), `${row.name}/master`).toBe(row.masterOk);
      expect(canReceiveWorldEvent(ownerMaster, row.event), `${row.name}/ownerMaster`).toBe(
        row.ownerMasterOk,
      );
    }
  });

  it("turns invisible pin/marker upserts into deletes for the viewer", () => {
    const pin: WorldRealtimeEvent = {
      type: "map.pin",
      worldId: "w",
      pinId: "p",
      mapId: "m",
      layers: gmPinLayers,
    };
    expect(eventForViewer(master, pin)).toEqual(pin);
    expect(eventForViewer(player, pin)).toEqual({
      type: "map.pin.deleted",
      worldId: "w",
      pinId: "p",
      mapId: "m",
      layers: gmPinLayers,
    });

    const marker: WorldRealtimeEvent = {
      type: "map.marker",
      worldId: "w",
      markerId: "mk",
      mapId: "m",
      layers: gmMapLayers,
    };
    expect(eventForViewer(player, marker)).toEqual({
      type: "map.marker.deleted",
      worldId: "w",
      markerId: "mk",
      mapId: "m",
      layers: gmMapLayers,
    });
  });

  it("drops invisible map.updated and delete signals", () => {
    const updated: WorldRealtimeEvent = {
      type: "map.updated",
      worldId: "w",
      universeId: "u",
      layers: gmMapLayers,
    };
    expect(eventForViewer(player, updated)).toBeNull();
    expect(eventForViewer(master, updated)).toEqual(updated);

    const deleted: WorldRealtimeEvent = {
      type: "map.pin.deleted",
      worldId: "w",
      pinId: "p",
      mapId: "m",
      layers: gmPinLayers,
    };
    expect(eventForViewer(player, deleted)).toBeNull();
  });

  it("never forwards membership.changed to clients", () => {
    const event: WorldRealtimeEvent = {
      type: "membership.changed",
      worldId: "w",
      userId: OTHER,
    };
    expect(canReceiveWorldEvent(player, event)).toBe(false);
    expect(eventForViewer(player, event)).toBeNull();
  });
});

describe("CR-003 file read decisions", () => {
  it("world title: only active members", () => {
    expect(canReadWorldTitleFile(row("player"))).toBe(true);
    expect(canReadWorldTitleFile(row("player", { archivedAt: new Date() }))).toBe(false);
    expect(canReadWorldTitleFile(null)).toBe(false);
  });

  it("map image: inherits universe and map visibility", () => {
    const player = { role: "player" as const, userId: OTHER };
    const master = { role: "master" as const, userId: OTHER };
    expect(canReadMapFile(player, [{ visibility: "published" }, { visibility: "published" }])).toBe(true);
    expect(canReadMapFile(player, [{ visibility: "published" }, { visibility: "gm_only" }])).toBe(false);
    expect(canReadMapFile(master, [{ visibility: "published" }, { visibility: "gm_only" }])).toBe(true);
    expect(canReadMapFile(null, [{ visibility: "published" }, { visibility: "published" }])).toBe(false);
  });

  it("article title: uses content visibility", () => {
    const player = { role: "player" as const, userId: OTHER };
    const master = { role: "master" as const, userId: OTHER };
    expect(
      canReadArticleTitleFile(player, { visibility: "published", ownerId: OWNER }),
    ).toBe(true);
    expect(canReadArticleTitleFile(player, { visibility: "gm_only", ownerId: OWNER })).toBe(false);
    expect(canReadArticleTitleFile(master, { visibility: "gm_only", ownerId: OWNER })).toBe(true);
    expect(canReadArticleTitleFile(master, { visibility: "owner_only", ownerId: OWNER })).toBe(false);
    expect(
      canReadArticleTitleFile({ role: "master", userId: OWNER }, { visibility: "owner_only", ownerId: OWNER }),
    ).toBe(true);
  });

  it("monster portrait: uses content visibility (T-006)", () => {
    const player = { role: "player" as const, userId: OTHER };
    const master = { role: "master" as const, userId: OTHER };
    expect(
      canReadMonsterPortraitFile(player, { visibility: "published", ownerId: OWNER }),
    ).toBe(true);
    expect(canReadMonsterPortraitFile(player, { visibility: "gm_only", ownerId: OWNER })).toBe(false);
    expect(canReadMonsterPortraitFile(master, { visibility: "gm_only", ownerId: OWNER })).toBe(true);
    expect(canReadMonsterPortraitFile(master, { visibility: "owner_only", ownerId: OWNER })).toBe(false);
    expect(
      canReadMonsterPortraitFile({ role: "master", userId: OWNER }, { visibility: "owner_only", ownerId: OWNER }),
    ).toBe(true);
  });

  it("character file: owner or shared active world", () => {
    expect(canReadCharacterFile({ viewerId: OWNER, ownerId: OWNER, hasActiveSharedWorld: false })).toBe(true);
    expect(canReadCharacterFile({ viewerId: OTHER, ownerId: OWNER, hasActiveSharedWorld: true })).toBe(true);
    expect(canReadCharacterFile({ viewerId: OTHER, ownerId: OWNER, hasActiveSharedWorld: false })).toBe(false);
  });

  it("unreferenced file: only uploader", () => {
    expect(canReadUnreferencedFile({ viewerId: OWNER, createdBy: OWNER })).toBe(true);
    expect(canReadUnreferencedFile({ viewerId: OTHER, createdBy: OWNER })).toBe(false);
  });
});
