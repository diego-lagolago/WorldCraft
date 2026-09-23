/**
 * CR-017 / Review 004: regression tests for owner_only visibility edges
 * (linked relations, hub/mention search, R1 edit restore, manual relation 404, search limit).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, BASE, login, testSql, type TestSession } from "@/test/api-harness";
import type { PinDto } from "@/lib/map/types";
import { SEARCH_DEFAULT_LIMIT } from "@/lib/search";

const sql = testSql();
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let gm: TestSession;
let masterA: TestSession;
let masterB: TestSession;
let worldId = "";
let masterAMembershipId = "";
let publishedMapId = "";
let publishedArticleId = "";

const w = (path = "") => `/api/worlds/${worldId}${path}`;

beforeAll(async () => {
  [gm, masterA, masterB] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-b"),
  ]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", {
    name: "CR-017 Review 004",
  });
  expect(world.status).toBe(201);
  worldId = world.data.id;

  for (const session of [masterA, masterB]) {
    const invite = await api<{ code: string }>(gm, "POST", w("/invites"), {
      validity: "seven_days",
    });
    expect((await api(session, "POST", `/api/invites/${invite.data.code}/join`)).status).toBe(200);
  }

  const members = await api<{ members: { membershipId: string; userId: string }[] }>(
    gm,
    "GET",
    w("/members"),
  );
  expect(members.status).toBe(200);
  for (const session of [masterA, masterB]) {
    const row = members.data.members.find((entry) => entry.userId === session.user.id);
    expect(row).toBeTruthy();
    expect(
      (await api(gm, "PATCH", w(`/members/${row!.membershipId}`), { role: "master" })).status,
    ).toBe(200);
    if (session === masterA) masterAMembershipId = row!.membershipId;
  }

  const worldGet = await api<{ universes: { id: string }[] }>(gm, "GET", w());
  const universeId = worldGet.data.universes[0]!.id;
  const created = await api<{ map?: { id: string } }>(gm, "POST", w("/map"), {
    universeId,
    name: "CR-017 Karte",
  });
  expect(created.status).toBe(201);
  publishedMapId = created.data.map!.id;
  const form = new FormData();
  form.set("kind", "map");
  form.set("worldId", worldId);
  form.set("targetId", publishedMapId);
  form.set("image", new Blob([PNG], { type: "image/png" }), "map.png");
  expect(
    (
      await fetch(`${BASE}/api/files`, {
        method: "POST",
        headers: { cookie: gm.cookie, origin: BASE },
        body: form,
      })
    ).status,
  ).toBe(201);
  expect(
    (await api(gm, "PATCH", w("/map"), { mapId: publishedMapId, visibility: "published" })).status,
  ).toBe(200);

  const published = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
    title: "CR017 Offen",
    visibility: "published",
  });
  expect(published.status).toBe(201);
  publishedArticleId = published.data.article.id;
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql.end();
});

describe("CR-017 owner_only not in linked for non-owner", () => {
  it("owner_only not in linked for non-owner", async () => {
    const owned = await api<{ article: { id: string } }>(masterA, "POST", w("/articles"), {
      title: "CR017 Owner Only Link",
      visibility: "owner_only",
    });
    expect(owned.status).toBe(201);
    const ownedId = owned.data.article.id;

    const manual = await api<{ id: string }>(masterA, "POST", w("/relations"), {
      sourceKind: "article",
      sourceId: publishedArticleId,
      targetKind: "article",
      targetId: ownedId,
      label: "kennt",
    });
    expect(manual.status).toBe(201);

    const linkedGm = await api<{ items: { id: string }[] }>(
      gm,
      "GET",
      w(`/relations?kind=article&id=${publishedArticleId}`),
    );
    expect(linkedGm.status).toBe(200);
    expect(linkedGm.data.items.map((item) => item.id)).not.toContain(ownedId);

    const linkedOwner = await api<{ items: { id: string }[] }>(
      masterA,
      "GET",
      w(`/relations?kind=article&id=${publishedArticleId}`),
    );
    expect(linkedOwner.data.items.map((item) => item.id)).toContain(ownedId);
  });
});

describe("CR-017 owner_only quest/pin not in hub/mention search", () => {
  it("owner_only quest/pin not in hub/mention search", async () => {
    const quest = await api<{ quest: { id: string } }>(masterA, "POST", w("/quests"), {
      title: "CR017SecretQuest",
      visibility: "owner_only",
    });
    expect(quest.status).toBe(201);
    const questId = quest.data.quest.id;

    const pin = await api<{ pin: PinDto }>(masterA, "POST", w("/map/pins"), {
      mapId: publishedMapId,
      pinType: "city",
      title: "CR017SecretPin",
      posX: 0.41,
      posY: 0.41,
      visibility: "owner_only",
    });
    expect(pin.status).toBe(201);
    const pinId = pin.data.pin.id;

    for (const session of [gm, masterB]) {
      const hub = await api<{ hits: { id: string; kind: string }[] }>(
        session,
        "GET",
        w("/search?q=CR017Secret"),
      );
      expect(hub.status).toBe(200);
      expect(hub.data.hits.map((hit) => hit.id)).not.toContain(questId);
      expect(hub.data.hits.map((hit) => hit.id)).not.toContain(pinId);

      const mention = await api<{ hits: { id: string; kind: string }[] }>(
        session,
        "GET",
        w("/mentions?q=CR017Secret"),
      );
      expect(mention.status).toBe(200);
      expect(mention.data.hits.map((hit) => hit.id)).not.toContain(questId);
    }

    const hubOwner = await api<{ hits: { id: string }[] }>(
      masterA,
      "GET",
      w("/search?q=CR017Secret"),
    );
    expect(hubOwner.data.hits.map((hit) => hit.id)).toEqual(
      expect.arrayContaining([questId, pinId]),
    );
    const mentionOwner = await api<{ hits: { id: string }[] }>(
      masterA,
      "GET",
      w("/mentions?q=CR017Secret"),
    );
    expect(mentionOwner.data.hits.map((hit) => hit.id)).toContain(questId);
  });
});

describe("CR-017 R1 promotion restores edit", () => {
  it("R1 promotion restores edit", async () => {
    const article = await api<{ article: { id: string } }>(masterA, "POST", w("/articles"), {
      title: "CR017 R1 Edit",
      visibility: "owner_only",
    });
    expect(article.status).toBe(201);
    const id = article.data.article.id;

    expect((await api(gm, "PATCH", w(`/members/${masterAMembershipId}`), { role: "player" })).status).toBe(
      200,
    );
    expect((await api(masterA, "GET", w(`/articles/${id}`))).status).toBe(404);
    // Player is not staff — write is denied (403) even before visibility 404.
    expect((await api(masterA, "PATCH", w(`/articles/${id}`), { title: "Als Player" })).status).toBe(
      403,
    );

    expect((await api(gm, "PATCH", w(`/members/${masterAMembershipId}`), { role: "master" })).status).toBe(
      200,
    );
    expect((await api(masterA, "GET", w(`/articles/${id}`))).status).toBe(200);
    expect(
      (await api(masterA, "PATCH", w(`/articles/${id}`), { title: "Nach Promotion" })).status,
    ).toBe(200);
  });
});

describe("CR-017 manual relation to invisible target is 404", () => {
  it("manual relation to invisible target is 404", async () => {
    const owned = await api<{ article: { id: string } }>(masterA, "POST", w("/articles"), {
      title: "CR017 Invisible Target",
      visibility: "owner_only",
    });
    expect(owned.status).toBe(201);

    const byGm = await api(gm, "POST", w("/relations"), {
      sourceKind: "article",
      sourceId: publishedArticleId,
      targetKind: "article",
      targetId: owned.data.article.id,
      label: "unsichtbar",
    });
    expect(byGm.status).toBe(404);
    const [count] = await sql`
      SELECT count(*)::int AS n FROM relations
      WHERE world_id = ${worldId}
        AND target_article_id = ${owned.data.article.id}
        AND origin = 'manual'
    `;
    expect(count.n).toBe(0);

    const byOwner = await api<{ id: string }>(masterA, "POST", w("/relations"), {
      sourceKind: "article",
      sourceId: publishedArticleId,
      targetKind: "article",
      targetId: owned.data.article.id,
      label: "sichtbar",
    });
    expect(byOwner.status).toBe(201);
  });
});

describe("CR-004 search limit with owner_only crowding", () => {
  it("finds gm_only article despite limit+1 foreign owner_only matches", async () => {
    const marker = `CR004Lim${Date.now().toString(36)}`;
    const limit = SEARCH_DEFAULT_LIMIT;
    for (let i = 0; i < limit + 1; i += 1) {
      expect(
        (
          await api(masterB, "POST", w("/articles"), {
            title: `${marker} B${i}`,
            visibility: "owner_only",
          })
        ).status,
      ).toBe(201);
    }
    const gmOnly = await api<{ article: { id: string } }>(gm, "POST", w("/articles"), {
      title: `${marker} GM`,
      visibility: "gm_only",
    });
    expect(gmOnly.status).toBe(201);

    const hub = await api<{ hits: { id: string }[] }>(
      gm,
      "GET",
      w(`/search?q=${encodeURIComponent(marker)}&limit=${limit}`),
    );
    expect(hub.status).toBe(200);
    expect(hub.data.hits.map((hit) => hit.id)).toContain(gmOnly.data.article.id);
  });

  it("returns both quests when one has limit+1 matching chapters", async () => {
    const marker = `CR004Ch${Date.now().toString(36)}`;
    const limit = 5;
    const questX = await api<{ quest: { id: string } }>(gm, "POST", w("/quests"), {
      title: `${marker} QuestX`,
      visibility: "published",
    });
    const questY = await api<{ quest: { id: string } }>(gm, "POST", w("/quests"), {
      title: `${marker} QuestY`,
      visibility: "published",
    });
    expect(questX.status).toBe(201);
    expect(questY.status).toBe(201);

    for (let i = 0; i < limit + 1; i += 1) {
      expect(
        (
          await api(gm, "POST", w(`/quests/${questX.data.quest.id}/chapters`), {
            title: `${marker} Kap ${i}`,
            visibility: "published",
            body: {
              type: "doc",
              content: [{ type: "paragraph", content: [{ type: "text", text: marker }] }],
            },
          })
        ).status,
      ).toBe(201);
    }
    expect(
      (
        await api(gm, "POST", w(`/quests/${questY.data.quest.id}/chapters`), {
          title: `${marker} Einzig`,
          visibility: "published",
          body: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: marker }] }],
          },
        })
      ).status,
    ).toBe(201);

    const hub = await api<{ hits: { id: string; kind: string }[] }>(
      gm,
      "GET",
      w(`/search?q=${encodeURIComponent(marker)}&kind=quest&limit=${limit}`),
    );
    expect(hub.status).toBe(200);
    const questIds = hub.data.hits.filter((hit) => hit.kind === "quest").map((hit) => hit.id);
    expect(questIds).toEqual(
      expect.arrayContaining([questX.data.quest.id, questY.data.quest.id]),
    );
  });
});
