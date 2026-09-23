import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { files } from "@/db/schema";
import { fileStorageRoot } from "@/lib/files/paths";
import { inspectImage, isImageError, type InspectedImage } from "./inspect";

export function storedFilePath(storageKey: string): string {
  if (!/^files\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(storageKey)) {
    throw new Error("Ungültiger Dateischlüssel.");
  }
  const absolute = path.resolve(fileStorageRoot(), storageKey);
  const root = path.resolve(fileStorageRoot());
  if (!absolute.startsWith(root + path.sep)) {
    throw new Error("Ungültiger Dateischlüssel.");
  }
  return absolute;
}

export async function persistImage(input: {
  bytes: Buffer;
  createdBy: string;
  maxBytes: number;
}): Promise<{ id: string; image: InspectedImage } | { error: string }> {
  const image = inspectImage(input.bytes, input.maxBytes);
  if (isImageError(image)) return image;

  const id = randomUUID();
  const storageKey = `files/${id}.${image.ext}`;
  const absolute = storedFilePath(storageKey);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, input.bytes);

  try {
    await db.insert(files).values({
      id,
      storageKey,
      mime: image.mime,
      byteSize: input.bytes.byteLength,
      widthPx: image.width,
      heightPx: image.height,
      createdBy: input.createdBy,
    });
  } catch (error) {
    await unlink(absolute).catch(() => undefined);
    throw error;
  }

  return { id, image };
}

export async function removeStoredFile(fileId: string): Promise<void> {
  const [row] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!row) return;
  await db.delete(files).where(eq(files.id, fileId));
  await unlink(storedFilePath(row.storageKey)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export function openStoredFile(storageKey: string): ReadableStream {
  return Readable.toWeb(createReadStream(storedFilePath(storageKey))) as ReadableStream;
}
