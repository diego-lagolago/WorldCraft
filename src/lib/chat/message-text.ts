import { formatDiceRoll } from "./dice-format";
import type { ChatMessageDto, ChatThreadDto } from "./types";

export function messageCopyText(message: ChatMessageDto, threads: ChatThreadDto[]): string {
  if (message.opensThreadId) {
    return threads.find((row) => row.id === message.opensThreadId)?.title ?? "";
  }
  if (message.dice) {
    return formatDiceRoll(message.dice.expression, message.dice.terms);
  }
  return message.body ?? "";
}

export function messagePreviewText(message: ChatMessageDto, threads: ChatThreadDto[]): string {
  if (message.opensThreadId) {
    const title = messageCopyText(message, threads);
    return title ? `🧵 ${title}` : "";
  }
  return messageCopyText(message, threads);
}

export function truncatePreview(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
