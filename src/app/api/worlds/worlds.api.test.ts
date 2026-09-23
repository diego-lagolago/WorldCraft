import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, testSql, type TestSession } from "@/test/api-harness";

type Universe = { id: string; name: string; visibility: string; sortOrder: number };
type Invite = { id: string; code: string; status: string; useCount: number };
type Member = { membershipId: string; userId: string; role: string };

const sql = testSql();
let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let playerB: TestSession;
let worldId = "";
const extraWorlds: string[] = [];
const characterId = randomUUID();

const w = (path = "") => `/api/worlds/${worldId}${path}`;

async function newInvite(validity = "seven_days"): Promise<Invite> {
  const res = await api<Invite>(gm, "POST", w("/invites"), { validity });
  expect(res.status).toBe(201);
  return res.data;
}

async function membershipOf(session: TestSession) {
  const [row] = await sql`
    SELECT id, role, archived_at FROM memberships WHERE world_id = ${worldId} AND user_id = ${session.user.id}
  `;
  return row as { id: string; role: string; archived_at: Date | null } | undefined;
}

beforeAll(async () => {
  [gm, master, playerA, playerB] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-a"),
    login("test-player-b"),
  ]);
});

afterAll(async () => {
  const ids = [worldId, ...extraWorlds].filter(Boolean);
  if (ids.length) await sql`DELETE FROM worlds WHERE id IN ${sql(ids)}`;
  await sql`DELETE FROM characters WHERE id = ${characterId}`;
  await sql.end();
});

describe("T-007 (0)/(1): creating a world", () => {
  it("creates world, game master membership, Hauptuniversum and Allgemein together", async () => {
    const res = await api<{ id: string; universeId: string }>(gm, "POST", "/api/worlds", {
      name: "  T-007 Testwelt  ",
      description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hallo" }] }] },
    });
    expect(res.status).toBe(201);
    worldId = res.data.id;

    const [world] = await sql`SELECT name, description_plain FROM worlds WHERE id = ${worldId}`;
    expect(world).toMatchObject({ name: "T-007 Testwelt", description_plain: "Hallo" });
    expect(await membershipOf(gm)).toMatchObject({ role: "game_master", archived_at: null });
    const universes = await sql`SELECT id, name, visibility, sort_order FROM universes WHERE world_id = ${worldId}`;
    expect(universes).toEqual([
      { id: res.data.universeId, name: "Hauptuniversum", visibility: "published", sort_order: 0 },
    ]);
    const channels = await sql`SELECT name, sort_order FROM chat_channels WHERE world_id = ${worldId}`;
    expect(channels).toEqual([{ name: "Allgemein", sort_order: 0 }]);
  });

  it("rejects invalid input without leaving a half-created world", async () => {
    const before = await sql`SELECT count(*)::int AS n FROM worlds WHERE created_by = ${gm.user.id}`;
    const mention = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "mention", attrs: { id: randomUUID(), kind: "article", label: "X" } }],
        },
      ],
    };
    expect((await api(gm, "POST", "/api/worlds", { name: "Mit Erwähnung", description: mention })).status).toBe(400);
    expect((await api(gm, "POST", "/api/worlds", { name: "x".repeat(121) })).status).toBe(400);
    expect((await api(gm, "POST", "/api/worlds", { name: "   " })).status).toBe(400);
    expect((await api(gm, "POST", "/api/worlds", "kein objekt")).status).toBe(400);
    expect((await api(null, "POST", "/api/worlds", { name: "Anonym" })).status).toBe(401);
    const after = await sql`SELECT count(*)::int AS n FROM worlds WHERE created_by = ${gm.user.id}`;
    expect(after[0].n).toBe(before[0].n);
  });

  it("never allows a second game master", async () => {
    const invite = await newInvite();
    expect((await api(master, "POST", `/api/invites/${invite.code}/join`)).status).toBe(200);
    const target = await membershipOf(master);
    const res = await api(gm, "PATCH", w(`/members/${target?.id}`), { role: "game_master" });
    expect(res.status).toBe(400);
    await expect(
      sql`UPDATE memberships SET role = 'game_master' WHERE id = ${target?.id ?? ""}`,
    ).rejects.toThrow();
    expect((await api(gm, "PATCH", w(`/members/${target?.id}`), { role: "master" })).status).toBe(200);
    expect(await membershipOf(master)).toMatchObject({ role: "master" });
  });
});

describe("T-007 (2): invite links", () => {
  it("makes a new user a player and counts the use", async () => {
    const invite = await newInvite("one_day");
    const res = await api<{ worldId: string; joined: boolean }>(playerA, "POST", `/api/invites/${invite.code}/join`);
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ worldId, joined: true });
    expect(await membershipOf(playerA)).toMatchObject({ role: "player", archived_at: null });

    const again = await api<{ joined: boolean }>(playerA, "POST", `/api/invites/${invite.code}/join`);
    expect(again.status).toBe(200);
    expect(again.data.joined).toBe(false);
    const [row] = await sql`SELECT use_count FROM invite_links WHERE id = ${invite.id}`;
    expect(row.use_count).toBe(1);
  });

  it("rejects revoked, expired and unknown links", async () => {
    const revoked = await newInvite();
    expect((await api(gm, "DELETE", w(`/invites/${revoked.id}`))).status).toBe(200);
    expect((await api(playerB, "POST", `/api/invites/${revoked.code}/join`)).status).toBe(409);

    const expired = await newInvite("one_day");
    await sql`UPDATE invite_links SET expires_at = now() - interval '1 minute' WHERE id = ${expired.id}`;
    expect((await api(playerB, "POST", `/api/invites/${expired.code}/join`)).status).toBe(409);

    expect((await api(playerB, "POST", `/api/invites/${"a".repeat(43)}/join`)).status).toBe(404);
    expect((await api(playerB, "POST", "/api/invites/kurz/join")).status).toBe(404);
    expect(await membershipOf(playerB)).toBeUndefined();

    const list = await api<{ invites: Invite[] }>(gm, "GET", w("/invites"));
    const byId = new Map(list.data.invites.map((invite) => [invite.id, invite.status]));
    expect(byId.get(revoked.id)).toBe("revoked");
    expect(byId.get(expired.id)).toBe("expired");
  });
});

describe("T-007 (3): masters and players are not game masters", () => {
  it("forbids a master to invite, change roles, edit or delete the world", async () => {
    const players = await api<{ members: Member[] }>(master, "GET", w("/members"));
    const a = players.data.members.find((member) => member.userId === playerA.user.id);
    expect((await api(master, "POST", w("/invites"), { validity: "unlimited" })).status).toBe(403);
    expect((await api(master, "GET", w("/invites"))).status).toBe(403);
    expect((await api(master, "PATCH", w(`/members/${a?.membershipId}`), { role: "master" })).status).toBe(403);
    expect((await api(master, "DELETE", w(`/members/${a?.membershipId}`))).status).toBe(403);
    expect((await api(master, "PATCH", w(), { name: "Übernommen" })).status).toBe(403);
    expect((await api(master, "DELETE", w())).status).toBe(403);
    expect((await api(playerA, "DELETE", w())).status).toBe(403);
  });

  it("does not let the game master remove or demote themselves", async () => {
    const own = await membershipOf(gm);
    expect((await api(gm, "PATCH", w(`/members/${own?.id}`), { role: "player" })).status).toBe(409);
    expect((await api(gm, "DELETE", w(`/members/${own?.id}`))).status).toBe(409);
    expect((await api(gm, "POST", w("/leave"))).status).toBe(409);
  });
});

describe("T-007 (4): leaving and rejoining", () => {
  it("archives membership and participations, keeps content, rejoins as player", async () => {
    await sql`
      INSERT INTO characters (id, owner_id, name, skills, created_by, updated_by)
      VALUES (${characterId}, ${playerA.user.id}, 'Austrittsheld', '[]'::jsonb, ${playerA.user.id}, ${playerA.user.id})
    `;
    await sql`
      INSERT INTO world_participations (character_id, world_id, created_by, updated_by)
      VALUES (${characterId}, ${worldId}, ${playerA.user.id}, ${playerA.user.id})
    `;
    const a = await membershipOf(playerA);
    await sql`UPDATE memberships SET role = 'master' WHERE id = ${a?.id ?? ""}`;

    expect((await api(playerA, "POST", w("/leave"))).status).toBe(200);
    expect((await membershipOf(playerA))?.archived_at).not.toBeNull();
    const [participation] = await sql`
      SELECT archived_at FROM world_participations WHERE character_id = ${characterId} AND world_id = ${worldId}
    `;
    expect(participation.archived_at).not.toBeNull();
    const [character] = await sql`SELECT id FROM characters WHERE id = ${characterId}`;
    expect(character).toBeDefined();
    expect((await api(playerA, "GET", w())).status).toBe(403);
    expect((await api<{ members: Member[] }>(gm, "GET", w("/members"))).data.members.map((m) => m.userId)).not.toContain(
      playerA.user.id,
    );

    const invite = await newInvite();
    const rejoin = await api<{ joined: boolean }>(playerA, "POST", `/api/invites/${invite.code}/join`);
    expect(rejoin.status).toBe(200);
    expect(rejoin.data.joined).toBe(true);
    expect(await membershipOf(playerA)).toMatchObject({ id: a?.id, role: "player", archived_at: null });
    const [still] = await sql`
      SELECT archived_at FROM world_participations WHERE character_id = ${characterId} AND world_id = ${worldId}
    `;
    expect(still.archived_at).not.toBeNull();
  });

  it("lets the game master remove a member (archived, not deleted)", async () => {
    const invite = await newInvite();
    expect((await api(playerB, "POST", `/api/invites/${invite.code}/join`)).status).toBe(200);
    const b = await membershipOf(playerB);
    expect((await api(gm, "DELETE", w(`/members/${b?.id}`))).status).toBe(200);
    expect((await membershipOf(playerB))?.archived_at).not.toBeNull();
    expect((await api(gm, "DELETE", w(`/members/${b?.id}`))).status).toBe(404);
    expect((await api(gm, "DELETE", w(`/members/${randomUUID()}`))).status).toBe(404);
    expect((await api(gm, "DELETE", w("/members/keine-uuid"))).status).toBe(404);
  });
});

describe("T-007 (5): universes", () => {
  let hiddenId = "";

  it("creates new universes as gm_only at the end; players do not see them", async () => {
    const res = await api<Universe>(master, "POST", w("/universes"), { name: "Schattenebene" });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ visibility: "gm_only", sortOrder: 1 });
    hiddenId = res.data.id;

    const forPlayer = await api<{ universes: Universe[] }>(playerA, "GET", w("/universes"));
    expect(forPlayer.data.universes.map((u) => u.name)).toEqual(["Hauptuniversum"]);
    expect((await api(playerA, "GET", w(`/universes/${hiddenId}`))).status).toBe(404);
    const forMaster = await api<{ universes: Universe[] }>(master, "GET", w("/universes"));
    expect(forMaster.data.universes.map((u) => u.name)).toEqual(["Hauptuniversum", "Schattenebene"]);
  });

  it("enforces unique names, staff-only writes and ordering", async () => {
    expect((await api(gm, "POST", w("/universes"), { name: "Schattenebene" })).status).toBe(409);
    expect((await api(playerA, "POST", w("/universes"), { name: "Spielerwelt" })).status).toBe(403);
    expect((await api(playerA, "PATCH", w(`/universes/${hiddenId}`), { name: "X" })).status).toBe(403);

    expect((await api(gm, "PATCH", w(`/universes/${hiddenId}`), { move: "up" })).status).toBe(200);
    const ordered = await api<{ universes: Universe[] }>(gm, "GET", w("/universes"));
    expect(ordered.data.universes.map((u) => u.name)).toEqual(["Schattenebene", "Hauptuniversum"]);

    expect(
      (await api(gm, "PATCH", w(`/universes/${hiddenId}`), { visibility: "published" })).status,
    ).toBe(200);
    const forPlayer = await api<{ universes: Universe[] }>(playerA, "GET", w("/universes"));
    expect(forPlayer.data.universes.map((u) => u.name)).toEqual(["Schattenebene", "Hauptuniversum"]);
  });

  it("keeps the last universe", async () => {
    expect((await api(gm, "DELETE", w(`/universes/${hiddenId}`))).status).toBe(200);
    const [{ id: lastId }] = await sql`SELECT id FROM universes WHERE world_id = ${worldId}`;
    expect((await api(gm, "DELETE", w(`/universes/${lastId}`))).status).toBe(409);
  });
});

describe("T-007 CR-005: bad ids and bodies", () => {
  it("answers 404/400, never 500", async () => {
    expect((await api(gm, "GET", "/api/worlds/keine-uuid")).status).toBe(404);
    expect((await api(gm, "GET", `/api/worlds/${randomUUID()}`)).status).toBe(404);
    expect((await api(gm, "PATCH", w("/universes/keine-uuid"), { name: "X" })).status).toBe(404);
    expect((await api(gm, "PATCH", w(), {})).status).toBe(400);
    expect((await api(gm, "PATCH", w(), "kein objekt")).status).toBe(400);
    expect((await api(gm, "POST", w("/invites"), { validity: "ewig" })).status).toBe(400);
    expect((await api(gm, "DELETE", w("/invites/keine-uuid"))).status).toBe(404);
    expect((await api(playerB, "GET", w())).status).toBe(403);
  });
});

describe("T-007: world settings and deletion (game master only)", () => {
  it("renames the world and deletes it with its content", async () => {
    expect((await api(gm, "PATCH", w(), { name: "Umbenannt" })).status).toBe(200);
    const [world] = await sql`SELECT name FROM worlds WHERE id = ${worldId}`;
    expect(world.name).toBe("Umbenannt");

    const extra = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "Wegwerfwelt" });
    extraWorlds.push(extra.data.id);
    expect((await api(gm, "DELETE", `/api/worlds/${extra.data.id}`)).status).toBe(200);
    const left = await sql`SELECT id FROM universes WHERE world_id = ${extra.data.id}`;
    expect(left).toEqual([]);
    expect((await api(gm, "GET", `/api/worlds/${extra.data.id}`)).status).toBe(404);
  });
});
