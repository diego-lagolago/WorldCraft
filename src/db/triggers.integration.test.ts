import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });

const gmId = `trig-gm-${randomUUID()}`;
const otherId = `trig-other-${randomUUID()}`;
const outsiderId = `trig-out-${randomUUID()}`;
const worldId = randomUUID();
const otherWorldId = randomUUID();
const universeId = randomUUID();
const secondUniverseId = randomUUID();
const articleId = randomUUID();
const otherArticleId = randomUUID();
const questA = randomUUID();
const questB = randomUUID();
const otherQuestId = randomUUID();
const characterId = randomUUID();
const outsiderCharacterId = randomUUID();
const fileId = randomUUID();

async function expectSqlState(code: string, run: () => Promise<unknown>) {
  await expect(run()).rejects.toMatchObject({ code });
}

beforeAll(async () => {
  const now = new Date();
  await sql`
    INSERT INTO users (id, name, email, email_verified, discord_id, created_at, updated_at)
    VALUES
      (${gmId}, 'Trigger GM', ${gmId + "@localhost"}, true, ${gmId}, ${now}, ${now}),
      (${otherId}, 'Trigger Other', ${otherId + "@localhost"}, true, ${otherId}, ${now}, ${now}),
      (${outsiderId}, 'Trigger Out', ${outsiderId + "@localhost"}, true, ${outsiderId}, ${now}, ${now})
  `;
  await sql`
    INSERT INTO worlds (id, name, created_by, created_at, updated_at, updated_by)
    VALUES
      (${worldId}, 'Trigger Welt', ${gmId}, ${now}, ${now}, ${gmId}),
      (${otherWorldId}, 'Trigger Fremdwelt', ${gmId}, ${now}, ${now}, ${gmId})
  `;
  await sql`
    INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
    VALUES
      (${worldId}, ${gmId}, 'game_master', ${gmId}, ${gmId}),
      (${otherWorldId}, ${gmId}, 'game_master', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO universes (id, world_id, name, sort_order, visibility, created_by, updated_by)
    VALUES (${universeId}, ${worldId}, 'Hauptuniversum', 0, 'published', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO articles (id, world_id, title, owner_id, created_by, updated_by)
    VALUES
      (${articleId}, ${worldId}, 'Artikel', ${gmId}, ${gmId}, ${gmId}),
      (${otherArticleId}, ${otherWorldId}, 'Fremder Artikel', ${gmId}, ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO quests (id, world_id, title, owner_id, created_by, updated_by)
    VALUES
      (${questA}, ${worldId}, 'Quest A', ${gmId}, ${gmId}, ${gmId}),
      (${questB}, ${worldId}, 'Quest B', ${gmId}, ${gmId}, ${gmId}),
      (${otherQuestId}, ${otherWorldId}, 'Fremde Quest', ${gmId}, ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO characters (id, owner_id, name, skills, created_by, updated_by)
    VALUES
      (${characterId}, ${gmId}, 'Held', '[]'::jsonb, ${gmId}, ${gmId}),
      (${outsiderCharacterId}, ${outsiderId}, 'Gast', '[]'::jsonb, ${outsiderId}, ${outsiderId})
  `;
  await sql`
    INSERT INTO world_participations (character_id, world_id, created_by, updated_by)
    VALUES (${characterId}, ${worldId}, ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO files (id, storage_key, mime, byte_size, created_by)
    VALUES (${fileId}, ${"trig/" + fileId}, 'image/png', 12, ${gmId})
  `;
});

afterAll(async () => {
  await sql`DELETE FROM worlds WHERE id IN (${worldId}, ${otherWorldId})`;
  await sql`DELETE FROM characters WHERE id IN (${characterId}, ${outsiderCharacterId})`;
  await sql`DELETE FROM files WHERE id = ${fileId}`;
  await sql`DELETE FROM users WHERE id IN (${gmId}, ${otherId}, ${outsiderId})`;
  await sql.end();
});

describe("TRIG-*", () => {
  it("TRIG-GM-IS-CREATOR rejects a second game master and deleting the creator row", async () => {
    await expectSqlState("WC001", () => sql`
      INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
      VALUES (${worldId}, ${otherId}, 'game_master', ${gmId}, ${gmId})
    `);
    await expectSqlState("WC001", () => sql`
      DELETE FROM memberships WHERE world_id = ${worldId} AND user_id = ${gmId}
    `);
  });

  it("TRIG-WORLD-CREATOR-IMMUTABLE rejects changing the creator", async () => {
    await expectSqlState("WC002", () => sql`
      UPDATE worlds SET created_by = ${otherId} WHERE id = ${worldId}
    `);
  });

  it("stores a quest-to-quest relation and rejects one that crosses worlds", async () => {
    const [row] = await sql<{ source_id: string; target_id: string }>`
      INSERT INTO relations (
        world_id, source_kind, source_quest_id, target_kind, target_quest_id,
        origin, created_by, updated_by
      )
      VALUES (
        ${worldId}, 'quest', ${questA}, 'quest', ${questB},
        'mention', ${gmId}, ${gmId}
      )
      RETURNING source_id, target_id
    `;
    expect(row?.source_id).toBe(questA);
    expect(row?.target_id).toBe(questB);

    await expectSqlState("WC003", () => sql`
      INSERT INTO relations (
        world_id, source_kind, source_article_id, target_kind, target_article_id,
        origin, created_by, updated_by
      )
      VALUES (
        ${worldId}, 'article', ${articleId}, 'article', ${otherArticleId},
        'mention', ${gmId}, ${gmId}
      )
    `);
  });

  it("accepts monster relations and rejects mismatched kind/FK (Plan 005 T-004)", async () => {
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
    const [row] = await sql<{ source_id: string; target_id: string }>`
      INSERT INTO relations (
        world_id, source_kind, source_monster_id, target_kind, target_article_id,
        origin, created_by, updated_by
      )
      VALUES (
        ${worldId}, 'monster', ${monsterId}, 'article', ${articleId},
        'mention', ${gmId}, ${gmId}
      )
      RETURNING source_id, target_id
    `;
    expect(row?.source_id).toBe(monsterId);
    expect(row?.target_id).toBe(articleId);

    await expect(sql`
      INSERT INTO relations (
        world_id, source_kind, source_article_id, target_kind, target_article_id,
        origin, created_by, updated_by
      )
      VALUES (
        ${worldId}, 'monster', ${articleId}, 'article', ${articleId},
        'mention', ${gmId}, ${gmId}
      )
    `).rejects.toThrow();

    await expect(sql`
      INSERT INTO monsters (
        id, world_id, name, skills, abilities, attr_str, owner_id, created_by, updated_by
      )
      VALUES (
        ${randomUUID()}, ${worldId}, 'Kaputt', '[]'::jsonb, '[]'::jsonb, 31,
        ${gmId}, ${gmId}, ${gmId}
      )
    `).rejects.toThrow();

    await expect(sql`
      INSERT INTO monsters (
        id, world_id, name, skills, abilities, owner_id, created_by, updated_by
      )
      VALUES (
        ${randomUUID()}, ${worldId}, 'Objekt', '{}'::jsonb, '[]'::jsonb,
        ${gmId}, ${gmId}, ${gmId}
      )
    `).rejects.toThrow();
  });

  it("TRIG-UNIVERSE-LAST keeps the final universe and allows deleting another", async () => {
    await expectSqlState("WC004", () => sql`
      DELETE FROM universes WHERE id = ${universeId}
    `);
    await sql`
      INSERT INTO universes (id, world_id, name, sort_order, visibility, created_by, updated_by)
      VALUES (${secondUniverseId}, ${worldId}, 'Zweites', 1, 'gm_only', ${gmId}, ${gmId})
    `;
    await sql`DELETE FROM universes WHERE id = ${secondUniverseId}`;
  });

  it("TRIG-JOURNAL-PART rejects an entry without a participation", async () => {
    await expectSqlState("WC005", () => sql`
      INSERT INTO journal_entries (
        character_id, world_id, body_json, body_plain, created_by, updated_by
      )
      VALUES (
        ${outsiderCharacterId}, ${worldId}, '{}'::jsonb, 'geheim', ${outsiderId}, ${outsiderId}
      )
    `);
  });

  it("TRIG-PART-OWNER-MEMBER rejects an active participation without membership", async () => {
    await expectSqlState("WC006", () => sql`
      INSERT INTO world_participations (character_id, world_id, created_by, updated_by)
      VALUES (${outsiderCharacterId}, ${worldId}, ${outsiderId}, ${outsiderId})
    `);
  });

  it("TRIG-CHAR-OWNER-IMMUTABLE rejects changing the owner", async () => {
    await expectSqlState("WC007", () => sql`
      UPDATE characters SET owner_id = ${otherId} WHERE id = ${characterId}
    `);
  });

  it("TRIG-CHAR-IMAGES-MAX rejects the 11th image", async () => {
    for (let sortOrder = 0; sortOrder < 10; sortOrder += 1) {
      await sql`
        INSERT INTO character_images (
          character_id, file_id, sort_order, created_by, updated_by
        )
        VALUES (${characterId}, ${fileId}, ${sortOrder}, ${gmId}, ${gmId})
      `;
    }
    await expectSqlState("WC008", () => sql`
      INSERT INTO character_images (
        character_id, file_id, sort_order, created_by, updated_by
      )
      VALUES (${characterId}, ${fileId}, 10, ${gmId}, ${gmId})
    `);
  });
});
