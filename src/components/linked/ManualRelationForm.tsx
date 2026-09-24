"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { ContentKind } from "@/lib/authz/types";
import { apiRequest } from "@/lib/client/api";
import type { RelationTargetOption } from "@/lib/domain/linked";
import { contentKindLabel } from "@/lib/i18n";

export function ManualRelationForm({
  worldId,
  sourceKind,
  sourceId,
  targets,
  labels,
}: {
  worldId: string;
  sourceKind: ContentKind;
  sourceId: string;
  targets: RelationTargetOption[];
  labels: string[];
}) {
  const router = useRouter();
  const [targetKind, setTargetKind] = useState<ContentKind>("article");
  const [targetId, setTargetId] = useState("");
  const [label, setLabel] = useState("");
  const [counterLabel, setCounterLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      targets.filter(
        (target) => target.kind === targetKind && !(target.kind === sourceKind && target.id === sourceId),
      ),
    [targets, targetKind, sourceKind, sourceId],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!targetId || !label.trim()) return;
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/worlds/${worldId}/relations`, "POST", {
      sourceKind,
      sourceId,
      targetKind,
      targetId,
      label: label.trim(),
      ...(counterLabel.trim() ? { counterLabel: counterLabel.trim() } : {}),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTargetId("");
    setLabel("");
    setCounterLabel("");
    router.refresh();
  }

  return (
    <form className="card stack" onSubmit={onSubmit} style={{ gap: 8 }}>
      <h2 style={{ margin: 0 }}>Manuell verknüpfen</h2>
      <label className="stack" style={{ gap: 6 }}>
        <span className="field-label">Art</span>
        <select
          value={targetKind}
          onChange={(event) => {
            setTargetKind(event.target.value as ContentKind);
            setTargetId("");
          }}
        >
          {(["article", "quest", "character", "pin", "universe", "monster"] as ContentKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {contentKindLabel(kind)}
            </option>
          ))}
        </select>
      </label>
      <label className="stack" style={{ gap: 6 }}>
        <span className="field-label">Ziel</span>
        <select value={targetId} onChange={(event) => setTargetId(event.target.value)} required>
          <option value="">–</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      </label>
      <label className="stack" style={{ gap: 6 }}>
        <span className="field-label">Bezeichnung</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          list="relation-labels"
          maxLength={60}
          required
        />
        <datalist id="relation-labels">
          {labels.map((entry) => (
            <option key={entry} value={entry} />
          ))}
        </datalist>
      </label>
      <label className="stack" style={{ gap: 6 }}>
        <span className="field-label">Gegenbezeichnung (optional)</span>
        <input
          value={counterLabel}
          onChange={(event) => setCounterLabel(event.target.value)}
          maxLength={60}
        />
      </label>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn sm" disabled={pending || !targetId || !label.trim()}>
        Verknüpfen
      </button>
    </form>
  );
}
