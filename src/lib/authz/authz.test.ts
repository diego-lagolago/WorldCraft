import { describe, expect, it } from "vitest";
import {
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

  it("archived participation hides the character from the world", () => {
    expect(canSeeCharacterInWorld({
        actorId: "gm",
        isMember: true,
        ownerId: "a",
        participationArchived: true,
      })).toBe(false);
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
