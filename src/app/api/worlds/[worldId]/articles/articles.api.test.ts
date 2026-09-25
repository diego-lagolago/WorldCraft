import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let playerB: TestSession;
let worldId = "";
const created: string[] = [];

const w = (path = "") => `/api/worlds/${worldId}${path}`;
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function create(session: TestSession, body: Record<string, unknown>) {
  const res = await api<{ article: { id: string; title: string; templateType: string; firstEditedAt: string | null } }>(
    session,
    "POST",
    w("/articles"),
    body,
  );
  expect(res.status).toBe(201);
  created.push(res.data.article.id);
  return res.data.article;
}

beforeAll(async () => {
  [gm, master, playerA, playerB] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-a"),
    login("test-player-b"),
  ]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "T-009 Artikelwelt" });
  expect(world.status).toBe(201);
  worldId = world.data.id;
  const invite = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
  expect((await api(playerA, "POST", `/api/invites/${invite.data.code}/join`)).status).toBe(200);
  const masterInvite = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
  expect((await api(master, "POST", `/api/invites/${masterInvite.data.code}/join`)).status).toBe(200);
  const [row] = await sql`SELECT id FROM memberships WHERE world_id = ${worldId} AND user_id = ${master.user.id}`;
  expect((await api(gm, "PATCH", w(`/members/${row.id}`), { role: "master" })).status).toBe(200);
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql.end();
});

describe("T-009 (1): template types", () => {
  it("creates none, person, place, organization, item and race", async () => {
    for (const templateType of ["none", "person", "place", "organization", "item", "race"]) {
      const article = await create(gm, { title: `Typ ${templateType}`, templateType });
      expect(article.templateType).toBe(templateType);
    }
    const none = await api<{ article: { templateFields: unknown } }>(gm, "GET", w(`/articles/${created[0]}`));
    expect(none.data.article.templateFields).toEqual({});
  });
});

describe("Plan 009 T-003: race articles and person references", () => {
  it("stores a Person → Rasse template-field relation and rejects other targets", async () => {
    const race = await create(gm, { title: "Waldelfen", templateType: "race" });
    const person = await create(gm, {
      title: "Liora",
      templateType: "person",
      templateFields: { race: { kind: "article", id: race.id } },
    });

    const [relation] = await sql`
      SELECT origin, template_field_key, source_article_id, target_article_id
      FROM relations
      WHERE source_article_id = ${person.id} AND target_article_id = ${race.id}
    `;
    expect(relation).toMatchObject({
      origin: "template_field",
      template_field_key: "race",
      source_article_id: person.id,
      target_article_id: race.id,
    });

    const place = await create(gm, { title: "Nicht eine Rasse", templateType: "place" });
    const wrongArticle = await api(gm, "PATCH", w(`/articles/${person.id}`), {
      templateFields: { race: { kind: "article", id: place.id } },
    });
    expect(wrongArticle.status).toBe(400);
    const wrongCharacter = await api(gm, "PATCH", w(`/articles/${person.id}`), {
      templateFields: { race: { kind: "character", id: "00000000-0000-4000-8000-0000000000dd" } },
    });
    expect(wrongCharacter.status).toBe(400);

    const filtered = await api<{ articles: { id: string }[] }>(gm, "GET", w("/articles?templateType=race"));
    expect(filtered.status).toBe(200);
    expect(filtered.data.articles.map((article) => article.id)).toContain(race.id);
    expect(filtered.data.articles.map((article) => article.id)).not.toContain(person.id);
  });
});

describe("Plan 009 T-004: item rarity list projection", () => {
  it("returns rarity only for list rows, not create or detail summaries", async () => {
    const createdItem = await create(gm, {
      title: "Legendärer Fisch",
      templateType: "item",
      templateFields: { kind: "fish", rarity: "legendary" },
    });
    expect(createdItem).not.toHaveProperty("rarity");

    const list = await api<{ articles: { id: string; rarity: string | null }[] }>(
      gm,
      "GET",
      w("/articles?templateType=item"),
    );
    expect(list.status).toBe(200);
    expect(list.data.articles.find((article) => article.id === createdItem.id)).toMatchObject({ rarity: "legendary" });

    const detail = await api<{ article: Record<string, unknown> }>(gm, "GET", w(`/articles/${createdItem.id}`));
    expect(detail.status).toBe(200);
    expect(detail.data.article).not.toHaveProperty("rarity");
    expect(detail.data.article.templateFields).toMatchObject({ rarity: "legendary" });
  });
});

describe("CR-001: template switches", () => {
  it("drops incompatible stored fields but keeps explicitly submitted fields strict", async () => {
    const organization = await create(gm, {
      title: "Göttliche Gilde",
      templateType: "organization",
      templateFields: { danger: "divine", size: "over_100" },
    });

    const switched = await api(gm, "PATCH", w(`/articles/${organization.id}`), { templateType: "place" });
    expect(switched.status).toBe(200);
    const detail = await api<{ article: { templateType: string; templateFields: unknown } }>(
      gm,
      "GET",
      w(`/articles/${organization.id}`),
    );
    expect(detail.status).toBe(200);
    expect(detail.data.article).toMatchObject({ templateType: "place", templateFields: {} });

    const explicitInvalid = await api(gm, "PATCH", w(`/articles/${organization.id}`), {
      templateType: "place",
      templateFields: { danger: "divine" },
    });
    expect(explicitInvalid.status).toBe(400);

    const race = await create(gm, { title: "Wechselnde Rasse", templateType: "race" });
    const person = await create(gm, {
      title: "Verweisende Person",
      templateType: "person",
      templateFields: { race: { kind: "article", id: race.id } },
    });
    expect((await api(gm, "PATCH", w(`/articles/${race.id}`), { templateType: "place" })).status).toBe(200);
    expect((await api(gm, "PATCH", w(`/articles/${person.id}`), { templateType: "person" })).status).toBe(200);
    const personDetail = await api<{ article: { templateFields: unknown } }>(gm, "GET", w(`/articles/${person.id}`));
    expect(personDetail.data.article.templateFields).toEqual({});

    const deletedRace = await create(gm, { title: "Gelöschte Rasse", templateType: "race" });
    const missingTargetPerson = await create(gm, {
      title: "Person ohne Ziel",
      templateType: "person",
      templateFields: { race: { kind: "article", id: deletedRace.id } },
    });
    expect((await api(gm, "DELETE", w(`/articles/${deletedRace.id}`))).status).toBe(200);
    expect((await api(gm, "PATCH", w(`/articles/${missingTargetPerson.id}`), { templateType: "person" })).status).toBe(
      200,
    );
    const missingTargetDetail = await api<{ article: { templateFields: unknown } }>(
      gm,
      "GET",
      w(`/articles/${missingTargetPerson.id}`),
    );
    expect(missingTargetDetail.data.article.templateFields).toEqual({});
  });
});

describe("T-009 (2)/(5): fields, refs and first_edited_at", () => {
  let personId = "";
  let placeId = "";
  let stubId = "";

  it("rejects a ref to the wrong template type", async () => {
    const person = await create(gm, { title: "Herrscherin", templateType: "person" });
    const place = await create(gm, { title: "Burg", templateType: "place" });
    personId = person.id;
    placeId = place.id;
    const bad = await api(gm, "PATCH", w(`/articles/${placeId}`), {
      templateFields: { ruler: { kind: "article", id: placeId } },
    });
    expect(bad.status).toBe(400);
    const good = await api(gm, "PATCH", w(`/articles/${placeId}`), {
      templateType: "place",
      templateFields: { kind: "city", ruler: { kind: "article", id: personId } },
    });
    expect(good.status).toBe(200);
  });

  it("keeps a stub red until body or a field is saved, then stays blue (5)", async () => {
    const stub = await create(master, { title: "Neuer Stub" });
    stubId = stub.id;
    expect(stub.firstEditedAt).toBeNull();
    expect((await api(master, "PATCH", w(`/articles/${stubId}`), { title: "Neuer Stub umbenannt" })).status).toBe(200);
    expect((await api(master, "PATCH", w(`/articles/${stubId}`), { visibility: "published" })).status).toBe(200);
    const still = await sql`SELECT first_edited_at FROM articles WHERE id = ${stubId}`;
    expect(still[0].first_edited_at).toBeNull();

    expect((await api(master, "PATCH", w(`/articles/${stubId}`), { body: doc("Erster Satz") })).status).toBe(200);
    const edited = await sql`SELECT first_edited_at, body_plain FROM articles WHERE id = ${stubId}`;
    expect(edited[0].first_edited_at).not.toBeNull();
    expect(edited[0].body_plain).toBe("Erster Satz");

    expect((await api(master, "PATCH", w(`/articles/${stubId}`), { body: doc("") })).status).toBe(200);
    const emptied = await sql`SELECT first_edited_at, body_plain FROM articles WHERE id = ${stubId}`;
    expect(emptied[0].first_edited_at).not.toBeNull();
    expect(emptied[0].body_plain).toBeNull();
  });

  it("sets first_edited_at when only a template field is filled", async () => {
    const article = await create(gm, { title: "Nur Feld", templateType: "person" });
    expect((await api(gm, "PATCH", w(`/articles/${article.id}`), { templateFields: { occupation: "Schmied" } })).status).toBe(
      200,
    );
    const [row] = await sql`SELECT first_edited_at FROM articles WHERE id = ${article.id}`;
    expect(row.first_edited_at).not.toBeNull();
  });
});

describe("T-009 (4): visibility", () => {
  it("hides gm_only articles from players", async () => {
    const hidden = await create(gm, { title: "Geheim", visibility: "gm_only", body: doc("geheim") });
    const shown = await create(gm, { title: "Offen", visibility: "published", body: doc("offen") });
    expect((await api(playerA, "GET", w(`/articles/${hidden.id}`))).status).toBe(404);
    expect((await api(playerA, "GET", w(`/articles/${shown.id}`))).status).toBe(200);
    const list = await api<{ articles: { id: string }[] }>(playerA, "GET", w("/articles"));
    const ids = list.data.articles.map((article) => article.id);
    expect(ids).toContain(shown.id);
    expect(ids).not.toContain(hidden.id);
    expect((await api(playerA, "PATCH", w(`/articles/${shown.id}`), { title: "Geklaut" })).status).toBe(403);
    expect((await api(playerA, "DELETE", w(`/articles/${shown.id}`))).status).toBe(403);
  });
});

describe("CR-004: invalid template ref ids", () => {
  it("rejects non-UUID refs with 400 on create and patch", async () => {
    const createRes = await api(gm, "POST", w("/articles"), {
      title: "X",
      templateType: "person",
      templateFields: { location: { kind: "article", id: "abc" } },
    });
    expect(createRes.status).toBe(400);
    expect((createRes.data as { error?: string }).error).toMatch(/akzeptiert dieses Ziel nicht/);

    const article = await create(gm, { title: "Patch-Ref", templateType: "person" });
    const patchRes = await api(gm, "PATCH", w(`/articles/${article.id}`), {
      templateFields: { location: { kind: "article", id: "abc" } },
    });
    expect(patchRes.status).toBe(400);
    expect((patchRes.data as { error?: string }).error).toMatch(/akzeptiert dieses Ziel nicht/);
  });
});

describe("CR-005: bad ids and bodies on article routes", () => {
  it("answers 400 or 404, never 500", async () => {
    expect((await api(gm, "GET", w("/articles/not-a-uuid"))).status).toBe(404);
    expect((await api(gm, "PATCH", w("/articles/not-a-uuid"), { title: "x" })).status).toBe(404);
    expect((await api(gm, "DELETE", `/api/worlds/not-a-uuid/articles/${randomUUID()}`)).status).toBe(404);
    expect((await api(gm, "PATCH", w(`/articles/${created[0]}`), {})).status).toBe(400);
    expect((await api(gm, "POST", w("/articles"), "kein objekt")).status).toBe(400);
    expect((await api(playerB, "GET", w("/articles"))).status).toBe(403);
  });
});
