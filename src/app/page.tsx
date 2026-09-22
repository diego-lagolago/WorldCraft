import Link from "next/link";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { AuthPanel } from "@/components/auth-panel";
import { db } from "@/db/client";
import { appInfo } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isDiscordConfigured, isTestLoginEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

async function readHomepageMessage(): Promise<string> {
  try {
    const rows = await db
      .select({ value: appInfo.value })
      .from(appInfo)
      .where(eq(appInfo.key, "homepage_message"))
      .limit(1);
    return rows[0]?.value ?? "Kein Wert in der Datenbank.";
  } catch {
    return "Datenbank nicht erreichbar. Läuft PostgreSQL (`docker compose up -d`)?";
  }
}

export default async function Home() {
  const message = await readHomepageMessage();
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6">
      <p className="text-sm uppercase tracking-wide text-zinc-400">WorldCraft</p>
      <h1 className="text-3xl font-semibold tracking-tight">Grundgerüst</h1>
      <p className="text-zinc-300">Wert aus der Datenbank:</p>
      <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg">
        {message}
      </p>
      <AuthPanel
        signedIn={Boolean(session?.user)}
        name={session?.user.name}
        image={session?.user.image}
        discordConfigured={isDiscordConfigured()}
        testLoginEnabled={isTestLoginEnabled()}
      />
      {session?.user ? (
        <p className="flex flex-wrap gap-4">
          <Link className="text-amber-300 underline" href="/spike/karte">
            Karten-Spike
          </Link>
          <Link className="text-amber-300 underline" href="/spike/chat">
            Chat-Spike
          </Link>
        </p>
      ) : null}
    </main>
  );
}
