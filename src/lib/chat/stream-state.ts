import type { ChatMessageDto, ChatState, ChatThreadDto } from "./types";

function sameStream(state: ChatState, message: ChatMessageDto): boolean {
  return message.channelId === state.channel?.id && (message.threadId ?? null) === (state.thread?.id ?? null);
}

/** Append a new message; bump replyCount only for unknown thread replies. Known IDs are ignored. */
export function withMessage(state: ChatState, message: ChatMessageDto): ChatState {
  const known = state.messages.some((row) => row.id === message.id);
  if (known) return state;
  const threads = message.threadId
    ? state.threads.map((thread) =>
        thread.id === message.threadId ? { ...thread, replyCount: thread.replyCount + 1 } : thread,
      )
    : state.threads;
  if (!sameStream(state, message)) return { ...state, threads };
  return { ...state, threads, messages: [...state.messages, message] };
}

/** Replace a known message in place; unknown IDs leave state unchanged (no append, no replyCount). */
export function withEditedMessage(state: ChatState, message: ChatMessageDto): ChatState {
  const index = state.messages.findIndex((row) => row.id === message.id);
  if (index < 0) return state;
  const messages = state.messages.slice();
  messages[index] = message;
  return { ...state, messages };
}

/** Replace a known thread (incl. open thread); unknown threads are prepended. */
export function withThread(state: ChatState, thread: ChatThreadDto): ChatState {
  const known = state.threads.some((row) => row.id === thread.id);
  if (known) {
    return {
      ...state,
      threads: state.threads.map((row) => (row.id === thread.id ? thread : row)),
      thread: state.thread?.id === thread.id ? thread : state.thread,
    };
  }
  return { ...state, threads: [thread, ...state.threads] };
}
