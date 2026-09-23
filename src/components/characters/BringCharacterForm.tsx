"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/client/api";

/** APP-PART-REACTIVATE: bringing an earlier character back restores its journal. */
export function BringCharacterForm({ worldId, characters }: { worldId: string; characters: { id: string; name: string }[] }) {
  const router = useRouter();
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await apiRequest(`/api/worlds/${worldId}/characters`, "POST", { characterId });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form className="stack" style={{ gap: 6 }} onSubmit={onSubmit}>
      <div className="row">
        <select
          className="grow"
          value={characterId}
          onChange={(event) => setCharacterId(event.target.value)}
          aria-label="Charakter zum Mitbringen"
        >
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn sm primary" disabled={pending || !characterId}>
          Mitbringen
        </button>
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
