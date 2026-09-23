import { and, asc, desc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { chatChannels, chatMessages, chatThreads, users } from "@/db/schema";
import {
  authorizeDeleteChatMessage,
  fail,
  isStaff,
  ok,
  requireStaff,
  type AuthzResult,
  type MembershipRole,
  type MembershipRow,
} from "@/lib/authz";
import { FIRST_CHANNEL_NAME } from "@/lib/domain/worlds";
import { mapDbError } from "@/lib/domain/db-errors";
import { parseStoredDiceTerms, type StoredDiceTerm } from "@/lib/chat/dice-format";
import type { RolledDice } from "@/lib/chat/dice";
import { worldEvents } from "@/lib/realtime/events";
import {
  CHAT_HISTORY_LIMIT,
  type ChatChannelDto,
  type ChatMessageDto,
  type ChatOlderPage,
  type ChatState,
  type ChatThreadDto,
} from "./types";

const NAME_TAKEN = "Ein aktiver Kanal mit diesem Namen existiert schon.";
const LAST_CHANNEL = "Der letzte aktive Kanal kann nicht archiviert werden.";

type ChannelRow = typeof chatChannels.$inferSelect;

function toChannel(row: ChannelRow): ChatChannelDto {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

function toThread(
  row: typeof chatThreads.$inferSelect,
  replyCount: number,
): ChatThreadDto {
  return {
    id: row.id,
    channelId: row.channelId,
    title: row.title,
    createdFromMessageId: row.createdFromMessageId,
    replyCount,
    createdAt: row.createdAt.toISOString(),
  };
}

type MessageJoin = {
  id: string;
  channelId: string;
  threadId: string | null;
  opensThreadId: string | null;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  body: string;
  diceExpression: string | null;
  diceTerms: unknown;
  diceSum: number | null;
  sentAt: Date;
};

function toMessage(row: MessageJoin): ChatMessageDto {
  const terms =
    row.diceExpression != null && row.diceTerms != null && row.diceSum != null
      ? parseStoredDiceTerms(row.diceTerms)
      : null;
  return {
    id: row.id,
    channelId: row.channelId,
    threadId: row.threadId,
    opensThreadId: row.opensThreadId,
    authorId: row.authorId,
    authorName: row.authorName,
    authorImage: row.authorImage,
    body: row.body,
    dice: terms
      ? { expression: row.diceExpression!, terms, sum: row.diceSum! }
      : null,
    sentAt: row.sentAt.toISOString(),
  };
}

function messageSelect() {
  return {
    id: chatMessages.id,
    channelId: chatMessages.channelId,
    threadId: chatMessages.threadId,
    opensThreadId: chatMessages.opensThreadId,
    authorId: chatMessages.authorId,
    authorName: users.name,
    authorImage: users.image,
    body: chatMessages.body,
    diceExpression: chatMessages.diceExpression,
    diceTerms: chatMessages.diceTerms,
    diceSum: chatMessages.diceSum,
    sentAt: chatMessages.sentAt,
  };
}

function streamFilter(channelId: string, threadId: string | null) {
  return and(
    eq(chatMessages.channelId, channelId),
    threadId == null ? isNull(chatMessages.threadId) : eq(chatMessages.threadId, threadId),
  );
}

async function firstActive(worldId: string): Promise<ChannelRow | null> {
  const [row] = await db
    .select()
    .from(chatChannels)
    .where(and(eq(chatChannels.worldId, worldId), isNull(chatChannels.archivedAt)))
    .orderBy(asc(chatChannels.sortOrder), asc(chatChannels.createdAt))
    .limit(1);
  return row ?? null;
}

/** Fills the default channel when world creation did not (APP-WORLD-CREATE). */
export async function ensureDefaultChannel(worldId: string, actorId: string): Promise<ChannelRow> {
  const existing = await firstActive(worldId);
  if (existing) return existing;
  try {
    const [created] = await db
      .insert(chatChannels)
      .values({
        worldId,
        name: FIRST_CHANNEL_NAME,
        sortOrder: 0,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();
    return created;
  } catch (error) {
    const again = await firstActive(worldId);
    if (again) return again;
    throw error;
  }
}

async function activeNameTaken(worldId: string, name: string, exceptId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: chatChannels.id })
    .from(chatChannels)
    .where(
      and(
        eq(chatChannels.worldId, worldId),
        isNull(chatChannels.archivedAt),
        sql`lower(${chatChannels.name}) = lower(${name})`,
      ),
    );
  return rows.some((row) => row.id !== exceptId);
}

async function channelInWorld(worldId: string, channelId: string): Promise<ChannelRow | null> {
  const [row] = await db
    .select()
    .from(chatChannels)
    .where(and(eq(chatChannels.id, channelId), eq(chatChannels.worldId, worldId)))
    .limit(1);
  return row ?? null;
}

export async function loadChatState(input: {
  worldId: string;
  actorId: string;
  role: MembershipRole;
  channelId: string | null;
  threadId: string | null;
}): Promise<AuthzResult<ChatState>> {
  await ensureDefaultChannel(input.worldId, input.actorId);
  const scope = await resolveScope(input.worldId, input.channelId, input.threadId);
  if (!scope.ok) return scope;

  const staff = isStaff(input.role);
  const [channelRows, archivedRows, threadRows, counts, recent, dicePostToChat] = await Promise.all([
    db
      .select()
      .from(chatChannels)
      .where(and(eq(chatChannels.worldId, input.worldId), isNull(chatChannels.archivedAt)))
      .orderBy(asc(chatChannels.sortOrder), asc(chatChannels.createdAt)),
    staff
      ? db
          .select()
          .from(chatChannels)
          .where(and(eq(chatChannels.worldId, input.worldId), isNotNull(chatChannels.archivedAt)))
          .orderBy(asc(chatChannels.name))
      : Promise.resolve([] as ChannelRow[]),
    db
      .select({ thread: chatThreads })
      .from(chatThreads)
      .innerJoin(chatChannels, eq(chatThreads.channelId, chatChannels.id))
      .where(and(eq(chatChannels.worldId, input.worldId), isNull(chatChannels.archivedAt)))
      .orderBy(desc(chatThreads.createdAt)),
    db
      .select({
        threadId: chatMessages.threadId,
        replyCount: sql<number>`count(*)::int`,
      })
      .from(chatMessages)
      .innerJoin(chatChannels, eq(chatMessages.channelId, chatChannels.id))
      .where(and(eq(chatChannels.worldId, input.worldId), isNotNull(chatMessages.threadId)))
      .groupBy(chatMessages.threadId),
    listRecent(scope.data.channelId, scope.data.threadId),
    getDicePostToChat(input.actorId),
  ]);

  const countByThread = new Map(
    counts.map((row) => [row.threadId, Number(row.replyCount)]),
  );
  const threads = threadRows.map((row) => toThread(row.thread, countByThread.get(row.thread.id) ?? 0));
  const channel = channelRows.find((row) => row.id === scope.data.channelId) ?? null;
  const thread = scope.data.threadId
    ? (threads.find((row) => row.id === scope.data.threadId) ?? null)
    : null;
  if (scope.data.threadId && !thread) return fail(404, "Thread nicht gefunden.");

  return ok({
    actorId: input.actorId,
    role: input.role,
    staff,
    channel: channel ? toChannel(channel) : null,
    thread,
    channels: channelRows.map(toChannel),
    archivedChannels: archivedRows.map(toChannel),
    threads,
    messages: recent.messages,
    hasMore: recent.hasMore,
    dicePostToChat,
  });
}

async function resolveScope(
  worldId: string,
  channelId: string | null,
  threadId: string | null,
): Promise<AuthzResult<{ channelId: string; threadId: string | null }>> {
  if (threadId) {
    const [thread] = await db
      .select({
        id: chatThreads.id,
        channelId: chatThreads.channelId,
        archivedAt: chatChannels.archivedAt,
        worldId: chatChannels.worldId,
      })
      .from(chatThreads)
      .innerJoin(chatChannels, eq(chatThreads.channelId, chatChannels.id))
      .where(eq(chatThreads.id, threadId))
      .limit(1);
    if (!thread || thread.worldId !== worldId || thread.archivedAt) {
      return fail(404, "Thread nicht gefunden.");
    }
    if (channelId && channelId !== thread.channelId) return fail(404, "Thread nicht gefunden.");
    return ok({ channelId: thread.channelId, threadId: thread.id });
  }

  if (!channelId) {
    const fallback = await firstActive(worldId);
    if (!fallback) return fail(404, "Kanal nicht gefunden.");
    return ok({ channelId: fallback.id, threadId: null });
  }

  const channel = await channelInWorld(worldId, channelId);
  if (!channel || channel.archivedAt) return fail(404, "Kanal nicht gefunden.");
  return ok({ channelId: channel.id, threadId: null });
}

async function listRecent(channelId: string, threadId: string | null) {
  const rows = await db
    .select(messageSelect())
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.authorId))
    .where(streamFilter(channelId, threadId))
    .orderBy(desc(chatMessages.sentAt), desc(chatMessages.id))
    .limit(CHAT_HISTORY_LIMIT + 1);
  const hasMore = rows.length > CHAT_HISTORY_LIMIT;
  const page = hasMore ? rows.slice(0, CHAT_HISTORY_LIMIT) : rows;
  return { messages: page.reverse().map(toMessage), hasMore };
}

export async function listOlderMessages(input: {
  worldId: string;
  channelId: string;
  threadId: string | null;
  beforeMessageId: string;
}): Promise<AuthzResult<ChatOlderPage>> {
  const scope = await resolveScope(input.worldId, input.channelId, input.threadId);
  if (!scope.ok) return scope;
  const [cursor] = await db
    .select(messageSelect())
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.authorId))
    .where(eq(chatMessages.id, input.beforeMessageId))
    .limit(1);
  if (!cursor || cursor.channelId !== scope.data.channelId || (cursor.threadId ?? null) !== scope.data.threadId) {
    return fail(404, "Cursor-Nachricht nicht gefunden.");
  }
  const older = or(
    lt(chatMessages.sentAt, cursor.sentAt),
    and(eq(chatMessages.sentAt, cursor.sentAt), lt(chatMessages.id, cursor.id)),
  );
  const rows = await db
    .select(messageSelect())
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.authorId))
    .where(and(streamFilter(scope.data.channelId, scope.data.threadId), older))
    .orderBy(desc(chatMessages.sentAt), desc(chatMessages.id))
    .limit(CHAT_HISTORY_LIMIT + 1);
  const hasMore = rows.length > CHAT_HISTORY_LIMIT;
  const page = hasMore ? rows.slice(0, CHAT_HISTORY_LIMIT) : rows;
  return ok({ messages: page.reverse().map(toMessage), hasMore });
}

async function fetchMessage(id: string): Promise<ChatMessageDto | null> {
  const [row] = await db
    .select(messageSelect())
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.authorId))
    .where(eq(chatMessages.id, id))
    .limit(1);
  return row ? toMessage(row) : null;
}

export async function postChatMessage(input: {
  worldId: string;
  channelId: string;
  threadId: string | null;
  authorId: string;
  body: string;
  dice?: RolledDice | null;
}): Promise<AuthzResult<{ message: ChatMessageDto }>> {
  const scope = await resolveScope(input.worldId, input.channelId, input.threadId);
  if (!scope.ok) return scope;
  const dice = input.dice ?? null;
  try {
    const [row] = await db
      .insert(chatMessages)
      .values({
        worldId: input.worldId,
        channelId: scope.data.channelId,
        threadId: scope.data.threadId,
        authorId: input.authorId,
        body: input.body,
        diceExpression: dice?.expression ?? null,
        diceTerms: dice ? (dice.terms as StoredDiceTerm[]) : null,
        diceSum: dice?.sum ?? null,
      })
      .returning({ id: chatMessages.id });
    const message = await fetchMessage(row.id);
    if (!message) return fail(404, "Diese Nachricht gibt es nicht.");
    worldEvents.publish({ type: "chat.message", worldId: input.worldId, message });
    return ok({ message });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function createThreadWithOpening(input: {
  worldId: string;
  channelId: string;
  actorId: string;
  title: string;
}): Promise<AuthzResult<{ thread: ChatThreadDto; message: ChatMessageDto }>> {
  const title = input.title.trim();
  if (!title || title.length > 80) return fail(400, "Der Thread-Titel muss 1 bis 80 Zeichen haben.");
  const channel = await channelInWorld(input.worldId, input.channelId);
  if (!channel || channel.archivedAt) return fail(404, "Kanal nicht gefunden.");

  try {
    const created = await db.transaction(async (tx) => {
      const [message] = await tx
        .insert(chatMessages)
        .values({
          worldId: input.worldId,
          channelId: channel.id,
          threadId: null,
          authorId: input.actorId,
          body: title,
        })
        .returning({ id: chatMessages.id });
      const [thread] = await tx
        .insert(chatThreads)
        .values({
          channelId: channel.id,
          title,
          createdFromMessageId: message.id,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })
        .returning({ id: chatThreads.id });
      await tx
        .update(chatMessages)
        .set({ opensThreadId: thread.id })
        .where(eq(chatMessages.id, message.id));
      return { messageId: message.id, threadId: thread.id };
    });
    const [message, threadRow] = await Promise.all([
      fetchMessage(created.messageId),
      db.select().from(chatThreads).where(eq(chatThreads.id, created.threadId)).limit(1),
    ]);
    if (!message || !threadRow[0]) return fail(404, "Thread nicht gefunden.");
    const thread = toThread(threadRow[0], 0);
    worldEvents.publish({ type: "chat.thread", worldId: input.worldId, thread });
    worldEvents.publish({ type: "chat.message", worldId: input.worldId, message });
    return ok({ thread, message });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function deleteChatMessage(input: {
  worldId: string;
  messageId: string;
  membership: MembershipRow;
}): Promise<AuthzResult<{ messageId: string }>> {
  const [row] = await db
    .select({
      id: chatMessages.id,
      authorId: chatMessages.authorId,
      channelId: chatMessages.channelId,
      threadId: chatMessages.threadId,
      opensThreadId: chatMessages.opensThreadId,
      diceExpression: chatMessages.diceExpression,
      worldId: chatMessages.worldId,
    })
    .from(chatMessages)
    .where(eq(chatMessages.id, input.messageId))
    .limit(1);
  if (!row || row.worldId !== input.worldId) return fail(404, "Diese Nachricht gibt es nicht.");
  const allowed = authorizeDeleteChatMessage(input.membership, {
    authorId: row.authorId,
    hasDice: row.diceExpression != null,
    opensThread: row.opensThreadId != null,
  });
  if (!allowed.ok) return allowed;
  await db.delete(chatMessages).where(eq(chatMessages.id, row.id));
  worldEvents.publish({
    type: "chat.message.deleted",
    worldId: input.worldId,
    messageId: row.id,
    channelId: row.channelId,
    threadId: row.threadId,
  });
  return ok({ messageId: row.id });
}

export async function createChannel(input: {
  membership: MembershipRow;
  actorId: string;
  worldId: string;
  name: string;
}): Promise<AuthzResult<ChatChannelDto>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const name = input.name.trim();
  if (!name || name.length > CHANNEL_NAME_MAX()) return fail(400, "Der Kanalname muss 1 bis 80 Zeichen haben.");
  if (await activeNameTaken(input.worldId, name)) return fail(409, NAME_TAKEN);
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${chatChannels.sortOrder}), -1)` })
    .from(chatChannels)
    .where(and(eq(chatChannels.worldId, input.worldId), isNull(chatChannels.archivedAt)));
  try {
    const [row] = await db
      .insert(chatChannels)
      .values({
        worldId: input.worldId,
        name,
        sortOrder: Number(maxRow?.max ?? -1) + 1,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning();
    worldEvents.publish({ type: "chat.channels", worldId: input.worldId });
    return ok(toChannel(row));
  } catch (error) {
    const mapped = mapDbError(error, { unique: NAME_TAKEN });
    if (mapped) return mapped;
    throw error;
  }
}

function CHANNEL_NAME_MAX() {
  return 80;
}

export async function updateChannel(input: {
  membership: MembershipRow;
  actorId: string;
  worldId: string;
  channelId: string;
  action: "rename" | "archive" | "restore";
  name?: string;
}): Promise<AuthzResult<ChatChannelDto>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const channel = await channelInWorld(input.worldId, input.channelId);
  if (!channel) return fail(404, "Kanal nicht gefunden.");

  if (input.action === "rename") {
    if (channel.archivedAt) return fail(404, "Dieser Kanal ist archiviert.");
    const name = (input.name ?? "").trim();
    if (!name || name.length > 80) return fail(400, "Der Kanalname muss 1 bis 80 Zeichen haben.");
    if (await activeNameTaken(input.worldId, name, channel.id)) return fail(409, NAME_TAKEN);
    try {
      const [row] = await db
        .update(chatChannels)
        .set({ name, updatedAt: new Date(), updatedBy: input.actorId })
        .where(eq(chatChannels.id, channel.id))
        .returning();
      worldEvents.publish({ type: "chat.channels", worldId: input.worldId });
      return ok(toChannel(row));
    } catch (error) {
      const mapped = mapDbError(error, { unique: NAME_TAKEN });
      if (mapped) return mapped;
      throw error;
    }
  }

  if (input.action === "archive") {
    if (channel.archivedAt) return fail(404, "Dieser Kanal ist archiviert.");
    const [countRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(chatChannels)
      .where(and(eq(chatChannels.worldId, input.worldId), isNull(chatChannels.archivedAt)));
    if (Number(countRow?.n ?? 0) <= 1) return fail(409, LAST_CHANNEL);
    const [row] = await db
      .update(chatChannels)
      .set({ archivedAt: new Date(), updatedAt: new Date(), updatedBy: input.actorId })
      .where(eq(chatChannels.id, channel.id))
      .returning();
    worldEvents.publish({ type: "chat.channels", worldId: input.worldId });
    return ok(toChannel(row));
  }

  if (!channel.archivedAt) return fail(404, "Dieser Kanal ist nicht archiviert.");
  if (await activeNameTaken(input.worldId, channel.name, channel.id)) return fail(409, NAME_TAKEN);
  try {
    const [row] = await db
      .update(chatChannels)
      .set({ archivedAt: null, updatedAt: new Date(), updatedBy: input.actorId })
      .where(eq(chatChannels.id, channel.id))
      .returning();
    worldEvents.publish({ type: "chat.channels", worldId: input.worldId });
    return ok(toChannel(row));
  } catch (error) {
    const mapped = mapDbError(error, { unique: NAME_TAKEN });
    if (mapped) return mapped;
    throw error;
  }
}

export async function reorderChannels(input: {
  membership: MembershipRow;
  actorId: string;
  worldId: string;
  channelIds: string[];
}): Promise<AuthzResult<{ channelIds: string[] }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const active = await db
    .select({ id: chatChannels.id })
    .from(chatChannels)
    .where(and(eq(chatChannels.worldId, input.worldId), isNull(chatChannels.archivedAt)));
  const current = new Set(active.map((row) => row.id));
  const unique = new Set(input.channelIds);
  if (
    input.channelIds.length !== active.length ||
    unique.size !== input.channelIds.length ||
    input.channelIds.some((id) => !current.has(id))
  ) {
    return fail(400, "Die Reihenfolge muss alle aktiven Kanäle genau einmal enthalten.");
  }
  await db.transaction(async (tx) => {
    for (let index = 0; index < input.channelIds.length; index += 1) {
      await tx
        .update(chatChannels)
        .set({ sortOrder: index, updatedAt: new Date(), updatedBy: input.actorId })
        .where(and(eq(chatChannels.id, input.channelIds[index]!), eq(chatChannels.worldId, input.worldId)));
    }
  });
  worldEvents.publish({ type: "chat.channels", worldId: input.worldId });
  return ok({ channelIds: input.channelIds });
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
