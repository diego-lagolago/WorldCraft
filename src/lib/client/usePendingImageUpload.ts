"use client";

import { useEffect, useState, type ChangeEvent } from "react";

/**
 * Hold a chosen image file until after create, then upload to the new target.
 * Shared by article title image (T-009) and monster portrait (T-008).
 */
export function usePendingImageUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function chooseFile(next: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    event.target.value = "";
    chooseFile(next);
  }

  function clear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
  }

  return { file, previewUrl, choose, chooseFile, clear, hasFile: !!file };
}
