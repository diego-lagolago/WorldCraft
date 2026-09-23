"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client/api";
import { forgetWorld } from "@/lib/client/last-context";

export function LeaveWorldButton({ worldId, worldName }: { worldId: string; worldName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLeave() {
    const confirmed = window.confirm(
      `„${worldName}“ verlassen? Deine Charaktere verlassen die Welt mit dir. Inhalte bleiben erhalten; mit einer neuen Einladung kannst du wieder beitreten.`,
    );
    if (!confirmed) return;
    setError(null);
    setPending(true);
    const left = await apiRequest(`/api/worlds/${worldId}/leave`, "POST");
    if (!left.ok) {
      setPending(false);
      setError(left.error);
      return;
    }
    forgetWorld(worldId);
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <button type="button" className="item" style={{ width: "100%" }} disabled={pending} onClick={onLeave}>
        <span aria-hidden="true">🚪</span>
        <div className="grow" style={{ textAlign: "left" }}>
          Welt verlassen
        </div>
      </button>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
