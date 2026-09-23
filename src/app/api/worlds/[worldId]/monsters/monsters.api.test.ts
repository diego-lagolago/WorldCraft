import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let worldId = "";
const created: string[] = [];

const w = (path = "") => `/api/worlds/${worldId}${path}`;
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function create(session: TestSession, body: Record<string, unknown>) {
  const res = await api<{ monster: { id: string; name: string; visibility: string; kind: string } }>(
    session,
    "POST",
    w("/monsters"),
    body,
  );
  expect(res.status).toBe(201);
  created.push(res.data.monster.id);
  return res.data.monster;
}

beforeAll(async () => {
  [gm, master, playerA] = await Promise.all([login("test-gm"), login("test-master"), login("test-player-a")]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "T-005 Monsterwelt" });
  expect(world.status).toBe(201);
  worldId = world.data.id;

  const inviteMaster = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
  expect((await api(master, "POST", `/api/invites/${inviteMaster.data.code}/join`)).status).toBe(200);
  const invitePlayer = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
  expect((await api(playerA, "POST", `/api/invites/${invitePlayer.data.code}/join`)).status).toBe(200);

  const [row] = await sql`SELECT id FROM memberships WHERE world_id = ${worldId} AND user_id = ${master.user.id}`;
  expect((await api(gm, "PATCH", w(`/members/${row.id}`), { role: "master" })).status).toBe(200);
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql.end();
});

describe("T-005 monsters API", () => {
  it("rejects create by player with 403", async () => {
    expect((await api(playerA, "POST", w("/monsters"), { name: "Unerlaubt" })).status).toBe(403);
  });

  it("hides owner_only monster from other masters (404)", async () => {
    const monster = await create(master, { name: "Nur Master", visibility: "owner_only" });
    expect((await api(gm, "GET", w(`/monsters/${monster.id}`))).status).toBe(404);
    expect((await api(playerA, "GET", w(`/monsters/${monster.id}`))).status).toBe(404);
    expect((await api(master, "GET", w(`/monsters/${monster.id}`))).status).toBe(200);

    const listGm = await api<{ monsters: { id: string }[] }>(gm, "GET", w("/monsters"));
    expect(listGm.data.monsters.map((row) => row.id)).not.toContain(monster.id);
  });

  it("lets players see only published monsters", async () => {
    const published = await create(gm, { name: "Offenes Biest", visibility: "published", kind: "beast" });
    const hidden = await create(gm, { name: "SL-Geheim", visibility: "gm_only", kind: "demon" });

    expect((await api(playerA, "GET", w(`/monsters/${published.id}`))).status).toBe(200);
    expect((await api(playerA, "GET", w(`/monsters/${hidden.id}`))).status).toBe(404);

    const list = await api<{ monsters: { id: string }[] }>(playerA, "GET", w("/monsters"));
    const ids = list.data.monsters.map((row) => row.id);
    expect(ids).toContain(published.id);
    expect(ids).not.toContain(hidden.id);

    expect((await api(playerA, "PATCH", w(`/monsters/${published.id}`), { name: "Hack" })).status).toBe(403);
    expect((await api(playerA, "DELETE", w(`/monsters/${published.id}`))).status).toBe(403);
  });

  it("rejects habitat that is not a visible place article with 422", async () => {
    const person = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Person",
      templateType: "person",
      visibility: "published",
    });
    expect(person.status).toBe(201);
    const placeOwnerOnly = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Nur GM Ort",
      templateType: "place",
      visibility: "owner_only",
    });
    expect(placeOwnerOnly.status).toBe(201);
    const place = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Wald",
      templateType: "place",
      visibility: "published",
    });
    expect(place.status).toBe(201);

    const badPerson = await api(gm, "POST", w("/monsters"), {
      name: "Falscher Habitat",
      habitatArticleId: person.data.article.id,
    });
    expect(badPerson.status).toBe(422);

    const monster = await create(master, { name: "Waldwesen", visibility: "published" });
    const badHidden = await api(master, "PATCH", w(`/monsters/${monster.id}`), {
      habitatArticleId: placeOwnerOnly.data.article.id,
    });
    expect(badHidden.status).toBe(422);

    expect(
      (await api(master, "PATCH", w(`/monsters/${monster.id}`), { habitatArticleId: place.data.article.id })).status,
    ).toBe(200);
  });

  it("rejects 31 skills with 422 (sheet validation)", async () => {
    const skills = Array.from({ length: 31 }, (_, i) => ({
      name: `S${i}`,
      level: "trained",
      attr: "dex",
    }));
    const res = await api(gm, "POST", w("/monsters"), { name: "Überladen", skills });
    expect(res.status).toBe(422);
  });

  it("filters list by kind and accepts bio with mentions", async () => {
    const place = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Höhle",
      templateType: "place",
      visibility: "published",
    });
    expect(place.status).toBe(201);
    const dragon = await create(gm, {
      name: "Schattendrache",
      kind: "dragon",
      visibility: "published",
      bio: doc("Lebt nahe der Höhle"),
      habitatArticleId: place.data.article.id,
    });
    const beasts = await api<{ monsters: { id: string; kind: string }[] }>(gm, "GET", w("/monsters?kind=beast"));
    expect(beasts.data.monsters.every((row) => row.kind === "beast")).toBe(true);
    expect(beasts.data.monsters.map((row) => row.id)).not.toContain(dragon.id);

    const dragons = await api<{ monsters: { id: string }[] }>(gm, "GET", w("/monsters?kind=dragon"));
    expect(dragons.data.monsters.map((row) => row.id)).toContain(dragon.id);

    const detail = await api<{ monster: { bioJson: unknown; habitatArticleId: string | null } }>(
      gm,
      "GET",
      w(`/monsters/${dragon.id}`),
    );
    expect(detail.data.monster.habitatArticleId).toBe(place.data.article.id);
    expect(detail.data.monster.bioJson).toBeTruthy();
  });

  it("answers 404 for bad ids, never 500", async () => {
    expect((await api(gm, "GET", w("/monsters/not-a-uuid"))).status).toBe(404);
    expect((await api(gm, "PATCH", w("/monsters/not-a-uuid"), { name: "x" })).status).toBe(404);
    expect((await api(gm, "DELETE", w("/monsters/not-a-uuid"))).status).toBe(404);
  });
});
