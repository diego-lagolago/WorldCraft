import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, testSql, type TestSession } from "@/test/api-harness";

type Hit = { kind: string; id: string; title: string; templateType?: string };

const sql = testSql();
const worldId = randomUUID();
let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let playerB: TestSession;

beforeAll(async () => {
  [gm, master, playerA, playerB] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-a"),
    login("test-player-b"),
  ]);
  await sql`
    INSERT INTO worlds (id, name, created_by, updated_by)
    VALUES (${worldId}, 'Erwähnungs-Testwelt', ${gm.user.id}, ${gm.user.id})
  `;
  await sql`
    INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
    VALUES
      (${worldId}, ${gm.user.id}, 'game_master', ${gm.user.id}, ${gm.user.id}),
      (${worldId}, ${master.user.id}, 'master', ${gm.user.id}, ${gm.user.id}),
      (${worldId}, ${playerA.user.id}, 'player', ${gm.user.id}, ${gm.user.id})
  `;
  await sql`
    INSERT INTO universes (world_id, name, sort_order, visibility, created_by, updated_by)
    VALUES (${worldId}, 'Hauptuniversum', 0, 'published', ${gm.user.id}, ${gm.user.id})
  `;
  await sql`
    INSERT INTO articles (world_id, title, template_type, visibility, first_edited_at, created_by, updated_by)
    VALUES
      (${worldId}, 'Tore von Wertheim', 'place', 'published', now(), ${gm.user.id}, ${gm.user.id}),
      (${worldId}, 'Burgtor', 'place', 'published', now(), ${gm.user.id}, ${gm.user.id}),
      (${worldId}, 'Torheit der Alten', 'none', 'gm_only', now(), ${gm.user.id}, ${gm.user.id}),
      (${worldId}, '50% Rabatt', 'none', 'published', now(), ${gm.user.id}, ${gm.user.id})
  `;
});

afterAll(async () => {
  await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql.end();
});

function search(session: TestSession | null, query: string, world = worldId) {
  return api<{ hits?: Hit[]; error?: string }>(
    session,
    "GET",
    `/api/worlds/${world}/mentions?q=${encodeURIComponent(query)}`,
  );
}

describe("GET /api/worlds/[worldId]/mentions", () => {
  it("ranks word-start hits first and shows the template category data", async () => {
    const res = await search(gm, "tor");
    expect(res.status).toBe(200);
    expect(res.data.hits?.map((hit) => hit.title)).toEqual([
      "Tore von Wertheim",
      "Torheit der Alten",
      "Burgtor",
    ]);
    expect(res.data.hits?.[0]).toMatchObject({ kind: "article", templateType: "place" });
  });

  it("uses the text up to the caret as query, spaces included", async () => {
    const res = await search(gm, "Tore von Wer");
    expect(res.data.hits?.map((hit) => hit.title)).toEqual(["Tore von Wertheim"]);
  });

  it("hides gm_only articles from players", async () => {
    const res = await search(playerA, "tor");
    expect(res.status).toBe(200);
    expect(res.data.hits?.map((hit) => hit.title)).toEqual(["Tore von Wertheim", "Burgtor"]);
  });

  it("treats LIKE wildcards literally", async () => {
    expect((await search(gm, "%")).data.hits?.map((hit) => hit.title)).toEqual(["50% Rabatt"]);
    expect((await search(gm, "_")).data.hits).toEqual([]);
  });

  it("rejects non-members, unknown worlds, bad ids and anonymous users", async () => {
    expect((await search(playerB, "tor")).status).toBe(403);
    expect((await search(gm, "tor", randomUUID())).status).toBe(404);
    expect((await search(gm, "tor", "keine-uuid")).status).toBe(404);
    expect((await search(null, "tor")).status).toBe(401);
    expect((await search(gm, "x".repeat(201))).status).toBe(400);
  });
});

describe("POST /api/worlds/[worldId]/articles (stub from @)", () => {
  it("lets staff create a stub that is hidden and unedited", async () => {
    const res = await api<{ article?: { id: string; title: string; templateType: string } }>(
      master,
      "POST",
      `/api/worlds/${worldId}/articles`,
      { title: "  Neuer Ort  " },
    );
    expect(res.status).toBe(201);
    expect(res.data.article).toMatchObject({ title: "Neuer Ort", templateType: "none" });
    const [row] = await sql`
      SELECT visibility, first_edited_at FROM articles WHERE id = ${res.data.article?.id ?? ""}
    `;
    expect(row).toMatchObject({ visibility: "gm_only", first_edited_at: null });

    const found = await search(gm, "Neuer Ort");
    expect(found.data.hits?.map((hit) => hit.id)).toEqual([res.data.article?.id]);
    expect((await search(playerA, "Neuer Ort")).data.hits).toEqual([]);
  });

  it("forbids players and non-members, validates the title", async () => {
    const path = `/api/worlds/${worldId}/articles`;
    expect((await api(playerA, "POST", path, { title: "Spielerartikel" })).status).toBe(403);
    expect((await api(playerB, "POST", path, { title: "Fremd" })).status).toBe(403);
    expect((await api(gm, "POST", path, { title: "   " })).status).toBe(400);
    expect((await api(gm, "POST", path, { title: "x".repeat(201) })).status).toBe(400);
    expect((await api(gm, "POST", path, "kein objekt")).status).toBe(400);
    expect((await api(gm, "POST", `/api/worlds/${randomUUID()}/articles`, { title: "X" })).status).toBe(404);
  });
});
