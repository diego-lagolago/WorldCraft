import { describe, expect, it } from "vitest";
import { messageCopyText, messagePreviewText, truncatePreview } from "./message-text";
import type { ChatMessageDto, ChatThreadDto } from "./types";

const threads: ChatThreadDto[] = [
  {
    id: "t1",
    channelId: "c1",
    title: "Drachenhöhle",
    createdFromMessageId: "m0",
    createdBy: "u1",
    replyCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

function msg(overrides: Partial<ChatMessageDto>): ChatMessageDto {
  return {
    id: "m1",
    channelId: "c1",
    threadId: null,
    opensThreadId: null,
    authorId: "u1",
    authorName: "Ada",
    authorImage: null,
    body: "Hallo **Welt**",
    dice: null,
    sentAt: "2026-01-01T00:00:00.000Z",
    editedAt: null,
    ...overrides,
  };
}

describe("messageCopyText / messagePreviewText", () => {
  it("copies markdown body for text messages", () => {
    const message = msg({});
    expect(messageCopyText(message, threads)).toBe("Hallo **Welt**");
    expect(messagePreviewText(message, threads)).toBe("Hallo **Welt**");
  });

  it("copies formatted dice rolls", () => {
    const message = msg({
      body: null,
      dice: {
        expression: "1d20",
        terms: [{ sides: 20, sign: 1, values: [15] }],
        sum: 15,
      },
    });
    expect(messageCopyText(message, threads)).toBe("1d20 → [15] = 15");
    expect(messagePreviewText(message, threads)).toBe("1d20 → [15] = 15");
  });

  it("copies the thread title for openers; preview adds the emoji", () => {
    const message = msg({ body: null, opensThreadId: "t1" });
    expect(messageCopyText(message, threads)).toBe("Drachenhöhle");
    expect(messagePreviewText(message, threads)).toBe("🧵 Drachenhöhle");
  });
});

describe("truncatePreview", () => {
  it("truncates past the max with an ellipsis", () => {
    expect(truncatePreview("abcdefghij", 5)).toBe("abcde…");
    expect(truncatePreview("kurz", 5)).toBe("kurz");
  });
});
