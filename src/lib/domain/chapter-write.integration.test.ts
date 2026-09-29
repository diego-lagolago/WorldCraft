import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createChapter, updateChapter } from "./quest-chapters";

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
const prefix = `chapter-write-${randomUUID()}`;
const gmId = `${prefix}-gm`;
const masterId = `${prefix}-master`;
const worldId = randomUUID();
const questId = randomUUID();
const hiddenQuestId = randomUUID();

const gmMembership = {
  id: randomUUID(),
  worldId,
  userId: gmId,
  role: "game_master" as const,
  archivedAt: null,
};
const masterMembership = {
  id: randomUUID(),
  worldId,
  userId: masterId,
  role: "master" as const,
  archivedAt: null,
};

beforeAll(async () => {
  const now = new Date();
  await sql`
    INSERT INTO users (id, name, email, email_verified, discord_id, created_at, updated_at)
    VALUES
      (${gmId}, 'Chapter write GM', ${gmId + "@localhost"}, true, ${gmId}, ${now}, ${now}),
      (${masterId}, 'Chapter write master', ${masterId + "@localhost"}, true, ${masterId}, ${now}, ${now})
  `;
  await sql`
    INSERT INTO worlds (id, name, created_by, created_at, updated_at, updated_by)
    VALUES (${worldId}, 'Chapter write world', ${gmId}, ${now}, ${now}, ${gmId})
  `;
  await sql`
    INSERT INTO memberships (id, world_id, user_id, role, created_by, updated_by)
    VALUES
      (${gmMembership.id}, ${worldId}, ${gmId}, 'game_master', ${gmId}, ${gmId}),
      (${masterMembership.id}, ${worldId}, ${masterId}, 'master', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO quests (id, world_id, title, status, visibility, owner_id, created_by, updated_by)
    VALUES
      (${questId}, ${worldId}, 'Visible quest', 'open', 'published', ${gmId}, ${gmId}, ${gmId}),
      (${hiddenQuestId}, ${worldId}, 'Hidden quest', 'open', 'owner_only', ${gmId}, ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO quest_chapters (id, quest_id, title, position, status, visibility, owner_id, created_by, updated_by)
    VALUES (${randomUUID()}, ${questId}, 'Existing chapter', 0, 'open', 'published', ${gmId}, ${gmId}, ${gmId})
  `;
});

afterAll(async () => {
  await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql`DELETE FROM users WHERE id IN (${gmId}, ${masterId})`;
  await sql.end();
});

describe("CR-007 chapter writes", () => {
  it("creates and reorders chapters atomically with the returned revision", async () => {
    const created = await createChapter({
      membership: gmMembership,
      actorId: gmId,
      worldId,
      questId,
      title: "Created chapter",
      status: "active",
      position: 1,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data).toMatchObject({ status: "active", position: 0 });
    const [stored] = await sql`
      SELECT title, status, position, updated_at FROM quest_chapters WHERE id = ${created.data.id}
    `;
    expect(stored).toMatchObject({ title: "Created chapter", status: "active", position: 0 });
    expect(stored.updated_at).toEqual(created.data.updatedAt);

    const invalidCreate = await createChapter({
      membership: gmMembership,
      actorId: gmId,
      worldId,
      questId,
      title: "Invalid chapter",
      position: 4,
    });
    expect(invalidCreate).toMatchObject({ ok: false, status: 400 });
    expect(await sql`SELECT count(*)::int AS count FROM quest_chapters WHERE quest_id = ${questId}`).toEqual([{ count: 2 }]);

    const hidden = await createChapter({
      membership: masterMembership,
      actorId: masterId,
      worldId,
      questId: hiddenQuestId,
      title: "Invisible chapter",
    });
    expect(hidden).toMatchObject({ ok: false, status: 404 });
    expect(await sql`SELECT count(*)::int AS count FROM quest_chapters WHERE quest_id = ${hiddenQuestId}`).toEqual([{ count: 0 }]);

    const updated = await updateChapter({
      membership: gmMembership,
      actorId: gmId,
      worldId,
      questId,
      chapterId: created.data.id,
      title: "Updated chapter",
      position: 2,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    const [reordered] = await sql`
      SELECT title, position, updated_at FROM quest_chapters WHERE id = ${created.data.id}
    `;
    expect(reordered).toMatchObject({ title: "Updated chapter", position: 1 });
    expect(reordered.updated_at).toEqual(updated.data.updatedAt);

    const invalidUpdate = await updateChapter({
      membership: gmMembership,
      actorId: gmId,
      worldId,
      questId,
      chapterId: created.data.id,
      title: "Invalid update",
      position: 3,
    });
    expect(invalidUpdate).toMatchObject({ ok: false, status: 400 });
    expect(await sql`
      SELECT title, position FROM quest_chapters WHERE id = ${created.data.id}
    `).toEqual([{ title: "Updated chapter", position: 1 }]);
  });
});
