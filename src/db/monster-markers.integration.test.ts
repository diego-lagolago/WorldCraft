import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Plan 006 T-003: pos checks + CASCADE when monster is deleted. */
const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });

const prefix = `mm-${randomUUID()}`;
const gmId = `${prefix}-gm`;
const worldId = randomUUID();
const universeId = randomUUID();
const mapId = randomUUID();

beforeAll(async () => {
  await sql`
    INSERT INTO users (id, name, email, email_verified, discord_id)
    VALUES (${gmId}, 'MM GM', ${`${gmId}@localhost`}, true, ${gmId})
  `;
  await sql`
    INSERT INTO worlds (id, name, created_by, updated_by)
    VALUES (${worldId}, 'Monster-Marker-Welt', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
    VALUES (${worldId}, ${gmId}, 'game_master', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO universes (id, world_id, name, sort_order, visibility, created_by, updated_by)
    VALUES (${universeId}, ${worldId}, 'Hauptuniversum', 0, 'published', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO maps (id, universe_id, name, visibility, created_by, updated_by)
    VALUES (${mapId}, ${universeId}, 'Testkarte', 'published', ${gmId}, ${gmId})
  `;
});

afterAll(async () => {
  await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql`DELETE FROM users WHERE id = ${gmId}`;
  await sql.end();
});

describe("monster_markers (Plan 006 T-003)", () => {
  it("rejects pos_x outside 0–1 and cascades on monster delete", async () => {
    const monsterId = randomUUID();
    await sql`
      INSERT INTO monsters (
        id, world_id, name, skills, abilities, owner_id, created_by, updated_by
      )
      VALUES (
        ${monsterId}, ${worldId}, 'Schattenwolf', '[]'::jsonb, '[]'::jsonb,
        ${gmId}, ${gmId}, ${gmId}
      )
    `;

    await expect(
      sql`
        INSERT INTO monster_markers (
          monster_id, map_id, pos_x, pos_y, visibility, owner_id, created_by, updated_by
        )
        VALUES (
          ${monsterId}, ${mapId}, 1.5, 0.5, 'owner_only', ${gmId}, ${gmId}, ${gmId}
        )
      `,
    ).rejects.toThrow();

    const markerId = randomUUID();
    await sql`
      INSERT INTO monster_markers (
        id, monster_id, map_id, pos_x, pos_y, visibility, owner_id, created_by, updated_by
      )
      VALUES (
        ${markerId}, ${monsterId}, ${mapId}, 0.33, 0.7, 'owner_only', ${gmId}, ${gmId}, ${gmId}
      )
    `;

    await sql`DELETE FROM monsters WHERE id = ${monsterId}`;
    const left = await sql`SELECT id FROM monster_markers WHERE id = ${markerId}`;
    expect(left).toHaveLength(0);
  });
});
