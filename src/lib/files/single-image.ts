import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { articles, characters, monsters, worlds } from "@/db/schema";

type SwapTarget =
  | { kind: "world_title"; targetId: string }
  | { kind: "article_title"; targetId: string; worldId: string }
  | { kind: "monster_portrait"; targetId: string; worldId: string }
  | { kind: "character_portrait"; targetId: string };

/**
 * Atomically replaces (or clears) one image reference. Reading the old value
 * happens under a row lock, so concurrent writers pass every replaced file to
 * GC instead of leaving an orphan behind.
 */
export async function swapSingleImage(input: SwapTarget & { fileId: string | null; actorId: string }): Promise<string | null | undefined> {
  return db.transaction(async (tx) => {
    const stamp = { updatedAt: new Date(), updatedBy: input.actorId };
    switch (input.kind) {
      case "world_title": {
        const [current] = await tx
          .select({ fileId: worlds.titleImageId })
          .from(worlds)
          .where(eq(worlds.id, input.targetId))
          .for("update");
        if (!current) return undefined;
        await tx.update(worlds).set({ titleImageId: input.fileId, ...stamp }).where(eq(worlds.id, input.targetId));
        return current.fileId;
      }
      case "article_title": {
        const [current] = await tx
          .select({ fileId: articles.titleImageId })
          .from(articles)
          .where(and(eq(articles.id, input.targetId), eq(articles.worldId, input.worldId)))
          .for("update");
        if (!current) return undefined;
        await tx.update(articles).set({ titleImageId: input.fileId, ...stamp }).where(eq(articles.id, input.targetId));
        return current.fileId;
      }
      case "monster_portrait": {
        const [current] = await tx
          .select({ fileId: monsters.portraitId })
          .from(monsters)
          .where(and(eq(monsters.id, input.targetId), eq(monsters.worldId, input.worldId)))
          .for("update");
        if (!current) return undefined;
        await tx.update(monsters).set({ portraitId: input.fileId, ...stamp }).where(eq(monsters.id, input.targetId));
        return current.fileId;
      }
      case "character_portrait": {
        const [current] = await tx
          .select({ fileId: characters.portraitId })
          .from(characters)
          .where(eq(characters.id, input.targetId))
          .for("update");
        if (!current) return undefined;
        await tx.update(characters).set({ portraitId: input.fileId, ...stamp }).where(eq(characters.id, input.targetId));
        return current.fileId;
      }
    }
  });
}
