import { imageSize } from "image-size";
import type { ImageKind } from "./kinds";

export const MAP_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const OTHER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export { CHARACTER_IMAGES_MAX as MAX_CHARACTER_IMAGES } from "@/lib/characters/sheet";

/** Byte limit for an upload of the given image kind (`map` is larger). */
export function maxBytesFor(kind: ImageKind): number {
  return kind === "map" ? MAP_IMAGE_MAX_BYTES : OTHER_IMAGE_MAX_BYTES;
}

const ALLOWED = {
  jpg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
} as const;

export type InspectedImage = {
  mime: string;
  ext: string;
  width: number;
  height: number;
};

export type ImageError = { error: string };

/** Detects the real format from bytes. The client-supplied MIME is ignored. */
export function inspectImage(bytes: Buffer, maxBytes: number): InspectedImage | ImageError {
  if (bytes.byteLength === 0) {
    return { error: "Die Datei ist leer." };
  }
  let detected: ReturnType<typeof imageSize>;
  try {
    detected = imageSize(bytes);
  } catch {
    return { error: "Nur JPEG, PNG oder WebP." };
  }
  const type = detected.type;
  const allowed = type === "jpg" || type === "png" || type === "webp" ? ALLOWED[type] : null;
  if (!allowed || !detected.width || !detected.height) {
    return { error: "Nur JPEG, PNG oder WebP." };
  }
  if (bytes.byteLength > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    return { error: `Das Bild darf höchstens ${limitMb} MB groß sein.` };
  }
  return {
    mime: allowed.mime,
    ext: allowed.ext,
    width: detected.width,
    height: detected.height,
  };
}

export function isImageError(value: InspectedImage | ImageError): value is ImageError {
  return "error" in value;
}
