import { LoginScreen } from "@/components/auth/LoginScreen";
import { HomeRedirect } from "@/components/shell/HomeRedirect";
import { Onboarding } from "@/components/shell/Onboarding";
import { listMyWorlds } from "@/lib/domain/worlds";
import { isDiscordConfigured, isTestLoginEnabled } from "@/lib/env";
import { getOptionalSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getOptionalSession();
  if (!session?.user) {
    return (
      <LoginScreen discordConfigured={isDiscordConfigured()} testLoginEnabled={isTestLoginEnabled()} />
    );
  }

  const worlds = await listMyWorlds(session.user.id);
  return (
    <HomeRedirect worldIds={worlds.map((world) => world.id)}>
      <Onboarding userName={session.user.name} worlds={worlds} />
    </HomeRedirect>
  );
}
