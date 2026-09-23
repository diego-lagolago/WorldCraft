/**
 * T-011: coverage checks for Plan 004 rights cases that must appear in `npm run test:rechte`.
 * Groups: owner tier per content type, editing foreign owner_only, chapter inheritance,
 * notes access, map exception (universe/map reject owner_only).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, BASE, login, testSql, type TestSession } from "@/test/api-harness";
import type { MapState, PinDto } from "@/lib/map/types";

const sql = testSql();
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let gm: TestSession;
let masterA: TestSession;
let masterB: TestSession;
let player: TestSession;
let worldId = "";
let universeId = "";
let publishedMapId = "";

const w = (path = "") => `/api/worlds/${worldId}${path}`;

beforeAll(async () => {
  [gm, masterA, masterB, player] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-b"),
    login("test-player-a"),
  ]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", {
    name: "T-011 Owner-Coverage",
  });
  expect(world.status).toBe(201);
  worldId = world.data.id;

  for (const session of [masterA, masterB, player]) {
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
  }

  const worldGet = await api<{ universes: { id: string }[] }>(gm, "GET", w());
  universeId = worldGet.data.universes[0]!.id;

  const created = await api<{ map?: { id: string } }>(gm, "POST", w("/map"), {
    universeId,
    name: "Coverage-Karte",
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
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql.end();
});

describe("T-011 owner tier per content type", () => {
  it("hides owner_only article, quest, chapter and pin from non-owners", async () => {
    const article = await api<{ article: { id: string } }>(masterA, "POST", w("/articles"), {
      title: "Coverage Artikel",
      visibility: "owner_only",
    });
    expect(article.status).toBe(201);

    const quest = await api<{ quest: { id: string } }>(masterA, "POST", w("/quests"), {
      title: "Coverage Quest",
      visibility: "published",
    });
    expect(quest.status).toBe(201);
    const chapter = await api<{ chapter: { id: string } }>(
      masterA,
      "POST",
      w(`/quests/${quest.data.quest.id}/chapters`),
      { title: "Coverage Kapitel", visibility: "owner_only" },
    );
    expect(chapter.status).toBe(201);

    const pin = await api<{ pin: PinDto }>(masterA, "POST", w("/map/pins"), {
      mapId: publishedMapId,
      pinType: "city",
      title: "Coverage Pin",
      posX: 0.3,
      posY: 0.3,
      visibility: "owner_only",
    });
    expect(pin.status).toBe(201);

    for (const session of [gm, masterB, player]) {
      expect((await api(session, "GET", w(`/articles/${article.data.article.id}`))).status).toBe(
        404,
      );
      const chapters = await api<{ chapters: { id: string }[] }>(
        session,
        "GET",
        w(`/quests/${quest.data.quest.id}/chapters`),
      );
      expect(chapters.status).toBe(200);
      expect(chapters.data.chapters.map((row) => row.id)).not.toContain(chapter.data.chapter.id);
      expect((await api(session, "GET", w(`/map/pins/${pin.data.pin.id}`))).status).toBe(404);
    }

    expect((await api(masterA, "GET", w(`/articles/${article.data.article.id}`))).status).toBe(200);
    const ownChapters = await api<{ chapters: { id: string }[] }>(
      masterA,
      "GET",
      w(`/quests/${quest.data.quest.id}/chapters`),
    );
    expect(ownChapters.data.chapters.map((row) => row.id)).toContain(chapter.data.chapter.id);
    expect((await api(masterA, "GET", w(`/map/pins/${pin.data.pin.id}`))).status).toBe(200);

    const ownerOnlyQuest = await api<{ quest: { id: string } }>(masterA, "POST", w("/quests"), {
      title: "Nur A Coverage Quest",
      visibility: "owner_only",
    });
    expect(ownerOnlyQuest.status).toBe(201);
    for (const session of [gm, masterB, player]) {
      expect(
        (await api(session, "GET", w(`/quests/${ownerOnlyQuest.data.quest.id}`))).status,
      ).toBe(404);
    }
    expect(
      (await api(masterA, "GET", w(`/quests/${ownerOnlyQuest.data.quest.id}`))).status,
    ).toBe(200);
  });
});

describe("T-011 editing foreign owner_only", () => {
  it("rejects GM PATCH on master's owner_only quest, chapter and pin", async () => {
    const quest = await api<{ quest: { id: string } }>(masterA, "POST", w("/quests"), {
      title: "Fremd-Edit Quest",
      visibility: "owner_only",
    });
    expect(quest.status).toBe(201);
    expect(
      (await api(gm, "PATCH", w(`/quests/${quest.data.quest.id}`), { title: "Hack" })).status,
    ).toBe(404);

    const published = await api<{ quest: { id: string } }>(masterA, "POST", w("/quests"), {
      title: "Fremd-Edit Kapitel-Quest",
      visibility: "published",
    });
    expect(published.status).toBe(201);
    const chapter = await api<{ chapter: { id: string } }>(
      masterA,
      "POST",
      w(`/quests/${published.data.quest.id}/chapters`),
      { title: "Fremd Kapitel", visibility: "owner_only" },
    );
    expect(chapter.status).toBe(201);
    expect(
      (
        await api(gm, "PATCH", w(`/quests/${published.data.quest.id}/chapters/${chapter.data.chapter.id}`), {
          title: "Hack",
        })
      ).status,
    ).toBe(404);

    const pin = await api<{ pin: PinDto }>(masterA, "POST", w("/map/pins"), {
      mapId: publishedMapId,
      pinType: "landmark",
      title: "Fremd Pin",
      posX: 0.5,
      posY: 0.5,
      visibility: "owner_only",
    });
    expect(pin.status).toBe(201);
    expect(
      (await api(gm, "PATCH", w(`/map/pins/${pin.data.pin.id}`), { title: "Hack" })).status,
    ).toBe(404);
  });
});

describe("T-011 chapter inheritance", () => {
  it("hides published chapters when the quest itself is gm_only for players", async () => {
    const quest = await api<{ quest: { id: string } }>(gm, "POST", w("/quests"), {
      title: "Vererbung Quest",
      visibility: "gm_only",
    });
    expect(quest.status).toBe(201);
    expect(
      (
        await api(gm, "POST", w(`/quests/${quest.data.quest.id}/chapters`), {
          title: "Öffentlich aber vererbt",
          visibility: "published",
        })
      ).status,
    ).toBe(201);

    expect((await api(player, "GET", w(`/quests/${quest.data.quest.id}`))).status).toBe(404);
    expect(
      (await api(player, "GET", w(`/quests/${quest.data.quest.id}/chapters`))).status,
    ).toBe(404);
  });
});

describe("T-011 notes access", () => {
  it("allows player notes on published quest and denies gm_only quest", async () => {
    const published = await api<{ quest: { id: string } }>(gm, "POST", w("/quests"), {
      title: "Notiz Coverage offen",
      visibility: "published",
    });
    expect(published.status).toBe(201);
    const bodyJson = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Coverage" }] }],
    };
    expect(
      (
        await api(player, "PUT", w(`/quests/${published.data.quest.id}/notes`), {
          bodyJson,
          version: 0,
        })
      ).status,
    ).toBe(200);

    const hidden = await api<{ quest: { id: string } }>(gm, "POST", w("/quests"), {
      title: "Notiz Coverage versteckt",
      visibility: "gm_only",
    });
    expect(hidden.status).toBe(201);
    expect((await api(player, "GET", w(`/quests/${hidden.data.quest.id}/notes`))).status).toBe(404);
  });
});

describe("T-011 map exception", () => {
  it("rejects owner_only for universe and map visibility", async () => {
    const universePatch = await api(gm, "PATCH", w(`/universes/${universeId}`), {
      visibility: "owner_only",
    });
    expect(universePatch.status).toBe(400);

    const mapPatch = await api(gm, "PATCH", w("/map"), {
      mapId: publishedMapId,
      visibility: "owner_only",
    });
    expect(mapPatch.status).toBe(400);

    const [universeRow] = await sql`SELECT visibility FROM universes WHERE id = ${universeId}`;
    const [mapRow] = await sql`SELECT visibility FROM maps WHERE id = ${publishedMapId}`;
    expect(universeRow.visibility).not.toBe("owner_only");
    expect(mapRow.visibility).toBe("published");

    const state = await api<MapState>(player, "GET", w(`/map?map=${publishedMapId}`));
    expect(state.status).toBe(200);
    expect(state.data.map?.visibility).toBe("published");
  });
});
