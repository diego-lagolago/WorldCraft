import type { VisibilityLayer } from "@/lib/authz";
import type { ChatMessageDto, ChatThreadDto } from "@/lib/chat/types";
import { createRealtimeBus } from "./bus";

/** Events on the single world bus. Chat and map publish here (CR-012). Map pin/marker are signals only (R5); `layers` is for SSE visibility filtering (CR-001). `membership.changed` is internal (CR-002/CR-017): never forwarded to clients. */
export type WorldRealtimeEvent =
  | { type: "chat.message"; worldId: string; message: ChatMessageDto }
  | { type: "chat.message.edited"; worldId: string; message: ChatMessageDto }
  | {
      type: "chat.message.deleted";
      worldId: string;
      messageId: string;
      channelId: string;
      threadId: string | null;
    }
  | { type: "chat.thread"; worldId: string; thread: ChatThreadDto }
  | { type: "chat.channels"; worldId: string }
  | { type: "map.updated"; worldId: string; universeId: string; layers: VisibilityLayer[] }
  | { type: "map.pin"; worldId: string; pinId: string; mapId: string; layers: VisibilityLayer[] }
  | { type: "map.pin.deleted"; worldId: string; pinId: string; mapId: string; layers: VisibilityLayer[] }
  | { type: "map.marker"; worldId: string; markerId: string; mapId: string; layers: VisibilityLayer[] }
  | {
      type: "map.marker.deleted";
      worldId: string;
      markerId: string;
      mapId: string;
      layers: VisibilityLayer[];
    }
  | {
      type: "map.monsterMarker";
      worldId: string;
      markerId: string;
      mapId: string;
      layers: VisibilityLayer[];
    }
  | {
      type: "map.monsterMarker.deleted";
      worldId: string;
      markerId: string;
      mapId: string;
      layers: VisibilityLayer[];
    }
  | { type: "membership.changed"; worldId: string; userId: string };

export const worldEvents = createRealtimeBus<WorldRealtimeEvent>("world");

export function isHelloEvent(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { type?: unknown }).type === "hello";
}

const WORLD_EVENT_TYPES = new Set([
  "chat.message",
  "chat.message.edited",
  "chat.message.deleted",
  "chat.thread",
  "chat.channels",
  "map.updated",
  "map.pin",
  "map.pin.deleted",
  "map.marker",
  "map.marker.deleted",
  "map.monsterMarker",
  "map.monsterMarker.deleted",
]);

export function isWorldRealtimeEvent(value: unknown): value is WorldRealtimeEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as { type?: unknown; worldId?: unknown };
  return typeof event.type === "string" && WORLD_EVENT_TYPES.has(event.type) && typeof event.worldId === "string";
}
