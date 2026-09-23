"use client";

import { useState, type ChangeEvent } from "react";
import { uploadImage, type ApiResult } from "@/lib/client/api";

/**
 * Hold a chosen image file until after create, then upload to the new target.
 * Shared by article title image (T-009) and monster portrait (T-008).
 */
export function usePendingImageUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  function clear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
  }

  async function uploadAfterCreate(input: {
    kind: string;
    worldId?: string;
    targetId: string;
  }): Promise<ApiResult<{ fileId: string }> | null> {
    if (!file) return null;
    return uploadImage({ file, kind: input.kind, worldId: input.worldId, targetId: input.targetId });
  }

  return { file, previewUrl, choose, clear, uploadAfterCreate, hasFile: !!file };
}
