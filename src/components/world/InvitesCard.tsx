"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client/api";
import type { InviteStatus, InviteSummary, InviteValidity } from "@/lib/domain/invites";

const VALIDITY_LABEL: Record<InviteValidity, string> = {
  one_day: "1 Tag",
  seven_days: "7 Tage",
  unlimited: "unbegrenzt",
};

const STATUS_LABEL: Record<Exclude<InviteStatus, "valid">, string> = {
  expired: "abgelaufen",
  revoked: "widerrufen",
};

function inviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`;
}

function shortCode(code: string): string {
  return `${code.slice(0, 6)}…${code.slice(-4)}`;
}

export function InvitesCard({ worldId, invites }: { worldId: string; invites: InviteSummary[] }) {
  const router = useRouter();
  const [validity, setValidity] = useState<InviteValidity>("seven_days");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copy(code: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      setMessage("Link kopiert.");
    } catch {
      setMessage(null);
      setError(`Kopieren nicht möglich. Link: ${inviteUrl(code)}`);
    }
  }

  async function create() {
    setError(null);
    setMessage(null);
    setPending(true);
    const created = await apiRequest<InviteSummary>(`/api/worlds/${worldId}/invites`, "POST", { validity });
    setPending(false);
    if (!created.ok) {
      setError(created.error);
      return;
    }
    router.refresh();
    await copy(created.data.code);
  }

  async function revoke(invite: InviteSummary) {
    if (!window.confirm("Diesen Einladungslink widerrufen? Er funktioniert danach nicht mehr.")) return;
    setError(null);
    setMessage(null);
    setPending(true);
    const revoked = await apiRequest(`/api/worlds/${worldId}/invites/${invite.id}`, "DELETE");
    setPending(false);
    if (!revoked.ok) setError(revoked.error);
    else router.refresh();
  }

  return (
    <div className="card">
      <h2>Einladungslinks</h2>
      <div className="list">
        {invites.length === 0 ? <div className="empty">Noch kein Einladungslink.</div> : null}
        {invites.map((invite) => (
          <div key={invite.id} className="item">
            <div className="grow">
              <code>{shortCode(invite.code)}</code>
              <div className="kind">
                {VALIDITY_LABEL[invite.validity]} · {invite.useCount}{" "}
                {invite.useCount === 1 ? "Nutzung" : "Nutzungen"}
              </div>
            </div>
            {invite.status === "valid" ? (
              <>
                <button type="button" className="btn sm" onClick={() => copy(invite.code)}>
                  Kopieren
                </button>
                <button
                  type="button"
                  className="btn sm danger"
                  disabled={pending}
                  onClick={() => revoke(invite)}
                >
                  Widerrufen
                </button>
              </>
            ) : (
              <span className="badge">{STATUS_LABEL[invite.status]}</span>
            )}
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <select
          value={validity}
          onChange={(event) => setValidity(event.target.value as InviteValidity)}
          aria-label="Gültigkeit"
          style={{ flex: 1 }}
        >
          {Object.entries(VALIDITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="btn primary" disabled={pending} onClick={create}>
          Link erstellen
        </button>
      </div>
      {message ? <p className="small muted">{message}</p> : null}
      {error ? (
        <p className="error-text" role="alert" style={{ wordBreak: "break-all" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
