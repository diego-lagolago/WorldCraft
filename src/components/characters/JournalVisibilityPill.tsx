"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { JournalVisibility } from "@/lib/authz/types";
import { apiRequest } from "@/lib/client/api";
import "./characters.css";

const LABEL: Record<JournalVisibility, string> = {
  private: "🔒 privat",
  shared_with_gm: "👁 mit Spielleitung geteilt",
};

/** Owner toggles only after confirming (Entscheidung 2026-09-22); staff see a plain label. */
export function JournalVisibilityPill(props: {
  worldId: string;
  entryId: string;
  visibility: JournalVisibility;
  canChange: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const className = props.visibility === "shared_with_gm" ? "chip jpill gm" : "chip jpill";

  if (!props.canChange) return <span className={className}>{LABEL[props.visibility]}</span>;

  const toShared = props.visibility === "private";

  async function onConfirm() {
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/worlds/${props.worldId}/journal/${props.entryId}`, "PATCH", {
      visibility: toShared ? "shared_with_gm" : "private",
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className={className} aria-label="Sichtbarkeit ändern" onClick={() => setOpen(true)}>
        {LABEL[props.visibility]} <span className="muted">⇄</span>
      </button>
      {open ? (
        <div className="dialog-backdrop" onClick={() => !pending && setOpen(false)}>
          <div
            className="card stack dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`jvis-${props.entryId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={`jvis-${props.entryId}`} style={{ margin: 0 }}>
              {toShared ? "Mit Spielleitung teilen?" : "Wieder privat machen?"}
            </h2>
            <p className="muted">
              {toShared
                ? "Game Master und Master können diesen Eintrag danach lesen. Auch wenn du ihn später wieder auf privat stellst, kann die Spielleitung ihn bis dahin gesehen haben."
                : "Nur du siehst den Eintrag danach. Was die Spielleitung bereits gelesen hat, lässt sich nicht zurücknehmen."}
            </p>
            {error ? (
              <p className="error-text" role="alert">
                {error}
              </p>
            ) : null}
            <div className="row">
              <button type="button" className="btn grow" disabled={pending} onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button type="button" className="btn primary grow" disabled={pending} onClick={onConfirm}>
                {toShared ? "Teilen" : "Privat machen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
