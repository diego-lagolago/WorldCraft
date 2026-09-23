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

    await api(gm, "PATCH", `/api/worlds/${worldId}/chat/settings`, { dicePostToChat: true });
    const dice = await chat(gm, "", "POST", {
      kind: "roll",
      terms: [{ n: 1, m: 20 }],
      channelId,
    });
    expect(dice.status).toBe(201);
    const diceId = (dice.data as { message?: ChatMessageDto }).message?.id;
    expect(diceId).toBeTruthy();
    expect((await api(playerA, "DELETE", `/api/worlds/${worldId}/chat/messages/${diceId}`)).status).toBe(403);
    expect((await api(gm, "DELETE", `/api/worlds/${worldId}/chat/messages/${diceId}`)).status).toBe(200);

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

  it("lets the author edit a text message and rejects forbidden edits", async () => {
    const state = await chat(gm);
    const channelId = state.data.channel?.id as string;
    const mine = await chat(playerA, "", "POST", { body: "bearbeit mich", channelId });
    expect(mine.status).toBe(201);
    const messageId = mine.data.message?.id as string;

    const edited = await api<{ message: ChatMessageDto }>(
      playerA,
      "PATCH",
      `/api/worlds/${worldId}/chat/messages/${messageId}`,
      { body: "bearbeitet" },
    );
    expect(edited.status).toBe(200);
    expect(edited.data.message.body).toBe("bearbeitet");
    expect(edited.data.message.editedAt).toBeTruthy();

    expect(
      (await api(gm, "PATCH", `/api/worlds/${worldId}/chat/messages/${messageId}`, { body: "gm" })).status,
    ).toBe(403);
    expect(
      (await api(master, "PATCH", `/api/worlds/${worldId}/chat/messages/${messageId}`, { body: "m" })).status,
    ).toBe(403);
    expect(
      (await api(playerA, "PATCH", `/api/worlds/${worldId}/chat/messages/${messageId}`, { body: "" })).status,
    ).toBe(422);
    expect(
      (
        await api(playerA, "PATCH", `/api/worlds/${worldId}/chat/messages/${messageId}`, {
          body: "x".repeat(2001),
        })
      ).status,
    ).toBe(422);
    const rollDenied = await api<{ error?: string }>(
      playerA,
      "PATCH",
      `/api/worlds/${worldId}/chat/messages/${messageId}`,
      { body: "/r 1d20" },
    );
    expect(rollDenied.status).toBe(422);
    expect(rollDenied.data.error).toMatch(/Würfelbefehle/);

    const after = await chat(playerA);
    const still = after.data.messages?.find((row) => row.id === messageId);
    expect(still?.body).toBe("bearbeitet");

    await api(gm, "PATCH", `/api/worlds/${worldId}/chat/settings`, { dicePostToChat: true });
    const dice = await chat(playerA, "", "POST", {
      kind: "roll",
      terms: [{ n: 1, m: 20 }],
      channelId,
    });
    const diceId = (dice.data as { message?: ChatMessageDto }).message?.id as string;
    expect(
      (await api(playerA, "PATCH", `/api/worlds/${worldId}/chat/messages/${diceId}`, { body: "x" })).status,
    ).toBe(422);

    const opened = await api<{ thread: { id: string }; message: ChatMessageDto }>(
      playerA,
      "POST",
      `/api/worlds/${worldId}/chat/threads`,
      { channelId, title: "Edit-Thread" },
    );
    expect(
      (
        await api(playerA, "PATCH", `/api/worlds/${worldId}/chat/messages/${opened.data.message.id}`, {
          body: "x",
        })
      ).status,
    ).toBe(422);
  });

  it("renames threads for creator and staff; rejects others and bad titles", async () => {
    const state = await chat(gm);
    const channelId = state.data.channel?.id as string;
    const created = await api<{ thread: { id: string; title: string }; message: ChatMessageDto }>(
      playerA,
      "POST",
      `/api/worlds/${worldId}/chat/threads`,
      { channelId, title: "Umbenenn-Mich" },
    );
    expect(created.status).toBe(201);
    expect(created.data.message.body).toBeNull();

    const byCreator = await api<{ thread: { title: string } }>(
      playerA,
      "PATCH",
      `/api/worlds/${worldId}/chat/threads/${created.data.thread.id}`,
      { title: "Von Player" },
    );
    expect(byCreator.status).toBe(200);
    expect(byCreator.data.thread.title).toBe("Von Player");

    const byStaff = await api<{ thread: { title: string } }>(
      gm,
      "PATCH",
      `/api/worlds/${worldId}/chat/threads/${created.data.thread.id}`,
      { title: "Von GM" },
    );
    expect(byStaff.status).toBe(200);
    expect(byStaff.data.thread.title).toBe("Von GM");

    expect(
      (
        await api(master, "PATCH", `/api/worlds/${worldId}/chat/threads/${created.data.thread.id}`, {
          title: "von Master ok",
        })
      ).status,
    ).toBe(200);

    const foreign = await api<{ thread: { id: string } }>(
      master,
      "POST",
      `/api/worlds/${worldId}/chat/threads`,
      { channelId, title: "Master-Thread" },
    );
    expect(
      (
        await api(playerA, "PATCH", `/api/worlds/${worldId}/chat/threads/${foreign.data.thread.id}`, {
          title: "hack",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await api(playerA, "PATCH", `/api/worlds/${worldId}/chat/threads/${created.data.thread.id}`, {
          title: "",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await api(playerA, "PATCH", `/api/worlds/${worldId}/chat/threads/${created.data.thread.id}`, {
          title: "x".repeat(81),
        })
      ).status,
    ).toBe(422);

    const [{ badOpener }] = await sql<{ badOpener: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM chat_messages
        WHERE opens_thread_id IS NOT NULL AND body IS NOT NULL
          AND world_id = ${worldId}
      ) AS "badOpener"
    `;
    expect(badOpener).toBe(false);
  });
});


describe("CR-013 / CR-014 chat channel edge cases", () => {
  let edgeWorldId = "";
  let edgeGm: TestSession;
  let edgePlayer: TestSession;

  beforeAll(async () => {
    edgeGm = gm;
    edgePlayer = playerA;
    const created = await api<{ id: string }>(edgeGm, "POST", "/api/worlds", {
      name: `Chat-Edge ${Date.now()}`,
    });
    expect(created.status).toBe(201);
    edgeWorldId = created.data.id;
    await sql`
      INSERT INTO memberships (world_id, user_id, role, created_by, updated_by)
      VALUES (${edgeWorldId}, ${edgePlayer.user.id}, 'player', ${edgeGm.user.id}, ${edgeGm.user.id})
    `;
  });

  afterAll(async () => {
    if (edgeWorldId) await sql`DELETE FROM worlds WHERE id = ${edgeWorldId}`;
  });

  it("CR-013: parallel archives leave exactly one active channel", async () => {
    const second = await api<{ id: string }>(edgeGm, "POST", `/api/worlds/${edgeWorldId}/chat/channels`, {
      name: "Zweiter",
    });
    expect(second.status).toBe(201);
    const state = await api<ChatState>(edgeGm, "GET", `/api/worlds/${edgeWorldId}/chat`);
    expect(state.status).toBe(200);
    expect(state.data.channels).toHaveLength(2);
    const [a, b] = state.data.channels;
    const results = await Promise.all([
      api(edgeGm, "PATCH", `/api/worlds/${edgeWorldId}/chat/channels/${a!.id}`, { action: "archive" }),
      api(edgeGm, "PATCH", `/api/worlds/${edgeWorldId}/chat/channels/${b!.id}`, { action: "archive" }),
    ]);
    const statuses = results.map((row) => row.status).sort();
    expect(statuses).toEqual([200, 409]);
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM chat_channels
      WHERE world_id = ${edgeWorldId} AND archived_at IS NULL
    `;
    expect(Number(n)).toBe(1);
  });

  it("CR-014: GET chat with no active channel returns empty state without insert", async () => {
    await sql`
      UPDATE chat_channels SET archived_at = now()
      WHERE world_id = ${edgeWorldId} AND archived_at IS NULL
    `;
    const before = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM chat_channels
      WHERE world_id = ${edgeWorldId} AND archived_at IS NULL
    `;
    expect(Number(before[0]!.n)).toBe(0);

    const staffView = await api<ChatState>(edgeGm, "GET", `/api/worlds/${edgeWorldId}/chat`);
    expect(staffView.status).toBe(200);
    expect(staffView.data.channel).toBeNull();
    expect(staffView.data.channels).toEqual([]);
    expect(staffView.data.messages).toEqual([]);
    expect(staffView.data.archivedChannels.length).toBeGreaterThan(0);

    const playerView = await api<ChatState>(edgePlayer, "GET", `/api/worlds/${edgeWorldId}/chat`);
    expect(playerView.status).toBe(200);
    expect(playerView.data.channel).toBeNull();
    expect(playerView.data.channels).toEqual([]);
    expect(playerView.data.archivedChannels).toEqual([]);

    const after = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM chat_channels
      WHERE world_id = ${edgeWorldId} AND archived_at IS NULL
    `;
    expect(Number(after[0]!.n)).toBe(0);
  });
});
