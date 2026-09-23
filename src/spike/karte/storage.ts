/** Spike T-009 — lokale Dateien unter FILE_STORAGE_PATH, kein Seed-Kartenbild. */

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileStorageRoot } from "@/lib/files/paths";

const SPIKE_SUBDIR = "spike";

export const MAX_MAP_BYTES = 20 * 1024 * 1024;

export const ALLOWED_MAP_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export { fileStorageRoot };

export function spikeImageAbsolutePath(filename: string): string {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)) {
    throw new Error("Ungültiger Spike-Dateiname.");
  }
  return path.join(fileStorageRoot(), SPIKE_SUBDIR, filename);
}

export async function saveSpikeImage(
  mapId: string,
  extension: string,
  bytes: Buffer,
): Promise<string> {
  const filename = `${mapId}${extension}`;
  const dir = path.join(fileStorageRoot(), SPIKE_SUBDIR);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  return filename;
}

export async function removeSpikeImage(filename: string | null | undefined): Promise<void> {
  if (!filename) return;
  try {
    await unlink(spikeImageAbsolutePath(filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
