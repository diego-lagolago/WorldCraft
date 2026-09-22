import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canEditMarker,
  canSeeCharacterInWorld,
  canSeeJournal,
  canSeePublishedLayer,
  relationVisible,
} from "./authz.ts";
import { canSeeVisibility, isGm, isStaff } from "./types.ts";

describe("APP-AUTHZ Sichtbarkeit", () => {
  it("staff sees gm_only, players do not", () => {
    assert.equal(canSeeVisibility("player", "published"), true);
    assert.equal(canSeeVisibility("player", "gm_only"), false);
    assert.equal(canSeeVisibility("master", "gm_only"), true);
    assert.equal(canSeeVisibility("game_master", "gm_only"), true);
  });

  it("inherits universe → map → pin", () => {
    assert.equal(canSeePublishedLayer("player", ["gm_only", "published", "published"]), false);
    assert.equal(canSeePublishedLayer("master", ["gm_only", "published", "published"]), true);
    assert.equal(canSeePublishedLayer("player", ["published", "published", "gm_only"]), false);
    assert.equal(canSeePublishedLayer("player", ["published", "published", "published"]), true);
  });

  it("journals: B never sees A's; staff only shared", () => {
    assert.equal(
      canSeeJournal({
        actorId: "b",
        role: "player",
        ownerId: "a",
        visibility: "private",
        participationArchived: false,
      }),
      false,
    );
    assert.equal(
      canSeeJournal({
        actorId: "b",
        role: "player",
        ownerId: "a",
        visibility: "shared_with_gm",
        participationArchived: false,
      }),
      false,
    );
    assert.equal(
      canSeeJournal({
        actorId: "gm",
        role: "game_master",
        ownerId: "a",
        visibility: "private",
        participationArchived: false,
      }),
      false,
    );
    assert.equal(
      canSeeJournal({
        actorId: "master",
        role: "master",
        ownerId: "a",
        visibility: "shared_with_gm",
        participationArchived: false,
      }),
      true,
    );
    assert.equal(
      canSeeJournal({
        actorId: "gm",
        role: "game_master",
        ownerId: "a",
        visibility: "shared_with_gm",
        participationArchived: true,
      }),
      false,
    );
  });

  it("archived participation hides the character from the world", () => {
    assert.equal(
      canSeeCharacterInWorld({
        actorId: "gm",
        isMember: true,
        ownerId: "a",
        participationArchived: true,
      }),
      false,
    );
  });

  it("player moves own marker, staff both, owner only on visible map", () => {
    assert.equal(
      canEditMarker({
        role: "player",
        actorId: "a",
        ownerId: "a",
        mapVisibleToActor: true,
      }),
      true,
    );
    assert.equal(
      canEditMarker({
        role: "player",
        actorId: "a",
        ownerId: "b",
        mapVisibleToActor: true,
      }),
      false,
    );
    assert.equal(
      canEditMarker({
        role: "master",
        actorId: "m",
        ownerId: "b",
        mapVisibleToActor: true,
      }),
      true,
    );
    assert.equal(
      canEditMarker({
        role: "player",
        actorId: "a",
        ownerId: "a",
        mapVisibleToActor: false,
      }),
      false,
    );
  });

  it("relations need both ends visible", () => {
    assert.equal(relationVisible({ sourceVisible: true, targetVisible: false }), false);
    assert.equal(relationVisible({ sourceVisible: true, targetVisible: true }), true);
  });

  it("GM vs Master helpers", () => {
    assert.equal(isGm("game_master"), true);
    assert.equal(isGm("master"), false);
    assert.equal(isStaff("master"), true);
    assert.equal(isStaff("player"), false);
  });
});
