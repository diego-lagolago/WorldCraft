import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { articles, characters, worldParticipations } from "@/db/schema";
import {
  authorizeOwnedContentWrite,
  canSeeContent,
  contentVisibilitySchema,
  fail,
  ok,
  requireStaff,
  type AuthzResult,
  type ContentVisibility,
  type MembershipRole,
  type MembershipRow,
} from "@/lib/authz";
import { parseUuid } from "@/lib/http";
import { collectUnreferencedFiles } from "@/lib/files/gc";
import { swapSingleImage } from "@/lib/files/single-image";
import {
  keepCompatibleFields,
  parseTemplateFields,
  templateFieldsHaveValue,
  type StoredTemplateFields,
} from "@/lib/templates/fields";
import {
  TEMPLATE_TYPES,
  isTemplateType,
  templateOf,
  type TemplateRefValue,
  type TemplateType,
} from "@/lib/templates/registry";
import { mapDbError } from "./db-errors";
import { visibleContentWhere } from "./visibility-sql";
import { recalcArticleRelations } from "./relations";
import { richFieldFromInput } from "./rich-field";

export const ARTICLE_TITLE_MAX = 200;
export const articleTitleSchema = z.string().trim().min(1).max(ARTICLE_TITLE_MAX);
export const articleTemplateSchema = z.enum(TEMPLATE_TYPES);

const NOT_FOUND = "Diesen Artikel gibt es nicht.";

const articleFields = {
  title: articleTitleSchema,
  templateType: articleTemplateSchema,
  templateFields: z.unknown(),
  body: z.unknown(),
  visibility: contentVisibilitySchema,
  removeTitleImage: z.literal(true),
};

export const articleCreateSchema = z.object({
  title: articleFields.title,
  templateType: articleFields.templateType.optional(),
  templateFields: articleFields.templateFields.optional(),
  body: articleFields.body.optional(),
  visibility: articleFields.visibility.optional(),
});

export const articleUpdateSchema = z
  .object({
    title: articleFields.title.optional(),
    templateType: articleFields.templateType.optional(),
    templateFields: articleFields.templateFields.optional(),
    body: articleFields.body.optional(),
    visibility: articleFields.visibility.optional(),
    removeTitleImage: articleFields.removeTitleImage.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export type ArticleSummary = {
  id: string;
  title: string;
  templateType: string;
  visibility: ContentVisibility;
  ownerId: string;
  firstEditedAt: Date | null;
  updatedAt: Date;
  titleImageId: string | null;
  isQuestItem: boolean;
};

export type ArticleDetails = ArticleSummary & {
  worldId: string;
  bodyJson: unknown;
  templateFields: StoredTemplateFields;
};

/** Compact list shape; the list alone selects item rarity for its pill. */
export type ArticleListItem = ArticleSummary & { rarity: string | null };

const summaryColumns = {
  id: articles.id,
  title: articles.title,
  templateType: articles.templateType,
  visibility: articles.visibility,
  ownerId: articles.ownerId,
  firstEditedAt: articles.firstEditedAt,
  updatedAt: articles.updatedAt,
  titleImageId: articles.titleImageId,
  isQuestItem: sql<boolean>`(${articles.templateFields}->>'quest')::boolean IS TRUE`,
};

function asFields(value: unknown): StoredTemplateFields {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as StoredTemplateFields;
  return {};
}

function isEdited(plain: string | null | undefined, fields: StoredTemplateFields): boolean {
  return Boolean(plain?.trim()) || templateFieldsHaveValue(fields);
}

async function assertRefTargets(
  worldId: string,
  type: TemplateType,
  fields: StoredTemplateFields,
): Promise<AuthzResult<true>> {
  const refs: { key: string; value: TemplateRefValue }[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "object" && value && "kind" in value) refs.push({ key, value });
  }
  if (refs.length === 0) return ok(true);

  for (const ref of refs) {
    if (!parseUuid(ref.value.id)) return fail(400, "Ein Verweis ist ungültig.");
  }

  const articleIds = refs.filter((ref) => ref.value.kind === "article").map((ref) => ref.value.id);
  const characterIds = refs.filter((ref) => ref.value.kind === "character").map((ref) => ref.value.id);
  const articleRows = articleIds.length
    ? await db
        .select({ id: articles.id, templateType: articles.templateType })
        .from(articles)
        .where(and(eq(articles.worldId, worldId), inArray(articles.id, articleIds)))
    : [];
  const characterRows = characterIds.length
    ? await db
        .select({ id: characters.id })
        .from(characters)
        .innerJoin(
          worldParticipations,
          and(
            eq(worldParticipations.characterId, characters.id),
            eq(worldParticipations.worldId, worldId),
            isNull(worldParticipations.archivedAt),
          ),
        )
        .where(inArray(characters.id, characterIds))
    : [];
  const articlesById = new Map(articleRows.map((row) => [row.id, row]));
  const charactersById = new Set(characterRows.map((row) => row.id));
  const fieldByKey = new Map(templateOf(type).fields.map((field) => [field.key, field]));

  for (const ref of refs) {
    const field = fieldByKey.get(ref.key);
    if (!field || field.type !== "ref") return fail(400, "Ein Verweis ist ungültig.");
    if (ref.value.kind === "character") {
      if (!field.targets.some((target) => target.kind === "character") || !charactersById.has(ref.value.id)) {
        return fail(400, `„${field.label}“ akzeptiert dieses Ziel nicht.`);
      }
      continue;
    }
    const target = articlesById.get(ref.value.id);
    const allowed = field.targets.some(
      (entry) => entry.kind === "article" && target && isTemplateType(target.templateType) && entry.templateType === target.templateType,
    );
    if (!allowed) return fail(400, `„${field.label}“ akzeptiert dieses Ziel nicht.`);
  }
  return ok(true);
}

async function fieldsFrom(type: TemplateType, raw: unknown, worldId: string): Promise<AuthzResult<StoredTemplateFields>> {
  const parsed = parseTemplateFields(type, raw ?? {});
  if (!parsed.ok) return parsed;
  const refs = await assertRefTargets(worldId, type, parsed.data);
  if (!refs.ok) return refs;
  return parsed;
}

/** Drops stored refs whose target is gone or incompatible with a new template. */
async function keepCompatibleRefTargets(
  worldId: string,
  type: TemplateType,
  fields: StoredTemplateFields,
): Promise<StoredTemplateFields> {
  const refs: { key: string; value: TemplateRefValue }[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "object" && value && "kind" in value) refs.push({ key, value });
  }
  if (refs.length === 0) return fields;

  const articleIds = refs.filter((ref) => ref.value.kind === "article").map((ref) => ref.value.id);
  const characterIds = refs.filter((ref) => ref.value.kind === "character").map((ref) => ref.value.id);
  const [articleRows, characterRows] = await Promise.all([
    articleIds.length
      ? db
          .select({ id: articles.id, templateType: articles.templateType })
          .from(articles)
          .where(and(eq(articles.worldId, worldId), inArray(articles.id, articleIds)))
      : [],
    characterIds.length
      ? db
          .select({ id: characters.id })
          .from(characters)
          .innerJoin(
            worldParticipations,
            and(
              eq(worldParticipations.characterId, characters.id),
              eq(worldParticipations.worldId, worldId),
              isNull(worldParticipations.archivedAt),
            ),
          )
          .where(inArray(characters.id, characterIds))
      : [],
  ]);
  const articlesById = new Map(articleRows.map((row) => [row.id, row]));
  const characterIdsInWorld = new Set(characterRows.map((row) => row.id));
  const fieldByKey = new Map(templateOf(type).fields.map((field) => [field.key, field]));
  const out = { ...fields };

  for (const ref of refs) {
    const field = fieldByKey.get(ref.key);
    const allowed =
      field?.type === "ref" &&
      (ref.value.kind === "character"
        ? field.targets.some((target) => target.kind === "character") && characterIdsInWorld.has(ref.value.id)
        : field.targets.some(
            (target) =>
              target.kind === "article" &&
              articlesById.get(ref.value.id) &&
              isTemplateType(articlesById.get(ref.value.id)?.templateType) &&
              target.templateType === articlesById.get(ref.value.id)?.templateType,
          ));
    if (!allowed) delete out[ref.key];
  }
  return out;
}

/** Visible articles of a world, title A–Z; optional template filter. */
export async function listArticles(
  worldId: string,
  role: MembershipRole,
  viewerId: string,
  templateType?: TemplateType | "all",
): Promise<ArticleListItem[]> {
  const filters = [
    eq(articles.worldId, worldId),
    visibleContentWhere({ visibility: articles.visibility, ownerId: articles.ownerId }, { role, userId: viewerId }),
  ];
  if (templateType && templateType !== "all") filters.push(eq(articles.templateType, templateType));

  const rows = await db
    .select({ ...summaryColumns, rarity: sql<string | null>`${articles.templateFields}->>'rarity'` })
    .from(articles)
    .where(and(...filters))
    .orderBy(asc(articles.title));
  return rows.filter((row) =>
    canSeeContent({ role, userId: viewerId }, { visibility: row.visibility, ownerId: row.ownerId }),
  );
}

export async function getArticle(
  worldId: string,
  articleId: string,
  role: MembershipRole,
  viewerId: string,
): Promise<ArticleDetails | null> {
  const [row] = await db
    .select({
      ...summaryColumns,
      worldId: articles.worldId,
      bodyJson: articles.bodyJson,
      templateFields: articles.templateFields,
    })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.worldId, worldId)))
    .limit(1);
  if (
    !row ||
    !canSeeContent({ role, userId: viewerId }, { visibility: row.visibility, ownerId: row.ownerId })
  ) {
    return null;
  }
  return { ...row, templateFields: asFields(row.templateFields) };
}

type ArticlePatch = Partial<typeof articles.$inferInsert>;

async function toPatch(
  worldId: string,
  input: {
    title?: string;
    templateType?: TemplateType;
    templateFields?: unknown;
    body?: unknown;
    visibility?: ContentVisibility;
    removeTitleImage?: true;
  },
  current?: { templateType: string; templateFields: unknown; bodyPlain: string | null; firstEditedAt: Date | null },
): Promise<AuthzResult<ArticlePatch>> {
  const patch: ArticlePatch = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.visibility !== undefined) patch.visibility = input.visibility;

  const nextType: TemplateType = input.templateType ?? (isTemplateType(current?.templateType) ? current.templateType : "none");
  if (input.templateType !== undefined) patch.templateType = input.templateType;

  let fields: StoredTemplateFields | undefined;
  if (input.templateFields !== undefined || input.templateType !== undefined) {
    if (input.templateFields !== undefined) {
      const parsed = await fieldsFrom(nextType, input.templateFields, worldId);
      if (!parsed.ok) return parsed;
      fields = parsed.data;
    } else {
      fields = await keepCompatibleRefTargets(worldId, nextType, keepCompatibleFields(nextType, current?.templateFields));
    }
    patch.templateFields = fields;
  }

  let plain = current?.bodyPlain ?? null;
  if (input.body !== undefined) {
    const body = richFieldFromInput(input.body, { mentions: true });
    if (!body.ok) return body;
    patch.bodyJson = body.data.json;
    patch.bodyPlain = body.data.plain;
    plain = body.data.plain;
  }

  const storedFields = fields ?? asFields(current?.templateFields);
  if (!current?.firstEditedAt && isEdited(plain, storedFields)) {
    patch.firstEditedAt = new Date();
  }
  return ok(patch);
}

export async function createArticle(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  title: string;
  templateType?: TemplateType;
  templateFields?: unknown;
  body?: unknown;
  visibility?: ContentVisibility;
}): Promise<AuthzResult<ArticleSummary>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const patch = await toPatch(input.worldId, input);
  if (!patch.ok) return patch;
  try {
    const row = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(articles)
        .values({
          ...patch.data,
          worldId: input.worldId,
          title: input.title,
          ownerId: input.actorId,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })
        .returning(summaryColumns);
      await recalcArticleRelations(input.worldId, input.actorId, created.id, tx);
      return created;
    });
    return ok(row);
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

/** Stub from the `@` flow: title only, `owner_only`, `first_edited_at` stays null. */
export async function createArticleStub(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  title: string;
}): Promise<AuthzResult<{ id: string; title: string; templateType: string }>> {
  const created = await createArticle(input);
  if (!created.ok) return created;
  return ok({ id: created.data.id, title: created.data.title, templateType: created.data.templateType });
}

export async function updateArticle(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  articleId: string;
  title?: string;
  templateType?: TemplateType;
  templateFields?: unknown;
  body?: unknown;
  visibility?: ContentVisibility;
  removeTitleImage?: true;
}): Promise<AuthzResult<{ id: string }>> {
  const [current] = await db
    .select({
      id: articles.id,
      templateType: articles.templateType,
      templateFields: articles.templateFields,
      bodyPlain: articles.bodyPlain,
      firstEditedAt: articles.firstEditedAt,
      titleImageId: articles.titleImageId,
      ownerId: articles.ownerId,
      visibility: articles.visibility,
    })
    .from(articles)
    .where(and(eq(articles.id, input.articleId), eq(articles.worldId, input.worldId)))
    .limit(1);
  const allowed = authorizeOwnedContentWrite({
    membership: input.membership,
    content: current ? { ownerId: current.ownerId, visibility: current.visibility } : null,
    nextVisibility: input.visibility,
    notFoundError: NOT_FOUND,
  });
  if (!allowed.ok) return allowed;
  if (!current) return fail(404, NOT_FOUND);
  const patch = await toPatch(input.worldId, input, current);
  if (!patch.ok) return patch;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(articles)
        .set({ ...patch.data, updatedAt: new Date(), updatedBy: input.actorId })
        .where(eq(articles.id, current.id));
      await recalcArticleRelations(input.worldId, input.actorId, current.id, tx);
    });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
  if (input.removeTitleImage) {
    const previousImage = await swapSingleImage({
      kind: "article_title",
      worldId: input.worldId,
      targetId: current.id,
      fileId: null,
      actorId: input.actorId,
    });
    await collectUnreferencedFiles([previousImage]);
  }
  return ok({ id: current.id });
}

export async function deleteArticle(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  articleId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const [current] = await db
    .select({
      id: articles.id,
      titleImageId: articles.titleImageId,
      ownerId: articles.ownerId,
      visibility: articles.visibility,
    })
    .from(articles)
    .where(and(eq(articles.id, input.articleId), eq(articles.worldId, input.worldId)))
    .limit(1);
  const allowed = authorizeOwnedContentWrite({
    membership: input.membership,
    content: current ? { ownerId: current.ownerId, visibility: current.visibility } : null,
    notFoundError: NOT_FOUND,
  });
  if (!allowed.ok) return allowed;
  if (!current) return fail(404, NOT_FOUND);
  await db.delete(articles).where(eq(articles.id, current.id));
  await collectUnreferencedFiles([current.titleImageId]);
  return ok({ id: current.id });
}

export type ArticleRefOption = { kind: "article" | "character"; id: string; title: string; templateType?: string };

/** Dropdown candidates for template ref fields of one world. */
export async function listArticleRefOptions(worldId: string): Promise<ArticleRefOption[]> {
  const [articleRows, characterRows] = await Promise.all([
    db
      .select({ id: articles.id, title: articles.title, templateType: articles.templateType })
      .from(articles)
      .where(eq(articles.worldId, worldId))
      .orderBy(asc(articles.title)),
    db
      .select({ id: characters.id, title: characters.name })
      .from(characters)
      .innerJoin(
        worldParticipations,
        and(
          eq(worldParticipations.characterId, characters.id),
          eq(worldParticipations.worldId, worldId),
          isNull(worldParticipations.archivedAt),
        ),
      )
      .orderBy(asc(characters.name)),
  ]);
  return [
    ...articleRows.map((row) => ({ kind: "article" as const, id: row.id, title: row.title, templateType: row.templateType })),
    ...characterRows.map((row) => ({ kind: "character" as const, id: row.id, title: row.title })),
  ];
}
