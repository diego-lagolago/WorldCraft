"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signOut } from "@/lib/auth-client";
import { TEST_USERS, type TestUserId } from "@/lib/test-users";

type AuthPanelProps = {
  signedIn: boolean;
  name?: string;
  image?: string | null;
  discordConfigured: boolean;
  testLoginEnabled: boolean;
};

export function AuthPanel({
  signedIn,
  name,
  image,
  discordConfigured,
  testLoginEnabled,
}: AuthPanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDiscord() {
    setError(null);
    setPending("discord");
    await signIn.social({ provider: "discord", callbackURL: "/" });
  }

  async function onTestLogin(discordId: TestUserId) {
    setError(null);
    setPending(discordId);
    try {
      const response = await fetch("/api/test-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ discordId }),
      });
      if (!response.ok) {
        setError("Test-Login fehlgeschlagen.");
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function onSignOut() {
    setPending("sign-out");
    await signOut();
    router.refresh();
  }

  if (signedIn) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-4">
        <div className="flex items-center gap-3">
          {image ? (
            // Discord CDN URL; regular img avoids next/image remote config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              width={48}
              height={48}
              className="size-12 rounded-full bg-zinc-800"
            />
          ) : (
            <div
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-400"
            >
              {name?.slice(0, 1) ?? "?"}
            </div>
          )}
          <div>
            <p className="text-sm text-zinc-400">Angemeldet als</p>
            <p className="text-lg font-medium">{name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          disabled={pending === "sign-out"}
          className="w-fit rounded-md border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          Abmelden
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-4">
      {discordConfigured ? (
        <button
          type="button"
          onClick={onDiscord}
          disabled={pending === "discord"}
          className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          Mit Discord anmelden
        </button>
      ) : (
        <p className="text-sm text-zinc-400">
          Discord-Anmeldung ist noch nicht konfiguriert. Client-ID und Secret
          gehören in die lokale <code>.env</code> — nicht in den Chat.
        </p>
      )}

      {testLoginEnabled ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-400">Test-Login (nur lokal)</p>
          <div className="flex flex-wrap gap-2">
            {TEST_USERS.map((user) => (
              <button
                key={user.discordId}
                type="button"
                onClick={() => onTestLogin(user.discordId)}
                disabled={pending === user.discordId}
                className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                {user.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
