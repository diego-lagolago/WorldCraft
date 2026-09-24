import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, BASE, login, testSql, type TestSession } from "@/test/api-harness";
import type { MapState, MarkerDto, PinDetails, PinDto } from "@/lib/map/types";

const sql = testSql();
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let playerB: TestSession;
let outsider: TestSession;
let worldId: string;
let universeId: string;
let otherWorldId: string;

beforeAll(async () => {
  [gm, master, playerA, playerB] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-a"),
    login("test-player-b"),
  ]);
  outsider = playerB;
  const created = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "Karten-Testwelt" });
  if (created.status !== 201 || !created.data.id) throw new Error(`Welt anlegen fehlgeschlagen (${created.status})`);
  worldId = created.data.id;
  await sql`
    INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
    VALUES
      (${worldId}, ${master.user.id}, 'master', ${gm.user.id}, ${gm.user.id}),
      (${worldId}, ${playerA.user.id}, 'player', ${gm.user.id}, ${gm.user.id})
  `;
  const world = await api<{ universes: { id: string }[] }>(gm, "GET", `/api/worlds/${worldId}`);
  universeId = world.data.universes[0]?.id as string;
  const other = await api<{ id: string }>(playerB, "POST", "/api/worlds", { name: "Karten-Andere-Welt" });
  if (other.status !== 201 || !other.data.id) throw new Error("zweite Welt fehlgeschlagen");
  otherWorldId = other.data.id;
});

afterAll(async () => {
  await sql`DELETE FROM worlds WHERE id IN (${worldId}, ${otherWorldId})`;
  await sql.end();
});

function mapApi(session: TestSession | null, path = "", method = "GET", body?: unknown) {
  return api<MapState & { error?: string; pin?: PinDto; marker?: MarkerDto; map?: { id: string } }>(
    session,
    method,
    `/api/worlds/${worldId}/map${path}`,
    body,
  );
}

async function createMapWithFile(session: TestSession, id: string, name = "Testkarte") {
  const created = await api<{ map?: { id: string }; error?: string }>(session, "POST", `/api/worlds/${worldId}/map`, {
    universeId: id,
    name,
  });
  if (created.status !== 201 || !created.data.map?.id) return created;
  const form = new FormData();
  form.set("kind", "map");
  form.set("worldId", worldId);
  form.set("targetId", created.data.map.id);
  form.set("image", new Blob([PNG], { type: "image/png" }), "map.png");
  const upload = await fetch(`${BASE}/api/files`, {
    method: "POST",
    headers: { cookie: session.cookie, origin: BASE },
    body: form,
  });
  expect(upload.status).toBe(201);
  return created;
}

describe("Produkt-Karte", () => {
  it("rejects multipart create with 415", async () => {
    const form = new FormData();
    form.set("universeId", universeId);
    form.set("name", "Multipart");
    form.set("image", new Blob([PNG], { type: "image/png" }), "map.png");
    const res = await fetch(`${BASE}/api/worlds/${worldId}/map`, {
      method: "POST",
      headers: { cookie: gm.cookie, origin: BASE },
      body: form,
    });
    expect(res.status).toBe(415);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toMatch(/JSON/i);
  });

  it("rejects a non-member and invalid ids", async () => {
    expect((await mapApi(outsider)).status).toBe(403);
    expect((await mapApi(gm, "?universe=abc")).status).toBe(400);
    expect((await mapApi(gm, "?pin=xyz")).status).toBe(400);
    const invalidJson = await fetch(`${BASE}/api/worlds/${worldId}/map/pins`, {
      method: "POST",
      headers: { cookie: gm.cookie, origin: BASE, "content-type": "application/json" },
      body: "{",
    });
    expect(invalidJson.status).toBe(400);
    expect((await api(gm, "PATCH", `/api/worlds/${worldId}/map/pins/not-a-uuid`, { posX: 0.1, posY: 0.1 })).status).toBe(
      404,
    );
  });

  it("creates maps (multiple per universe), hides gm_only layers from the player, and publishes pins", async () => {
    const created = await createMapWithFile(gm, universeId);
    expect(created.status).toBe(201);
    const mapId = created.data.map?.id as string;
    expect(mapId).toBeTruthy();
    const second = await createMapWithFile(gm, universeId);
    expect(second.status).toBe(201);
    expect(second.data.map?.id).toBeTruthy();
    expect(second.data.map?.id).not.toBe(mapId);

    const replace = new FormData();
    replace.set("kind", "map");
    replace.set("worldId", worldId);
    replace.set("targetId", mapId);
    replace.set("image", new Blob([PNG], { type: "image/png" }), "map2.png");
    const replaced = await fetch(`${BASE}/api/files`, {
      method: "POST",
      headers: { cookie: gm.cookie, origin: BASE },
      body: replace,
    });
    expect(replaced.status).toBe(201);
    const playerForm = new FormData();
    playerForm.set("kind", "map");
    playerForm.set("worldId", worldId);
    playerForm.set("targetId", mapId);
    playerForm.set("image", new Blob([PNG], { type: "image/png" }), "map2.png");
    const playerReplace = await fetch(`${BASE}/api/files`, {
      method: "POST",
      headers: { cookie: playerA.cookie, origin: BASE },
      body: playerForm,
    });
    expect(playerReplace.status).toBe(403);

    const hidden = await mapApi(playerA);
    expect(hidden.status).toBe(200);
    expect(hidden.data.map).toBeNull();
    expect(hidden.data.mapHidden).toBe(true);

    expect((await mapApi(playerA, "", "PATCH", { mapId, visibility: "published" })).status).toBe(403);
    expect((await mapApi(master, "", "PATCH", { mapId, visibility: "published" })).status).toBe(200);

    const visible = await mapApi(playerA);
    expect(visible.data.map?.id).toBe(mapId);

    const pin = await mapApi(master, "/pins", "POST", {
      mapId,
      pinType: "city",
      title: "Taverne",
      posX: 0.2,
      posY: 0.3,
      visibility: "published",
    });
    expect(pin.status).toBe(201);
    const pinId = pin.data.pin?.id as string;

    const secretUni = await api<{ id: string }>(master, "POST", `/api/worlds/${worldId}/universes`, {
      name: "Geheimer Keller",
      visibility: "gm_only",
    });
    expect(secretUni.status).toBe(201);
    const secretMap = await createMapWithFile(gm, secretUni.data.id);
    expect(secretMap.status).toBe(201);
    await api(gm, "PATCH", `/api/worlds/${worldId}/map`, {
      mapId: secretMap.data.map?.id,
      visibility: "published",
    });
    const secretPin = await mapApi(gm, "/pins", "POST", {
      mapId: secretMap.data.map?.id,
      pinType: "dungeon",
      title: "Versteck",
      posX: 0.5,
      posY: 0.5,
      visibility: "published",
    });
    expect(secretPin.status).toBe(201);
    const playerSecret = await api<MapState>(playerA, "GET", `/api/worlds/${worldId}/map?universe=${secretUni.data.id}`);
    expect(playerSecret.status).toBe(200);
    expect(playerSecret.data.universes.some((row) => row.id === secretUni.data.id)).toBe(false);
    expect(playerSecret.data.pins?.some((row) => row.title === "Versteck")).toBeFalsy();

    const listed = await mapApi(playerA, `?pin=${pinId}`);
    expect(listed.data.highlightPinId).toBe(pinId);
    expect(listed.data.pins.some((row) => row.id === pinId)).toBe(true);
  });

  it("locks pins, rejects player lock, and keeps dice-like 409 until unlock", async () => {
    const state = await mapApi(master);
    const mapId =
      state.data.maps.find((row) => row.visibility === "published")?.id ?? (state.data.map?.id as string);
    const created = await mapApi(master, "/pins", "POST", {
      mapId,
      pinType: "danger",
      title: "Schloss",
      posX: 0.4,
      posY: 0.4,
      visibility: "published",
    });
    const pinId = created.data.pin?.id as string;
    expect((await api(playerA, "PATCH", `/api/worlds/${worldId}/map/pins/${pinId}`, { locked: true })).status).toBe(403);
    expect((await api(master, "PATCH", `/api/worlds/${worldId}/map/pins/${pinId}`, { locked: true })).status).toBe(200);
    expect((await api(master, "PATCH", `/api/worlds/${worldId}/map/pins/${pinId}`, { posX: 0.9, posY: 0.9 })).status).toBe(
      409,
    );
    expect((await api(master, "PATCH", `/api/worlds/${worldId}/map/pins/${pinId}`, { title: "Nein" })).status).toBe(409);
    expect((await api(gm, "DELETE", `/api/worlds/${worldId}/map/pins/${pinId}`)).status).toBe(409);
    expect((await api(master, "PATCH", `/api/worlds/${worldId}/map/pins/${pinId}`, { locked: false })).status).toBe(200);
    expect((await api(master, "PATCH", `/api/worlds/${worldId}/map/pins/${pinId}`, { posX: 0.9, posY: 0.9 })).status).toBe(
      200,
    );
  });

  it("lets player A move only their marker and moves a character across maps", async () => {
    await sql`
      INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
      VALUES (${worldId}, ${playerB.user.id}, 'player', ${gm.user.id}, ${gm.user.id})
      ON CONFLICT (world_id, user_id) DO NOTHING
    `;
    const charA = await api<{ id: string }>(playerA, "POST", "/api/characters", { name: "Marker-A" });
    const charB = await api<{ id: string }>(playerB, "POST", "/api/characters", { name: "Marker-B" });
    expect(charA.status).toBe(201);
    expect(charB.status).toBe(201);
    expect(
      (await api(playerA, "POST", `/api/worlds/${worldId}/characters`, { characterId: charA.data.id })).status,
    ).toBe(200);
    expect(
      (await api(playerB, "POST", `/api/worlds/${worldId}/characters`, { characterId: charB.data.id })).status,
    ).toBe(200);
    const masterState = await mapApi(master);
    const mapId =
      masterState.data.maps.find((row) => row.visibility === "published")?.id ??
      (masterState.data.map?.id as string);
    const placedA = await mapApi(playerA, "/markers", "POST", {
      mapId,
      characterId: charA.data.id,
      posX: 0.1,
      posY: 0.1,
    });
    expect(placedA.status).toBe(201);
    const placedB = await mapApi(playerB, "/markers", "POST", {
      mapId,
      characterId: charB.data.id,
      posX: 0.2,
      posY: 0.2,
    });
    expect(placedB.status).toBe(201);
    expect(
      (await api(playerA, "PATCH", `/api/worlds/${worldId}/map/markers/${placedB.data.marker?.id}`, {
        posX: 0.8,
        posY: 0.8,
      })).status,
    ).toBe(403);
    expect(
      (await api(playerA, "PATCH", `/api/worlds/${worldId}/map/markers/${placedA.data.marker?.id}`, {
        posX: 0.7,
        posY: 0.7,
      })).status,
    ).toBe(200);
    expect(
      (await api(master, "PATCH", `/api/worlds/${worldId}/map/markers/${placedB.data.marker?.id}`, {
        posX: 0.6,
        posY: 0.6,
      })).status,
    ).toBe(200);

    const other = await api<{ map?: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/map`, {
      universeId,
      name: "Zweite Karte",
    });
    expect(other.status).toBe(201);
    const otherMapId = other.data.map?.id as string;
    const form = new FormData();
    form.set("kind", "map");
    form.set("worldId", worldId);
    form.set("targetId", otherMapId);
    form.set("image", new Blob([PNG], { type: "image/png" }), "map3.png");
    expect(
      (
        await fetch(`${BASE}/api/files`, {
          method: "POST",
          headers: { cookie: gm.cookie, origin: BASE },
          body: form,
        })
      ).status,
    ).toBe(201);
    expect((await mapApi(master, "", "PATCH", { mapId: otherMapId, visibility: "published" })).status).toBe(200);

    const moved = await mapApi(playerA, "/markers", "POST", {
      mapId: otherMapId,
      characterId: charA.data.id,
      posX: 0.3,
      posY: 0.3,
    });
    expect(moved.status).toBe(201);
    expect(moved.data.marker?.mapId).toBe(otherMapId);
    const onFirst = await api<MapState>(gm, "GET", `/api/worlds/${worldId}/map?map=${mapId}`);
    expect(onFirst.data.markers?.some((row) => row.characterId === charA.data.id)).toBe(false);
    const onSecond = await api<MapState>(gm, "GET", `/api/worlds/${worldId}/map?map=${otherMapId}`);
    expect(onSecond.data.markers?.some((row) => row.characterId === charA.data.id)).toBe(true);
  });

  it("creates mention relations from the pin description", async () => {
    const [article] = await sql<{ id: string }[]>`
      INSERT INTO articles (world_id, title, visibility, owner_id, created_by, updated_by)
      VALUES (${worldId}, 'Gottschleim', 'published', ${gm.user.id}, ${gm.user.id}, ${gm.user.id})
      RETURNING id
    `;
    const mapId =
      (await mapApi(master)).data.maps.find((row) => row.visibility === "published")?.id ??
      ((await mapApi(master)).data.map?.id as string);
    const pin = await mapApi(master, "/pins", "POST", {
      mapId,
      pinType: "landmark",
      title: "Schleimquelle",
      posX: 0.15,
      posY: 0.15,
      visibility: "published",
      description: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "mention",
                attrs: { id: article.id, kind: "article", label: "Gottschleim" },
              },
            ],
          },
        ],
      },
    });
    expect(pin.status).toBe(201);
    const details = await api<PinDetails>(gm, "GET", `/api/worlds/${worldId}/map/pins/${pin.data.pin?.id}`);
    expect(details.status).toBe(200);
    expect(details.data.linked?.some((item) => item.id === article.id && item.kind === "article")).toBe(true);
    expect(details.data.linked?.find((item) => item.id === article.id)?.href).toContain("/articles/");
  });
});

describe("Monster-Marker (Plan 006 T-004)", () => {
  it("staff places markers; player cannot; visibility inherits; create forces owner_only", async () => {
    const map = await createMapWithFile(gm, universeId, "Monster-Karte");
    expect(map.status).toBe(201);
    const mapId = map.data.map?.id as string;
    expect((await mapApi(gm, "", "PATCH", { mapId, visibility: "published" })).status).toBe(200);

    const published = await api<{ monster: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/monsters`, {
      name: "Schattenwolf",
      visibility: "published",
      kind: "beast",
      rarity: "uncommon",
    });
    expect(published.status).toBe(201);
    const monsterId = published.data.monster.id;

    const gmOnlyMonster = await api<{ monster: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/monsters`, {
      name: "SL-Biest",
      visibility: "gm_only",
      kind: "demon",
    });
    expect(gmOnlyMonster.status).toBe(201);
    const hiddenMonsterId = gmOnlyMonster.data.monster.id;

    expect(
      (
        await api(playerA, "POST", `/api/worlds/${worldId}/map/monster-markers`, {
          mapId,
          monsterId,
          posX: 0.2,
          posY: 0.2,
        })
      ).status,
    ).toBe(403);

    const place1 = await api<{ marker: { id: string; visibility: string; rarity: string } }>(
      gm,
      "POST",
      `/api/worlds/${worldId}/map/monster-markers`,
      { mapId, monsterId, posX: 0.25, posY: 0.26, visibility: "published" },
    );
    expect(place1.status).toBe(201);
    expect(place1.data.marker.visibility).toBe("owner_only");
    expect(place1.data.marker.rarity).toBe("uncommon");

    const place2 = await api<{ marker: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/map/monster-markers`, {
      mapId,
      monsterId,
      posX: 0.3,
      posY: 0.31,
    });
    const place3 = await api<{ marker: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/map/monster-markers`, {
      mapId,
      monsterId,
      posX: 0.4,
      posY: 0.41,
    });
    expect(place2.status).toBe(201);
    expect(place3.status).toBe(201);

    const gmState = await api<MapState>(gm, "GET", `/api/worlds/${worldId}/map?map=${mapId}`);
    expect(gmState.data.monsterMarkers.filter((row) => row.monsterId === monsterId)).toHaveLength(3);

    const playerState = await api<MapState>(playerA, "GET", `/api/worlds/${worldId}/map?map=${mapId}`);
    expect(playerState.data.monsterMarkers.some((row) => row.monsterId === monsterId)).toBe(false);

    expect(
      (
        await api(gm, "PATCH", `/api/worlds/${worldId}/map/monster-markers/${place1.data.marker.id}`, {
          visibility: "gm_only",
        })
      ).status,
    ).toBe(200);
    expect(
      (await api<MapState>(gm, "GET", `/api/worlds/${worldId}/map?map=${mapId}`)).data.monsterMarkers.some(
        (row) => row.id === place1.data.marker.id,
      ),
    ).toBe(true);
    expect(
      (await api<MapState>(playerA, "GET", `/api/worlds/${worldId}/map?map=${mapId}`)).data.monsterMarkers.some(
        (row) => row.id === place1.data.marker.id,
      ),
    ).toBe(false);
    expect(
      (await api(playerA, "GET", `/api/worlds/${worldId}/map/monster-markers/${place1.data.marker.id}`)).status,
    ).toBe(404);

    const onHiddenMonster = await api<{ marker: { id: string } }>(
      gm,
      "POST",
      `/api/worlds/${worldId}/map/monster-markers`,
      { mapId, monsterId: hiddenMonsterId, posX: 0.5, posY: 0.5 },
    );
    expect(onHiddenMonster.status).toBe(201);
    expect(
      (
        await api(gm, "PATCH", `/api/worlds/${worldId}/map/monster-markers/${onHiddenMonster.data.marker.id}`, {
          visibility: "published",
        })
      ).status,
    ).toBe(200);
    expect(
      (await api<MapState>(playerA, "GET", `/api/worlds/${worldId}/map?map=${mapId}`)).data.monsterMarkers.some(
        (row) => row.id === onHiddenMonster.data.marker.id,
      ),
    ).toBe(false);
    expect(
      (await api(playerA, "GET", `/api/worlds/${worldId}/map/monster-markers/${onHiddenMonster.data.marker.id}`)).status,
    ).toBe(404);

    expect(
      (
        await api(gm, "PATCH", `/api/worlds/${worldId}/map/monster-markers/${place2.data.marker.id}`, {
          visibility: "published",
        })
      ).status,
    ).toBe(200);
    expect(
      (await api(playerA, "GET", `/api/worlds/${worldId}/map/monster-markers/${place2.data.marker.id}`)).status,
    ).toBe(200);

    expect(
      (
        await api(gm, "PATCH", `/api/worlds/${worldId}/map/monster-markers/${place1.data.marker.id}`, {
          monsterId,
        })
      ).status,
    ).toBe(400);

    const controller = new AbortController();
    const sse = await fetch(`${BASE}/api/worlds/${worldId}/events`, {
      headers: { cookie: gm.cookie, origin: BASE, accept: "text/event-stream" },
      signal: controller.signal,
    });
    expect(sse.ok).toBe(true);
    const reader = sse.body!.getReader();
    const decoder = new TextDecoder();
    // Drain hello
    await Promise.race([
      reader.read(),
      new Promise((r) => setTimeout(r, 500)),
    ]);

    const collected: string[] = [];
    const collect = (async () => {
      let buffer = "";
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && collected.filter((t) => t === "map.updated").length < 1) {
        const result = await Promise.race([
          reader.read(),
          new Promise<{ done: true; value: undefined }>((resolve) =>
            setTimeout(() => resolve({ done: true, value: undefined }), 200),
          ),
        ]);
        if (result.done && !result.value) continue;
        if (!result.value) continue;
        buffer += decoder.decode(result.value, { stream: true });
        for (const chunk of buffer.split("\n\n")) {
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(line.slice(6)) as { type?: string };
              if (parsed.type) collected.push(parsed.type);
            } catch {
              /* ignore */
            }
          }
        }
        buffer = buffer.includes("\n\n") ? buffer.split("\n\n").pop() ?? "" : buffer;
      }
    })();

    expect(
      (await api(gm, "PATCH", `/api/worlds/${worldId}/monsters/${monsterId}`, { visibility: "owner_only" }))
        .status,
    ).toBe(200);
    await collect;
    expect(collected).toContain("map.updated");

    collected.length = 0;
    const collectDelete = (async () => {
      let buffer = "";
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && !collected.includes("map.updated")) {
        const result = await Promise.race([
          reader.read(),
          new Promise<{ done: true; value: undefined }>((resolve) =>
            setTimeout(() => resolve({ done: true, value: undefined }), 200),
          ),
        ]);
        if (!result.value) continue;
        buffer += decoder.decode(result.value, { stream: true });
        for (const chunk of buffer.split("\n\n")) {
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(line.slice(6)) as { type?: string };
              if (parsed.type) collected.push(parsed.type);
            } catch {
              /* ignore */
            }
          }
        }
      }
    })();
    expect((await api(gm, "DELETE", `/api/worlds/${worldId}/monsters/${hiddenMonsterId}`)).status).toBe(200);
    await collectDelete;
    expect(collected).toContain("map.updated");
    const stateAfterDelete = await api<MapState>(gm, "GET", `/api/worlds/${worldId}/map?map=${mapId}`);
    expect(stateAfterDelete.data.monsterMarkers.some((row) => row.monsterId === hiddenMonsterId)).toBe(false);
    controller.abort();
  });

  it("copies monster markers with source visibility (K11)", async () => {
    const map = await createMapWithFile(gm, universeId, "Kopie-Karte");
    expect(map.status).toBe(201);
    const mapId = map.data.map?.id as string;
    expect((await mapApi(gm, "", "PATCH", { mapId, visibility: "published" })).status).toBe(200);

    const monster = await api<{ monster: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/monsters`, {
      name: "Kopierwolf",
      visibility: "published",
      kind: "beast",
    });
    expect(monster.status).toBe(201);

    const original = await api<{ marker: { id: string; visibility: string; ownerId: string } }>(
      gm,
      "POST",
      `/api/worlds/${worldId}/map/monster-markers`,
      { mapId, monsterId: monster.data.monster.id, posX: 0.1, posY: 0.1 },
    );
    expect(original.status).toBe(201);
    expect(
      (
        await api(gm, "PATCH", `/api/worlds/${worldId}/map/monster-markers/${original.data.marker.id}`, {
          visibility: "published",
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await api(playerA, "POST", `/api/worlds/${worldId}/map/monster-markers`, {
          sourceMarkerId: original.data.marker.id,
          posX: 0.2,
          posY: 0.2,
        })
      ).status,
    ).toBe(403);

    const copy = await api<{ marker: { id: string; visibility: string; ownerId: string; monsterId: string } }>(
      master,
      "POST",
      `/api/worlds/${worldId}/map/monster-markers`,
      { sourceMarkerId: original.data.marker.id, posX: 0.33, posY: 0.34 },
    );
    expect(copy.status).toBe(201);
    expect(copy.data.marker.visibility).toBe("published");
    expect(copy.data.marker.ownerId).toBe(master.user.id);
    expect(copy.data.marker.monsterId).toBe(monster.data.monster.id);
    expect(
      (await api<MapState>(playerA, "GET", `/api/worlds/${worldId}/map?map=${mapId}`)).data.monsterMarkers.some(
        (row) => row.id === copy.data.marker.id,
      ),
    ).toBe(true);

    const gmOnly = await api<{ marker: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/map/monster-markers`, {
      mapId,
      monsterId: monster.data.monster.id,
      posX: 0.4,
      posY: 0.4,
    });
    expect(gmOnly.status).toBe(201);
    expect(
      (
        await api(gm, "PATCH", `/api/worlds/${worldId}/map/monster-markers/${gmOnly.data.marker.id}`, {
          visibility: "gm_only",
        })
      ).status,
    ).toBe(200);
    const gmCopy = await api<{ marker: { visibility: string } }>(
      gm,
      "POST",
      `/api/worlds/${worldId}/map/monster-markers`,
      { sourceMarkerId: gmOnly.data.marker.id, posX: 0.45, posY: 0.45 },
    );
    expect(gmCopy.status).toBe(201);
    expect(gmCopy.data.marker.visibility).toBe("gm_only");

    const foreign = await api<{ marker: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/map/monster-markers`, {
      mapId,
      monsterId: monster.data.monster.id,
      posX: 0.55,
      posY: 0.55,
    });
    expect(foreign.status).toBe(201);
    // master cannot see gm's owner_only → 404
    expect(
      (
        await api(master, "POST", `/api/worlds/${worldId}/map/monster-markers`, {
          sourceMarkerId: foreign.data.marker.id,
          posX: 0.56,
          posY: 0.56,
        })
      ).status,
    ).toBe(404);
  });
});
