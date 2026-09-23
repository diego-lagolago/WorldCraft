import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { updateArticle } from "./articles";

/**
 * CR-006: main write + relation recalc share one transaction. A forced failure
 * during relations insert must leave the article row unchanged.
 */
const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });

const prefix = `rel-tx-${randomUUID()}`;
const gmId = `${prefix}-gm`;
const worldId = randomUUID();
const articleId = randomUUID();
const targetArticleId = randomUUID();
const membershipId = randomUUID();

const membership = {
  id: membershipId,
  worldId,
  userId: gmId,
  role: "game_master" as const,
  archivedAt: null,
};

function mentionBody(targetId: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Siehe " },
          {
            type: "mention",
            attrs: {
              id: targetId,
              kind: "article",
              label: "Ziel",
              mentionSuggestionChar: "@",
            },
          },
        ],
      },
    ],
  };
}

beforeAll(async () => {
  const now = new Date();
  await sql`
    INSERT INTO users (id, name, email, email_verified, discord_id, created_at, updated_at)
    VALUES (${gmId}, 'Rel Tx GM', ${gmId + "@localhost"}, true, ${gmId}, ${now}, ${now})
  `;
  await sql`
    INSERT INTO worlds (id, name, created_by, created_at, updated_at, updated_by)
    VALUES (${worldId}, 'Rel Tx Welt', ${gmId}, ${now}, ${now}, ${gmId})
  `;
  await sql`
    INSERT INTO memberships (id, world_id, user_id, role, created_by, updated_by)
    VALUES (${membershipId}, ${worldId}, ${gmId}, 'game_master', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO articles (id, world_id, title, visibility, owner_id, created_by, updated_by)
    VALUES
      (${articleId}, ${worldId}, 'Alt', 'published', ${gmId}, ${gmId}, ${gmId}),
      (${targetArticleId}, ${worldId}, 'Ziel', 'published', ${gmId}, ${gmId}, ${gmId})
  `;
});

afterAll(async () => {
  await sql`DROP TRIGGER IF EXISTS cr006_fail_relations_insert ON relations`;
  await sql`DROP FUNCTION IF EXISTS cr006_fail_relations_insert()`;
  await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql`DELETE FROM users WHERE id = ${gmId}`;
  await sql.end();
});

describe("CR-006 article update transaction", () => {
  it("rolls back the article when relations insert fails", async () => {
    await sql`
      CREATE OR REPLACE FUNCTION cr006_fail_relations_insert() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced relations insert failure' USING ERRCODE = '23514';
      END;
      $$ LANGUAGE plpgsql
    `;
    await sql`
      CREATE TRIGGER cr006_fail_relations_insert
      BEFORE INSERT ON relations
      FOR EACH ROW EXECUTE FUNCTION cr006_fail_relations_insert()
    `;

    try {
      const result = await updateArticle({
        membership,
        actorId: gmId,
        worldId,
        articleId,
        title: "Neu",
        body: mentionBody(targetArticleId),
      });
      expect(result.ok).toBe(false);
    } finally {
      await sql`DROP TRIGGER IF EXISTS cr006_fail_relations_insert ON relations`;
      await sql`DROP FUNCTION IF EXISTS cr006_fail_relations_insert()`;
    }

    const [row] = await sql`SELECT title, body_plain FROM articles WHERE id = ${articleId}`;
    expect(row.title).toBe("Alt");
    expect(row.body_plain).toBeNull();
  });
});
