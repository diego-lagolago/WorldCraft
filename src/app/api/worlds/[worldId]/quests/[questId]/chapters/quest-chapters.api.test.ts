import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
let gm: TestSession;
let masterA: TestSession;
let masterB: TestSession;
let player: TestSession;
let worldId = "";

const w = (path = "") => `/api/worlds/${worldId}${path}`;
const chaptersPath = (questId: string) => w(`/quests/${questId}/chapters`);
const chapterPath = (questId: string, chapterId: string) =>
  w(`/quests/${questId}/chapters/${chapterId}`);
const orderPath = (questId: string) => w(`/quests/${questId}/chapters/order`);

async function createQuest(session: TestSession, body: Record<string, unknown>) {
  const res = await api<{ quest: { id: string } }>(session, "POST", w("/quests"), body);
  expect(res.status).toBe(201);
  return res.data.quest;
}

async function createChapter(
  session: TestSession,
  questId: string,
  body: Record<string, unknown>,
) {
  const res = await api<{ chapter: { id: string; title: string; visibility: string; position: number } }>(
    session,
    "POST",
    chaptersPath(questId),
    body,
  );
  expect(res.status).toBe(201);
  return res.data.chapter;
}

beforeAll(async () => {
  [gm, masterA, masterB, player] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-b"),
    login("test-player-a"),
  ]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", {
    name: "T-006 Quest-Kapitel",
  });
  expect(world.status).toBe(201);
  worldId = world.data.id;

  for (const session of [masterA, masterB, player]) {
    const invite = await api<{ code: string }>(gm, "POST", w("/invites"), {
      validity: "seven_days",
    });
    expect((await api(session, "POST", `/api/invites/${invite.data.code}/join`)).status).toBe(
      200,
    );
  }

  const members = await api<{ members: { membershipId: string; userId: string }[] }>(
    gm,
    "GET",
    w("/members"),
  );
  expect(members.status).toBe(200);
  const rowA = members.data.members.find((row) => row.userId === masterA.user.id);
  const rowB = members.data.members.find((row) => row.userId === masterB.user.id);
  expect(rowA && rowB).toBeTruthy();
  expect(
    (await api(gm, "PATCH", w(`/members/${rowA!.membershipId}`), { role: "master" })).status,
  ).toBe(200);
  expect(
    (await api(gm, "PATCH", w(`/members/${rowB!.membershipId}`), { role: "master" })).status,
  ).toBe(200);
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql.end();
});

describe("T-006 (1): visibility inheritance", () => {
  it("player sees only published chapters in a published quest; gm_only quest is 404", async () => {
    const published = await createQuest(gm, {
      title: "Offene Quest mit Kapiteln",
      visibility: "published",
    });
    const pubChapter = await createChapter(gm, published.id, {
      title: "Öffentliches Kapitel",
      visibility: "published",
    });
    const hiddenChapter = await createChapter(gm, published.id, {
      title: "SL-Kapitel",
      visibility: "gm_only",
    });

    const list = await api<{ chapters: { id: string }[] }>(
      player,
      "GET",
      chaptersPath(published.id),
    );
    expect(list.status).toBe(200);
    const ids = list.data.chapters.map((row) => row.id);
    expect(ids).toContain(pubChapter.id);
    expect(ids).not.toContain(hiddenChapter.id);

    const questGet = await api<{ quest: { chapters: { id: string }[] } }>(
      player,
      "GET",
      w(`/quests/${published.id}`),
    );
    expect(questGet.status).toBe(200);
    expect(questGet.data.quest.chapters.map((row) => row.id)).toEqual(ids);

    const gmOnly = await createQuest(gm, {
      title: "Versteckte Quest",
      visibility: "gm_only",
    });
    await createChapter(gm, gmOnly.id, {
      title: "Egal",
      visibility: "published",
    });
    expect((await api(player, "GET", w(`/quests/${gmOnly.id}`))).status).toBe(404);
    expect((await api(player, "GET", chaptersPath(gmOnly.id))).status).toBe(404);
  });
});

describe("T-006 (2): owner_only chapter", () => {
  it("only the owner sees an owner_only chapter", async () => {
    const quest = await createQuest(masterA, {
      title: "Owner-Kapitel-Quest",
      visibility: "published",
    });
    const chapter = await createChapter(masterA, quest.id, {
      title: "Nur A",
      visibility: "owner_only",
    });

    expect((await api(masterA, "GET", chaptersPath(quest.id))).status).toBe(200);
    const forA = await api<{ chapters: { id: string }[] }>(
      masterA,
      "GET",
      chaptersPath(quest.id),
    );
    expect(forA.data.chapters.map((row) => row.id)).toContain(chapter.id);

    for (const session of [gm, masterB, player]) {
      const list = await api<{ chapters: { id: string }[] }>(
        session,
        "GET",
        chaptersPath(quest.id),
      );
      expect(list.status).toBe(200);
      expect(list.data.chapters.map((row) => row.id)).not.toContain(chapter.id);
    }
  });
});

describe("T-006 (3): player mutations rejected", () => {
  it("rejects player POST/PATCH/DELETE/PUT order", async () => {
    const quest = await createQuest(gm, {
      title: "Player-Schreibschutz",
      visibility: "published",
    });
    const chapter = await createChapter(gm, quest.id, {
      title: "Kapitel",
      visibility: "published",
    });

    expect(
      (await api(player, "POST", chaptersPath(quest.id), { title: "Geklaut" })).status,
    ).toBe(403);
    expect(
      (await api(player, "PATCH", chapterPath(quest.id, chapter.id), { title: "Geändert" }))
        .status,
    ).toBe(403);
    expect((await api(player, "DELETE", chapterPath(quest.id, chapter.id))).status).toBe(403);
    expect(
      (await api(player, "PUT", orderPath(quest.id), { chapterIds: [chapter.id] })).status,
    ).toBe(403);
  });
});

describe("T-006 (4): reorder", () => {
  it("changes GET order and rejects foreign/missing IDs", async () => {
    const quest = await createQuest(gm, {
      title: "Umsortier-Quest",
      visibility: "published",
    });
    const k1 = await createChapter(gm, quest.id, { title: "K1", visibility: "published" });
    const k2 = await createChapter(gm, quest.id, { title: "K2", visibility: "published" });
    const k3 = await createChapter(gm, quest.id, { title: "K3", visibility: "published" });

    const reordered = await api<{ chapterIds: string[] }>(gm, "PUT", orderPath(quest.id), {
      chapterIds: [k3.id, k1.id, k2.id],
    });
    expect(reordered.status).toBe(200);
    expect(reordered.data.chapterIds).toEqual([k3.id, k1.id, k2.id]);

    const list = await api<{ chapters: { id: string }[] }>(gm, "GET", chaptersPath(quest.id));
    expect(list.data.chapters.map((row) => row.id)).toEqual([k3.id, k1.id, k2.id]);

    expect(
      (await api(gm, "PUT", orderPath(quest.id), { chapterIds: [k1.id, k2.id] })).status,
    ).toBe(400);
    expect(
      (
        await api(gm, "PUT", orderPath(quest.id), {
          chapterIds: [k1.id, k2.id, k3.id, randomUUID()],
        })
      ).status,
    ).toBe(400);
  });

  it("R3: invisible chapters keep their index", async () => {
    const quest = await createQuest(gm, {
      title: "R3-Quest",
      visibility: "published",
    });
    const k1 = await createChapter(gm, quest.id, { title: "K1", visibility: "gm_only" });
    const k2 = await createChapter(masterB, quest.id, {
      title: "K2",
      visibility: "owner_only",
    });
    const k3 = await createChapter(gm, quest.id, { title: "K3", visibility: "gm_only" });
    const k4 = await createChapter(gm, quest.id, { title: "K4", visibility: "gm_only" });

    const forA = await api<{ chapters: { id: string }[] }>(
      masterA,
      "GET",
      chaptersPath(quest.id),
    );
    expect(forA.data.chapters.map((row) => row.id)).toEqual([k1.id, k3.id, k4.id]);

    const reorder = await api<{ chapterIds: string[] }>(masterA, "PUT", orderPath(quest.id), {
      chapterIds: [k4.id, k3.id, k1.id],
    });
    expect(reorder.status).toBe(200);
    expect(reorder.data.chapterIds).toEqual([k4.id, k2.id, k3.id, k1.id]);

    const forGm = await api<{ chapters: { id: string }[] }>(gm, "GET", chaptersPath(quest.id));
    // GM cannot see masterB's owner_only chapter either
    expect(forGm.data.chapters.map((row) => row.id)).toEqual([k4.id, k3.id, k1.id]);

    const forB = await api<{ chapters: { id: string }[] }>(
      masterB,
      "GET",
      chaptersPath(quest.id),
    );
    expect(forB.data.chapters.map((row) => row.id)).toEqual([k4.id, k2.id, k3.id, k1.id]);
  });
});

describe("T-006 (5): cascade delete", () => {
  it("deleting a quest deletes its chapters", async () => {
    const quest = await createQuest(gm, {
      title: "Cascade-Quest",
      visibility: "published",
    });
    const chapter = await createChapter(gm, quest.id, {
      title: "Verschwindet",
      visibility: "published",
    });
    expect((await api(gm, "DELETE", w(`/quests/${quest.id}`))).status).toBe(200);
    const [row] = await sql`SELECT id FROM quest_chapters WHERE id = ${chapter.id}`;
    expect(row).toBeUndefined();
  });
});

describe("T-006 (6): title validation", () => {
  it("rejects empty title or title over 200 chars", async () => {
    const quest = await createQuest(gm, {
      title: "Titel-Validierung",
      visibility: "published",
    });
    expect((await api(gm, "POST", chaptersPath(quest.id), { title: "" })).status).toBe(400);
    expect(
      (await api(gm, "POST", chaptersPath(quest.id), { title: "x".repeat(201) })).status,
    ).toBe(400);

    const chapter = await createChapter(gm, quest.id, {
      title: "Ok",
      visibility: "published",
    });
    expect(
      (await api(gm, "PATCH", chapterPath(quest.id, chapter.id), { title: "" })).status,
    ).toBe(400);
    expect(
      (await api(gm, "PATCH", chapterPath(quest.id, chapter.id), { title: "y".repeat(201) }))
        .status,
    ).toBe(400);
  });
});
