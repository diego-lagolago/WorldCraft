import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let playerB: TestSession;
let worldId = "";
let broughtId = "";
let foreignCharId = "";
const created: string[] = [];

const w = (path = "") => `/api/worlds/${worldId}${path}`;
const mentionDoc = (id: string, kind: string, label: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "mention", attrs: { id, kind, label, mentionSuggestionChar: "@" } }],
    },
  ],
});
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function createQuest(session: TestSession, body: Record<string, unknown>) {
  const res = await api<{ quest: { id: string; title: string; visibility: string } }>(
    session,
    "POST",
    w("/quests"),
    body,
  );
  expect(res.status).toBe(201);
  created.push(res.data.quest.id);
  return res.data.quest;
}

beforeAll(async () => {
  [gm, master, playerA, playerB] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-a"),
    login("test-player-b"),
  ]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "T-011 Questwelt" });
  expect(world.status).toBe(201);
  worldId = world.data.id;
  const invite = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
  expect((await api(playerA, "POST", `/api/invites/${invite.data.code}/join`)).status).toBe(200);
  const masterInvite = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
  expect((await api(master, "POST", `/api/invites/${masterInvite.data.code}/join`)).status).toBe(200);
  const [row] = await sql`SELECT id FROM memberships WHERE world_id = ${worldId} AND user_id = ${master.user.id}`;
  expect((await api(gm, "PATCH", w(`/members/${row.id}`), { role: "master" })).status).toBe(200);

  const brought = await api<{ id: string }>(playerA, "POST", "/api/characters", {
    name: "Schleimi",
  });
  expect(brought.status).toBe(201);
  broughtId = brought.data.id;
  expect((await api(playerA, "POST", w("/characters"), { characterId: broughtId })).status).toBe(200);

  const foreign = await api<{ id: string }>(playerA, "POST", "/api/characters", {
    name: "Nicht mitgebracht",
  });
  expect(foreign.status).toBe(201);
  foreignCharId = foreign.data.id;
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  if (broughtId) await sql`DELETE FROM characters WHERE id = ${broughtId}`;
  if (foreignCharId) await sql`DELETE FROM characters WHERE id = ${foreignCharId}`;
  await sql.end();
});

describe("T-011 (1): visibility", () => {
  it("hides gm_only quests from players", async () => {
    const hidden = await createQuest(gm, { title: "Geheimquest", visibility: "gm_only" });
    const shown = await createQuest(gm, { title: "Offene Quest", visibility: "published" });
    expect((await api(playerA, "GET", w(`/quests/${hidden.id}`))).status).toBe(404);
    expect((await api(playerA, "GET", w(`/quests/${shown.id}`))).status).toBe(200);
    const list = await api<{ quests: { id: string }[] }>(playerA, "GET", w("/quests"));
    const ids = list.data.quests.map((quest) => quest.id);
    expect(ids).toContain(shown.id);
    expect(ids).not.toContain(hidden.id);
    expect((await api(playerA, "PATCH", w(`/quests/${shown.id}`), { title: "Geklaut" })).status).toBe(403);
    expect((await api(playerA, "DELETE", w(`/quests/${shown.id}`))).status).toBe(403);
  });
});

describe("T-011 (2): APP-QUEST-PART", () => {
  it("rejects a character that is not brought into the world", async () => {
    const bad = await api(gm, "POST", w("/quests"), {
      title: "Ohne Mitbringen",
      participantIds: [foreignCharId],
    });
    expect(bad.status).toBe(400);
    expect(bad.data).toMatchObject({ error: expect.stringMatching(/mitgebracht/i) });
  });
});

describe("T-011 (3): name snapshot after character delete", () => {
  it("keeps the frozen name without a link", async () => {
    const disposable = await api<{ id: string }>(playerA, "POST", "/api/characters", {
      name: "Opferheld",
    });
    expect(disposable.status).toBe(201);
    const charId = disposable.data.id;
    expect((await api(playerA, "POST", w("/characters"), { characterId: charId })).status).toBe(200);

    const quest = await createQuest(gm, {
      title: "Opferquest",
      visibility: "published",
      participantIds: [charId],
    });
    expect((await api(playerA, "DELETE", `/api/characters/${charId}`)).status).toBe(200);

    const [participant] = await sql`
      SELECT character_id, character_name FROM quest_participants WHERE quest_id = ${quest.id}
    `;
    expect(participant).toMatchObject({ character_id: null, character_name: "Opferheld" });

    const view = await api<{
      quest: { participants: { characterId: string | null; characterName: string; href: boolean }[] };
    }>(gm, "GET", w(`/quests/${quest.id}`));
    expect(view.status).toBe(200);
    expect(view.data.quest.participants).toEqual([
      { characterId: null, characterName: "Opferheld", href: false },
    ]);
  });
});

describe("T-011 (4): mention search includes quests", () => {
  it("finds article Gottschleim and quest Töte den Gottschleim", async () => {
    const article = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Gottschleim",
      visibility: "published",
    });
    expect(article.status).toBe(201);
    const quest = await createQuest(gm, {
      title: "Töte den Gottschleim",
      visibility: "published",
    });

    const res = await api<{ hits: { kind: string; title: string }[] }>(
      gm,
      "GET",
      w(`/mentions?q=${encodeURIComponent("schleim")}`),
    );
    expect(res.status).toBe(200);
    const hits = res.data.hits ?? [];
    expect(hits.some((hit) => hit.kind === "article" && hit.title === "Gottschleim")).toBe(true);
    expect(hits.some((hit) => hit.kind === "quest" && hit.title === "Töte den Gottschleim")).toBe(true);
    expect(hits.some((hit) => hit.kind === "character" && hit.title === "Schleimi")).toBe(true);
    void quest;
  });
});

describe("T-011 (5): participation and mention relations", () => {
  it("shows both directions in Verknüpft", async () => {
    const article = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Schleimziel",
      visibility: "published",
      body: doc("Ziel"),
    });
    expect(article.status).toBe(201);
    const articleId = article.data.article.id;

    const quest = await createQuest(gm, {
      title: "Mit Beteiligung",
      visibility: "published",
      participantIds: [broughtId],
      description: mentionDoc(articleId, "article", "Schleimziel"),
    });

    const linkedQuest = await api<{ items: { kind: string; id: string; originLabels: string[] }[] }>(
      gm,
      "GET",
      w(`/relations?kind=quest&id=${quest.id}`),
    );
    expect(linkedQuest.status).toBe(200);
    const questItems = linkedQuest.data.items;
    expect(questItems.some((item) => item.kind === "character" && item.id === broughtId)).toBe(true);
    expect(
      questItems.some(
        (item) => item.kind === "article" && item.id === articleId && item.originLabels.includes("Erwähnung"),
      ),
    ).toBe(true);

    const linkedChar = await api<{ items: { kind: string; id: string; originLabels: string[] }[] }>(
      gm,
      "GET",
      w(`/relations?kind=character&id=${broughtId}`),
    );
    expect(linkedChar.status).toBe(200);
    expect(
      linkedChar.data.items.some(
        (item) => item.kind === "quest" && item.id === quest.id && item.originLabels.includes("Beteiligung"),
      ),
    ).toBe(true);
  });
});

describe("CR-005: bad ids and bodies on quest routes", () => {
  it("answers 400 or 404, never 500", async () => {
    expect((await api(gm, "GET", w("/quests/not-a-uuid"))).status).toBe(404);
    expect((await api(gm, "PATCH", w("/quests/not-a-uuid"), { title: "x" })).status).toBe(404);
    expect((await api(gm, "DELETE", `/api/worlds/not-a-uuid/quests/${randomUUID()}`)).status).toBe(404);
    expect((await api(gm, "PATCH", w(`/quests/${created[0]}`), {})).status).toBe(400);
    expect((await api(gm, "POST", w("/quests"), "kein objekt")).status).toBe(400);
    expect((await api(playerB, "GET", w("/quests"))).status).toBe(403);
  });
});

describe("CR-005: quest participants after leave or delete", () => {
  type Participant = { id: string; characterId: string | null; characterName: string; href: boolean };

  async function join(session: TestSession) {
    const invite = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
    expect(invite.status).toBe(201);
    expect((await api(session, "POST", `/api/invites/${invite.data.code}/join`)).status).toBe(200);
  }

  async function getParticipants(questId: string) {
    const view = await api<{ quest: { participants: Participant[] } }>(gm, "GET", w(`/quests/${questId}`));
    expect(view.status).toBe(200);
    return view.data.quest.participants;
  }

  it("(1)+(2) leave keeps snapshot; bring-back restores link and live name", async () => {
    const createdChar = await api<{ id: string }>(playerA, "POST", "/api/characters", {
      name: "Abenteurer",
    });
    expect(createdChar.status).toBe(201);
    const charId = createdChar.data.id;
    expect((await api(playerA, "POST", w("/characters"), { characterId: charId })).status).toBe(200);

    const quest = await createQuest(gm, {
      title: "Mit Abenteurer",
      visibility: "published",
      participantIds: [charId],
    });

    expect((await api(playerA, "POST", w("/leave"))).status).toBe(200);

    const titleOnly = await api(gm, "PATCH", w(`/quests/${quest.id}`), { title: "Nur Titel" });
    expect(titleOnly.status).toBe(200);
    expect(await getParticipants(quest.id)).toEqual([
      expect.objectContaining({ characterId: charId, characterName: "Abenteurer", href: false }),
    ]);

    await join(playerA);
    expect((await api(playerA, "POST", w("/characters"), { characterId: charId })).status).toBe(200);
    expect((await api(playerA, "POST", w("/characters"), { characterId: broughtId })).status).toBe(200);

    expect(await getParticipants(quest.id)).toEqual([
      expect.objectContaining({ characterId: charId, characterName: "Abenteurer", href: true }),
    ]);

    expect((await api(playerA, "PATCH", `/api/characters/${charId}`, { name: "Rückkehrer" })).status).toBe(200);
    expect(await getParticipants(quest.id)).toEqual([
      expect.objectContaining({ characterId: charId, characterName: "Rückkehrer", href: true }),
    ]);

    await sql`DELETE FROM characters WHERE id = ${charId}`;
  });

  it("(3)+(4) deleted character snapshot survives unrelated PATCH and is removed only via remove", async () => {
    const disposable = await api<{ id: string }>(playerA, "POST", "/api/characters", {
      name: "Gelöschter Held",
    });
    expect(disposable.status).toBe(201);
    const charB = disposable.data.id;
    expect((await api(playerA, "POST", w("/characters"), { characterId: charB })).status).toBe(200);

    const other = await api<{ id: string }>(playerA, "POST", "/api/characters", {
      name: "Anderer Held",
    });
    expect(other.status).toBe(201);
    const charOther = other.data.id;
    expect((await api(playerA, "POST", w("/characters"), { characterId: charOther })).status).toBe(200);

    const quest = await createQuest(gm, {
      title: "Zwei Beteiligte",
      visibility: "published",
      participantIds: [charB, broughtId],
    });

    expect((await api(playerA, "DELETE", `/api/characters/${charB}`)).status).toBe(200);

    const changeOthers = await api(gm, "PATCH", w(`/quests/${quest.id}`), {
      addParticipantIds: [charOther],
      removeParticipantIds: [broughtId],
    });
    expect(changeOthers.status).toBe(200);

    const afterChange = await getParticipants(quest.id);
    expect(afterChange).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ characterId: null, characterName: "Gelöschter Held", href: false }),
        expect.objectContaining({ characterId: charOther, characterName: "Anderer Held", href: true }),
      ]),
    );
    expect(afterChange).toHaveLength(2);
    expect(afterChange.some((entry) => entry.characterId === broughtId)).toBe(false);

    const snapshotId = afterChange.find((entry) => entry.characterId === null)!.id;
    const removed = await api(gm, "PATCH", w(`/quests/${quest.id}`), {
      removeParticipantIds: [snapshotId],
    });
    expect(removed.status).toBe(200);
    expect(await getParticipants(quest.id)).toEqual([
      expect.objectContaining({ characterId: charOther, characterName: "Anderer Held", href: true }),
    ]);

    await sql`DELETE FROM characters WHERE id = ${charOther}`;
  });

  it("(5) adding a non-brought character via addParticipantIds is rejected", async () => {
    const quest = await createQuest(gm, { title: "Leer", visibility: "published" });
    const bad = await api(gm, "PATCH", w(`/quests/${quest.id}`), {
      addParticipantIds: [foreignCharId],
    });
    expect(bad.status).toBe(400);
    expect(bad.data).toMatchObject({ error: expect.stringMatching(/mitgebracht/i) });
  });

  it("participantIds full list keeps unnamed snapshots", async () => {
    const disposable = await api<{ id: string }>(playerA, "POST", "/api/characters", {
      name: "Snapshot-Schutz",
    });
    expect(disposable.status).toBe(201);
    const charId = disposable.data.id;
    expect((await api(playerA, "POST", w("/characters"), { characterId: charId })).status).toBe(200);

    const quest = await createQuest(gm, {
      title: "Liste ohne Snapshot",
      visibility: "published",
      participantIds: [charId, broughtId],
    });
    expect((await api(playerA, "DELETE", `/api/characters/${charId}`)).status).toBe(200);

    const sync = await api(gm, "PATCH", w(`/quests/${quest.id}`), {
      participantIds: [broughtId],
    });
    expect(sync.status).toBe(200);
    expect(await getParticipants(quest.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ characterId: null, characterName: "Snapshot-Schutz", href: false }),
        expect.objectContaining({ characterId: broughtId, href: true }),
      ]),
    );
  });
});
