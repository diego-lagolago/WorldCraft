"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { worldPath } from "@/components/shell/nav";
import { apiRequest } from "@/lib/client/api";

export function JoinInviteButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onJoin() {
    setError(null);
    setPending(true);
    const joined = await apiRequest<{ worldId: string }>(`/api/invites/${encodeURIComponent(code)}/join`, "POST");
    if (!joined.ok) {
      setPending(false);
      setError(joined.error);
      return;
    }
    router.push(worldPath(joined.data.worldId));
  }

  return (
    <>
      <button type="button" className="btn primary" disabled={pending} onClick={onJoin}>
        {pending ? "Trete bei …" : "Beitreten"}
      </button>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
