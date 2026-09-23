"use client";

import { useEffect, useRef, useState } from "react";
import { ALLOWED_SIDES, MAX_DICE_TERMS, formatStructuredPreview } from "@/lib/chat/dice-format";
import {
  DEFAULT_DICE_DRAFT,
  addTerm,
  removeTerm,
  setModifier,
  setTermCount,
  setTermSides,
  toRollPayload,
  type DiceDraft,
} from "@/lib/chat/dice-draft";
import { Sheet } from "./ChannelList";

export type RollResult =
  | { ok: true; posted: true }
  | { ok: true; posted: false; text: string }
  | { ok: false; error: string };

type Props = {
  postToChat: boolean;
  onPostToChat: (next: boolean) => void;
  onRoll: (input: { terms: { n: number; m: number }[]; modifier: number }) => Promise<RollResult>;
  onClose: () => void;
};

export function DiceSheet({ postToChat, onPostToChat, onRoll, onClose }: Props) {
  const [draft, setDraft] = useState<DiceDraft>(DEFAULT_DICE_DRAFT);
  const [resultText, setResultText] = useState<string | null>(null);
  const [copiedHint, setCopiedHint] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  async function copyResult() {
    if (!resultText) return;
    const match = /=\s*(-?\d+)\s*$/.exec(resultText);
    if (!match?.[1]) return;
    try {
      await navigator.clipboard.writeText(match[1]);
      setCopiedHint(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedHint(false), 1200);
    } catch {
      /* clipboard may be denied */
    }
  }

  async function handleRoll() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await onRoll(toRollPayload(draft));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.posted) {
        onClose();
        return;
      }
      setResultText(result.text);
    } finally {
      setSending(false);
    }
  }

  const preview = formatStructuredPreview(draft);

  return (
    <Sheet title="Würfeln" onClose={onClose}>
      <div className="dice-sheet">
        <div className="dice-sheet-controls">
          {draft.terms.map((term, index) => (
            <div className="dice-term" key={`term-${index}`}>
              <div className="dice-term-head">
                <span>{index === 0 ? "Würfel" : `Plus-Würfel ${index + 1}`}</span>
                {index > 0 ? (
                  <button
                    type="button"
                    className="dice-text-btn"
                    onClick={() => setDraft((current) => removeTerm(current, index))}
                  >
                    Entfernen
                  </button>
                ) : null}
              </div>
              <div className="stepper">
                <button
                  type="button"
                  aria-label="Weniger Würfel"
                  onClick={() => setDraft((current) => setTermCount(current, index, term.n - 1))}
                >
                  −
                </button>
                <strong>{term.n}</strong>
                <button
                  type="button"
                  aria-label="Mehr Würfel"
                  onClick={() => setDraft((current) => setTermCount(current, index, term.n + 1))}
                >
                  +
                </button>
              </div>
              <div className="dice-sides">
                {ALLOWED_SIDES.map((sides) => (
                  <button
                    key={sides}
                    type="button"
                    aria-pressed={term.m === sides}
                    onClick={() => setDraft((current) => setTermSides(current, index, sides))}
                  >
                    d{sides}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {draft.terms.length < MAX_DICE_TERMS ? (
            <button
              type="button"
              className="dice-text-btn"
              onClick={() => setDraft((current) => addTerm(current))}
            >
              Weiteren Würfel
            </button>
          ) : null}
          <div className="dice-bonus-row">
            <div className="dice-bonus-block">
              <span>Bonus</span>
              <div className="stepper">
                <button
                  type="button"
                  aria-label="Bonus verringern"
                  onClick={() => setDraft((current) => setModifier(current, current.modifier - 1))}
                >
                  −
                </button>
                <strong>{draft.modifier}</strong>
                <button
                  type="button"
                  aria-label="Bonus erhöhen"
                  onClick={() => setDraft((current) => setModifier(current, current.modifier + 1))}
                >
                  +
                </button>
              </div>
              <p className="dice-preview">{preview}</p>
            </div>
            <div
              className={`dice-result${resultText ? "" : " empty"}${copiedHint ? " copied" : ""}`}
              role={resultText ? "button" : undefined}
              tabIndex={resultText ? 0 : undefined}
              aria-live="polite"
              aria-label={copiedHint ? "Kopiert" : "Wurfergebnis"}
              onClick={() => void copyResult()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void copyResult();
                }
              }}
            >
              <p>{copiedHint ? "Kopiert" : (resultText ?? "—")}</p>
            </div>
          </div>
          <div className="row step-row">
            <span>Im Chat posten</span>
            <button
              type="button"
              className="sw"
              role="switch"
              aria-checked={postToChat}
              aria-label="Im Chat posten"
              onClick={() => onPostToChat(!postToChat)}
            />
          </div>
        </div>
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dice-sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn primary" disabled={sending} onClick={() => void handleRoll()}>
            Würfeln
          </button>
        </div>
      </div>
    </Sheet>
  );
}
