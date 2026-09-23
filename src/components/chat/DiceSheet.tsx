"use client";

import { useEffect, useRef, useState } from "react";
import { ALLOWED_SIDES, MAX_DICE_TERMS, formatStructuredPreview } from "@/lib/chat/dice-format";
import {
  DEFAULT_DICE_DRAFT,
  addTerm,
  parseDraftInt,
  removeTerm,
  setModifier,
  setTermCount,
  setTermSides,
  toRollPayload,
  type DiceDraft,
  type RollPayload,
  type RollResult,
} from "@/lib/chat/dice-draft";
import { Sheet } from "./ChannelList";

type Props = {
  postToChat: boolean;
  onPostToChat: (next: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRoll: (input: RollPayload) => Promise<RollResult>;
  onClose: () => void;
};

/**
 * Stepper with an inline-editable number (Plan 008, Nachtrag nach Smoketest 2026-09-23).
 * Focus selects the whole number so typing replaces it; valid input applies immediately
 * (setters clamp), blur shows the clamped value again.
 */
function NumberStepper({
  value,
  label,
  decreaseLabel,
  increaseLabel,
  allowNegative = false,
  onChange,
}: {
  value: number;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  allowNegative?: boolean;
  onChange: (next: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const keepSelection = useRef(false);

  return (
    <div className="stepper">
      <button type="button" aria-label={decreaseLabel} onClick={() => onChange(value - 1)}>
        −
      </button>
      <input
        className="stepper-in"
        type="text"
        // iOS number pads have no minus key, so the bonus keeps the regular keyboard.
        inputMode={allowNegative ? "text" : "numeric"}
        enterKeyHint="done"
        autoComplete="off"
        aria-label={label}
        value={text ?? String(value)}
        onMouseDown={(event) => {
          // Select-all only when focusing via mouse, not when the field already has focus.
          if (document.activeElement !== event.currentTarget) {
            keepSelection.current = true;
          }
        }}
        onFocus={(event) => {
          setText(String(value));
          event.currentTarget.select();
        }}
        onMouseUp={(event) => {
          // A click would otherwise place the caret and drop the selection made on focus.
          if (keepSelection.current) event.preventDefault();
          keepSelection.current = false;
        }}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = parseDraftInt(event.target.value, { allowNegative });
          if (parsed !== null) onChange(parsed);
        }}
        onBlur={() => {
          keepSelection.current = false;
          setText(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <button type="button" aria-label={increaseLabel} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

export function DiceSheet({ postToChat, onPostToChat, onRoll, onClose }: Props) {
  const [draft, setDraft] = useState<DiceDraft>(DEFAULT_DICE_DRAFT);
  const [result, setResult] = useState<{ text: string; sum: number } | null>(null);
  const [copiedHint, setCopiedHint] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(String(result.sum));
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
      const rollResult = await onRoll(toRollPayload(draft));
      // W6: cancel unmounts this instance; a late response must not close a newly opened sheet.
      if (!mountedRef.current) return;
      if (!rollResult.ok) {
        setError(rollResult.error);
        return;
      }
      if (rollResult.posted) {
        onClose();
        return;
      }
      setResult({ text: rollResult.text, sum: rollResult.sum });
    } finally {
      if (mountedRef.current) setSending(false);
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
              <NumberStepper
                value={term.n}
                label="Anzahl Würfel"
                decreaseLabel="Weniger Würfel"
                increaseLabel="Mehr Würfel"
                onChange={(n) => setDraft((current) => setTermCount(current, index, n))}
              />
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
              <NumberStepper
                value={draft.modifier}
                label="Bonus"
                decreaseLabel="Bonus verringern"
                increaseLabel="Bonus erhöhen"
                allowNegative
                onChange={(modifier) => setDraft((current) => setModifier(current, modifier))}
              />
              <p className="dice-preview">{preview}</p>
            </div>
            <div
              className={`dice-result${result ? "" : " empty"}${copiedHint ? " copied" : ""}`}
              role={result ? "button" : undefined}
              tabIndex={result ? 0 : undefined}
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
              <p>{copiedHint ? "Kopiert" : (result?.text ?? "—")}</p>
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
              onClick={() => {
                void onPostToChat(!postToChat).then((res) => {
                  if (!res.ok) setError(res.error);
                  else setError(null);
                });
              }}
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
