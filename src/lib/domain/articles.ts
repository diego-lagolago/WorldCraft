import { z } from "zod";
import { db } from "@/db/client";
import { articles } from "@/db/schema";
import { ok, requireStaff, type AuthzResult, type MembershipRow } from "@/lib/authz";
import { mapDbError } from "./db-errors";

export const ARTICLE_TITLE_MAX = 200;

export const articleTitleSchema = z.string().trim().min(1).max(ARTICLE_TITLE_MAX);

export type ArticleSummary = { id: string; title: string; templateType: string };

/**
 * Stub from the `@` flow (erwaehnungen.md): only the title, `gm_only`,
 * `first_edited_at` stays null so the mention renders red until the first edit.
 */
export async function createArticleStub(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  title: string;
}): Promise<AuthzResult<ArticleSummary>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  try {
    const [row] = await db
      .insert(articles)
      .values({
        worldId: input.worldId,
        title: input.title,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning({ id: articles.id, title: articles.title, templateType: articles.templateType });
    return ok(row);
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}
