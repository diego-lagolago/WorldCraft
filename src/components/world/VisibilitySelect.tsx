"use client";

import { CONTENT_VISIBILITIES, type ContentVisibility } from "@/lib/authz/types";

export const CONTENT_VISIBILITY_LABEL: Record<ContentVisibility, string> = {
  owner_only: "nur ich",
  gm_only: "nur Spielleitung",
  published: "veröffentlicht",
};

/** Dreistufige Sichtbarkeit (Artikel, Quest, Kapitel, Pin). R2: „nur ich“ nur für den Owner. */
export function ContentVisibilitySelect({
  value,
  onChange,
  allowOwner = true,
  id = "visibility",
}: {
  value: ContentVisibility;
  onChange: (value: ContentVisibility) => void;
  /** Wenn false (fremder Datensatz), fehlt die Option „nur ich“ (R2). */
  allowOwner?: boolean;
  id?: string;
}) {
  const options = allowOwner
    ? CONTENT_VISIBILITIES
    : (CONTENT_VISIBILITIES.filter((entry) => entry !== "owner_only") as ContentVisibility[]);
  const current = !allowOwner && value === "owner_only" ? "gm_only" : value;

  return (
    <label className="vis-select" htmlFor={id}>
      <span className="field-label">Sichtbarkeit</span>
      <select
        id={id}
        value={current}
        onChange={(event) => onChange(event.target.value as ContentVisibility)}
        aria-label="Sichtbarkeit"
      >
        {options.map((entry) => (
          <option key={entry} value={entry}>
            {CONTENT_VISIBILITY_LABEL[entry]}
          </option>
        ))}
      </select>
      {!allowOwner ? (
        <p className="hint" style={{ margin: "6px 0 0" }}>
          Fremder Datensatz: „nur ich“ ist nur für den Owner wählbar.
        </p>
      ) : null}
    </label>
  );
}
