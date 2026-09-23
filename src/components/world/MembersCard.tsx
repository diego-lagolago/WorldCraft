"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client/api";
import type { MemberSummary } from "@/lib/domain/members";
import { Avatar } from "./display";
import { ROLE_LABEL } from "./labels";

type Props = {
  worldId: string;
  members: MemberSummary[];
  currentUserId: string;
  canManage: boolean;
};

export function MembersCard({ worldId, members, currentUserId, canManage }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(member: MemberSummary, action: "role" | "remove") {
    if (action === "remove") {
      const confirmed = window.confirm(
        `${member.name} aus der Welt entfernen? Die Mitgliedschaft wird archiviert, Inhalte bleiben erhalten.`,
      );
      if (!confirmed) return;
    }
    setError(null);
    setPending(member.membershipId);
    const url = `/api/worlds/${worldId}/members/${member.membershipId}`;
    const result =
      action === "remove"
        ? await apiRequest(url, "DELETE")
        : await apiRequest(url, "PATCH", { role: member.role === "player" ? "master" : "player" });
    setPending(null);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="card">
      <h2>Mitglieder</h2>
      <div className="list">
        {members.map((member) => (
          <div key={member.membershipId} className="item">
            <Avatar name={member.name} image={member.image} />
            <div className="grow">
              {member.name}
              {member.userId === currentUserId ? <span className="kind"> (du)</span> : null}
              <div className="kind">{ROLE_LABEL[member.role]}</div>
            </div>
            {canManage && member.role !== "game_master" ? (
              <>
                <button
                  type="button"
                  className="btn sm"
                  disabled={pending !== null}
                  onClick={() => act(member, "role")}
                >
                  {member.role === "player" ? "Zum Master" : "Zu Player"}
                </button>
                <button
                  type="button"
                  className="btn sm danger"
                  disabled={pending !== null}
                  onClick={() => act(member, "remove")}
                  aria-label={`${member.name} entfernen`}
                >
                  ✕
                </button>
              </>
            ) : null}
          </div>
        ))}
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
