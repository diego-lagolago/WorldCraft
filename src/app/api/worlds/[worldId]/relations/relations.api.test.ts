import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
let gm: TestSession;
let playerA: TestSession;
let worldId = "";
let otherWorldId = "";
let publishedId = "";
let hiddenId = "";
let placeId = "";
let personId = "";

const w = (path = "") => `/api/worlds/${worldId}${path}`;
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const mentionDoc = (id: string, kind: string, label: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "mention", attrs: { id, kind, label, mentionSuggestionChar: "@" } }],
    },
  ],
});

beforeAll(async () => {
  [gm, playerA] = await Promise.all([login("test-gm"), login("test-player-a")]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "T-010 Relationenwelt" });
  expect(world.status).toBe(201);
  worldId = world.data.id;
  const invite = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
  expect((await api(playerA, "POST", `/api/invites/${invite.data.code}/join`)).status).toBe(200);
  const other = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "T-010 Fremdwelt" });
  expect(other.status).toBe(201);
  otherWorldId = other.data.id;
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  if (otherWorldId) await sql`DELETE FROM worlds WHERE id = ${otherWorldId}`;
  await sql.end();
});

describe("T-010 (1)/(5): mention and template_field recalc", () => {
  it("creates mention relations on save and keeps manuals", async () => {
    const source = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), { title: "Quelle", visibility: "published" });
    const target = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Ziel",
      visibility: "published",
    });
    expect(source.status).toBe(201);
    publishedId = source.data.article.id;
    const targetId = target.data.article.id;

    expect(
      (await api(gm, "PATCH", w(`/articles/${publishedId}`), { body: mentionDoc(targetId, "article", "Ziel") })).status,
    ).toBe(200);
    const linked = await api<{ items: { id: string; originLabels: string[]; manualLabel: string | null }[] }>(
      gm,
      "GET",
      w(`/relations?kind=article&id=${publishedId}`),
    );
    expect(linked.data.items).toEqual([
      expect.objectContaining({ id: targetId, originLabels: ["Erwähnung"], manualLabel: null }),
    ]);

    const manual = await api<{ id: string }>(gm, "POST", w("/relations"), {
      sourceKind: "article",
      sourceId: publishedId,
      targetKind: "article",
      targetId,
      label: "Nachbar",
    });
    expect(manual.status).toBe(201);

    expect(
      (await api(gm, "PATCH", w(`/articles/${publishedId}`), { body: mentionDoc(targetId, "article", "Ziel") })).status,
    ).toBe(200);
    const after = await api<{ items: { originLabels: string[]; manualLabel: string | null }[] }>(
      gm,
      "GET",
      w(`/relations?kind=article&id=${publishedId}`),
    );
    expect(after.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ originLabels: expect.arrayContaining(["Erwähnung"]), manualLabel: null }),
        expect.objectContaining({ manualLabel: "Nachbar" }),
      ]),
    );
  });

  it("creates a template_field relation and removes it when the field is cleared (5)", async () => {
    const person = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Herrscherin",
      templateType: "person",
      visibility: "published",
    });
    const place = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Burg",
      templateType: "place",
      visibility: "published",
    });
    personId = person.data.article.id;
    placeId = place.data.article.id;
    expect(
      (
        await api(gm, "PATCH", w(`/articles/${placeId}`), {
          templateFields: { ruler: { kind: "article", id: personId } },
        })
      ).status,
    ).toBe(200);
    const linked = await api<{ items: { id: string; originLabels: string[] }[] }>(
      gm,
      "GET",
      w(`/relations?kind=article&id=${placeId}`),
    );
    expect(linked.data.items).toEqual([expect.objectContaining({ id: personId, originLabels: ["Vorlagenfeld"] })]);

    expect((await api(gm, "PATCH", w(`/articles/${placeId}`), { templateFields: {} })).status).toBe(200);
    const cleared = await api<{ items: { id: string }[] }>(gm, "GET", w(`/relations?kind=article&id=${placeId}`));
    expect(cleared.data.items).toEqual([]);
  });
});

describe("T-010 (2)/(3)/(6): visibility and manual labels", () => {
  it("hides published↔gm_only from players and shows it to staff (2)", async () => {
    const hidden = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: "Geheim",
      visibility: "gm_only",
      body: doc("geheim"),
    });
    hiddenId = hidden.data.article.id;
    expect(
      (await api(gm, "PATCH", w(`/articles/${publishedId}`), { body: mentionDoc(hiddenId, "article", "Geheim") })).status,
    ).toBe(200);
    const staff = await api<{ items: { id: string }[] }>(gm, "GET", w(`/relations?kind=article&id=${publishedId}`));
    expect(staff.data.items.map((item) => item.id)).toContain(hiddenId);
    const player = await api<{ items: { id: string }[] }>(playerA, "GET", w(`/relations?kind=article&id=${publishedId}`));
    expect(player.data.items.map((item) => item.id)).not.toContain(hiddenId);
  });

  it("rejects a player creating a manual relation (3)", async () => {
    expect(
      (
        await api(playerA, "POST", w("/relations"), {
          sourceKind: "article",
          sourceId: publishedId,
          targetKind: "article",
          targetId: placeId,
          label: "Verboten",
        })
      ).status,
    ).toBe(403);
  });

  it("shows label at the source and counter-label at the target (6)", async () => {
    const created = await api<{ id: string }>(gm, "POST", w("/relations"), {
      sourceKind: "article",
      sourceId: placeId,
      targetKind: "article",
      targetId: personId,
      label: "wird beherrscht von",
      counterLabel: "beherrscht",
    });
    expect(created.status).toBe(201);
    const source = await api<{ items: { id: string; manualLabel: string | null }[] }>(
      gm,
      "GET",
      w(`/relations?kind=article&id=${placeId}`),
    );
    expect(source.data.items).toContainEqual(
      expect.objectContaining({ id: personId, manualLabel: "wird beherrscht von" }),
    );
    const target = await api<{ items: { id: string; manualLabel: string | null }[] }>(
      gm,
      "GET",
      w(`/relations?kind=article&id=${personId}`),
    );
    expect(target.data.items).toContainEqual(expect.objectContaining({ id: placeId, manualLabel: "beherrscht" }));
  });
});

describe("CR-004 / CR-005 on relation routes", () => {
  it("rejects a target from another world as 404, never 500", async () => {
    const foreign = await api<{ article: { id: string } }>(gm, "POST", `/api/worlds/${otherWorldId}/articles`, {
      title: "Fremd",
    });
    expect(foreign.status).toBe(201);
    const cross = await api(gm, "POST", w("/relations"), {
      sourceKind: "article",
      sourceId: publishedId,
      targetKind: "article",
      targetId: foreign.data.article.id,
      label: "Übergriff",
    });
    expect(cross.status).toBe(404);
    const missing = await api(gm, "POST", w("/relations"), {
      sourceKind: "article",
      sourceId: publishedId,
      targetKind: "article",
      targetId: randomUUID(),
      label: "Nirgends",
    });
    expect(missing.status).toBe(404);
  });

  it("answers 400 or 404 for bad ids and bodies, never 500", async () => {
    expect((await api(gm, "GET", w("/relations?kind=article&id=not-a-uuid"))).status).toBe(404);
    expect((await api(gm, "DELETE", w("/relations/not-a-uuid"))).status).toBe(404);
    expect((await api(gm, "POST", w("/relations"), "kein objekt")).status).toBe(400);
    expect((await api(gm, "POST", `/api/worlds/not-a-uuid/relations`, { label: "x" })).status).toBe(404);
  });
});
