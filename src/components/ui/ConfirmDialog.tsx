"use client";

import { useEffect, useRef } from "react";
import { confirmDialogKey } from "./confirm-dialog";

type Props = {
  title: string;
  preview: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  preview,
  confirmLabel = "Löschen",
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
    onCancelRef.current = onCancel;
  }, [onConfirm, onCancel]);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const focusedCancel = document.activeElement === cancelRef.current;
      const action = confirmDialogKey(event.key, focusedCancel);
      if (action === "cancel") {
        event.preventDefault();
        onCancelRef.current();
      } else if (action === "confirm") {
        event.preventDefault();
        onConfirmRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="sheet-bg" role="presentation" onClick={() => onCancelRef.current()}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grab" />
        <h2>{title}</h2>
        {preview ? <p className="confirm-preview muted">{preview}</p> : null}
        <p className="small muted">Tipp: Mit gedrückter Umschalttaste ohne Nachfrage löschen.</p>
        <div className="row confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn grow"
            onClick={() => onCancelRef.current()}
          >
            Abbrechen
          </button>
          <button type="button" className="btn danger grow" onClick={() => onConfirmRef.current()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
