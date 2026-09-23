import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, BASE, login, testSql, type TestSession } from "@/test/api-harness";
import type { ChatMessageDto, ChatState } from "@/lib/chat/types";

const sql = testSql();
let gm: TestSession;
let master: TestSession;
let playerA: TestSession;
let outsider: TestSession;
let worldId: string;
let otherWorldId: string;

beforeAll(async () => {
  [gm, master, playerA, outsider] = await Promise.all([
    login("test-gm"),
    login("test-master"),
    login("test-player-a"),
    login("test-player-b"),
  ]);
  const created = await api<{ id: string }>(gm, "POST", "/api/worlds", { name: "Chat-Testwelt" });
  if (created.status !== 201 || !created.data.id) {
    throw new Error(`Welt anlegen fehlgeschlagen (${created.status})`);
  }
  worldId = created.data.id;
  await sql`
    INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
    VALUES
      (${worldId}, ${master.user.id}, 'master', ${gm.user.id}, ${gm.user.id}),
      (${worldId}, ${playerA.user.id}, 'player', ${gm.user.id}, ${gm.user.id})
  `;
  const other = await api<{ id: string }>(outsider, "POST", "/api/worlds", { name: "Chat-Andere-Welt" });
  if (other.status !== 201 || !other.data.id) throw new Error("zweite Welt fehlgeschlagen");
  otherWorldId = other.data.id;
});

afterAll(async () => {
  await sql`DELETE FROM worlds WHERE id IN (${worldId}, ${otherWorldId})`;
  await sql.end();
});

function chat(session: TestSession | null, path = "", method = "GET", body?: unknown) {
  return api<ChatState & { error?: string; message?: ChatMessageDto; posted?: boolean; channels?: { id: string; name: string }[] }>(
    session,
    method,
    `/api/worlds/${worldId}/chat${path}`,
    body,
  );
}

describe("Produkt-Chat", () => {
  it("rejects a non-member and an invalid channel id", async () => {
    const denied = await chat(outsider);
    expect(denied.status).toBe(403);
    const bad = await chat(gm, "?channelId=abc&before=xyz");
    expect(bad.status).toBe(400);
    const invalidJson = await fetch(`${BASE}/api/worlds/${worldId}/chat`, {
      method: "POST",
      headers: { cookie: gm.cookie, origin: BASE, "content-type": "application/json" },
      body: "{",
    });
    expect(invalidJson.status).toBe(400);
  });

  it("posts text, hides it from another world, and keeps the last page on reload", async () => {
    const state = await chat(gm);
    expect(state.status).toBe(200);
    const channelId = state.data.channel?.id;
    expect(channelId).toBeTruthy();
    const sent = await chat(playerA, "", "POST", { body: "Hallo aus der Testwelt", channelId });
    expect(sent.status).toBe(201);
    const again = await chat(master);
    expect(again.data.messages?.some((row) => row.body === "Hallo aus der Testwelt")).toBe(true);
    const other = await api<ChatState>(outsider, "GET", `/api/worlds/${otherWorldId}/chat`);
    expect(other.status).toBe(200);
    expect(other.data.messages?.some((row) => row.body === "Hallo aus der Testwelt")).toBe(false);
  });

  it("rejects 2d7 and a client-supplied result without storing a roll", async () => {
    const state = await chat(gm);
    const channelId = state.data.channel?.id;
    const before = state.data.messages?.length ?? 0;
    const bad = await chat(gm, "", "POST", { body: "/roll 2d7", channelId });
    expect(bad.status).toBe(400);
    const forged = await chat(gm, "", "POST", { body: "geschmiedet", channelId, diceSum: 12 });
    expect(forged.status).toBe(400);
    const after = await chat(gm);
    expect(after.data.messages?.length).toBe(before);
  });

  it("does not post /roll when the switch is off", async () => {
    const state = await chat(playerA);
    const channelId = state.data.channel?.id;
    const setting = await api(playerA, "PATCH", `/api/worlds/${worldId}/chat/settings`, {
      dicePostToChat: false,
    });
    expect(setting.status).toBe(200);
    const rolled = await chat(playerA, "", "POST", { body: "/roll 2d6+3", channelId });
    expect(rolled.status).toBe(200);
    expect(rolled.data.posted).toBe(false);
    const after = await chat(playerA);
    expect(after.data.messages?.some((row) => row.dice && row.authorId === playerA.user.id)).toBe(false);
    await api(playerA, "PATCH", `/api/worlds/${worldId}/chat/settings`, { dicePostToChat: true });
  });

  it("enforces delete rules and channel administration", async () => {
    const state = await chat(gm);
    const channelId = state.data.channel?.id as string;
    const mine = await chat(playerA, "", "POST", { body: "lösch mich", channelId });
    const messageId = mine.data.message?.id as string;
    const foreign = await chat(master, "", "POST", { body: "bleibt erstmal", channelId });
    const foreignId = foreign.data.message?.id as string;
    expect((await api(playerA, "DELETE", `/api/worlds/${worldId}/chat/messages/${foreignId}`)).status).toBe(403);
    expect((await api(playerA, "DELETE", `/api/worlds/${worldId}/chat/messages/${messageId}`)).status).toBe(200);
    expect((await api(master, "DELETE", `/api/worlds/${worldId}/chat/messages/${foreignId}`)).status).toBe(200);

    const dice = await chat(gm, "", "POST", {
      kind: "roll",
      terms: [{ n: 1, m: 20 }],
      channelId,
    });
    expect(dice.status).toBe(201);
    const diceId = (dice.data as { message?: ChatMessageDto }).message?.id;
    expect(diceId).toBeTruthy();
    expect((await api(gm, "DELETE", `/api/worlds/${worldId}/chat/messages/${diceId}`)).status).toBe(403);

    expect((await api(playerA, "POST", `/api/worlds/${worldId}/chat/channels`, { name: "Taverne" })).status).toBe(403);
    const created = await api<{ id: string; name: string }>(master, "POST", `/api/worlds/${worldId}/chat/channels`, {
      name: "Taverne",
    });
    expect(created.status).toBe(201);
    const renamed = await api(master, "PATCH", `/api/worlds/${worldId}/chat/channels/${created.data.id}`, {
      action: "rename",
      name: "Markt",
    });
    expect(renamed.status).toBe(200);
    const duplicate = await api(master, "POST", `/api/worlds/${worldId}/chat/channels`, { name: "Markt" });
    expect(duplicate.status).toBe(409);

    const listed = await chat(master);
    const ids = listed.data.channels.map((channel) => channel.id);
    const reversed = [...ids].reverse();
    expect((await api(playerA, "PUT", `/api/worlds/${worldId}/chat/channels`, { channelIds: reversed })).status).toBe(403);
    expect((await api(master, "PUT", `/api/worlds/${worldId}/chat/channels`, { channelIds: reversed })).status).toBe(200);

    const general = listed.data.channels.find((channel) => channel.name === "Allgemein");
    expect(general).toBeTruthy();
    expect(
      (await api(master, "PATCH", `/api/worlds/${worldId}/chat/channels/${general!.id}`, { action: "archive" })).status,
    ).toBe(200);
    const only = await chat(master);
    expect((await api(master, "PATCH", `/api/worlds/${worldId}/chat/channels/${only.data.channel?.id}`, { action: "archive" })).status).toBe(409);

    const playerView = await chat(playerA);
    expect(playerView.data.channels.some((channel) => channel.name === "Allgemein")).toBe(false);
    expect(playerView.data.archivedChannels).toEqual([]);
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM chat_messages WHERE channel_id = ${general!.id}
    `;
    expect(Number(n)).toBeGreaterThan(0);
    expect(
      (await api(master, "PATCH", `/api/worlds/${worldId}/chat/channels/${general!.id}`, { action: "restore" })).status,
    ).toBe(200);
    const restored = await chat(playerA);
    expect(restored.data.channels.some((channel) => channel.name === "Allgemein")).toBe(true);
  });

  it("opens a thread in one stream and refuses to delete the opener", async () => {
    const state = await chat(gm);
    const channelId = state.data.channels.find((channel) => channel.name === "Allgemein")?.id ?? state.data.channel?.id;
    const created = await api<{ thread: { id: string }; message: ChatMessageDto }>(
      playerA,
      "POST",
      `/api/worlds/${worldId}/chat/threads`,
      { channelId, title: "Nachtwache" },
    );
    expect(created.status).toBe(201);
    expect(
      (await api(gm, "DELETE", `/api/worlds/${worldId}/chat/messages/${created.data.message.id}`)).status,
    ).toBe(403);
    const threadStream = await chat(playerA, `?channelId=${channelId}&threadId=${created.data.thread.id}`);
    expect(threadStream.status).toBe(200);
    expect(threadStream.data.thread?.title).toBe("Nachtwache");
    const reply = await chat(master, "", "POST", {
      body: "Ich übernehme die erste Wache",
      channelId,
      threadId: created.data.thread.id,
    });
    expect(reply.status).toBe(201);
  });
});
