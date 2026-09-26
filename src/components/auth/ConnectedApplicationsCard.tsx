"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client/api";
import type { ConnectedApplication } from "@/lib/domain/connected-applications";

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Noch nicht verwendet";
}

export function ConnectedApplicationsCard({ applications }: { applications: ConnectedApplication[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function revoke(clientId: string) {
    setPending(clientId);
    setError(null);
    const result = await apiRequest(`/api/connected-applications/${encodeURIComponent(clientId)}`, "DELETE");
    setPending(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }
  return (
    <section className="card stack" aria-labelledby="connected-applications-title">
      <h2 id="connected-applications-title" style={{ margin: 0 }}>Verbundene Anwendungen</h2>
      <p className="small muted">Diese Anwendungen dürfen WorldCraft-Daten im Rahmen deiner Freigabe lesen.</p>
      {applications.length === 0 ? <p className="small muted">Noch keine Anwendung verbunden.</p> : null}
      {applications.map((application) => (
        <div className="item" key={application.clientId}>
          <div className="grow stack" style={{ gap: 3 }}>
            <strong>{application.name}</strong>
            <span className="small muted">Weiterleitung: {application.redirectDomain}</span>
            <span className="small muted">Freigegeben: {formatDate(application.consentedAt)} · Letzte Nutzung: {formatDate(application.lastUsedAt)}</span>
          </div>
          <button type="button" className="btn danger" onClick={() => revoke(application.clientId)} disabled={pending !== null}>
            {pending === application.clientId ? "Widerrufe…" : "Zugriff widerrufen"}
          </button>
        </div>
      ))}
      {error ? <p className="error-text" role="alert">{error}</p> : null}
    </section>
  );
}
