import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChatSpikePage } from "@/spike/chat/ChatSpikePage";
import { loadSpikeChatState } from "@/spike/chat/repository";

export const dynamic = "force-dynamic";

export default async function SpikeChatRoute({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; thread?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/");
  }
  const params = await searchParams;
  const initialState = await loadSpikeChatState({
    channelId: params.channel,
    threadId: params.thread,
    userId: session.user.id,
  });
  return (
    <ChatSpikePage
      currentUserId={session.user.id}
      currentUserName={session.user.name}
      initialState={initialState}
    />
  );
}
