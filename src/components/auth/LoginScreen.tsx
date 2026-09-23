"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { TEST_USERS, type TestUserId } from "@/lib/test-users";

type Props = {
  discordConfigured: boolean;
  testLoginEnabled: boolean;
  /** Validated in-app path to open after login, e.g. an invite link. */
  next?: string | null;
};

export function LoginScreen({ discordConfigured, testLoginEnabled, next = null }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDiscord() {
    setError(null);
    setPending("discord");
    try {
      await signIn.social({ provider: "discord", callbackURL: next ?? "/" });
    } catch {
      setError("Die Discord-Anmeldung konnte nicht gestartet werden.");
      setPending(null);
    }
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
      if (next) router.push(next);
      else router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="center">
      <div className="login stack text-center">
        <div className="logo" aria-hidden="true">
          🌍
        </div>
        <h1>WorldCraft</h1>
        <p className="muted">Welten, Karten, Quests und Chat für eure D&amp;D-Runde.</p>
        {next?.startsWith("/invite/") ? (
          <p className="small">Melde dich an, um die Einladung anzunehmen.</p>
        ) : null}
        {discordConfigured ? (
          <button type="button" className="btn discord" onClick={onDiscord} disabled={pending !== null}>
            Mit Discord anmelden
          </button>
        ) : (
          <p className="small muted">Die Discord-Anmeldung ist auf diesem Server nicht eingerichtet.</p>
        )}
        {testLoginEnabled ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="small muted">Test-Login (nur lokal)</p>
            {TEST_USERS.map((user) => (
              <button
                key={user.discordId}
                type="button"
                className="btn"
                onClick={() => onTestLogin(user.discordId)}
                disabled={pending !== null}
              >
                {user.name}
              </button>
            ))}
          </div>
        ) : null}
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
