import { unlink } from "node:fs/promises";
import { and, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { files } from "@/db/schema";
import { storedFilePath } from "./store";

/**
 * APP-FILE-GC: deletes candidate files that no row references any more and
 * removes them from the volume. One DELETE for all candidates, no per-file query.
 */
export async function collectUnreferencedFiles(candidateIds: readonly (string | null | undefined)[]) {
  const ids = [...new Set(candidateIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;

  const removed = await db
    .delete(files)
    .where(
      and(
        inArray(files.id, ids),
        sql`NOT EXISTS (SELECT 1 FROM worlds WHERE title_image_id = ${files.id})`,
        sql`NOT EXISTS (SELECT 1 FROM articles WHERE title_image_id = ${files.id})`,
        sql`NOT EXISTS (SELECT 1 FROM maps WHERE image_id = ${files.id})`,
        sql`NOT EXISTS (SELECT 1 FROM characters WHERE portrait_id = ${files.id})`,
        sql`NOT EXISTS (SELECT 1 FROM character_images WHERE file_id = ${files.id})`,
      ),
    )
    .returning({ storageKey: files.storageKey });

  await Promise.all(
    removed.map((row) =>
      unlink(storedFilePath(row.storageKey)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      }),
    ),
  );
}
