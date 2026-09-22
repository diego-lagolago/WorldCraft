/** Spike T-010 — Kanäle, Threads und Nachrichten für alle angemeldeten Tester. */

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { spikeChatChannels, spikeChatMessages, spikeChatThreads, users } from "@/db/schema";
import type {
  SpikeChatChannelDto,
  SpikeChatMessageDto,
  SpikeChatState,
  SpikeChatThreadDto,
  SpikeDiceDto,
} from "./types";

export const SPIKE_CHAT_HISTORY_LIMIT = 50;
export const SPIKE_CHAT_WORLD_KEY = "spike";
export const SPIKE_DEFAULT_CHANNEL_NAME = "Allgemein";

export function serializeChannel(
  row: typeof spikeChatChannels.$inferSelect,
): SpikeChatChannelDto {
  return { id: row.id, name: row.name, sort: row.sort };
}

export function serializeThread(
  row: typeof spikeChatThreads.$inferSelect,
): SpikeChatThreadDto {
  return {
    id: row.id,
    channelId: row.channelId,
    title: row.title,
    createdFromMessageId: row.createdFromMessageId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeChatMessage(
  row: typeof spikeChatMessages.$inferSelect,
): SpikeChatMessageDto {
  const dice: SpikeDiceDto | null =
    row.diceExpression != null && row.diceValues != null && row.diceSum != null
      ? {
          expression: row.diceExpression,
          values: row.diceValues,
          sum: row.diceSum,
        }
      : null;
  return {
    id: row.id,
    channelId: row.channelId,
    threadId: row.threadId,
    opensThreadId: row.opensThreadId,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    dice,
    sentAt: row.sentAt.toISOString(),
  };
}

export async function ensureDefaultChannel(): Promise<typeof spikeChatChannels.$inferSelect> {
  const [existing] = await db
    .select()
    .from(spikeChatChannels)
    .where(eq(spikeChatChannels.worldKey, SPIKE_CHAT_WORLD_KEY))
    .orderBy(asc(spikeChatChannels.sort), asc(spikeChatChannels.createdAt))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(spikeChatChannels)
    .values({
      worldKey: SPIKE_CHAT_WORLD_KEY,
      name: SPIKE_DEFAULT_CHANNEL_NAME,
      sort: 0,
    })
    .returning();
  return created;
}

export async function listChannels(): Promise<SpikeChatChannelDto[]> {
  await ensureDefaultChannel();
  const rows = await db
    .select()
    .from(spikeChatChannels)
    .where(eq(spikeChatChannels.worldKey, SPIKE_CHAT_WORLD_KEY))
    .orderBy(asc(spikeChatChannels.sort), asc(spikeChatChannels.createdAt));
  return rows.map(serializeChannel);
}

export async function getChannel(id: string) {
  const [row] = await db
    .select()
    .from(spikeChatChannels)
    .where(eq(spikeChatChannels.id, id))
    .limit(1);
  return row ?? null;
}

export async function listThreads(channelId: string): Promise<SpikeChatThreadDto[]> {
  const rows = await db
    .select()
    .from(spikeChatThreads)
    .where(eq(spikeChatThreads.channelId, channelId))
    .orderBy(desc(spikeChatThreads.createdAt));
  return rows.map(serializeThread);
}

export async function getThread(id: string) {
  const [row] = await db
    .select()
    .from(spikeChatThreads)
    .where(eq(spikeChatThreads.id, id))
    .limit(1);
  return row ?? null;
}

export async function insertThread(input: {
  channelId: string;
  title: string;
  createdFromMessageId?: string | null;
}): Promise<SpikeChatThreadDto> {
  const [row] = await db
    .insert(spikeChatThreads)
    .values({
      channelId: input.channelId,
      title: input.title,
      createdFromMessageId: input.createdFromMessageId ?? null,
    })
    .returning();
  return serializeThread(row);
}

export async function listRecentChatMessages(input: {
  channelId: string;
  threadId?: string | null;
}): Promise<SpikeChatMessageDto[]> {
  const threadFilter =
    input.threadId == null
      ? isNull(spikeChatMessages.threadId)
      : eq(spikeChatMessages.threadId, input.threadId);
  const rows = await db
    .select()
    .from(spikeChatMessages)
    .where(and(eq(spikeChatMessages.channelId, input.channelId), threadFilter))
    .orderBy(desc(spikeChatMessages.sentAt))
    .limit(SPIKE_CHAT_HISTORY_LIMIT);
  return rows.reverse().map(serializeChatMessage);
}

export async function insertChatMessage(input: {
  channelId: string;
  threadId?: string | null;
  opensThreadId?: string | null;
  authorId: string;
  authorName: string;
  body: string;
  dice?: SpikeDiceDto | null;
}): Promise<SpikeChatMessageDto> {
  const [row] = await db
    .insert(spikeChatMessages)
    .values({
      channelId: input.channelId,
      threadId: input.threadId ?? null,
      opensThreadId: input.opensThreadId ?? null,
      authorId: input.authorId,
      authorName: input.authorName,
      body: input.body,
      diceExpression: input.dice?.expression ?? null,
      diceValues: input.dice?.values ?? null,
      diceSum: input.dice?.sum ?? null,
    })
    .returning();
  return serializeChatMessage(row);
}

export async function createThreadWithParentPost(input: {
  channelId: string;
  title: string;
  authorId: string;
  authorName: string;
}): Promise<{ thread: SpikeChatThreadDto; message: SpikeChatMessageDto }> {
  const thread = await insertThread({
    channelId: input.channelId,
    title: input.title,
  });
  const message = await insertChatMessage({
    channelId: input.channelId,
    threadId: null,
    opensThreadId: thread.id,
    authorId: input.authorId,
    authorName: input.authorName,
    body: input.title,
  });
  const [updated] = await db
    .update(spikeChatThreads)
    .set({ createdFromMessageId: message.id })
    .where(eq(spikeChatThreads.id, thread.id))
    .returning();
  return {
    thread: serializeThread(updated),
    message,
  };
}

export async function getDicePostToChat(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ dicePostToChat: users.dicePostToChat })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.dicePostToChat ?? true;
}

export async function setDicePostToChat(userId: string, dicePostToChat: boolean): Promise<boolean> {
  const [row] = await db
    .update(users)
    .set({ dicePostToChat, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ dicePostToChat: users.dicePostToChat });
  return row?.dicePostToChat ?? dicePostToChat;
}

export async function loadSpikeChatState(input?: {
  channelId?: string;
  threadId?: string;
  userId?: string;
}): Promise<SpikeChatState> {
  const fallback = await ensureDefaultChannel();
  const channelRow = input?.channelId
    ? ((await getChannel(input.channelId)) ?? fallback)
    : fallback;
  const threadRow = input?.threadId ? await getThread(input.threadId) : null;
  const thread =
    threadRow && threadRow.channelId === channelRow.id ? serializeThread(threadRow) : null;
  const [channels, threads, messages, dicePostToChat] = await Promise.all([
    listChannels(),
    listThreads(channelRow.id),
    listRecentChatMessages({
      channelId: channelRow.id,
      threadId: thread?.id ?? null,
    }),
    input?.userId ? getDicePostToChat(input.userId) : Promise.resolve(true),
  ]);
  return {
    channel: serializeChannel(channelRow),
    thread,
    channels,
    threads,
    messages,
    dicePostToChat,
  };
}
