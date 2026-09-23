import { z } from "zod";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  articles,
  characters,
  maps,
  pins,
  questChapters,
  questParticipants,
  quests,
  relations,
  universes,
  worldParticipations,
} from "@/db/schema";
import {
  canSeePublishedLayer,
  canSeeVisibility,
  fail,
  ok,
  requireStaff,
  relationVisible,
  type AuthzResult,
  type ContentKind,
  type MembershipRole,
  type MembershipRow,
  type RelationOrigin,
  CONTENT_KINDS,
} from "@/lib/authz";
import { contentHref } from "@/lib/content-href";
import { mentionKey, type MentionRef } from "@/lib/editor/mentions";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { parseUuid } from "@/lib/http";
import { type LinkedItem, type RelationTargetOption } from "@/lib/domain/linked";
import { mapDbError } from "@/lib/domain/db-errors";
import type { StoredTemplateFields } from "@/lib/templates/fields";

const ORIGIN_LABEL: Record<RelationOrigin, string> = {
  mention: "Erwähnung",
  template_field: "Vorlagenfeld",
  participation: "Beteiligung",
  manual: "manuell",
};

const SOURCE_FK = {
  article: relations.sourceArticleId,
  quest: relations.sourceQuestId,
  character: relations.sourceCharacterId,
  pin: relations.sourcePinId,
  universe: relations.sourceUniverseId,
} as const;

function sourceValues(kind: ContentKind, id: string) {
  return {
    sourceKind: kind,
    sourceArticleId: kind === "article" ? id : null,
    sourceQuestId: kind === "quest" ? id : null,
    sourceCharacterId: kind === "character" ? id : null,
    sourcePinId: kind === "pin" ? id : null,
    sourceUniverseId: kind === "universe" ? id : null,
  };
}

function targetValues(kind: ContentKind, id: string) {
  return {
    targetKind: kind,
    targetArticleId: kind === "article" ? id : null,
    targetQuestId: kind === "quest" ? id : null,
    targetCharacterId: kind === "character" ? id : null,
    targetPinId: kind === "pin" ? id : null,
    targetUniverseId: kind === "universe" ? id : null,
  };
}

/**
 * APP-REL-RECALC for mention origins of one source. Manual, template_field and
 * participation rows stay. Missing targets are skipped (the next save retries).
 */
export async function recalcOutgoingMentions(input: {
  worldId: string;
  actorId: string;
  sourceKind: ContentKind;
  sourceId: string;
  mentions: readonly MentionRef[];
}): Promise<void> {
  const unique = new Map<string, MentionRef>();
  for (const mention of input.mentions) {
    if (mention.kind === input.sourceKind && mention.id === input.sourceId) continue;
    unique.set(mentionKey(mention), mention);
  }
  const mentions = [...unique.values()];
  const existing = await existingMentionTargets(input.worldId, mentions);

  await db.transaction(async (tx) => {
    await tx
      .delete(relations)
      .where(
        and(
          eq(relations.worldId, input.worldId),
          eq(relations.origin, "mention"),
          eq(SOURCE_FK[input.sourceKind], input.sourceId),
        ),
      );
    if (existing.length === 0) return;
    await tx.insert(relations).values(
      existing.map((mention) => ({
        worldId: input.worldId,
        ...sourceValues(input.sourceKind, input.sourceId),
        ...targetValues(mention.kind, mention.id),
        origin: "mention" as const,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })),
    );
  });
}

async function existingMentionTargets(worldId: string, mentions: MentionRef[]): Promise<MentionRef[]> {
  if (mentions.length === 0) return [];
  const byKind = (kind: MentionRef["kind"]) => mentions.filter((row) => row.kind === kind).map((row) => row.id);
  const articleIds = byKind("article");
  const questIds = byKind("quest");
  const characterIds = byKind("character");
  const universeIds = byKind("universe");
  const [articleRows, questRows, characterRows, universeRows] = await Promise.all([
    articleIds.length
      ? db.select({ id: articles.id }).from(articles).where(and(eq(articles.worldId, worldId), inArray(articles.id, articleIds)))
      : [],
    questIds.length
      ? db.select({ id: quests.id }).from(quests).where(and(eq(quests.worldId, worldId), inArray(quests.id, questIds)))
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
    universeIds.length
      ? db.select({ id: universes.id }).from(universes).where(and(eq(universes.worldId, worldId), inArray(universes.id, universeIds)))
      : [],
  ]);
  const present = new Set([
    ...articleRows.map((row) => `article:${row.id}`),
    ...questRows.map((row) => `quest:${row.id}`),
    ...characterRows.map((row) => `character:${row.id}`),
    ...universeRows.map((row) => `universe:${row.id}`),
  ]);
  return mentions.filter((mention) => present.has(mentionKey(mention)));
}

type TemplateRef = { key: string; kind: "article" | "character"; id: string };

function refsFromFields(fields: StoredTemplateFields): TemplateRef[] {
  const refs: TemplateRef[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "object" && value && "kind" in value && (value.kind === "article" || value.kind === "character")) {
      refs.push({ key, kind: value.kind, id: value.id });
    }
  }
  return refs;
}

/** APP-REL-RECALC for `template_field` rows of one article. Manual and mentions stay. */
export async function recalcOutgoingTemplateFields(input: {
  worldId: string;
  actorId: string;
  sourceId: string;
  fields: StoredTemplateFields;
}): Promise<void> {
  const refs = refsFromFields(input.fields).filter(
    (ref) => !(ref.kind === "article" && ref.id === input.sourceId),
  );
  const existing = await existingMentionTargets(
    input.worldId,
    refs.map((ref) => ({ kind: ref.kind, id: ref.id })),
  );
  const present = new Set(existing.map((row) => mentionKey(row)));
  const kept = refs.filter((ref) => present.has(`${ref.kind}:${ref.id}`));

  await db.transaction(async (tx) => {
    await tx
      .delete(relations)
      .where(
        and(
          eq(relations.worldId, input.worldId),
          eq(relations.origin, "template_field"),
          eq(relations.sourceArticleId, input.sourceId),
        ),
      );
    if (kept.length === 0) return;
    await tx.insert(relations).values(
      kept.map((ref) => ({
        worldId: input.worldId,
        ...sourceValues("article", input.sourceId),
        ...targetValues(ref.kind, ref.id),
        origin: "template_field" as const,
        templateFieldKey: ref.key,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })),
    );
  });
}

/** Load current article body + fields and rebuild outgoing auto-relations. */
export async function recalcArticleRelations(worldId: string, actorId: string, articleId: string): Promise<void> {
  const [row] = await db
    .select({ bodyJson: articles.bodyJson, templateFields: articles.templateFields })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.worldId, worldId)))
    .limit(1);
  if (!row) return;
  const fields =
    row.templateFields && typeof row.templateFields === "object" && !Array.isArray(row.templateFields)
      ? (row.templateFields as StoredTemplateFields)
      : {};
  await Promise.all([
    recalcOutgoingMentions({
      worldId,
      actorId,
      sourceKind: "article",
      sourceId: articleId,
      mentions: extractMentions(asRichDoc(row.bodyJson)),
    }),
    recalcOutgoingTemplateFields({ worldId, actorId, sourceId: articleId, fields }),
  ]);
}

/** APP-REL-RECALC for `participation` rows of one quest. Mentions and manual stay. */
export async function recalcOutgoingParticipations(input: {
  worldId: string;
  actorId: string;
  questId: string;
}): Promise<void> {
  const rows = await db
    .select({ characterId: questParticipants.characterId })
    .from(questParticipants)
    .where(and(eq(questParticipants.questId, input.questId)));
  const characterIds = [
    ...new Set(rows.map((row) => row.characterId).filter((id): id is string => Boolean(id))),
  ];

  await db.transaction(async (tx) => {
    await tx
      .delete(relations)
      .where(
        and(
          eq(relations.worldId, input.worldId),
          eq(relations.origin, "participation"),
          eq(relations.sourceQuestId, input.questId),
        ),
      );
    if (characterIds.length === 0) return;
    await tx.insert(relations).values(
      characterIds.map((characterId) => ({
        worldId: input.worldId,
        ...sourceValues("quest", input.questId),
        ...targetValues("character", characterId),
        origin: "participation" as const,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })),
    );
  });
}

/**
 * Load quest description + published chapters (APP-CHAPTER-REL) + participants
 * and rebuild outgoing auto-relations. Manual and participation stay intact
 * across mention recalcs; participation is rebuilt separately from participants.
 */
export async function recalcQuestRelations(worldId: string, actorId: string, questId: string): Promise<void> {
  const [row] = await db
    .select({ descriptionJson: quests.descriptionJson })
    .from(quests)
    .where(and(eq(quests.id, questId), eq(quests.worldId, worldId)))
    .limit(1);
  if (!row) return;

  const publishedChapters = await db
    .select({ bodyJson: questChapters.bodyJson })
    .from(questChapters)
    .where(and(eq(questChapters.questId, questId), eq(questChapters.visibility, "published")));

  const mentions = [
    ...extractMentions(asRichDoc(row.descriptionJson)),
    ...publishedChapters.flatMap((chapter) => extractMentions(asRichDoc(chapter.bodyJson))),
  ];

  await Promise.all([
    recalcOutgoingMentions({
      worldId,
      actorId,
      sourceKind: "quest",
      sourceId: questId,
      mentions,
    }),
    recalcOutgoingParticipations({ worldId, actorId, questId }),
  ]);
}

type RelationRow = typeof relations.$inferSelect;

function counterpart(row: RelationRow, kind: ContentKind, id: string): { kind: ContentKind; id: string } | null {
  const outgoing = row.sourceKind === kind && row.sourceId === id;
  const incoming = row.targetKind === kind && row.targetId === id;
  if (outgoing && row.targetKind && row.targetId) return { kind: row.targetKind, id: row.targetId };
  if (incoming && row.sourceKind && row.sourceId) return { kind: row.sourceKind, id: row.sourceId };
  return null;
}

/**
 * Both ends of a relation, grouped later in the UI. One query per content kind (CR-011).
 */
export async function listLinked(input: {
  worldId: string;
  role: MembershipRole;
  viewerId: string;
  kind: ContentKind;
  id: string;
}): Promise<LinkedItem[]> {
  const rows = await db
    .select()
    .from(relations)
    .where(
      and(
        eq(relations.worldId, input.worldId),
        or(
          and(eq(relations.sourceKind, input.kind), eq(relations.sourceId, input.id)),
          and(eq(relations.targetKind, input.kind), eq(relations.targetId, input.id)),
        ),
      ),
    );

  const others: { kind: ContentKind; id: string }[] = [];
  for (const row of rows) {
    const other = counterpart(row, input.kind, input.id);
    if (other) others.push(other);
  }

  const visible = await loadVisibleTargets(input.worldId, input.role, input.viewerId, others);
  const selfVisible = await isSelfVisible(input);
  const grouped = new Map<string, LinkedItem>();

  for (const row of rows) {
    const other = counterpart(row, input.kind, input.id);
    if (!other) continue;
    const target = visible.get(`${other.kind}:${other.id}`);
    if (!target) continue;
    if (!relationVisible({ sourceVisible: selfVisible, targetVisible: true })) continue;
    const outgoing = row.sourceKind === input.kind && row.sourceId === input.id;
    const manualLabel = row.origin === "manual" ? (outgoing ? row.label : row.counterLabel ?? row.label) : null;
    const origin = ORIGIN_LABEL[row.origin];
    const key = `${other.kind}:${other.id}:${manualLabel ?? ""}`;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.originLabels.includes(origin)) existing.originLabels.push(origin);
      continue;
    }
    grouped.set(key, {
      ...target,
      originLabels: [origin],
      manualLabel,
    });
  }

  return [...grouped.values()];
}

async function isSelfVisible(input: {
  worldId: string;
  role: MembershipRole;
  viewerId: string;
  kind: ContentKind;
  id: string;
}): Promise<boolean> {
  const loaded = await loadVisibleTargets(input.worldId, input.role, input.viewerId, [
    { kind: input.kind, id: input.id },
  ]);
  return loaded.has(`${input.kind}:${input.id}`);
}

async function loadVisibleTargets(
  worldId: string,
  role: MembershipRole,
  viewerId: string,
  refs: { kind: ContentKind; id: string }[],
): Promise<Map<string, Omit<LinkedItem, "originLabels" | "manualLabel">>> {
  const ids = (kind: ContentKind) => [...new Set(refs.filter((row) => row.kind === kind).map((row) => row.id))];
  const articleIds = ids("article");
  const questIds = ids("quest");
  const characterIds = ids("character");
  const pinIds = ids("pin");
  const universeIds = ids("universe");
  const viewer = { role, userId: viewerId };

  const [articleRows, questRows, characterRows, pinRows, universeRows] = await Promise.all([
    articleIds.length
      ? db
          .select({
            id: articles.id,
            title: articles.title,
            visibility: articles.visibility,
            ownerId: articles.ownerId,
            templateType: articles.templateType,
          })
          .from(articles)
          .where(and(eq(articles.worldId, worldId), inArray(articles.id, articleIds)))
      : [],
    questIds.length
      ? db
          .select({
            id: quests.id,
            title: quests.title,
            visibility: quests.visibility,
            ownerId: quests.ownerId,
          })
          .from(quests)
          .where(and(eq(quests.worldId, worldId), inArray(quests.id, questIds)))
      : [],
    characterIds.length
      ? db
          .select({
            id: characters.id,
            title: characters.name,
            portraitId: characters.portraitId,
          })
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
    pinIds.length
      ? db
          .select({
            id: pins.id,
            title: pins.title,
            visibility: pins.visibility,
            ownerId: pins.ownerId,
            pinType: pins.pinType,
            mapName: maps.name,
            mapVisibility: maps.visibility,
            universeVisibility: universes.visibility,
          })
          .from(pins)
          .innerJoin(maps, eq(maps.id, pins.mapId))
          .innerJoin(universes, eq(universes.id, maps.universeId))
          .where(and(eq(universes.worldId, worldId), inArray(pins.id, pinIds)))
      : [],
    universeIds.length
      ? db
          .select({ id: universes.id, title: universes.name, visibility: universes.visibility })
          .from(universes)
          .where(and(eq(universes.worldId, worldId), inArray(universes.id, universeIds)))
      : [],
  ]);

  const out = new Map<string, Omit<LinkedItem, "originLabels" | "manualLabel">>();
  for (const row of articleRows) {
    if (
      !canSeeVisibility({
        role,
        visibility: row.visibility,
        viewerId,
        ownerId: row.ownerId,
      })
    ) {
      continue;
    }
    out.set(`article:${row.id}`, {
      kind: "article",
      id: row.id,
      title: row.title,
      href: contentHref(worldId, "article", row.id),
      templateType: row.templateType,
    });
  }
  for (const row of questRows) {
    if (
      !canSeeVisibility({
        role,
        visibility: row.visibility,
        viewerId,
        ownerId: row.ownerId,
      })
    ) {
      continue;
    }
    out.set(`quest:${row.id}`, {
      kind: "quest",
      id: row.id,
      title: row.title,
      href: contentHref(worldId, "quest", row.id),
    });
  }
  for (const row of characterRows) {
    out.set(`character:${row.id}`, {
      kind: "character",
      id: row.id,
      title: row.title,
      href: contentHref(worldId, "character", row.id),
      portraitId: row.portraitId,
    });
  }
  for (const row of pinRows) {
    if (
      !canSeePublishedLayer(viewer, [
        { visibility: row.universeVisibility },
        { visibility: row.mapVisibility },
        { visibility: row.visibility, ownerId: row.ownerId },
      ])
    ) {
      continue;
    }
    out.set(`pin:${row.id}`, {
      kind: "pin",
      id: row.id,
      title: row.title,
      href: contentHref(worldId, "pin", row.id),
      pinType: row.pinType,
      mapName: row.mapName,
    });
  }
  for (const row of universeRows) {
    if (!canSeeVisibility({ role, visibility: row.visibility, viewerId })) continue;
    out.set(`universe:${row.id}`, {
      kind: "universe",
      id: row.id,
      title: row.title,
      href: contentHref(worldId, "universe", row.id),
    });
  }
  return out;
}

export const RELATION_LABEL_MAX = 60;
export const relationLabelSchema = z.string().trim().min(1).max(RELATION_LABEL_MAX);
export const contentKindSchema = z.enum(CONTENT_KINDS);

export const manualRelationSchema = z.object({
  sourceKind: contentKindSchema,
  sourceId: z.uuid(),
  targetKind: contentKindSchema,
  targetId: z.uuid(),
  label: relationLabelSchema,
  counterLabel: z.string().trim().max(RELATION_LABEL_MAX).optional(),
});

async function loadEnd(
  worldId: string,
  kind: ContentKind,
  id: string,
): Promise<{ kind: ContentKind; id: string } | null> {
  if (kind === "article") {
    const [row] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.worldId, worldId)))
      .limit(1);
    return row ? { kind, id: row.id } : null;
  }
  if (kind === "quest") {
    const [row] = await db
      .select({ id: quests.id })
      .from(quests)
      .where(and(eq(quests.id, id), eq(quests.worldId, worldId)))
      .limit(1);
    return row ? { kind, id: row.id } : null;
  }
  if (kind === "universe") {
    const [row] = await db
      .select({ id: universes.id })
      .from(universes)
      .where(and(eq(universes.id, id), eq(universes.worldId, worldId)))
      .limit(1);
    return row ? { kind, id: row.id } : null;
  }
  if (kind === "character") {
    const [row] = await db
      .select({ id: characters.id })
      .from(characters)
      .innerJoin(
        worldParticipations,
        and(eq(worldParticipations.characterId, characters.id), eq(worldParticipations.worldId, worldId)),
      )
      .where(eq(characters.id, id))
      .limit(1);
    return row ? { kind, id: row.id } : null;
  }
  const [row] = await db
    .select({ id: pins.id })
    .from(pins)
    .innerJoin(maps, eq(maps.id, pins.mapId))
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .where(and(eq(pins.id, id), eq(universes.worldId, worldId)))
    .limit(1);
  return row ? { kind, id: row.id } : null;
}

/**
 * CR-004: both ends must exist in this world. Missing or foreign IDs are 404
 * so existence in another world is not distinguishable from absence.
 */
export async function createManualRelation(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  sourceKind: ContentKind;
  sourceId: string;
  targetKind: ContentKind;
  targetId: string;
  label: string;
  counterLabel?: string;
}): Promise<AuthzResult<{ id: string }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  if (input.sourceKind === input.targetKind && input.sourceId === input.targetId) {
    return fail(400, "Quelle und Ziel dürfen nicht identisch sein.");
  }
  const [source, target] = await Promise.all([
    loadEnd(input.worldId, input.sourceKind, input.sourceId),
    loadEnd(input.worldId, input.targetKind, input.targetId),
  ]);
  if (!source || !target) return fail(404, "Quelle oder Ziel gibt es in dieser Welt nicht.");
  const counter = input.counterLabel?.trim() || null;
  try {
    const [row] = await db
      .insert(relations)
      .values({
        worldId: input.worldId,
        ...sourceValues(input.sourceKind, input.sourceId),
        ...targetValues(input.targetKind, input.targetId),
        origin: "manual",
        label: input.label,
        counterLabel: counter,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning({ id: relations.id });
    return ok({ id: row.id });
  } catch (error) {
    const mapped = mapDbError(error, { unique: "Diese Verknüpfung gibt es schon." });
    if (mapped) return mapped;
    throw error;
  }
}

export async function deleteManualRelation(input: {
  membership: MembershipRow | null;
  worldId: string;
  relationId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const id = parseUuid(input.relationId);
  if (!id) return fail(404, "Diese Verknüpfung gibt es nicht.");
  const [row] = await db
    .select({ id: relations.id, origin: relations.origin })
    .from(relations)
    .where(and(eq(relations.id, id), eq(relations.worldId, input.worldId)))
    .limit(1);
  if (!row) return fail(404, "Diese Verknüpfung gibt es nicht.");
  if (row.origin !== "manual") return fail(400, "Automatische Verknüpfungen entstehen beim Speichern.");
  await db.delete(relations).where(eq(relations.id, row.id));
  return ok({ id: row.id });
}

/** R-3.14-6: distinct manual labels of this world, for the suggestion list. */
export async function listManualLabels(worldId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ label: relations.label })
    .from(relations)
    .where(and(eq(relations.worldId, worldId), eq(relations.origin, "manual")));
  return rows
    .map((row) => row.label)
    .filter((label): label is string => Boolean(label))
    .sort((a, b) => a.localeCompare(b, "de"));
}

export async function listRelationTargets(
  worldId: string,
  role: MembershipRole,
  viewerId: string,
): Promise<RelationTargetOption[]> {
  const viewer = { role, userId: viewerId };
  const [articleRows, universeRows, characterRows, questRows, pinRows] = await Promise.all([
    db
      .select({
        id: articles.id,
        title: articles.title,
        visibility: articles.visibility,
        ownerId: articles.ownerId,
      })
      .from(articles)
      .where(eq(articles.worldId, worldId)),
    db
      .select({ id: universes.id, title: universes.name, visibility: universes.visibility })
      .from(universes)
      .where(eq(universes.worldId, worldId)),
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
      ),
    db
      .select({
        id: quests.id,
        title: quests.title,
        visibility: quests.visibility,
        ownerId: quests.ownerId,
      })
      .from(quests)
      .where(eq(quests.worldId, worldId)),
    db
      .select({
        id: pins.id,
        title: pins.title,
        visibility: pins.visibility,
        ownerId: pins.ownerId,
        mapVisibility: maps.visibility,
        universeVisibility: universes.visibility,
      })
      .from(pins)
      .innerJoin(maps, eq(maps.id, pins.mapId))
      .innerJoin(universes, eq(universes.id, maps.universeId))
      .where(eq(universes.worldId, worldId)),
  ]);
  const out: RelationTargetOption[] = [];
  for (const row of articleRows) {
    if (
      canSeeVisibility({
        role,
        visibility: row.visibility,
        viewerId,
        ownerId: row.ownerId,
      })
    ) {
      out.push({ kind: "article", id: row.id, title: row.title });
    }
  }
  for (const row of universeRows) {
    if (canSeeVisibility({ role, visibility: row.visibility, viewerId })) {
      out.push({ kind: "universe", id: row.id, title: row.title });
    }
  }
  for (const row of characterRows) out.push({ kind: "character", id: row.id, title: row.title });
  for (const row of questRows) {
    if (
      canSeeVisibility({
        role,
        visibility: row.visibility,
        viewerId,
        ownerId: row.ownerId,
      })
    ) {
      out.push({ kind: "quest", id: row.id, title: row.title });
    }
  }
  for (const row of pinRows) {
    if (
      canSeePublishedLayer(viewer, [
        { visibility: row.universeVisibility },
        { visibility: row.mapVisibility },
        { visibility: row.visibility, ownerId: row.ownerId },
      ])
    ) {
      out.push({ kind: "pin", id: row.id, title: row.title });
    }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, "de"));
}

