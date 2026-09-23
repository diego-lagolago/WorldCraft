import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { HomeRedirect } from "@/components/shell/HomeRedirect";
import { Onboarding } from "@/components/shell/Onboarding";
import { listMyWorlds } from "@/lib/domain/worlds";
import { isDiscordConfigured, isTestLoginEnabled } from "@/lib/env";
import { safeNextPath } from "@/lib/next-path";
import { getOptionalSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const session = await getOptionalSession();
  if (!session?.user) {
    return (
      <LoginScreen
        discordConfigured={isDiscordConfigured()}
        testLoginEnabled={isTestLoginEnabled()}
        next={next}
      />
    );
  }
  if (next) redirect(next);

  const worlds = await listMyWorlds(session.user.id);
  return (
    <HomeRedirect worldIds={worlds.map((world) => world.id)} force={params.new === "1"}>
      <Onboarding userName={session.user.name} worlds={worlds} />
    </HomeRedirect>
  );
}
