import { cookies } from "next/headers";
import { ChatView } from "@/components/chat/ChatView";
import { EXPANDED_COOKIE, parseExpanded } from "@/lib/chat/expanded-state";
import { loadChatState } from "@/lib/chat/repository";
import { optionalUuid } from "@/lib/chat/query";
import { requireWorldPage } from "@/lib/page-context";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ worldId: string }>;
  searchParams: Promise<{ channel?: string; thread?: string }>;
}) {
  const { worldId } = await params;
  const query = await searchParams;
  const { world, membership, user } = await requireWorldPage(worldId);
  const channel = optionalUuid(query.channel ?? null);
  const thread = optionalUuid(query.thread ?? null);
  const state = await loadChatState({
    worldId: world.id,
    actorId: user.id,
    role: membership.role,
    channelId: channel.ok ? channel.id : null,
    threadId: thread.ok ? thread.id : null,
  });
  if (!state.ok) {
    return <p className="empty">{state.error}</p>;
  }
  const focusStream = Boolean(query.channel || query.thread);
  const initialExpanded = parseExpanded((await cookies()).get(EXPANDED_COOKIE)?.value);
  return (
    <ChatView
      key={`${state.data.channel?.id ?? ""}:${state.data.thread?.id ?? ""}`}
      worldId={world.id}
      initial={state.data}
      initialExpanded={initialExpanded}
      focusStream={focusStream}
    />
  );
}
