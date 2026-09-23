"use client";

import { useState } from "react";
import { RichComposer } from "./RichComposer";

type Props = {
  disabled: boolean;
  placeholder: string;
  inThread: boolean;
  onSend: (body: string) => Promise<boolean>;
  onStartThread: () => void;
  onOpenDice: () => void;
};

export function ComposerBar({ disabled, placeholder, inThread, onSend, onStartThread, onOpenDice }: Props) {
  const [value, setValue] = useState("");
  const [plusOpen, setPlusOpen] = useState(false);

  async function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    const ok = await onSend(text);
    if (ok) setValue("");
  }

  return (
    <div className="composer">
      {plusOpen ? (
        <div className="plus-pop">
          {inThread ? (
            <p className="empty">In einem Thread gibt es keine Unter-Threads.</p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPlusOpen(false);
                onStartThread();
              }}
            >
              🧵 Thread starten
            </button>
          )}
        </div>
      ) : null}
      <button type="button" className="cb" aria-label="Mehr" onClick={() => setPlusOpen((open) => !open)}>
        ＋
      </button>
      <button type="button" className="cb" aria-label="Würfeln" onClick={onOpenDice}>
        🎲
      </button>
      <RichComposer value={value} onChange={setValue} disabled={disabled} placeholder={placeholder} onSubmit={() => void submit()} />
      <button type="button" className="cb send" aria-label="Senden" disabled={disabled || !value.trim()} onClick={() => void submit()}>
        ➤
      </button>
    </div>
  );
}
