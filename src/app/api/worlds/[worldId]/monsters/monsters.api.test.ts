import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, BASE, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let worldId = "";
const created: string[] = [];

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const w = (path = "") => `/api/worlds/${worldId}${path}`;
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const mentionDoc = (id: string, kind: string, label: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "mention", attrs: { id, kind, label, mentionSuggestionChar: "@" } }],
    },
  ],
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

async function uploadPortrait(session: TestSession, monsterId: string) {
  const form = new FormData();
  form.set("kind", "monster_portrait");
  form.set("worldId", worldId);
  form.set("targetId", monsterId);
  form.set("image", new Blob([PNG], { type: "image/png" }), "portrait.png");
  const res = await fetch(`${BASE}/api/files`, {
    method: "POST",
    headers: { cookie: session.cookie, origin: BASE },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { fileId?: string; error?: string };
  return { status: res.status, data };
}

async function getFile(session: TestSession, fileId: string) {
  const res = await fetch(`${BASE}/api/files/${fileId}`, {
    headers: { cookie: session.cookie, origin: BASE },
  });
  return res.status;
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

describe("T-006 monster portrait", () => {
  it("rejects portrait upload by player with 403", async () => {
    const monster = await create(gm, { name: "Player-Sperre", visibility: "published" });
    expect((await uploadPortrait(playerA, monster.id)).status).toBe(403);
  });

  it("replaces the portrait on second upload and GCs the old file", async () => {
    const monster = await create(gm, { name: "Wechselbild", visibility: "published" });
    const first = await uploadPortrait(gm, monster.id);
    expect(first.status).toBe(201);
    expect(first.data.fileId).toBeTruthy();

    const second = await uploadPortrait(gm, monster.id);
    expect(second.status).toBe(201);
    expect(second.data.fileId).toBeTruthy();
    expect(second.data.fileId).not.toBe(first.data.fileId);

    const detail = await api<{ monster: { portraitId: string | null } }>(
      gm,
      "GET",
      w(`/monsters/${monster.id}`),
    );
    expect(detail.data.monster.portraitId).toBe(second.data.fileId);

    const [oldFile] = await sql`SELECT id FROM files WHERE id = ${first.data.fileId!}`;
    expect(oldFile).toBeUndefined();

    const [currentFile] = await sql`SELECT id FROM files WHERE id = ${second.data.fileId!}`;
    expect(currentFile).toBeTruthy();
  });

  it("hides owner_only monster portraits from other users (404)", async () => {
    const monster = await create(master, { name: "Geheimbild", visibility: "owner_only" });
    const uploaded = await uploadPortrait(master, monster.id);
    expect(uploaded.status).toBe(201);
    const fileId = uploaded.data.fileId!;

    expect(await getFile(master, fileId)).toBe(200);
    expect(await getFile(gm, fileId)).toBe(404);
    expect(await getFile(playerA, fileId)).toBe(404);
  });
});

describe("T-007 monster relations, mentions, habitat", () => {
  it("creates a habitat relation and removes it when cleared", async () => {
    const place = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Nebelmoor",
      templateType: "place",
      visibility: "published",
    });
    expect(place.status).toBe(201);
    const placeId = place.data.article.id;
    const monster = await create(gm, {
      name: "Moorleiche",
      visibility: "published",
      habitatArticleId: placeId,
    });

    const onMonster = await api<{ items: { id: string; originLabels: string[] }[] }>(
      gm,
      "GET",
      w(`/relations?kind=monster&id=${monster.id}`),
    );
    expect(onMonster.data.items).toEqual([
      expect.objectContaining({ id: placeId, originLabels: ["Vorlagenfeld"] }),
    ]);
    const habitatRows = await sql`
      SELECT id FROM relations
      WHERE world_id = ${worldId}
        AND source_monster_id = ${monster.id}
        AND origin = 'template_field'
        AND template_field_key = 'habitat'
    `;
    expect(habitatRows).toHaveLength(1);

    expect((await api(gm, "PATCH", w(`/monsters/${monster.id}`), { habitatArticleId: null })).status).toBe(200);
    const cleared = await api<{ items: { id: string }[] }>(
      gm,
      "GET",
      w(`/relations?kind=monster&id=${monster.id}`),
    );
    expect(cleared.data.items).toEqual([]);
    const afterClear = await sql`
      SELECT id FROM relations
      WHERE world_id = ${worldId}
        AND source_monster_id = ${monster.id}
        AND origin = 'template_field'
    `;
    expect(afterClear).toHaveLength(0);
  });

  it("shows article mentions from monster bio in Verknüpft on both sides", async () => {
    const article = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Mondstein",
      visibility: "published",
    });
    expect(article.status).toBe(201);
    const articleId = article.data.article.id;
    const monster = await create(gm, {
      name: "Mondbestie",
      visibility: "published",
      bio: mentionDoc(articleId, "article", "Mondstein"),
    });

    const fromMonster = await api<{ items: { id: string; kind: string; originLabels: string[] }[] }>(
      gm,
      "GET",
      w(`/relations?kind=monster&id=${monster.id}`),
    );
    expect(fromMonster.data.items).toEqual([
      expect.objectContaining({ id: articleId, kind: "article", originLabels: ["Erwähnung"] }),
    ]);

    const fromArticle = await api<{ items: { id: string; kind: string; originLabels: string[] }[] }>(
      gm,
      "GET",
      w(`/relations?kind=article&id=${articleId}`),
    );
    expect(fromArticle.data.items).toEqual([
      expect.objectContaining({ id: monster.id, kind: "monster", originLabels: ["Erwähnung"] }),
    ]);
  });

  it("deletes all relations when the monster is deleted", async () => {
    const place = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Ruinen",
      templateType: "place",
      visibility: "published",
    });
    expect(place.status).toBe(201);
    const article = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Opfer",
      visibility: "published",
    });
    expect(article.status).toBe(201);
    const monster = await create(gm, {
      name: "Ruinengänger",
      visibility: "published",
      habitatArticleId: place.data.article.id,
      bio: mentionDoc(article.data.article.id, "article", "Opfer"),
    });

    const before = await sql`
      SELECT id FROM relations
      WHERE world_id = ${worldId}
        AND (source_monster_id = ${monster.id} OR target_monster_id = ${monster.id})
    `;
    expect(before.length).toBeGreaterThanOrEqual(2);

    expect((await api(gm, "DELETE", w(`/monsters/${monster.id}`))).status).toBe(200);
    const after = await sql`
      SELECT id FROM relations
      WHERE world_id = ${worldId}
        AND (source_monster_id = ${monster.id} OR target_monster_id = ${monster.id})
    `;
    expect(after).toHaveLength(0);
  });
});
