"use client";

import { useState } from "react";
import { ALLOWED_SIDES, formatStructuredPreview } from "@/lib/chat/dice-format";
import { RichComposer } from "./RichComposer";
import { Sheet } from "./ChannelList";

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

export function DiceSheet({
  postToChat,
  onPostToChat,
  onRoll,
  onClose,
}: {
  postToChat: boolean;
  onPostToChat: (next: boolean) => void;
  onRoll: (input: { terms: { n: number; m: number }[]; modifier: number }) => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState<number>(20);
  const [modifier, setModifier] = useState(0);
  const preview = formatStructuredPreview({ terms: [{ n: count, m: sides }], modifier });

  return (
    <Sheet title="Würfeln" onClose={onClose}>
      <div className="dice-dies">
        {ALLOWED_SIDES.map((value) => (
          <button key={value} type="button" className={value === sides ? "on" : ""} onClick={() => setSides(value)}>
            d{value}
          </button>
        ))}
      </div>
      <div className="row step-row">
        <span>Anzahl</span>
        <div className="stepper">
          <button type="button" onClick={() => setCount((value) => Math.max(1, value - 1))} aria-label="Weniger Würfel">
            −
          </button>
          <span>{count}</span>
          <button type="button" onClick={() => setCount((value) => Math.min(100, value + 1))} aria-label="Mehr Würfel">
            ＋
          </button>
        </div>
      </div>
      <div className="row step-row">
        <span>Modifikator</span>
        <div className="stepper">
          <button type="button" onClick={() => setModifier((value) => Math.max(-999, value - 1))} aria-label="Modifikator senken">
            −
          </button>
          <span>{modifier >= 0 ? `+${modifier}` : modifier}</span>
          <button type="button" onClick={() => setModifier((value) => Math.min(999, value + 1))} aria-label="Modifikator heben">
            ＋
          </button>
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
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          onRoll({ terms: [{ n: count, m: sides }], modifier });
          onClose();
        }}
      >
        {preview} würfeln
      </button>
      <p className="small muted">Das Ergebnis entsteht auf dem Server.</p>
    </Sheet>
  );
}

export function ThreadSheet({ onSubmit, onClose }: { onSubmit: (title: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  return (
    <Sheet title="Thread starten" onClose={onClose}>
      <div className="stack">
        <input
          value={title}
          maxLength={80}
          placeholder="Titel des Threads"
          aria-label="Titel des Threads"
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          type="button"
          className="btn primary"
          disabled={!title.trim()}
          onClick={() => onSubmit(title.trim())}
        >
          Starten
        </button>
      </div>
    </Sheet>
  );
}

export function ChannelSheet({
  name,
  canArchive,
  canMoveUp,
  canMoveDown,
  onRename,
  onArchive,
  onMove,
  onClose,
}: {
  name: string;
  canArchive: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: (name: string) => void;
  onArchive: () => void;
  onMove: (direction: -1 | 1) => void;
  onClose: () => void;
}) {
  const [nextName, setNextName] = useState(name);
  return (
    <Sheet title="Kanal verwalten" onClose={onClose}>
      <div className="stack">
        <input
          value={nextName}
          maxLength={80}
          aria-label="Kanalname"
          onChange={(event) => setNextName(event.target.value)}
        />
        <button type="button" className="btn primary" disabled={!nextName.trim()} onClick={() => onRename(nextName.trim())}>
          Umbenennen
        </button>
        <div className="row">
          <button type="button" className="btn" disabled={!canMoveUp} onClick={() => onMove(-1)}>
            Nach oben
          </button>
          <button type="button" className="btn" disabled={!canMoveDown} onClick={() => onMove(1)}>
            Nach unten
          </button>
        </div>
        <p className="small muted">Archivieren blendet den Kanal für alle aus. Nachrichten und Würfe bleiben erhalten.</p>
        <button type="button" className="btn danger" disabled={!canArchive} onClick={onArchive}>
          Archivieren
        </button>
      </div>
    </Sheet>
  );
}

export function NewChannelSheet({ onSubmit, onClose }: { onSubmit: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  return (
    <Sheet title="Neuer Kanal" onClose={onClose}>
      <div className="stack">
        <input
          value={name}
          maxLength={80}
          placeholder="Kanalname (max. 80 Zeichen)"
          aria-label="Kanalname"
          onChange={(event) => setName(event.target.value)}
        />
        <button type="button" className="btn primary" disabled={!name.trim()} onClick={() => onSubmit(name.trim())}>
          Anlegen
        </button>
      </div>
    </Sheet>
  );
}
