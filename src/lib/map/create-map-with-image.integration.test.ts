import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMapWithImage } from "./repository";

/** CR-011: domain helper for MCP-style map+image create; GIF must be rejected. */
const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const prefix = `mapimg-${randomUUID()}`;
const gmId = `${prefix}-gm`;
const worldId = randomUUID();
const universeId = randomUUID();
const membership = {
  id: randomUUID(),
  worldId,
  userId: gmId,
  role: "game_master" as const,
  archivedAt: null,
};

beforeAll(async () => {
  await sql`
    INSERT INTO users (id, name, email, email_verified, discord_id)
    VALUES (${gmId}, 'GM', ${`${gmId}@localhost`}, true, ${gmId})
  `;
  await sql`
    INSERT INTO worlds (id, name, created_by, updated_by)
    VALUES (${worldId}, 'Kartenbild-Welt', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO memberships (id, world_id, user_id, role, created_by, updated_by)
    VALUES (${membership.id}, ${worldId}, ${gmId}, 'game_master', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO universes (id, world_id, name, sort_order, visibility, created_by, updated_by)
    VALUES (${universeId}, ${worldId}, 'Hauptuniversum', 0, 'published', ${gmId}, ${gmId})
  `;
});

afterAll(async () => {
  await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql`DELETE FROM users WHERE id = ${gmId}`;
  await sql.end();
});

describe("createMapWithImage", () => {
  it("creates a map with a PNG and rejects a GIF", async () => {
    const created = await createMapWithImage({
      membership,
      actorId: gmId,
      worldId,
      universeId,
      name: "Mit Bild",
      bytes: PNG,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.map.imageId).toBeTruthy();
    expect(created.data.map.imageWidth).toBe(1);
    expect(created.data.map.imageHeight).toBe(1);

    const gif = await createMapWithImage({
      membership,
      actorId: gmId,
      worldId,
      universeId,
      name: "GIF-Versuch",
      bytes: Buffer.from("GIF89a", "ascii"),
    });
    expect(gif.ok).toBe(false);
    if (!gif.ok) {
      expect(gif.status).toBe(400);
      expect(gif.error).toBe("Nur JPEG, PNG oder WebP.");
    }
  });
});
