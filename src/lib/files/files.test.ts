import { describe, expect, it } from "vitest";
import { authorizeImageWrite } from "./authorize";
import { inspectImage, isImageError } from "./inspect";

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
