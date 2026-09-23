import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { updateChannel } from "./repository";

/** CR-013: last-channel archive must stay atomic under concurrency. */
const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });

const prefix = `archive-${randomUUID()}`;
const gmId = `${prefix}-gm`;
const worldId = randomUUID();
const channelA = randomUUID();
const channelB = randomUUID();

beforeAll(async () => {
  await sql`
    INSERT INTO users (id, name, email, email_verified, discord_id)
    VALUES (${gmId}, 'Archive GM', ${`${gmId}@localhost`}, true, ${gmId})
  `;
  await sql`
    INSERT INTO worlds (id, name, created_by, updated_by)
    VALUES (${worldId}, 'Archive-Race', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
    VALUES (${worldId}, ${gmId}, 'game_master', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO chat_channels (id, world_id, name, sort_order, created_by, updated_by)
    VALUES
      (${channelA}, ${worldId}, 'Eins', 0, ${gmId}, ${gmId}),
      (${channelB}, ${worldId}, 'Zwei', 1, ${gmId}, ${gmId})
  `;
});

afterAll(async () => {
  await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql`DELETE FROM users WHERE id = ${gmId}`;
  await sql.end();
});

describe("updateChannel archive concurrency (CR-013)", () => {
  it("leaves exactly one active channel when both are archived in parallel", async () => {
    const membership = {
      id: "m",
      worldId,
      userId: gmId,
      role: "game_master" as const,
      archivedAt: null,
    };
    const results = await Promise.all([
      updateChannel({
        membership,
        actorId: gmId,
        worldId,
        channelId: channelA,
        action: "archive",
      }),
      updateChannel({
        membership,
        actorId: gmId,
        worldId,
        channelId: channelB,
        action: "archive",
      }),
    ]);
    const okCount = results.filter((row) => row.ok).length;
    const denied = results.filter((row) => !row.ok);
    expect(okCount).toBe(1);
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({ status: 409 });
    const [active] = await sql`
      SELECT count(*)::int AS n FROM chat_channels
      WHERE world_id = ${worldId} AND archived_at IS NULL
    `;
    expect(active.n).toBe(1);
  });
});
