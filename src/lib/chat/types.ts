import type { MembershipRole } from "@/lib/authz";
import type { StoredDiceTerm } from "./dice-format";

export const CHAT_HISTORY_LIMIT = 50;
export const CHANNEL_NAME_MAX = 80;
export const THREAD_TITLE_MAX = 80;
export const MESSAGE_MAX = 2000;

export type ChatChannelDto = {
  id: string;
  name: string;
  sortOrder: number;
  archivedAt: string | null;
};

export type ChatThreadDto = {
  id: string;
  channelId: string;
  title: string;
  createdFromMessageId: string;
  replyCount: number;
  createdAt: string;
};

export type ChatDiceDto = {
  expression: string;
  terms: StoredDiceTerm[];
  sum: number;
};

export type ChatMessageDto = {
  id: string;
  channelId: string;
  threadId: string | null;
  opensThreadId: string | null;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  body: string;
  dice: ChatDiceDto | null;
  sentAt: string;
};

export type ChatState = {
  actorId: string;
  role: MembershipRole;
  staff: boolean;
  channel: ChatChannelDto | null;
  thread: ChatThreadDto | null;
  channels: ChatChannelDto[];
  archivedChannels: ChatChannelDto[];
  threads: ChatThreadDto[];
  messages: ChatMessageDto[];
  hasMore: boolean;
  dicePostToChat: boolean;
};

export type ChatOlderPage = {
  messages: ChatMessageDto[];
  hasMore: boolean;
};
