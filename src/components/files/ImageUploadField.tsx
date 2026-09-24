"use client";

import { useState, type ChangeEvent, type RefObject } from "react";
import { uploadImage } from "@/lib/client/api";
import type { ImageKind } from "@/lib/files/kinds";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

type BaseProps = {
  label?: string;
  disabled?: boolean;
  removeLabel?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  hideButton?: boolean;
};

type PendingProps = BaseProps & {
  mode: "pending";
  onFileChange: (file: File | null) => void;
  onRemove?: () => void;
};

type ImmediateProps = BaseProps & {
  mode: "immediate";
  upload: { kind: ImageKind; worldId?: string; targetId?: string };
  onUploaded?: () => void;
  onError?: (error: string) => void;
  onRemove?: () => Promise<{ ok: boolean; error?: string }> | void;
};

/** The only file-input UI. Both deferred and direct uploads use `uploadImage`. */
export function ImageUploadField(props: PendingProps | ImmediateProps) {
  const { inputRef, hideButton, label, disabled: disabledProp, removeLabel, onRemove } = props;
  const [pending, setPending] = useState(false);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (props.mode === "pending") {
      props.onFileChange(file);
      return;
    }
    setPending(true);
    const result = await uploadImage({ file, ...props.upload });
    setPending(false);
    if (result.ok) props.onUploaded?.();
    else props.onError?.(result.error);
  }

  async function remove() {
    if (!onRemove) return;
    if (props.mode === "pending") {
      props.onFileChange(null);
      onRemove();
      return;
    }
    setPending(true);
    const result = await onRemove();
    setPending(false);
    if (result && !result.ok) props.onError?.(result.error ?? "Das hat nicht geklappt.");
    else props.onUploaded?.();
  }

  const disabled = Boolean(disabledProp || pending);
  return (
    <div className="row wrap">
      <label className={hideButton ? "sr-only" : "btn sm"} style={{ alignSelf: "flex-start" }}>
        {label ?? "Bild wählen"}
        <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={choose} disabled={disabled} />
      </label>
      {onRemove ? (
        <button type="button" className="btn sm" disabled={disabled} onClick={() => void remove()}>
          {removeLabel ?? "Entfernen"}
        </button>
      ) : null}
    </div>
  );
}
