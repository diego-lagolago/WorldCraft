import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let worldId = "";
let publishedId = "";
let hiddenId = "";

const w = (path = "") => `/api/worlds/${worldId}${path}`;
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

function search(session: TestSession, query: string, extra = "") {
  return api<{ hits?: { id: string; kind: string; title: string; snippet: string }[]; error?: string }>(
    session,
    "GET",
    w(`/search?q=${encodeURIComponent(query)}${extra}`),
  );
}

beforeAll(async () => {
  [gm, master, playerA] = await Promise.all([login("test-gm"), login("test-master"), login("test-player-a")]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "T-014 Suchwelt" });
  expect(world.status).toBe(201);
  worldId = world.data.id;
  const invite = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
  expect((await api(playerA, "POST", `/api/invites/${invite.data.code}/join`)).status).toBe(200);
  const masterInvite = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
  expect((await api(master, "POST", `/api/invites/${masterInvite.data.code}/join`)).status).toBe(200);
  const [row] = await sql`SELECT id FROM memberships WHERE world_id = ${worldId} AND user_id = ${master.user.id}`;
  expect((await api(gm, "PATCH", w(`/members/${row.id}`), { role: "master" })).status).toBe(200);

  const published = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
    title: "Burg Rabenstein",
    visibility: "published",
    body: doc("In den Kellern lauert der Gottschleim."),
  });
  expect(published.status).toBe(201);
  publishedId = published.data.article.id;

  const hidden = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
    title: "Geheimer Rabenhort",
    visibility: "gm_only",
    body: doc("Nur Spielleitung kennt den Rabenhort."),
  });
  expect(hidden.status).toBe(201);
  hiddenId = hidden.data.article.id;

  const char = await api<{ id: string }>(playerA, "POST", "/api/characters", { name: "Tagebuchträger" });
  expect(char.status).toBe(201);
  expect((await api(playerA, "POST", w("/characters"), { characterId: char.data.id })).status).toBe(200);
  expect(
    (
      await api(playerA, "POST", w(`/characters/${char.data.id}/journal`), {
        body: doc("Geheimer Tagebuchtext mit Rabenstein"),
        visibility: "shared_with_gm",
      })
    ).status,
  ).toBe(201);

  const monster = await api<{ monster: { id: string } }>(gm, "POST", w("/monsters"), {
    name: "Nachtjäger",
    visibility: "published",
    bio: doc("Sein Gift heißt Mondschattenextrakt und wirkt nur nachts."),
  });
  expect(monster.status).toBe(201);
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql`DELETE FROM characters WHERE owner_id = ${playerA.user.id} AND name = 'Tagebuchträger'`;
  await sql.end();
});

describe("T-014 (1)/(2)/(3): search visibility and journal exclusion", () => {
  it("finds title and body hits for members", async () => {
    const byTitle = await search(playerA, "Rabenstein");
    expect(byTitle.status).toBe(200);
    expect(byTitle.data.hits?.some((hit) => hit.id === publishedId && hit.title === "Burg Rabenstein")).toBe(true);

    const byBody = await search(playerA, "Gottschleim");
    expect(byBody.data.hits?.some((hit) => hit.id === publishedId && hit.snippet.includes("Gottschleim"))).toBe(true);
  });

  it("hides gm_only from players but shows it to staff", async () => {
    const player = await search(playerA, "Raben");
    expect(player.data.hits?.map((hit) => hit.id)).toContain(publishedId);
    expect(player.data.hits?.map((hit) => hit.id)).not.toContain(hiddenId);

    const staff = await search(master, "Raben");
    expect(staff.data.hits?.map((hit) => hit.id)).toEqual(expect.arrayContaining([publishedId, hiddenId]));
  });

  it("never returns journal entries", async () => {
    const res = await search(master, "Tagebuchtext");
    expect(res.status).toBe(200);
    expect(res.data.hits ?? []).toEqual([]);
  });
});

describe("T-014 (4)/(5): short query and limit", () => {
  it("returns empty hits for one character without error", async () => {
    const res = await search(gm, "R");
    expect(res.status).toBe(200);
    expect(res.data.hits).toEqual([]);
  });

  it("defaults to 20 and caps limit at 50", async () => {
    for (let i = 0; i < 25; i += 1) {
      expect(
        (await api(gm, "POST", w("/articles"), { title: `Füller ${i} Raben`, visibility: "published" })).status,
      ).toBe(201);
    }
    const def = await search(gm, "Raben");
    expect(def.data.hits?.length).toBeLessThanOrEqual(20);

    const capped = await search(gm, "Raben", "&limit=100");
    expect(capped.data.hits?.length).toBeLessThanOrEqual(50);
    expect((capped.data.hits?.length ?? 0) >= (def.data.hits?.length ?? 0)).toBe(true);
  });
});

describe("CR-005: bad world id on search", () => {
  it("answers 404 for invalid world ids, never 500", async () => {
    expect((await api(gm, "GET", "/api/worlds/not-a-uuid/search?q=ab")).status).toBe(404);
  });
});

describe("Plan 005 T-007: monster full-text search", () => {
  it("finds a word that only appears in a monster bio", async () => {
    const res = await search(playerA, "Mondschattenextrakt");
    expect(res.status).toBe(200);
    const hit = res.data.hits?.find((row) => row.kind === "monster" && row.title === "Nachtjäger");
    expect(hit).toBeTruthy();
    expect(hit?.snippet).toContain("Mondschattenextrakt");
  });
});
