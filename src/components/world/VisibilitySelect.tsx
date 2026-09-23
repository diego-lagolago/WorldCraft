"use client";

import {
  CONTENT_VISIBILITY_LABEL,
  contentVisibilityOptions,
  type ContentVisibility,
} from "@/lib/authz/types";

export function ContentVisibilitySelect({
  value,
  onChange,
  allowOwner = true,
  id = "visibility",
  compact = false,
  disabled = false,
  ariaLabel = "Sichtbarkeit",
}: {
  value: ContentVisibility;
  onChange: (value: ContentVisibility) => void;
  /** Wenn false (fremder Datensatz), fehlt die Option „nur ich“ (R2). */
  allowOwner?: boolean;
  id?: string;
  /** Kein Feld-Label/Hint, kleines Select (z. B. Kapitel-Zeile). */
  compact?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const options = contentVisibilityOptions(allowOwner);
  const current = !allowOwner && value === "owner_only" ? "gm_only" : value;

  if (compact) {
    return (
      <select
        id={id}
        value={current}
        onChange={(event) => onChange(event.target.value as ContentVisibility)}
        style={{ width: "auto", padding: "6px 8px", fontSize: 12 }}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        {options.map((entry) => (
          <option key={entry} value={entry}>
            {CONTENT_VISIBILITY_LABEL[entry]}
          </option>
        ))}
      </select>
    );
  }

  return (
    <label className="vis-select" htmlFor={id}>
      <span className="field-label">Sichtbarkeit</span>
      <select
        id={id}
        value={current}
        onChange={(event) => onChange(event.target.value as ContentVisibility)}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        {options.map((entry) => (
          <option key={entry} value={entry}>
            {CONTENT_VISIBILITY_LABEL[entry]}
          </option>
        ))}
      </select>
      {!allowOwner ? (
        <p className="hint" style={{ margin: "6px 0 0" }}>
          Fremder Datensatz: „{CONTENT_VISIBILITY_LABEL.owner_only}“ ist nur für den Owner wählbar.
        </p>
      ) : null}
    </label>
  );
}
