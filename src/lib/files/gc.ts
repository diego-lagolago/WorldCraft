import { unlink } from "node:fs/promises";
import { and, inArray, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/db/client";
import { FILE_REFERENCE_COLUMNS, files } from "@/db/schema";
import { storedFilePath } from "./store";

function notReferencedBy(column: AnyColumn) {
  return sql`NOT EXISTS (SELECT 1 FROM ${column.table} WHERE ${column} = ${files.id})`;
}

/**
 * APP-FILE-GC: deletes candidate files that no row references any more and
 * removes them from the volume. One DELETE for all candidates, no per-file query.
 * Reference list: `FILE_REFERENCE_COLUMNS` in the schema.
 */
export async function collectUnreferencedFiles(candidateIds: readonly (string | null | undefined)[]) {
  const ids = [...new Set(candidateIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;

  const removed = await db
    .delete(files)
    .where(and(inArray(files.id, ids), ...FILE_REFERENCE_COLUMNS.map(notReferencedBy)))
    .returning({ storageKey: files.storageKey });

  await Promise.all(
    removed.map((row) =>
      unlink(storedFilePath(row.storageKey)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      }),
    ),
  );
}
