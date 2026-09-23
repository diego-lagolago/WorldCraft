/**
 * CR-001 / CR-002 / CR-017: SSE visibility filter and membership.changed closes the stream.
 * Requires: ENABLE_TEST_LOGIN=true and a running `npm run dev`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, BASE, login, testSql, type TestSession } from "@/test/api-harness";

const sql = testSql();
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let playerB: TestSession;
let worldId = "";
let universeId = "";
let mapId = "";
let masterMembershipId = "";
let playerMembershipId = "";

beforeAll(async () => {
  try {
    await fetch(`${BASE}/api/test-login`, { method: "OPTIONS" });
  } catch {
    throw new Error(`Kein Dev-Server unter ${BASE}. Bitte npm run dev, dann npm run test:rechte.`);
  }
  [gm, master, playerA, playerB] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-a"),
    login("test-player-b"),
  ]);
  const created = await api<{ id: string }>(gm, "POST", "/api/worlds", {
    name: `SSE-Test ${Date.now()}`,
  });
  expect(created.status).toBe(201);
  worldId = created.data.id;
  await sql`
    INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
    VALUES
      (${worldId}, ${master.user.id}, 'master', ${gm.user.id}, ${gm.user.id}),
      (${worldId}, ${playerA.user.id}, 'player', ${gm.user.id}, ${gm.user.id}),
      (${worldId}, ${playerB.user.id}, 'player', ${gm.user.id}, ${gm.user.id})
  `;
  const world = await api<{
    universes: { id: string }[];
    members?: { membershipId: string; userId: string }[];
  }>(gm, "GET", `/api/worlds/${worldId}`);
  universeId = world.data.universes[0]!.id;
  const members = await api<{ members: { membershipId: string; userId: string }[] }>(
    gm,
    "GET",
    `/api/worlds/${worldId}/members`,
  );
  masterMembershipId = members.data.members.find((m) => m.userId === master.user.id)!.membershipId;
  playerMembershipId = members.data.members.find((m) => m.userId === playerA.user.id)!.membershipId;

  const form = new FormData();
  form.set("universeId", universeId);
  form.set("name", "SSE-Karte");
  form.set("image", new Blob([PNG], { type: "image/png" }), "map.png");
  const mapRes = await fetch(`${BASE}/api/worlds/${worldId}/map`, {
    method: "POST",
    headers: { cookie: gm.cookie, origin: BASE },
    body: form,
  });
  const mapData = (await mapRes.json()) as { map?: { id: string } };
  expect(mapRes.status).toBe(201);
  mapId = mapData.map!.id;
});

afterAll(async () => {
  if (worldId) await sql`DELETE FROM worlds WHERE id = ${worldId}`;
  await sql.end();
});

type SseEvent = { type: string; [key: string]: unknown };

async function openSse(session: TestSession) {
  const controller = new AbortController();
  const res = await fetch(`${BASE}/api/worlds/${worldId}/events`, {
    headers: { cookie: session.cookie, origin: BASE, accept: "text/event-stream" },
    signal: controller.signal,
  });
  if (!res.ok || !res.body) {
    controller.abort();
    throw new Error(`SSE open failed (${res.status})`);
  }
  return { res, controller, reader: res.body.getReader(), decoder: new TextDecoder() };
}

async function readSseEvents(
  stream: Awaited<ReturnType<typeof openSse>>,
  count: number,
  timeoutMs = 4000,
): Promise<SseEvent[]> {
  const events: SseEvent[] = [];
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  while (events.length < count && Date.now() < deadline) {
    const remaining = Math.max(50, deadline - Date.now());
    const result = await Promise.race([
      stream.reader.read(),
      new Promise<{ done: true; value: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), remaining),
      ),
    ]);
    if (result.done && result.value === undefined && Date.now() >= deadline) break;
    if (result.done) break;
    if (!result.value) continue;
    buffer += stream.decoder.decode(result.value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          events.push(JSON.parse(line.slice(6)) as SseEvent);
        } catch {
          /* ignore */
        }
      }
      if (events.length >= count) break;
    }
  }
  return events;
}

async function drainUntilClosed(stream: Awaited<ReturnType<typeof openSse>>, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = Math.max(50, deadline - Date.now());
    const result = await Promise.race([
      stream.reader.read(),
      new Promise<{ done: true; value: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), remaining),
      ),
    ]);
    if (result.done) return true;
  }
  return false;
}

describe("SSE events (CR-001 / CR-002 / CR-017)", () => {
  it("filters gm_only pin events: master gets map.pin, player gets none or deleted on hide", async () => {
    const masterStream = await openSse(master);
    const playerStream = await openSse(playerA);
    await readSseEvents(masterStream, 1);
    await readSseEvents(playerStream, 1);

    const created = await api<{ pin: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/map/pins`, {
      mapId,
      pinType: "location",
      title: "Geheim",
      posX: 0.2,
      posY: 0.3,
      visibility: "gm_only",
    });
    expect(created.status).toBe(201);
    const pinId = created.data.pin.id;

    const masterEvents = await readSseEvents(masterStream, 1);
    const playerEvents = await readSseEvents(playerStream, 1, 1500);
    expect(masterEvents.some((e) => e.type === "map.pin" && e.pinId === pinId)).toBe(true);
    expect(playerEvents.some((e) => e.type === "map.pin" && e.pinId === pinId)).toBe(false);
    expect(playerEvents.some((e) => e.type === "map.pin.deleted" && e.pinId === pinId)).toBe(false);

    const published = await api(gm, "PATCH", `/api/worlds/${worldId}/map/pins/${pinId}`, {
      visibility: "published",
    });
    expect(published.status).toBe(200);
    await readSseEvents(masterStream, 1);
    await readSseEvents(playerStream, 1);

    const hidden = await api(gm, "PATCH", `/api/worlds/${worldId}/map/pins/${pinId}`, {
      visibility: "gm_only",
    });
    expect(hidden.status).toBe(200);
    const hideMaster = await readSseEvents(masterStream, 1);
    const hidePlayer = await readSseEvents(playerStream, 1);
    expect(hideMaster.some((e) => e.type === "map.pin" && e.pinId === pinId)).toBe(true);
    expect(hidePlayer.some((e) => e.type === "map.pin.deleted" && e.pinId === pinId)).toBe(true);

    masterStream.controller.abort();
    playerStream.controller.abort();
  });

  it("closes the stream when a member is removed (CR-002)", async () => {
    const stream = await openSse(playerA);
    await readSseEvents(stream, 1);

    expect((await api(gm, "DELETE", `/api/worlds/${worldId}/members/${playerMembershipId}`)).status).toBe(200);
    const closed = await drainUntilClosed(stream);
    expect(closed).toBe(true);

    const channels = await api(gm, "GET", `/api/worlds/${worldId}/chat`);
    expect(channels.status).toBe(200);
    const channelId = (channels.data as { channel?: { id: string } }).channel?.id;
    if (channelId) {
      await api(gm, "POST", `/api/worlds/${worldId}/chat/messages`, {
        channelId,
        body: "nach remove",
      });
    }

    await sql`
      UPDATE memberships SET archived_at = NULL, updated_at = now()
      WHERE id = ${playerMembershipId}
    `;
  });

  it("closes the stream on leave (CR-002)", async () => {
    const stream = await openSse(playerB);
    await readSseEvents(stream, 1);
    expect((await api(playerB, "POST", `/api/worlds/${worldId}/leave`)).status).toBe(200);
    expect(await drainUntilClosed(stream)).toBe(true);
  });

  it("closes the stream on role demotion; reconnect filters as player (CR-017)", async () => {
    const stream = await openSse(master);
    await readSseEvents(stream, 1);

    expect(
      (await api(gm, "PATCH", `/api/worlds/${worldId}/members/${masterMembershipId}`, { role: "player" })).status,
    ).toBe(200);
    expect(await drainUntilClosed(stream)).toBe(true);

    const reconnect = await openSse(master);
    await readSseEvents(reconnect, 1);
    const created = await api<{ pin: { id: string } }>(gm, "POST", `/api/worlds/${worldId}/map/pins`, {
      mapId,
      pinType: "location",
      title: "Nach Demotion",
      posX: 0.5,
      posY: 0.5,
      visibility: "gm_only",
    });
    expect(created.status).toBe(201);
    const after = await readSseEvents(reconnect, 1, 1500);
    expect(after.some((e) => e.type === "map.pin" && e.pinId === created.data.pin.id)).toBe(false);
    reconnect.controller.abort();

    await api(gm, "PATCH", `/api/worlds/${worldId}/members/${masterMembershipId}`, { role: "master" });
  });
});
