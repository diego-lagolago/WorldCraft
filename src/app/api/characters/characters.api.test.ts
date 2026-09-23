import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, api, login, testSql, type TestSession } from "@/test/api-harness";

type Sheet = {
  id: string;
  ownerId: string;
  skills: { name: string; level: string; attr: string }[];
  abilities: { text: string; attr: string }[];
  attributes: Record<string, number | null>;
  proficiencyBonus: number;
  images: { id: string; fileId: string; caption: string | null; sortOrder: number }[];
  portraitId: string | null;
};
type Entry = { id: string; title: string | null; visibility: string };

const sql = testSql();
let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let playerB: TestSession;
let worldId = "";
let otherWorldId = "";
const created: string[] = [];
let charA1 = "";
let charA2 = "";

const w = (path = "") => `/api/worlds/${worldId}${path}`;
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const mentionDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "mention", attrs: { id: randomUUID(), kind: "article", label: "X" } }] }],
};
/** 1×1 PNG. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function createCharacter(session: TestSession, name: string, extra: Record<string, unknown> = {}) {
  const res = await api<{ id: string }>(session, "POST", "/api/characters", { name, ...extra });
  expect(res.status).toBe(201);
  created.push(res.data.id);
  return res.data.id;
}

async function sheet(session: TestSession, id: string) {
  const res = await api<{ character: Sheet }>(session, "GET", `/api/characters/${id}`);
  expect(res.status).toBe(200);
  return res.data.character;
}

async function join(session: TestSession, world = worldId) {
  const invite = await api<{ code: string }>(gm, "POST", `/api/worlds/${world}/invites`, { validity: "seven_days" });
  expect(invite.status).toBe(201);
  expect((await api(session, "POST", `/api/invites/${invite.data.code}/join`)).status).toBe(200);
}

async function upload(session: TestSession, kind: string, targetId: string) {
  const form = new FormData();
  form.set("image", new Blob([PNG], { type: "image/png" }), "x.png");
  form.set("kind", kind);
  form.set("targetId", targetId);
  const res = await fetch(`${BASE}/api/files`, {
    method: "POST",
    headers: { origin: BASE, cookie: session.cookie },
    body: form,
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as { fileId?: string; error?: string } };
}

async function journal(session: TestSession, characterId: string) {
  return api<{ entries: Entry[] }>(session, "GET", w(`/characters/${characterId}/journal`));
}

beforeAll(async () => {
  [gm, master, playerA, playerB] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-a"),
    login("test-player-b"),
  ]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "T-008 Testwelt" });
  expect(world.status).toBe(201);
  worldId = world.data.id;
  const other = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "T-008 Fremde Welt" });
  otherWorldId = other.data.id;
  await Promise.all([join(master), join(playerA), join(playerB)]);
  const [row] = await sql`SELECT id FROM memberships WHERE world_id = ${worldId} AND user_id = ${master.user.id}`;
  expect((await api(gm, "PATCH", w(`/members/${row.id}`), { role: "master" })).status).toBe(200);
});

afterAll(async () => {
  const worlds = [worldId, otherWorldId].filter(Boolean);
  if (worlds.length) await sql`DELETE FROM worlds WHERE id IN ${sql(worlds)}`;
  if (created.length) await sql`DELETE FROM characters WHERE id IN ${sql(created)}`;
  await sql.end();
});

describe("T-008 (4)/(4a)/(4b): character sheet", () => {
  it("starts with empty skill and ability lists and default proficiency", async () => {
    charA1 = await createCharacter(playerA, "Aldric");
    const fresh = await sheet(playerA, charA1);
    expect(fresh).toMatchObject({ skills: [], abilities: [], proficiencyBonus: 2, portraitId: null, images: [] });
  });

  it("saves attributes, skills, abilities and traits", async () => {
    const res = await api(playerA, "PATCH", `/api/characters/${charA1}`, {
      class: "Waldläufer",
      attributes: { dex: 17, cha: 9 },
      skills: [{ name: "Reiten", level: "expertise", attr: "dex" }],
      abilities: [{ text: "Wolf rufen", attr: "cha" }],
      personality: "  ruhig  ",
      flaws: "",
      bio: doc("Aus dem Norden"),
    });
    expect(res.status).toBe(200);
    const saved = await sheet(playerA, charA1);
    expect(saved.attributes).toMatchObject({ dex: 17, cha: 9, str: null });
    expect(saved.skills).toEqual([{ name: "Reiten", level: "expertise", attr: "dex" }]);
    expect(saved.abilities).toEqual([{ text: "Wolf rufen", attr: "cha" }]);
    expect(saved).toMatchObject({ personality: "ruhig", flaws: null });
  });

  it("rejects attributes 0 and 31 and proficiency 11", async () => {
    const patch = (body: unknown) => api(playerA, "PATCH", `/api/characters/${charA1}`, body);
    expect((await patch({ attributes: { str: 0 } })).status).toBe(400);
    expect((await patch({ attributes: { str: 31 } })).status).toBe(400);
    expect((await patch({ proficiencyBonus: 11 })).status).toBe(400);
    expect((await patch({ proficiencyBonus: -1 })).status).toBe(400);
  });

  it("rejects a 31st, empty or duplicate skill and ability", async () => {
    const patch = (body: unknown) => api<{ error: string }>(playerA, "PATCH", `/api/characters/${charA1}`, body);
    const skills = Array.from({ length: 31 }, (_, i) => ({ name: `S${i}`, level: "trained", attr: "dex" }));
    expect((await patch({ skills })).status).toBe(400);
    expect((await patch({ skills: [{ name: "  ", level: "trained", attr: "dex" }] })).status).toBe(400);
    const duplicate = await patch({
      skills: [
        { name: "Reiten", level: "trained", attr: "dex" },
        { name: "reiten", level: "expertise", attr: "wis" },
      ],
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.data.error).toContain("doppelt");

    const abilities = Array.from({ length: 31 }, (_, i) => ({ text: `A${i}`, attr: "cha" }));
    expect((await patch({ abilities })).status).toBe(400);
    expect((await patch({ abilities: [{ text: "", attr: "cha" }] })).status).toBe(400);
    expect(
      (await patch({ abilities: [{ text: "Wolf rufen", attr: "cha" }, { text: "WOLF RUFEN", attr: "str" }] })).status,
    ).toBe(400);
    expect((await sheet(playerA, charA1)).skills).toHaveLength(1);
  });

  it("rejects a mention in the bio (APP-BIO-NO-MENTIONS)", async () => {
    expect((await api(playerA, "PATCH", `/api/characters/${charA1}`, { bio: mentionDoc })).status).toBe(400);
  });

  it("lets only the owner read and write on world-independent routes (6)", async () => {
    expect((await api(playerB, "GET", `/api/characters/${charA1}`)).status).toBe(404);
    expect((await api(playerB, "PATCH", `/api/characters/${charA1}`, { name: "Gestohlen" })).status).toBe(403);
    expect((await api(gm, "DELETE", `/api/characters/${charA1}`)).status).toBe(403);
    expect((await api(null, "GET", "/api/characters")).status).toBe(401);
  });
});

describe("T-008 images", () => {
  it("keeps image order unique after deletes and moves, and only the owner uploads", async () => {
    const first = await upload(playerA, "character_image", charA1);
    const second = await upload(playerA, "character_image", charA1);
    expect([first.status, second.status]).toEqual([201, 201]);
    let images = (await sheet(playerA, charA1)).images;
    expect(images).toHaveLength(2);

    expect((await api(playerA, "DELETE", `/api/characters/${charA1}/images/${images[0].id}`)).status).toBe(200);
    expect((await upload(playerA, "character_image", charA1)).status).toBe(201);
    images = (await sheet(playerA, charA1)).images;
    expect(images).toHaveLength(2);

    const moved = await api(playerA, "PATCH", `/api/characters/${charA1}/images/${images[1].id}`, {
      move: "up",
      caption: "Am Lagerfeuer",
    });
    expect(moved.status).toBe(200);
    const after = (await sheet(playerA, charA1)).images;
    expect(after.map((image) => image.id)).toEqual([images[1].id, images[0].id]);
    expect(after[0].caption).toBe("Am Lagerfeuer");

    expect((await upload(playerB, "character_image", charA1)).status).toBe(403);
    expect((await api(playerB, "DELETE", `/api/characters/${charA1}/images/${after[0].id}`)).status).toBe(403);
    expect((await api(playerA, "DELETE", `/api/characters/${charA1}/images/${randomUUID()}`)).status).toBe(404);
  });

  it("replaces and removes the portrait", async () => {
    const portrait = await upload(playerA, "character_portrait", charA1);
    expect(portrait.status).toBe(201);
    expect((await sheet(playerA, charA1)).portraitId).toBe(portrait.data.fileId);
    expect((await api(playerA, "PATCH", `/api/characters/${charA1}`, { removePortrait: true })).status).toBe(200);
    expect((await sheet(playerA, charA1)).portraitId).toBeNull();
    const [file] = await sql`SELECT id FROM files WHERE id = ${portrait.data.fileId!}`;
    expect(file).toBeUndefined();
  });
});

describe("T-008 (1)/(6): bringing characters", () => {
  it("brings two characters of the same player into one world", async () => {
    charA2 = await createCharacter(playerA, "Brom");
    for (const id of [charA1, charA2]) {
      const res = await api<{ brought: boolean }>(playerA, "POST", w("/characters"), { characterId: id });
      expect(res.status).toBe(200);
      expect(res.data.brought).toBe(true);
    }
    const again = await api<{ brought: boolean }>(playerA, "POST", w("/characters"), { characterId: charA1 });
    expect(again.data.brought).toBe(false);

    const list = await api<{ characters: { id: string }[] }>(playerB, "GET", w("/characters"));
    expect(list.data.characters.map((c) => c.id).sort()).toEqual([charA1, charA2].sort());
    const view = await api<{ character: Sheet }>(playerB, "GET", w(`/characters/${charA1}`));
    expect(view.status).toBe(200);
    expect(view.data.character.skills).toHaveLength(1);
  });

  it("refuses to bring foreign characters or into worlds without membership", async () => {
    expect((await api(playerB, "POST", w("/characters"), { characterId: charA1 })).status).toBe(403);
    expect((await api(playerA, "POST", `/api/worlds/${otherWorldId}/characters`, { characterId: charA1 })).status).toBe(403);
    expect((await api(playerA, "POST", w("/characters"), { characterId: randomUUID() })).status).toBe(404);
  });

  it("hides characters that were never brought", async () => {
    const lonely = await createCharacter(playerB, "Ungebracht");
    expect((await api(playerA, "GET", w(`/characters/${lonely}`))).status).toBe(404);
  });
});

describe("T-008 (1)/(2)/(3)/(4c): journal", () => {
  let privateId = "";
  let sharedId = "";

  it("rejects entries without body or without bringing the character (3)", async () => {
    const lonely = await createCharacter(playerA, "Ohne Welt");
    expect((await api(playerA, "POST", w(`/characters/${lonely}/journal`), { body: doc("x") })).status).toBe(400);
    expect((await api(playerA, "POST", w(`/characters/${charA1}/journal`), { body: doc("") })).status).toBe(400);
    expect((await api(playerA, "POST", w(`/characters/${charA1}/journal`), { title: "Nur Titel" })).status).toBe(400);
    expect((await api(playerB, "POST", w(`/characters/${charA1}/journal`), { body: doc("fremd") })).status).toBe(403);
  });

  it("stores private and shared entries; mentions are allowed but create no relations", async () => {
    const priv = await api<{ id: string }>(playerA, "POST", w(`/characters/${charA1}/journal`), {
      body: doc("Geheim"),
    });
    const shared = await api<{ id: string }>(playerA, "POST", w(`/characters/${charA1}/journal`), {
      title: "Nach dem Turnier",
      body: mentionDoc,
      visibility: "shared_with_gm",
    });
    expect([priv.status, shared.status]).toEqual([201, 201]);
    privateId = priv.data.id;
    sharedId = shared.data.id;
    const relations = await sql`SELECT count(*)::int AS n FROM relations WHERE world_id = ${worldId}`;
    expect(relations[0].n).toBe(0);
  });

  it("shows the owner everything, staff only shared, other players nothing (1)/(2)", async () => {
    const own = await journal(playerA, charA1);
    expect(own.data.entries.map((entry) => entry.id).sort()).toEqual([privateId, sharedId].sort());
    for (const staff of [gm, master]) {
      const res = await journal(staff, charA1);
      expect(res.data.entries.map((entry) => entry.id)).toEqual([sharedId]);
    }
    expect((await journal(playerB, charA1)).data.entries).toEqual([]);
  });

  it("switches visibility only for the owner (4c)", async () => {
    expect((await api(gm, "PATCH", w(`/journal/${sharedId}`), { visibility: "private" })).status).toBe(404);
    expect((await api(playerB, "PATCH", w(`/journal/${privateId}`), { visibility: "shared_with_gm" })).status).toBe(404);
    expect((await api(playerA, "PATCH", w(`/journal/${privateId}`), { visibility: "shared_with_gm" })).status).toBe(200);
    expect((await api(playerA, "PATCH", w(`/journal/${sharedId}`), { visibility: "private" })).status).toBe(200);
    const staffView = await journal(master, charA1);
    expect(staffView.data.entries.map((entry) => entry.id)).toEqual([privateId]);
    expect((await api(playerA, "PATCH", w(`/journal/${privateId}`), { visibility: "public" })).status).toBe(400);
  });
});

describe("T-008 (7), CR-019 b: leaving and coming back", () => {
  it("hides the characters of a player who left", async () => {
    expect((await api(playerA, "POST", w("/leave"))).status).toBe(200);
    expect((await api(playerB, "GET", w(`/characters/${charA1}`))).status).toBe(404);
    const list = await api<{ characters: { id: string }[] }>(playerB, "GET", w("/characters"));
    expect(list.data.characters.map((c) => c.id)).not.toContain(charA1);
    expect((await journal(gm, charA1)).status).toBe(404);
  });

  it("rejects journal writes on an archived participation after rejoining (CR-019 b)", async () => {
    await join(playerA);
    const res = await api<{ error: string }>(playerA, "POST", w(`/characters/${charA1}/journal`), { body: doc("zurück") });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain("nicht in diese Welt mitgebracht");
  });

  it("restores the old participation and journal when brought again (APP-PART-REACTIVATE)", async () => {
    const brought = await api<{ brought: boolean }>(playerA, "POST", w("/characters"), { characterId: charA1 });
    expect(brought.data.brought).toBe(true);
    expect((await journal(playerA, charA1)).data.entries).toHaveLength(2);
    expect((await api(playerB, "GET", w(`/characters/${charA1}`))).status).toBe(200);
  });
});

describe("CR-005: bad ids and bodies on character routes", () => {
  it("answers 400 or 404, never 500", async () => {
    const cases: [string, string, unknown?][] = [
      ["GET", "/api/characters/not-a-uuid"],
      ["PATCH", "/api/characters/not-a-uuid", { name: "x" }],
      ["PATCH", `/api/characters/${charA1}/images/not-a-uuid`, { caption: "x" }],
      ["GET", w("/characters/not-a-uuid")],
      ["GET", w("/characters/not-a-uuid/journal")],
      ["PATCH", w("/journal/not-a-uuid"), { visibility: "private" }],
      ["POST", w("/characters"), { characterId: "abc" }],
      ["PATCH", `/api/characters/${charA1}`, {}],
      ["PATCH", `/api/characters/${charA1}`, "kein objekt"],
    ];
    for (const [method, path, body] of cases) {
      const res = await api(playerA, method, path, body);
      expect([400, 404], `${method} ${path}`).toContain(res.status);
    }
    const broken = await fetch(`${BASE}/api/characters/${charA1}`, {
      method: "PATCH",
      headers: { origin: BASE, cookie: playerA.cookie, "content-type": "application/json" },
      body: "{",
    });
    expect(broken.status).toBe(400);
    const notMultipart = await fetch(`${BASE}/api/files`, {
      method: "POST",
      headers: { origin: BASE, cookie: playerA.cookie, "content-type": "application/json" },
      body: "{}",
    });
    expect(notMultipart.status).toBe(400);
  });
});

describe("deleting a character", () => {
  it("removes it for everyone and collects its files", async () => {
    const images = (await sheet(playerA, charA1)).images.map((image) => image.fileId);
    expect((await api(playerA, "DELETE", `/api/characters/${charA1}`)).status).toBe(200);
    expect((await api(playerB, "GET", w(`/characters/${charA1}`))).status).toBe(404);
    const files = await sql`SELECT id FROM files WHERE id IN ${sql(images)}`;
    expect(files).toEqual([]);
  });
});
