"use client";

import { useEffect, useRef } from "react";
import { confirmDialogKey, nextFocusIndex } from "./confirm-dialog";

type Props = {
  title: string;
  preview: string;
  confirmLabel?: string;
  hint?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  preview,
  confirmLabel = "Bestätigen",
  hint,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
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
    function focusables(): HTMLButtonElement[] {
      return [cancelRef.current, confirmRef.current].filter(
        (node): node is HTMLButtonElement => node != null,
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab") {
        const nodes = focusables();
        if (nodes.length === 0) return;
        const current = nodes.findIndex((node) => node === document.activeElement);
        const next = nextFocusIndex(current < 0 ? 0 : current, nodes.length, event.shiftKey);
        event.preventDefault();
        nodes[next]?.focus();
        return;
      }

      const focusedConfirm = document.activeElement === confirmRef.current;
      const action = confirmDialogKey(event.key, focusedConfirm);
      if (action === "cancel") {
        event.preventDefault();
        onCancelRef.current();
      }
      // Enter on confirm → "none": native button activation fires onConfirm.
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
        {hint ? <p className="small muted">{hint}</p> : null}
        <div className="row confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn grow"
            onClick={() => onCancelRef.current()}
          >
            Abbrechen
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn danger grow"
            onClick={() => onConfirmRef.current()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
