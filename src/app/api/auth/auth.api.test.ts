import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { BASE, api, login, testSql } from "@/test/api-harness";

const sql = testSql();

afterAll(async () => {
  await sql.end();
});

describe("CR-003: discordId is not user input", () => {
  it("update-user cannot change discord_id; test-login keeps the seeded id", async () => {
    const player = await login("test-player-b");
    expect(player.user.discordId).toBe("test-player-b");

    const res = await api(player, "POST", "/api/auth/update-user", { discordId: `hijack-${randomUUID()}` });
    expect(res.status).toBe(400);

    const [row] = await sql`SELECT discord_id FROM users WHERE id = ${player.user.id}`;
    expect(row.discord_id).toBe("test-player-b");

    const again = await login("test-player-b");
    expect(again.user.id).toBe(player.user.id);
  });

  it("update-user still accepts allowed fields", async () => {
    const player = await login("test-player-b");
    const [before] = await sql`SELECT name FROM users WHERE id = ${player.user.id}`;
    const res = await api(player, "POST", "/api/auth/update-user", { name: before.name });
    expect(res.status).toBe(200);
  });
});

describe("T-006: signed-out world routes go to the login", () => {
  it("redirects /w/… to / without a session", async () => {
    const res = await fetch(`${BASE}/w/${randomUUID()}/map`, { redirect: "manual" });
    expect([303, 307, 308]).toContain(res.status);
    expect(new URL(res.headers.get("location") ?? "", BASE).pathname).toBe("/");
  });

  it("answers 404 for a world the user is not a member of", async () => {
    const player = await login("test-player-b");
    const res = await fetch(`${BASE}/w/${randomUUID()}`, {
      headers: { cookie: player.cookie },
      redirect: "manual",
    });
    expect(res.status).toBe(404);
  });
});
