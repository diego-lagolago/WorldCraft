import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { joinByInvite } from "./invites";

/** CR-008: joins run with a real connection pool (DATABASE_POOL_MAX in vitest.triggers.config.ts). */
const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });

const prefix = `join-${randomUUID()}`;
const gmId = `${prefix}-gm`;
const joinerIds = Array.from({ length: 10 }, (_, index) => `${prefix}-u${index}`);
const worldId = randomUUID();
const inviteId = randomUUID();
const code = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");

beforeAll(async () => {
  const users = [gmId, ...joinerIds].map((id) => ({
    id,
    name: id.slice(-6),
    email: `${id}@localhost`,
    email_verified: true,
    discord_id: id,
  }));
  await sql`INSERT INTO users ${sql(users)}`;
  await sql`
    INSERT INTO worlds (id, name, created_by, updated_by) VALUES (${worldId}, 'Beitrittswelt', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
    VALUES (${worldId}, ${gmId}, 'game_master', ${gmId}, ${gmId})
  `;
  await sql`
    INSERT INTO invite_links (id, world_id, code, validity, created_by, updated_by)
    VALUES (${inviteId}, ${worldId}, ${code}, 'unlimited', ${gmId}, ${gmId})
  `;
});

afterAll(async () => {
  await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql`DELETE FROM users WHERE id LIKE ${prefix + "%"}`;
  await sql.end();
});

describe("joinByInvite under concurrency", () => {
  it("counts ten parallel joins of different users exactly", async () => {
    const results = await Promise.all(joinerIds.map((userId) => joinByInvite({ code, userId })));
    expect(results.every((result) => result.ok && result.data.joined)).toBe(true);
    const [invite] = await sql`SELECT use_count FROM invite_links WHERE id = ${inviteId}`;
    expect(invite.use_count).toBe(10);
    const [members] = await sql`
      SELECT count(*)::int AS n FROM memberships WHERE world_id = ${worldId} AND role = 'player'
    `;
    expect(members.n).toBe(10);
  });

  it("lets the same user join twice in parallel without an error or a double count", async () => {
    const userId = joinerIds[0];
    await sql`UPDATE memberships SET archived_at = now() WHERE world_id = ${worldId} AND user_id = ${userId}`;
    const results = await Promise.all([joinByInvite({ code, userId }), joinByInvite({ code, userId })]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.filter((result) => result.ok && result.data.joined)).toHaveLength(1);
    const [invite] = await sql`SELECT use_count FROM invite_links WHERE id = ${inviteId}`;
    expect(invite.use_count).toBe(11);
    const rows = await sql`
      SELECT archived_at FROM memberships WHERE world_id = ${worldId} AND user_id = ${userId}
    `;
    expect(rows).toEqual([{ archived_at: null }]);
  });
});
