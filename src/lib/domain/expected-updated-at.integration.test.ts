import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { updateArticle } from "./articles";
import { updateMonster } from "./monsters";
import { updateChapter } from "./quest-chapters";
import { updateQuest } from "./quests";
import { updateUniverse } from "./universes";
import { updateWorld } from "./worlds";

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
const prefix = `expected-updated-at-${randomUUID()}`;
const userId = `${prefix}-gm`;
const worldId = randomUUID();
const articleId = randomUUID();
const questId = randomUUID();
const chapterId = randomUUID();
const monsterId = randomUUID();
const universeId = randomUUID();

const membership = {
  id: randomUUID(),
  worldId,
  userId,
  role: "game_master" as const,
  archivedAt: null,
};

function staleFrom(updatedAt: Date) {
  return new Date(updatedAt.getTime() + 1);
}

function expectStale(result: { ok: boolean; status?: number }) {
  expect(result).toMatchObject({ ok: false, status: 409 });
}

beforeAll(async () => {
  const now = new Date();
  await sql`
    INSERT INTO users (id, name, email, email_verified, discord_id, created_at, updated_at)
    VALUES (${userId}, 'Expected updated at GM', ${userId + "@localhost"}, true, ${userId}, ${now}, ${now})
  `;
  await sql`
    INSERT INTO worlds (id, name, created_by, created_at, updated_at, updated_by)
    VALUES (${worldId}, 'Expected updated at world', ${userId}, ${now}, ${now}, ${userId})
  `;
  await sql`
    INSERT INTO memberships (id, world_id, user_id, role, created_by, updated_by)
    VALUES (${membership.id}, ${worldId}, ${userId}, 'game_master', ${userId}, ${userId})
  `;
  await sql`
    INSERT INTO articles (id, world_id, title, visibility, owner_id, created_by, created_at, updated_at, updated_by)
    VALUES (${articleId}, ${worldId}, 'Article before', 'published', ${userId}, ${userId}, ${now}, ${now}, ${userId})
  `;
  await sql`
    INSERT INTO quests (id, world_id, title, status, visibility, owner_id, created_by, created_at, updated_at, updated_by)
    VALUES (${questId}, ${worldId}, 'Quest before', 'open', 'published', ${userId}, ${userId}, ${now}, ${now}, ${userId})
  `;
  await sql`
    INSERT INTO quest_chapters (id, quest_id, title, position, status, visibility, owner_id, created_by, created_at, updated_at, updated_by)
    VALUES (${chapterId}, ${questId}, 'Chapter before', 0, 'open', 'published', ${userId}, ${userId}, ${now}, ${now}, ${userId})
  `;
  await sql`
    INSERT INTO monsters (id, world_id, name, visibility, owner_id, created_by, created_at, updated_at, updated_by)
    VALUES (${monsterId}, ${worldId}, 'Monster before', 'published', ${userId}, ${userId}, ${now}, ${now}, ${userId})
  `;
  await sql`
    INSERT INTO universes (id, world_id, name, sort_order, visibility, created_by, created_at, updated_at, updated_by)
    VALUES (${universeId}, ${worldId}, 'Universe before', 0, 'gm_only', ${userId}, ${now}, ${now}, ${userId})
  `;
});

afterAll(async () => {
  await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql`DELETE FROM users WHERE id = ${userId}`;
  await sql.end();
});

describe("CR-003 expectedUpdatedAt", () => {
  it("compares database microseconds with the millisecond MCP stand", async () => {
    await sql`UPDATE articles SET updated_at = '2026-09-29T10:00:00.123456Z' WHERE id = ${articleId}`;
    const stand = new Date("2026-09-29T10:00:00.123Z");
    expectStale(await updateArticle({
      membership, actorId: userId, worldId, articleId, title: "Article micro stale", expectedUpdatedAt: staleFrom(stand),
    }));
    expect((await updateArticle({
      membership, actorId: userId, worldId, articleId, title: "Article micro current", expectedUpdatedAt: stand,
    })).ok).toBe(true);
  });

  it("rejects stale updates and accepts current revisions for all mutable MCP targets", async () => {
    const [articleBefore] = await sql`SELECT title, updated_at FROM articles WHERE id = ${articleId}`;
    expectStale(await updateArticle({
      membership, actorId: userId, worldId, articleId, title: "Article stale", expectedUpdatedAt: staleFrom(articleBefore.updated_at),
    }));
    expect(await sql`SELECT title, updated_at FROM articles WHERE id = ${articleId}`).toEqual([articleBefore]);
    expect((await updateArticle({
      membership, actorId: userId, worldId, articleId, title: "Article current", expectedUpdatedAt: articleBefore.updated_at,
    })).ok).toBe(true);

    const [questBefore] = await sql`SELECT title, updated_at FROM quests WHERE id = ${questId}`;
    expectStale(await updateQuest({
      membership, actorId: userId, worldId, questId, title: "Quest stale", expectedUpdatedAt: staleFrom(questBefore.updated_at),
    }));
    expect(await sql`SELECT title, updated_at FROM quests WHERE id = ${questId}`).toEqual([questBefore]);
    expect((await updateQuest({
      membership, actorId: userId, worldId, questId, title: "Quest current", expectedUpdatedAt: questBefore.updated_at,
    })).ok).toBe(true);

    const [chapterBefore] = await sql`SELECT title, updated_at FROM quest_chapters WHERE id = ${chapterId}`;
    expectStale(await updateChapter({
      membership, actorId: userId, worldId, questId, chapterId, title: "Chapter stale", expectedUpdatedAt: staleFrom(chapterBefore.updated_at),
    }));
    expect(await sql`SELECT title, updated_at FROM quest_chapters WHERE id = ${chapterId}`).toEqual([chapterBefore]);
    expect((await updateChapter({
      membership, actorId: userId, worldId, questId, chapterId, title: "Chapter current", expectedUpdatedAt: chapterBefore.updated_at,
    })).ok).toBe(true);

    const [monsterBefore] = await sql`SELECT name, updated_at FROM monsters WHERE id = ${monsterId}`;
    expectStale(await updateMonster({
      membership, actorId: userId, worldId, monsterId, name: "Monster stale", expectedUpdatedAt: staleFrom(monsterBefore.updated_at),
    }));
    expect(await sql`SELECT name, updated_at FROM monsters WHERE id = ${monsterId}`).toEqual([monsterBefore]);
    expect((await updateMonster({
      membership, actorId: userId, worldId, monsterId, name: "Monster current", expectedUpdatedAt: monsterBefore.updated_at,
    })).ok).toBe(true);

    const [universeBefore] = await sql`SELECT name, updated_at FROM universes WHERE id = ${universeId}`;
    expectStale(await updateUniverse({
      membership, actorId: userId, worldId, universeId, name: "Universe stale", expectedUpdatedAt: staleFrom(universeBefore.updated_at),
    }));
    expect(await sql`SELECT name, updated_at FROM universes WHERE id = ${universeId}`).toEqual([universeBefore]);
    expect((await updateUniverse({
      membership, actorId: userId, worldId, universeId, name: "Universe current", expectedUpdatedAt: universeBefore.updated_at,
    })).ok).toBe(true);

    const [worldBefore] = await sql`SELECT name, updated_at FROM worlds WHERE id = ${worldId}`;
    expectStale(await updateWorld({
      membership, actorId: userId, worldId, name: "World stale", expectedUpdatedAt: staleFrom(worldBefore.updated_at),
    }));
    expect(await sql`SELECT name, updated_at FROM worlds WHERE id = ${worldId}`).toEqual([worldBefore]);
    expect((await updateWorld({
      membership, actorId: userId, worldId, name: "World current", expectedUpdatedAt: worldBefore.updated_at,
    })).ok).toBe(true);
  });
});
