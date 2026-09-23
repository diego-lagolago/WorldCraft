"use client";

import { useState, type ReactNode } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { RichTextView } from "@/components/editor/RichTextView";
import { PIN_TYPE_META, pinTypeIconUrl, type PinType } from "@/lib/map/pin-types";
import type { MarkerDto, PinDetails, PlaceableCharacterDto } from "@/lib/map/types";
import type { RichDoc } from "@/lib/editor/rich-text";
import type { VisibilityStatus } from "@/lib/authz";

export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-bg" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="grab" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function PinViewSheet({
  pin,
  staff,
  worldId,
  onEdit,
  onClose,
  onLock,
  onUnlock,
  onDelete,
}: {
  pin: PinDetails;
  staff: boolean;
  worldId: string;
  onEdit: () => void;
  onClose: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onDelete: () => void;
}) {
  void worldId;
  return (
    <Sheet title={pin.title} onClose={onClose}>
      <div className="row">
        <img src={pinTypeIconUrl(pin.pinType)} width={36} height={44} alt="" />
        <div className="grow">
          <div className="kind">{PIN_TYPE_META.find((row) => row.id === pin.pinType)?.label}</div>
          {pin.visibility === "gm_only" ? <span className="badge">nur Spielleitung</span> : null}
          {pin.locked ? <span className="badge">gesperrt</span> : null}
        </div>
      </div>
      <div style={{ margin: "14px 0" }}>
        <RichTextView
          doc={pin.descriptionJson}
          mentions={pin.mentions}
          empty={<p className="muted">Keine Beschreibung.</p>}
        />
      </div>
      <div className="row" style={{ marginTop: 12, flexWrap: "wrap", gap: 8 }}>
        {staff && !pin.locked ? (
          <button type="button" className="btn grow" onClick={onEdit}>
            Bearbeiten
          </button>
        ) : null}
        {staff && !pin.locked ? (
          <button type="button" className="btn grow" onClick={onLock}>
            Sperren
          </button>
        ) : null}
        {staff && pin.locked ? (
          <button type="button" className="btn grow" onClick={onUnlock}>
            Entsperren
          </button>
        ) : null}
        {staff && !pin.locked ? (
          <button type="button" className="btn danger" onClick={onDelete}>
            Löschen
          </button>
        ) : null}
        <button type="button" className="btn grow" onClick={onClose}>
          Schließen
        </button>
      </div>
    </Sheet>
  );
}

export function PinFormSheet({
  title,
  worldId,
  staff,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  worldId: string;
  staff: boolean;
  initial: {
    pinType: PinType;
    title: string;
    description: RichDoc | null;
    visibility: VisibilityStatus;
  };
  onSave: (value: {
    pinType: PinType;
    title: string;
    description: RichDoc | null;
    visibility: VisibilityStatus;
  }) => void;
  onClose: () => void;
}) {
  const [pinType, setPinType] = useState<PinType>(initial.pinType);
  const [name, setName] = useState(initial.title);
  const [description, setDescription] = useState<RichDoc | null>(initial.description);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="type-grid" style={{ margin: "14px 0" }}>
        {PIN_TYPE_META.map((meta) => (
          <button
            key={meta.id}
            type="button"
            className={meta.id === pinType ? "on" : undefined}
            onClick={() => setPinType(meta.id)}
          >
            <img src={pinTypeIconUrl(meta.id)} alt="" />
            {meta.label}
          </button>
        ))}
      </div>
      <div className="stack">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Titel (Pflicht)" maxLength={120} />
        <RichTextEditor
          initialContent={initial.description}
          mentions={{ worldId, canCreateArticle: staff }}
          placeholder="Beschreibung (optional, @ für Erwähnungen)"
          ariaLabel="Pinbeschreibung"
          onChange={(change) => setDescription(change.doc)}
        />
        <div className="toggle">
          <span>
            Veröffentlicht <span className="small muted">(aus = nur Spielleitung)</span>
          </span>
          <button
            type="button"
            className="sw"
            role="switch"
            aria-checked={visibility === "published"}
            onClick={() => setVisibility((current) => (current === "published" ? "gm_only" : "published"))}
          />
        </div>
        {error ? <p className="chat-error">{error}</p> : null}
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            if (!name.trim()) {
              setError("Titel ist Pflicht.");
              return;
            }
            onSave({ pinType, title: name.trim(), description, visibility });
          }}
        >
          Speichern
        </button>
      </div>
    </Sheet>
  );
}

export function MarkerSheet({
  marker,
  canEdit,
  onClose,
  onRemove,
  href,
}: {
  marker: MarkerDto;
  canEdit: boolean;
  onClose: () => void;
  onRemove: () => void;
  href: string;
}) {
  return (
    <Sheet title={marker.name} onClose={onClose}>
      <p className="muted">Charakter-Marker</p>
      <div className="row" style={{ marginTop: 16 }}>
        <a className="btn grow" href={href}>
          Charakterbogen
        </a>
        {canEdit ? (
          <button type="button" className="btn danger" onClick={onRemove}>
            Entfernen
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}

export function PlaceCharacterSheet({
  characters,
  onPick,
  onClose,
}: {
  characters: PlaceableCharacterDto[];
  onPick: (characterId: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Charakter auf Karte setzen" onClose={onClose}>
      <p className="small muted">Ein Charakter kann nur auf einer Karte gleichzeitig sein.</p>
      <div className="list">
        {characters.map((character) => (
          <button
            key={character.id}
            type="button"
            className="item"
            style={{ width: "100%" }}
            disabled={character.placed}
            onClick={() => onPick(character.id)}
          >
            <span className="av">{character.name.slice(0, 1)}</span>
            <div className="grow" style={{ textAlign: "left" }}>
              {character.name}
              <div className="kind">
                {character.placed
                  ? "schon auf dieser Karte"
                  : character.placedElsewhere
                    ? "auf anderer Karte — wird verschoben"
                    : character.ownerName}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function CreateMapSheet({
  universes,
  defaultUniverseId,
  onClose,
  onSave,
}: {
  universes: { id: string; name: string }[];
  defaultUniverseId: string | null;
  onClose: () => void;
  onSave: (universeId: string, name: string) => void;
}) {
  const [universeId, setUniverseId] = useState(defaultUniverseId ?? universes[0]?.id ?? "");
  const [name, setName] = useState("Weltkarte");
  return (
    <Sheet title="Karte hinzufügen" onClose={onClose}>
      <label className="stack" style={{ gap: 6 }}>
        <span className="field-label">Universum</span>
        <select
          value={universeId}
          onChange={(event) => setUniverseId(event.target.value)}
          aria-label="Universum"
          required
        >
          {universes.map((universe) => (
            <option key={universe.id} value={universe.id}>
              {universe.name}
            </option>
          ))}
        </select>
      </label>
      <label className="stack" style={{ gap: 6, marginTop: 12 }}>
        <span className="field-label">Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          required
          aria-label="Kartenname"
          placeholder="z. B. Weltkarte"
        />
      </label>
      <p className="small muted" style={{ marginTop: 12 }}>
        Die Karte startet ohne Bild. Das Bild lädst du danach in der Kartenansicht hoch.
      </p>
      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        <button type="button" className="btn grow" onClick={onClose}>
          Abbrechen
        </button>
        <button
          type="button"
          className="btn primary grow"
          disabled={!universeId || !name.trim()}
          onClick={() => onSave(universeId, name.trim())}
        >
          Anlegen
        </button>
      </div>
    </Sheet>
  );
}

/** Checkbox confirm before replacing an existing map image (pins stay). */
export function ReplaceImageDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="card stack dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-replace-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="map-replace-title" style={{ margin: 0 }}>
          Kartenbild ersetzen?
        </h2>
        <p className="muted">
          Das aktuelle Kartenbild wird überschrieben. Alle Pins und Charakter-Marker bleiben an ihren Positionen.
        </p>
        <label className="confirm-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span>Ich verstehe — Bild ersetzen, Pins bleiben.</span>
        </label>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn grow" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="button" className="btn primary grow" disabled={!checked} onClick={onConfirm}>
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}

