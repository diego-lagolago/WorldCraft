/** Spike T-010 — JSON-Form für API und Client. */

export type SpikeDiceDto = {
  expression: string;
  values: number[];
  sum: number;
};

export type SpikeChatChannelDto = {
  id: string;
  name: string;
  sort: number;
};

export type SpikeChatThreadDto = {
  id: string;
  channelId: string;
  title: string;
  createdFromMessageId: string | null;
  createdAt: string;
};

export type SpikeChatMessageDto = {
  id: string;
  channelId: string;
  threadId: string | null;
  opensThreadId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  dice: SpikeDiceDto | null;
  sentAt: string;
};

export type SpikeChatState = {
  channel: SpikeChatChannelDto;
  thread: SpikeChatThreadDto | null;
  channels: SpikeChatChannelDto[];
  threads: SpikeChatThreadDto[];
  messages: SpikeChatMessageDto[];
  /** True when older messages exist beyond the current window. */
  hasMore: boolean;
  dicePostToChat: boolean;
};

/** Older-page response when `GET ...&before=<messageId>`. */
export type SpikeChatOlderPage = {
  messages: SpikeChatMessageDto[];
  hasMore: boolean;
};

export type SpikeChatRealtimeEvent =
  | { type: "hello" }
  | { type: "message"; message: SpikeChatMessageDto }
  | { type: "thread.created"; thread: SpikeChatThreadDto };
