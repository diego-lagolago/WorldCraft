"use client";

import { useEffect, useState } from "react";

type Props = {
  clientName: string;
  redirectDomain: string;
  oauthQuery: string;
  scopes: string[];
  accessAllowed: boolean;
};

export function OAuthConsent({ clientName, redirectDomain, oauthQuery, scopes, accessAllowed }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(accept: boolean) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accept, oauth_query: oauthQuery }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("url" in payload) ||
        typeof payload.url !== "string"
      ) {
        setError("Die OAuth-Freigabe konnte nicht verarbeitet werden.");
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setError("Die OAuth-Freigabe konnte nicht verarbeitet werden.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (accessAllowed) return;
    void fetch("/api/auth/oauth2/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accept: false, oauth_query: oauthQuery }),
    })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (
          response.ok &&
          payload &&
          typeof payload === "object" &&
          "url" in payload &&
          typeof payload.url === "string"
        ) {
          window.location.assign(payload.url);
        }
      })
      .catch(() => undefined);
    // A removed Discord id must always become an OAuth `access_denied` redirect.
  }, [accessAllowed, oauthQuery]);

  return (
    <main className="center">
      <section className="login stack" aria-labelledby="oauth-consent-title">
        <h1 id="oauth-consent-title">Zugriff erlauben?</h1>
        <p>
          <strong>{clientName}</strong> möchte auf WorldCraft zugreifen.
        </p>
        <p className="small muted">Der Anwendungsname wird vom verbundenen Client selbst angegeben.</p>
        <p className="small">Weiterleitung an: <strong>{redirectDomain}</strong></p>
        <p className="muted">
          {scopes.includes("worlds:write")
            ? "Lesen und Schreiben auf deine Welten; Tagebücher, Chat, Karten, Pins und Charaktere sind vom Schreiben ausgeschlossen. Gelöscht wird nie."
            : scopes.includes("worlds:read")
            ? "Lesezugriff auf deine Welten; Tagebücher und Chat sind ausgeschlossen."
            : `Berechtigungen: ${scopes.join(", ")}`}
        </p>
        {!accessAllowed ? (
          <p className="error-text" role="alert">
            Dieses Discord-Konto ist für WorldCraft nicht mehr freigegeben. Der Zugriff wird abgelehnt.
          </p>
        ) : null}
        <div className="row" style={{ justifyContent: "center", gap: 8 }}>
          <button type="button" className="btn" onClick={() => decide(false)} disabled={pending}>
            Ablehnen
          </button>
          <button type="button" className="btn primary" onClick={() => decide(true)} disabled={pending || !accessAllowed}>
            {pending ? "Wird verarbeitet…" : "Erlauben"}
          </button>
        </div>
        {error ? <p className="error-text" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
