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

async function uploadMap(session: TestSession, id: string) {
  const form = new FormData();
  form.set("universeId", id);
  form.set("name", "Testkarte");
  form.set("image", new Blob([PNG], { type: "image/png" }), "map.png");
  const res = await fetch(`${BASE}/api/worlds/${worldId}/map`, {
    method: "POST",
    headers: { cookie: session.cookie, origin: BASE },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { map?: { id: string }; error?: string };
  return { status: res.status, data };
}

describe("Produkt-Karte", () => {
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
    const created = await uploadMap(gm, universeId);
    expect(created.status).toBe(201);
    const mapId = created.data.map?.id as string;
    expect(mapId).toBeTruthy();
    const second = await uploadMap(gm, universeId);
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
    const secretMap = await uploadMap(gm, secretUni.data.id);
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
      INSERT INTO articles (world_id, title, visibility, created_by, updated_by)
      VALUES (${worldId}, 'Gottschleim', 'published', ${gm.user.id}, ${gm.user.id})
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
