"use client";

import { useState } from "react";
import { CHANNEL_NAME_MAX, THREAD_TITLE_MAX } from "@/lib/chat/types";
import { Sheet } from "./ChannelList";

export function ThreadSheet({ onSubmit, onClose }: { onSubmit: (title: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  return (
    <Sheet title="Thread starten" onClose={onClose}>
      <div className="stack">
        <input
          value={title}
          maxLength={THREAD_TITLE_MAX}
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
          maxLength={CHANNEL_NAME_MAX}
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
          maxLength={CHANNEL_NAME_MAX}
          placeholder={`Kanalname (max. ${CHANNEL_NAME_MAX} Zeichen)`}
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

export function RenameThreadSheet({
  title,
  onSubmit,
  onClose,
}: {
  title: string;
  onSubmit: (title: string) => void;
  onClose: () => void;
}) {
  const [nextTitle, setNextTitle] = useState(title);
  return (
    <Sheet title="Thread umbenennen" onClose={onClose}>
      <div className="stack">
        <input
          value={nextTitle}
          maxLength={THREAD_TITLE_MAX}
          aria-label="Thread-Titel"
          onChange={(event) => setNextTitle(event.target.value)}
        />
        <button
          type="button"
          className="btn primary"
          disabled={!nextTitle.trim()}
          onClick={() => onSubmit(nextTitle.trim())}
        >
          Speichern
        </button>
      </div>
    </Sheet>
  );
}
