import { describe, expect, it } from "vitest";
import { authorizeImageWrite } from "./authorize";
import { IMAGE_MAX_PIXELS, inspectImage, isImageError, maxBytesFor, OTHER_IMAGE_MAX_BYTES, MAP_IMAGE_MAX_BYTES } from "./inspect";

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
    expect(maxBytesFor("monster_portrait")).toBe(OTHER_IMAGE_MAX_BYTES);
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

  it("rejects images over 25 megapixels but accepts the exact limit", () => {
    const png = Buffer.from(PNG);
    png.writeUInt32BE(5001, 16);
    png.writeUInt32BE(5000, 20);
    expect(IMAGE_MAX_PIXELS).toBe(25_000_000);
    expect(inspectImage(png, OTHER_IMAGE_MAX_BYTES)).toEqual({ error: "Das Bild darf höchstens 25 Megapixel haben." });

    png.writeUInt32BE(5000, 16);
    expect(isImageError(inspectImage(png, OTHER_IMAGE_MAX_BYTES))).toBe(false);
  });
});

describe("authorizeImageWrite", () => {
  it("refuses world, map, article and monster images for a player", () => {
    for (const kind of ["world_title", "map", "article_title", "monster_portrait"] as const) {
      const result = authorizeImageWrite({
        kind,
        actorId: "player",
        membership,
        ownerId: null,
        existingCharacterImages: 0,
        content:
          kind === "monster_portrait"
            ? { ownerId: "owner", visibility: "published" }
            : undefined,
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

  it("lets staff upload a monster portrait only when they can see the monster", () => {
    const master = { ...membership, userId: "master", role: "master" as const };
    const ownerMaster = { ...membership, userId: "owner", role: "master" as const };
    const base = {
      kind: "monster_portrait" as const,
      actorId: "x",
      ownerId: null,
      existingCharacterImages: 0,
    };
    expect(
      authorizeImageWrite({
        ...base,
        membership: master,
        content: { ownerId: "owner", visibility: "owner_only" },
      }),
    ).toMatchObject({ ok: false, status: 404 });
    expect(
      authorizeImageWrite({
        ...base,
        membership: ownerMaster,
        content: { ownerId: "owner", visibility: "owner_only" },
      }).ok,
    ).toBe(true);
    expect(
      authorizeImageWrite({
        ...base,
        membership: master,
        content: { ownerId: "owner", visibility: "published" },
      }).ok,
    ).toBe(true);
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
