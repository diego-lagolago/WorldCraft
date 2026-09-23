import { describe, expect, it } from "vitest";
import { authorizeImageWrite } from "./authorize";
import { inspectImage, isImageError, maxBytesFor, OTHER_IMAGE_MAX_BYTES, MAP_IMAGE_MAX_BYTES } from "./inspect";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const membership = {
  id: "m",
  worldId: "w",
  userId: "player",
  role: "player" as const,
  archivedAt: null,
};

describe("maxBytesFor", () => {
  it("uses 20 MB for map images and 10 MB for every other kind", () => {
    expect(maxBytesFor("map")).toBe(MAP_IMAGE_MAX_BYTES);
    expect(maxBytesFor("article_title")).toBe(OTHER_IMAGE_MAX_BYTES);
    expect(maxBytesFor("world_title")).toBe(OTHER_IMAGE_MAX_BYTES);
    expect(maxBytesFor("character_portrait")).toBe(OTHER_IMAGE_MAX_BYTES);
  });
});

describe("inspectImage", () => {
  it("accepts a real PNG and rejects a file that only claims to be one", () => {
    const ok = inspectImage(PNG, 10 * 1024 * 1024);
    expect(isImageError(ok)).toBe(false);
    if (isImageError(ok)) return;
    expect(ok.mime).toBe("image/png");
    expect(ok.width).toBe(1);

    const gif = inspectImage(Buffer.from("GIF89a", "ascii"), 10 * 1024 * 1024);
    expect(gif).toEqual({ error: "Nur JPEG, PNG oder WebP." });
  });

  it("rejects an oversized image", () => {
    const huge = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    expect(inspectImage(huge, 10 * 1024 * 1024)).toEqual({
      error: "Das Bild darf höchstens 10 MB groß sein.",
    });
  });
});

describe("authorizeImageWrite", () => {
  it("refuses world, map and article images for a player", () => {
    for (const kind of ["world_title", "map", "article_title"] as const) {
      const result = authorizeImageWrite({
        kind,
        actorId: "player",
        membership,
        ownerId: null,
        existingCharacterImages: 0,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(403);
    }
  });

  it("lets only the game master set the world title image; master may set map and article images", () => {
    const master = { ...membership, userId: "master", role: "master" as const };
    const gm = { ...membership, userId: "gm", role: "game_master" as const };
    const input = { actorId: "x", ownerId: null, existingCharacterImages: 0 };
    expect(authorizeImageWrite({ ...input, kind: "world_title", membership: master })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizeImageWrite({ ...input, kind: "world_title", membership: gm }).ok).toBe(true);
    expect(authorizeImageWrite({ ...input, kind: "map", membership: master }).ok).toBe(true);
    expect(authorizeImageWrite({ ...input, kind: "article_title", membership: master }).ok).toBe(true);
  });

  it("refuses the 11th character attachment", () => {
    const result = authorizeImageWrite({
      kind: "character_image",
      actorId: "owner",
      membership: null,
      ownerId: "owner",
      existingCharacterImages: 10,
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "Ein Charakter kann höchstens 10 Bildanhänge haben.",
    });
  });
});
