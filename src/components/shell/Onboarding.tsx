"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CreateWorldForm } from "@/components/world/CreateWorldForm";
import { ROLE_LABEL } from "@/components/world/labels";
import type { MyWorld } from "@/lib/domain/worlds";
import { inviteCodeFrom } from "./invite-code";
import { SignOutButton } from "./SignOutButton";
import { worldPath } from "./nav";

export function Onboarding({ userName, worlds }: { userName: string; worlds: MyWorld[] }) {
  const router = useRouter();
  const [invite, setInvite] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  function onInvite(event: FormEvent) {
    event.preventDefault();
    const code = inviteCodeFrom(invite);
    if (!code) {
      setInviteError("Das ist kein gültiger Einladungslink.");
      return;
    }
    router.push(`/invite/${code}`);
  }

  return (
    <main className="center">
      <div className="login stack">
        <h1>Willkommen, {userName}</h1>
        {worlds.length === 0 ? <p className="muted">Du bist noch in keiner Welt.</p> : null}

        {worlds.length > 0 ? (
          <div className="card list" style={{ padding: "0 4px" }}>
            {worlds.map((world) => (
              <Link key={world.id} className="item" href={worldPath(world.id)}>
                <div className="grow">
                  {world.name}
                  <div className="kind">{ROLE_LABEL[world.role]}</div>
                </div>
                <span className="muted" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>
        ) : null}

        <CreateWorldForm />

        <form className="card stack" onSubmit={onInvite}>
          <h2>Einladung einlösen</h2>
          <input
            value={invite}
            onChange={(event) => {
              setInvite(event.target.value);
              setInviteError(null);
            }}
            placeholder="Einladungslink einfügen"
            aria-label="Einladungslink"
            autoCapitalize="none"
            autoCorrect="off"
          />
          {inviteError ? <p className="error-text">{inviteError}</p> : null}
          <button type="submit" className="btn">
            Beitreten
          </button>
        </form>

        <Link className="btn" href="/characters">
          Eigene Charaktere
        </Link>
        <SignOutButton />
      </div>
    </main>
  );
}
