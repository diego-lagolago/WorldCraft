import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
let gm: TestSession;
let player: TestSession;
let worldId = "";
let articleId = "";

const w = (path = "") => `/api/worlds/${worldId}${path}`;
const notesPath = (questId: string) => w(`/quests/${questId}/notes`);

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

async function createQuest(session: TestSession, body: Record<string, unknown>) {
  const res = await api<{ quest: { id: string } }>(session, "POST", w("/quests"), body);
  expect(res.status).toBe(201);
  return res.data.quest;
}

beforeAll(async () => {
  [gm, player] = await Promise.all([login("test-gm"), login("test-player-a")]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", {
    name: "T-009 Quest-Notizblock",
  });
  expect(world.status).toBe(201);
  worldId = world.data.id;

  const invite = await api<{ code: string }>(gm, "POST", w("/invites"), {
    validity: "seven_days",
  });
  expect((await api(player, "POST", `/api/invites/${invite.data.code}/join`)).status).toBe(200);

  const article = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
    title: "Notizziel",
    visibility: "published",
  });
  expect(article.status).toBe(201);
  articleId = article.data.article.id;
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql.end();
});

describe("T-009 (1): access via quest visibility", () => {
  it("player reads and writes notes of a published quest; gm_only quest is 404", async () => {
    const published = await createQuest(gm, {
      title: "Offene Quest mit Notiz",
      visibility: "published",
    });

    const empty = await api<{ note: { bodyJson: unknown; version: number } }>(
      player,
      "GET",
      notesPath(published.id),
    );
    expect(empty.status).toBe(200);
    expect(empty.data.note.version).toBe(0);
    expect(empty.data.note.bodyJson).toBeNull();

    const saved = await api<{ note: { version: number; bodyJson: unknown } }>(
      player,
      "PUT",
      notesPath(published.id),
      { bodyJson: doc("Spieler-Notiz"), version: 0 },
    );
    expect(saved.status).toBe(200);
    expect(saved.data.note.version).toBe(1);

    const read = await api<{ note: { version: number } }>(player, "GET", notesPath(published.id));
    expect(read.status).toBe(200);
    expect(read.data.note.version).toBe(1);

    const gmOnly = await createQuest(gm, {
      title: "Versteckte Quest",
      visibility: "gm_only",
    });
    expect((await api(player, "GET", notesPath(gmOnly.id))).status).toBe(404);
    expect(
      (
        await api(player, "PUT", notesPath(gmOnly.id), {
          bodyJson: doc("darf nicht"),
          version: 0,
        })
      ).status,
    ).toBe(404);
  });
});

describe("T-009 (2): optimistic version check", () => {
  it("second PUT with the same starting version returns 409 and does not change", async () => {
    const quest = await createQuest(gm, {
      title: "Konflikt-Quest",
      visibility: "published",
    });

    const first = await api<{ note: { version: number } }>(gm, "PUT", notesPath(quest.id), {
      bodyJson: doc("Erster Stand"),
      version: 0,
    });
    expect(first.status).toBe(200);
    expect(first.data.note.version).toBe(1);

    const second = await api<{ error: string; version: number }>(gm, "PUT", notesPath(quest.id), {
      bodyJson: doc("Zweiter Stand"),
      version: 0,
    });
    expect(second.status).toBe(409);
    expect(second.data.version).toBe(1);
    expect(second.data.error).toContain("geändert");

    const current = await api<{ note: { version: number; bodyJson: { content: unknown[] } } }>(
      gm,
      "GET",
      notesPath(quest.id),
    );
    expect(current.status).toBe(200);
    expect(current.data.note.version).toBe(1);
    const text = JSON.stringify(current.data.note.bodyJson);
    expect(text).toContain("Erster Stand");
    expect(text).not.toContain("Zweiter Stand");
  });
});

describe("T-009 (3): mentions without relations", () => {
  it("a mention in notes creates no relations row", async () => {
    const quest = await createQuest(gm, {
      title: "Erwähnungs-Quest",
      visibility: "published",
    });

    const before = await sql`SELECT count(*)::int AS n FROM relations WHERE world_id = ${worldId}`;
    const saved = await api<{ note: { version: number; mentions: Record<string, unknown> } }>(
      gm,
      "PUT",
      notesPath(quest.id),
      { bodyJson: mentionDoc(articleId, "article", "Notizziel"), version: 0 },
    );
    expect(saved.status).toBe(200);
    expect(saved.data.note.version).toBe(1);
    expect(Object.keys(saved.data.note.mentions).length).toBeGreaterThan(0);

    const after = await sql`SELECT count(*)::int AS n FROM relations WHERE world_id = ${worldId}`;
    expect(after[0].n).toBe(before[0].n);
  });
});

describe("T-009 (4): cascade delete", () => {
  it("deleting a quest deletes its notes", async () => {
    const quest = await createQuest(gm, {
      title: "Lösch-Quest",
      visibility: "published",
    });
    expect(
      (
        await api(gm, "PUT", notesPath(quest.id), {
          bodyJson: doc("wird gelöscht"),
          version: 0,
        })
      ).status,
    ).toBe(200);

    const rowsBefore =
      await sql`SELECT count(*)::int AS n FROM quest_notes WHERE quest_id = ${quest.id}`;
    expect(rowsBefore[0].n).toBe(1);

    expect((await api(gm, "DELETE", w(`/quests/${quest.id}`))).status).toBe(200);

    const rowsAfter =
      await sql`SELECT count(*)::int AS n FROM quest_notes WHERE quest_id = ${quest.id}`;
    expect(rowsAfter[0].n).toBe(0);
  });
});
