/**
 * CR-003: GET /api/files/[id] authorizes by world membership and visibility.
 * Requires: ENABLE_TEST_LOGIN=true and a running `npm run dev`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, BASE, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let outsider: TestSession;
let worldId = "";
let universeId = "";
let mapId = "";
let mapImageId = "";
let worldTitleId = "";
let articleHiddenImageId = "";
let charOwner = "";
let portraitId = "";
let playerMembershipId = "";

beforeAll(async () => {
  try {
    await fetch(`${BASE}/api/test-login`, { method: "OPTIONS" });
  } catch {
    throw new Error(`Kein Dev-Server unter ${BASE}. Bitte npm run dev, dann npm run test:rechte.`);
  }
  [gm, master, playerA, outsider] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-a"),
    login("test-player-b"),
  ]);

  const created = await api<{ id: string }>(gm, "POST", "/api/worlds", {
    name: `Files-Auth ${Date.now()}`,
  });
  expect(created.status).toBe(201);
  worldId = created.data.id;

  await sql`
    INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
    VALUES
      (${worldId}, ${master.user.id}, 'master', ${gm.user.id}, ${gm.user.id}),
      (${worldId}, ${playerA.user.id}, 'player', ${gm.user.id}, ${gm.user.id})
  `;

  const world = await api<{ universes: { id: string }[]; titleImageId?: string | null }>(
    gm,
    "GET",
    `/api/worlds/${worldId}`,
  );
  universeId = world.data.universes[0]!.id;

  const members = await api<{ members: { membershipId: string; userId: string }[] }>(
    gm,
    "GET",
    `/api/worlds/${worldId}/members`,
  );
  playerMembershipId = members.data.members.find((m) => m.userId === playerA.user.id)!.membershipId;

  const titleForm = new FormData();
  titleForm.set("kind", "world_title");
  titleForm.set("worldId", worldId);
  titleForm.set("targetId", worldId);
  titleForm.set("image", new Blob([PNG], { type: "image/png" }), "title.png");
  const titleRes = await fetch(`${BASE}/api/files`, {
    method: "POST",
    headers: { cookie: gm.cookie, origin: BASE },
    body: titleForm,
  });
  const titleData = (await titleRes.json()) as { fileId?: string };
  expect(titleRes.status).toBe(201);
  worldTitleId = titleData.fileId!;

  const mapForm = new FormData();
  mapForm.set("universeId", universeId);
  mapForm.set("name", "Hidden Map");
  mapForm.set("image", new Blob([PNG], { type: "image/png" }), "map.png");
  const mapRes = await fetch(`${BASE}/api/worlds/${worldId}/map`, {
    method: "POST",
    headers: { cookie: gm.cookie, origin: BASE },
    body: mapForm,
  });
  const mapData = (await mapRes.json()) as { map?: { id: string; imageId: string } };
  expect(mapRes.status).toBe(201);
  mapId = mapData.map!.id;
  mapImageId = mapData.map!.imageId;
  expect((await api(gm, "PATCH", `/api/worlds/${worldId}/map`, { mapId, visibility: "gm_only" })).status).toBe(
    200,
  );

  const article = await api<{ article: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/articles`, {
    title: "Geheim",
    visibility: "gm_only",
  });
  expect(article.status).toBe(201);
  const artForm = new FormData();
  artForm.set("kind", "article_title");
  artForm.set("worldId", worldId);
  artForm.set("targetId", article.data.article.id);
  artForm.set("image", new Blob([PNG], { type: "image/png" }), "art.png");
  const artImg = await fetch(`${BASE}/api/files`, {
    method: "POST",
    headers: { cookie: gm.cookie, origin: BASE },
    body: artForm,
  });
  const artData = (await artImg.json()) as { fileId?: string };
  expect(artImg.status).toBe(201);
  articleHiddenImageId = artData.fileId!;

  const character = await api<{ character: { id: string } }>(playerA, "POST", "/api/characters", {
    name: `FilesChar ${Date.now()}`,
  });
  expect(character.status).toBe(201);
  charOwner = character.data.character.id;
  const portraitForm = new FormData();
  portraitForm.set("kind", "character_portrait");
  portraitForm.set("targetId", charOwner);
  portraitForm.set("image", new Blob([PNG], { type: "image/png" }), "portrait.png");
  const portraitRes = await fetch(`${BASE}/api/files`, {
    method: "POST",
    headers: { cookie: playerA.cookie, origin: BASE },
    body: portraitForm,
  });
  const portraitData = (await portraitRes.json()) as { fileId?: string };
  expect(portraitRes.status).toBe(201);
  portraitId = portraitData.fileId!;
  expect((await api(playerA, "POST", `/api/worlds/${worldId}/characters`, { characterId: charOwner })).status).toBe(
    201,
  );
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  if (charOwner) await sql`DELETE FROM characters WHERE id = ${charOwner}`;
  await sql.end();
});

async function getFile(session: TestSession | null, fileId: string) {
  const res = await fetch(`${BASE}/api/files/${fileId}`, {
    headers: session ? { cookie: session.cookie, origin: BASE } : { origin: BASE },
  });
  return {
    status: res.status,
    cache: res.headers.get("cache-control"),
  };
}

describe("GET /api/files/[id] (CR-003)", () => {
  it("hides gm_only map and article images from players; staff gets 200", async () => {
    expect((await getFile(playerA, mapImageId)).status).toBe(404);
    expect((await getFile(master, mapImageId)).status).toBe(200);
    expect((await getFile(playerA, articleHiddenImageId)).status).toBe(404);
    expect((await getFile(master, articleHiddenImageId)).status).toBe(200);
  });

  it("requires active world membership for the world title image", async () => {
    expect((await getFile(outsider, worldTitleId)).status).toBe(404);
    expect((await getFile(playerA, worldTitleId)).status).toBe(200);
  });

  it("denies left members for map images", async () => {
    expect((await api(playerA, "POST", `/api/worlds/${worldId}/leave`)).status).toBe(200);
    expect((await getFile(playerA, mapImageId)).status).toBe(404);
    await sql`
      UPDATE memberships SET archived_at = NULL, updated_at = now()
      WHERE id = ${playerMembershipId}
    `;
    await sql`
      UPDATE world_participations SET archived_at = NULL, updated_at = now()
      WHERE world_id = ${worldId} AND character_id = ${charOwner}
    `;
  });

  it("serves character portraits to owner and shared-world members only", async () => {
    expect((await getFile(playerA, portraitId)).status).toBe(200);
    expect((await getFile(master, portraitId)).status).toBe(200);
    expect((await getFile(outsider, portraitId)).status).toBe(404);
  });

  it("keeps Cache-Control private immutable", async () => {
    const res = await getFile(master, mapImageId);
    expect(res.status).toBe(200);
    expect(res.cache).toBe("private, max-age=31536000, immutable");
  });
});
