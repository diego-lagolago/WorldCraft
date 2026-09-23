"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CHARACTER_NAME_MAX } from "@/lib/characters/sheet";
import { apiRequest } from "@/lib/client/api";

/** A character belongs to the user, not a world (Fachmodell 3.8); details follow on the edit page. */
export function CreateCharacterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await apiRequest<{ id: string }>("/api/characters", "POST", { name });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/characters/${result.data.id}`);
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h2 style={{ margin: 0 }}>Neuer Charakter</h2>
      <div className="row">
        <input
          className="grow"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          aria-label="Name des Charakters"
          maxLength={CHARACTER_NAME_MAX}
          required
        />
        <button type="submit" className="btn primary" disabled={pending || !name.trim()}>
          Anlegen
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
