"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { DISCORD_NOT_ALLOWED_MESSAGE } from "@/lib/env";
import { TEST_USERS, type TestUserId } from "@/lib/test-users";

type Props = {
  discordConfigured: boolean;
  testLoginEnabled: boolean;
  /** Validated in-app path to open after login, e.g. an invite link. */
  next?: string | null;
  /** OAuth error code from the callback URL, e.g. discord_not_allowed. */
  authError?: string | null;
  authErrorDescription?: string | null;
};

function messageForAuthError(code: string | null | undefined, description: string | null | undefined): string | null {
  if (!code) return null;
  if (code === "discord_not_allowed") return description?.trim() || DISCORD_NOT_ALLOWED_MESSAGE;
  return description?.trim() || "Die Anmeldung ist fehlgeschlagen.";
}

export function LoginScreen({
  discordConfigured,
  testLoginEnabled,
  next = null,
  authError = null,
  authErrorDescription = null,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  // undefined = show URL/auth error; null/string = local override after user action
  const [actionError, setActionError] = useState<string | null | undefined>(undefined);
  const error = actionError === undefined ? messageForAuthError(authError, authErrorDescription) : actionError;

  async function onDiscord() {
    setActionError(null);
    setPending("discord");
    try {
      await signIn.social({
        provider: "discord",
        callbackURL: next ?? "/",
      });
    } catch {
      setActionError("Die Discord-Anmeldung konnte nicht gestartet werden.");
      setPending(null);
    }
  }

  async function onTestLogin(discordId: TestUserId) {
    setActionError(null);
    setPending(discordId);
    try {
      const response = await fetch("/api/test-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ discordId }),
      });
      if (!response.ok) {
        setActionError("Test-Login fehlgeschlagen.");
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
