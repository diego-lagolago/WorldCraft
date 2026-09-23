import { describe, expect, it } from "vitest";
import { withEditedMessage, withMessage, withThread } from "./stream-state";
import type { ChatMessageDto, ChatState, ChatThreadDto } from "./types";

const channelId = "chan-1";
const threadId = "thread-1";

function message(overrides: Partial<ChatMessageDto> & Pick<ChatMessageDto, "id">): ChatMessageDto {
  return {
    channelId,
    threadId: null,
    opensThreadId: null,
    authorId: "u1",
    authorName: "Ada",
    authorImage: null,
    body: "hi",
    dice: null,
    sentAt: "2026-01-01T00:00:00.000Z",
    editedAt: null,
    ...overrides,
  };
}

function thread(overrides: Partial<ChatThreadDto> = {}): ChatThreadDto {
  return {
    id: threadId,
    channelId,
    title: "Thread",
    createdFromMessageId: "msg-opener",
    createdBy: "u1",
    replyCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function emptyState(overrides: Partial<ChatState> = {}): ChatState {
  return {
    actorId: "u1",
    role: "player",
    staff: false,
    channel: { id: channelId, name: "Allgemein", sortOrder: 0, archivedAt: null },
    thread: null,
    channels: [],
    archivedChannels: [],
    threads: [thread()],
    messages: [],
    hasMore: false,
    dicePostToChat: true,
    ...overrides,
  };
}

describe("withMessage", () => {
  it("appends a new message in the open stream", () => {
    const state = emptyState();
    const next = withMessage(state, message({ id: "m1", body: "neu" }));
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]?.body).toBe("neu");
    expect(next.threads[0]?.replyCount).toBe(0);
  });

  it("increments replyCount only for an unknown thread reply", () => {
    const state = emptyState();
    const next = withMessage(
      state,
      message({ id: "m2", threadId, channelId, body: "antwort" }),
    );
    expect(next.messages).toHaveLength(0);
    expect(next.threads[0]?.replyCount).toBe(1);
  });

  it("ignores a known message id (no replace, no replyCount bump)", () => {
    const existing = message({ id: "m1", body: "alt" });
    const state = emptyState({ messages: [existing], threads: [thread({ replyCount: 2 })] });
    const next = withMessage(state, message({ id: "m1", body: "neu", threadId }));
    expect(next).toBe(state);
    expect(next.messages[0]?.body).toBe("alt");
    expect(next.threads[0]?.replyCount).toBe(2);
  });
});

describe("withEditedMessage", () => {
  it("returns the same state for an unknown id", () => {
    const state = emptyState({
      messages: [message({ id: "m1" })],
      threads: [thread({ replyCount: 3 })],
    });
    const next = withEditedMessage(state, message({ id: "other", body: "x", threadId }));
    expect(next).toBe(state);
    expect(next.messages).toHaveLength(1);
    expect(next.threads[0]?.replyCount).toBe(3);
  });

  it("replaces a known message at the same position", () => {
    const state = emptyState({
      messages: [message({ id: "a", body: "1" }), message({ id: "b", body: "2" })],
    });
    const next = withEditedMessage(state, message({ id: "a", body: "edited", editedAt: "2026-02-01T00:00:00.000Z" }));
    expect(next.messages.map((row) => row.body)).toEqual(["edited", "2"]);
    expect(next.messages[0]?.editedAt).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("withThread", () => {
  it("replaces a known thread including the open thread", () => {
    const open = thread({ title: "Alt" });
    const state = emptyState({ threads: [open], thread: open });
    const next = withThread(state, thread({ title: "Neu" }));
    expect(next.threads[0]?.title).toBe("Neu");
    expect(next.thread?.title).toBe("Neu");
  });

  it("prepends an unknown thread", () => {
    const state = emptyState();
    const next = withThread(state, thread({ id: "thread-2", title: "Neu" }));
    expect(next.threads.map((row) => row.id)).toEqual(["thread-2", threadId]);
  });
});
