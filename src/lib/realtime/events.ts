import type { ChatMessageDto, ChatThreadDto } from "@/lib/chat/types";
import { createRealtimeBus } from "./bus";

/** Events on the single world bus. T-013 adds map events to this union. */
export type WorldRealtimeEvent =
  | { type: "chat.message"; worldId: string; message: ChatMessageDto }
  | {
      type: "chat.message.deleted";
      worldId: string;
      messageId: string;
      channelId: string;
      threadId: string | null;
    }
  | { type: "chat.thread"; worldId: string; thread: ChatThreadDto }
  | { type: "chat.channels"; worldId: string };

export const worldEvents = createRealtimeBus<WorldRealtimeEvent>("world");

export function isHelloEvent(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { type?: unknown }).type === "hello";
}

const CHAT_EVENT_TYPES = new Set([
  "chat.message",
  "chat.message.deleted",
  "chat.thread",
  "chat.channels",
]);

export function isWorldRealtimeEvent(value: unknown): value is WorldRealtimeEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as { type?: unknown; worldId?: unknown };
  return typeof event.type === "string" && CHAT_EVENT_TYPES.has(event.type) && typeof event.worldId === "string";
}
