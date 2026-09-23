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
let masterAMembershipId = "";
let publishedMapId = "";
let gmOnlyMapId = "";

const w = (path = "") => `/api/worlds/${worldId}${path}`;

beforeAll(async () => {
  [gm, masterA, masterB, player] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-b"),
    login("test-player-a"),
  ]);
  const world = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "T-004 Owner-Sichtbarkeit" });
  expect(world.status).toBe(201);
  worldId = world.data.id;

  for (const session of [masterA, masterB, player]) {
    const invite = await api<{ code: string }>(gm, "POST", w("/invites"), { validity: "seven_days" });
    expect((await api(session, "POST", `/api/invites/${invite.data.code}/join`)).status).toBe(200);
  }

  const members = await api<{ members: { membershipId: string; userId: string }[] }>(gm, "GET", w("/members"));
  expect(members.status).toBe(200);
  const rowA = members.data.members.find((row) => row.userId === masterA.user.id);
  const rowB = members.data.members.find((row) => row.userId === masterB.user.id);
  expect(rowA && rowB).toBeTruthy();
  masterAMembershipId = rowA!.membershipId;
  expect((await api(gm, "PATCH", w(`/members/${rowA!.membershipId}`), { role: "master" })).status).toBe(200);
  expect((await api(gm, "PATCH", w(`/members/${rowB!.membershipId}`), { role: "master" })).status).toBe(200);

  const worldGet = await api<{ universes: { id: string }[] }>(gm, "GET", w());
  const universeId = worldGet.data.universes[0]!.id;

  async function createMapNamed(name: string) {
    const created = await api<{ map?: { id: string } }>(gm, "POST", w("/map"), { universeId, name });
    expect(created.status).toBe(201);
    const mapId = created.data.map!.id;
    const form = new FormData();
    form.set("kind", "map");
    form.set("worldId", worldId);
    form.set("targetId", mapId);
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
    return mapId;
  }

  publishedMapId = await createMapNamed("Öffentliche Karte");
  expect((await api(gm, "PATCH", w("/map"), { mapId: publishedMapId, visibility: "published" })).status).toBe(200);

  gmOnlyMapId = await createMapNamed("SL-Karte");
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql.end();
});

describe("T-004 APP-VIS-OWNER", () => {
  it("hides master's owner_only article/quest from GM and other masters; owner sees them", async () => {
    const article = await api<{ article: { id: string } }>(masterA, "POST", w("/articles"), {
      title: "Nur A Artikel",
      visibility: "owner_only",
    });
    expect(article.status).toBe(201);
    const articleId = article.data.article.id;

    const quest = await api<{ quest: { id: string } }>(masterA, "POST", w("/quests"), {
      title: "Nur A Quest",
      visibility: "owner_only",
    });
    expect(quest.status).toBe(201);
    const questId = quest.data.quest.id;

    for (const session of [gm, masterB, player]) {
      expect((await api(session, "GET", w(`/articles/${articleId}`))).status).toBe(404);
      expect((await api(session, "GET", w(`/quests/${questId}`))).status).toBe(404);
      const articles = await api<{ articles: { id: string }[] }>(session, "GET", w("/articles"));
      const quests = await api<{ quests: { id: string }[] }>(session, "GET", w("/quests"));
      expect(articles.data.articles.map((row) => row.id)).not.toContain(articleId);
      expect(quests.data.quests.map((row) => row.id)).not.toContain(questId);
    }

    expect((await api(masterA, "GET", w(`/articles/${articleId}`))).status).toBe(200);
    expect((await api(masterA, "GET", w(`/quests/${questId}`))).status).toBe(200);

    const searchGm = await api<{ hits: { id: string }[] }>(gm, "GET", w("/search?q=Nur%20A"));
    const searchA = await api<{ hits: { id: string }[] }>(masterA, "GET", w("/search?q=Nur%20A"));
    expect(searchGm.data.hits.map((hit) => hit.id)).not.toContain(articleId);
    expect(searchA.data.hits.map((hit) => hit.id)).toContain(articleId);

    const mentionGm = await api<{ hits: { id: string }[] }>(gm, "GET", w("/mentions?q=Nur%20A"));
    const mentionA = await api<{ hits: { id: string }[] }>(masterA, "GET", w("/mentions?q=Nur%20A"));
    expect(mentionGm.data.hits.map((hit) => hit.id)).not.toContain(articleId);
    expect(mentionA.data.hits.map((hit) => hit.id)).toContain(articleId);
  });

  it("rejects GM PATCH on owner_only; allows gm_only; R2 blocks setting owner_only", async () => {
    const owned = await api<{ article: { id: string } }>(masterA, "POST", w("/articles"), {
      title: "A Owner",
      visibility: "owner_only",
    });
    expect(owned.status).toBe(201);
    expect((await api(gm, "PATCH", w(`/articles/${owned.data.article.id}`), { title: "Hack" })).status).toBe(404);

    const shared = await api<{ article: { id: string } }>(masterA, "POST", w("/articles"), {
      title: "A SL",
      visibility: "gm_only",
    });
    expect(shared.status).toBe(201);
    expect((await api(gm, "PATCH", w(`/articles/${shared.data.article.id}`), { title: "GM ok" })).status).toBe(200);

    const r2 = await api(gm, "PATCH", w(`/articles/${shared.data.article.id}`), { visibility: "owner_only" });
    expect(r2.status).toBe(403);
    const [row] = await sql`SELECT visibility FROM articles WHERE id = ${shared.data.article.id}`;
    expect(row.visibility).toBe("gm_only");
  });

  it("R1: demotion hides own owner_only; promotion restores", async () => {
    const article = await api<{ article: { id: string } }>(masterA, "POST", w("/articles"), {
      title: "Demotion Artikel",
      visibility: "owner_only",
    });
    expect(article.status).toBe(201);
    const id = article.data.article.id;
    expect((await api(masterA, "GET", w(`/articles/${id}`))).status).toBe(200);

    expect((await api(gm, "PATCH", w(`/members/${masterAMembershipId}`), { role: "player" })).status).toBe(200);
    expect((await api(masterA, "GET", w(`/articles/${id}`))).status).toBe(404);
    const listAsPlayer = await api<{ articles: { id: string }[] }>(masterA, "GET", w("/articles"));
    expect(listAsPlayer.data.articles.map((row) => row.id)).not.toContain(id);

    expect((await api(gm, "PATCH", w(`/members/${masterAMembershipId}`), { role: "master" })).status).toBe(200);
    expect((await api(masterA, "GET", w(`/articles/${id}`))).status).toBe(200);
  });

  it("hides owner_only pin; inheritance and player GET on gm_only pin", async () => {
    const ownerPin = await api<{ pin: PinDto }>(masterA, "POST", w("/map/pins"), {
      mapId: publishedMapId,
      pinType: "city",
      title: "Nur A Pin",
      posX: 0.4,
      posY: 0.4,
      visibility: "owner_only",
    });
    expect(ownerPin.status).toBe(201);
    const pinId = ownerPin.data.pin.id;

    for (const session of [gm, masterB, player]) {
      expect((await api(session, "GET", w(`/map/pins/${pinId}`))).status).toBe(404);
      const state = await api<MapState>(session, "GET", w(`/map?map=${publishedMapId}`));
      expect(state.data.pins.map((pin) => pin.id)).not.toContain(pinId);
    }
    expect((await api(masterA, "GET", w(`/map/pins/${pinId}`))).status).toBe(200);

    const gmPin = await api<{ pin: PinDto }>(gm, "POST", w("/map/pins"), {
      mapId: publishedMapId,
      pinType: "landmark",
      title: "SL Pin",
      posX: 0.6,
      posY: 0.6,
      visibility: "gm_only",
    });
    expect(gmPin.status).toBe(201);
    expect((await api(player, "GET", w(`/map/pins/${gmPin.data.pin.id}`))).status).toBe(404);

    const publishedOnHidden = await api<{ pin: PinDto }>(gm, "POST", w("/map/pins"), {
      mapId: gmOnlyMapId,
      pinType: "city",
      title: "Published on hidden",
      posX: 0.2,
      posY: 0.2,
      visibility: "published",
    });
    expect(publishedOnHidden.status).toBe(201);
    expect((await api(player, "GET", w(`/map/pins/${publishedOnHidden.data.pin.id}`))).status).toBe(404);
  });
});
