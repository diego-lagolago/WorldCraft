import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attachImage } from "./attach";
import { removeStoredFile } from "./store";

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 4 });
const prefix = `single-image-${randomUUID()}`;
const actorId = `${prefix}-gm`;
const worldId = randomUUID();
const monsterId = randomUUID();
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

beforeAll(async () => {
  await sql`INSERT INTO users (id, name, email, email_verified, discord_id) VALUES (${actorId}, 'GC GM', ${`${actorId}@localhost`}, true, ${actorId})`;
  await sql`INSERT INTO worlds (id, name, created_by, updated_by) VALUES (${worldId}, 'GC Welt', ${actorId}, ${actorId})`;
  await sql`INSERT INTO memberships (world_id, user_id, role, created_by, updated_by) VALUES (${worldId}, ${actorId}, 'game_master', ${actorId}, ${actorId})`;
  await sql`
    INSERT INTO monsters (id, world_id, name, skills, abilities, owner_id, created_by, updated_by)
    VALUES (${monsterId}, ${worldId}, 'Parallelbild', '[]'::jsonb, '[]'::jsonb, ${actorId}, ${actorId}, ${actorId})
  `;
});

afterAll(async () => {
  const files = await sql`SELECT id FROM files WHERE created_by = ${actorId}`;
  await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await Promise.all(files.map((file) => removeStoredFile(file.id)));
  await sql`DELETE FROM users WHERE id = ${actorId}`;
  await sql.end();
});

describe("swapSingleImage", () => {
  it("leaves no orphan after two simultaneous monster portrait uploads", async () => {
    const results = await Promise.all([
      attachImage({ kind: "monster_portrait", actorId, worldId, targetId: monsterId, bytes: PNG }),
      attachImage({ kind: "monster_portrait", actorId, worldId, targetId: monsterId, bytes: PNG }),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    const [monster] = await sql`SELECT portrait_id FROM monsters WHERE id = ${monsterId}`;
    expect(monster.portrait_id).toBeTruthy();
    const files = await sql`SELECT id FROM files WHERE id = ${monster.portrait_id}`;
    expect(files).toHaveLength(1);
    const allCreated = await sql`SELECT id FROM files WHERE created_by = ${actorId}`;
    expect(allCreated).toHaveLength(1);
  });
});
