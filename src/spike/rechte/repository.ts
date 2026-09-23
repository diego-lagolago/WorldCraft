/** Spike T-011 — Datenzugriff mit APP-AUTHZ. */

import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  articles,
  characterMarkers,
  characters,
  files,
  inviteLinks,
  journalEntries,
  maps,
  memberships,
  pins,
  relations,
  universes,
  worldParticipations,
  worlds,
} from "@/db/schema";
import {
  authorizeJournalWrite,
  canEditMarker,
  canSeeCharacterInWorld,
  canSeeJournal,
  canSeePublishedLayer,
  denyIfNoMembership,
  relationVisible,
  requireGm,
  requireStaff,
} from "./authz";
import {
  FIRST_UNIVERSE_NAME,
  fail,
  isStaff,
  ok,
  type Actor,
  type AuthzResult,
  type ContentKind,
  type InviteValidity,
  type JournalVisibility,
  type MembershipRole,
  type MembershipRow,
  type PinType,
  type RelationOrigin,
  type VisibilityStatus,
} from "./types";

function pos(value: string | number): number {
  return Number(Number(value).toFixed(7));
}

function protocol(actorId: string) {
  const now = new Date();
  return {
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
  };
}

function touch(actorId: string) {
  return { updatedAt: new Date(), updatedBy: actorId };
}

function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return postgresCode(error.cause);
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return postgresCode(error) === "23505";
}

function asMembership(row: typeof memberships.$inferSelect): MembershipRow {
  return {
    id: row.id,
    worldId: row.worldId,
    userId: row.userId,
    role: row.role,
    archivedAt: row.archivedAt,
  };
}

export async function getActiveMembership(
  worldId: string,
  userId: string,
): Promise<MembershipRow | null> {
  const [row] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.worldId, worldId),
        eq(memberships.userId, userId),
        isNull(memberships.archivedAt),
      ),
    )
    .limit(1);
  return row ? asMembership(row) : null;
}

async function getWorld(worldId: string) {
  const [row] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  return row ?? null;
}

async function requireWorldMember(worldId: string, actor: Actor) {
  const world = await getWorld(worldId);
  if (!world) return { world: null, membership: null, error: fail(404, "Welt nicht gefunden.") };
  const membership = await getActiveMembership(worldId, actor.id);
  const denied = denyIfNoMembership(membership);
  if (denied) return { world, membership: null, error: denied };
  return { world, membership: membership!, error: null };
}

function inviteActive(row: typeof inviteLinks.$inferSelect): boolean {
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

function expiresAtFor(validity: InviteValidity): Date | null {
  if (validity === "unlimited") return null;
  const days = validity === "one_day" ? 1 : 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function emptyDoc(text: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}

function relationEnds(row: typeof relations.$inferSelect): {
  sourceKind: ContentKind;
  sourceId: string;
  targetKind: ContentKind;
  targetId: string;
} {
  const sourceId =
    row.sourceArticleId ?? row.sourceCharacterId ?? row.sourcePinId ?? row.sourceUniverseId;
  const targetId =
    row.targetArticleId ?? row.targetCharacterId ?? row.targetPinId ?? row.targetUniverseId;
  if (!sourceId || !targetId) {
    throw new Error("Relation ohne vollständige Enden.");
  }
  return {
    sourceKind: row.sourceKind,
    sourceId,
    targetKind: row.targetKind,
    targetId,
  };
}

function exclusiveFks(
  side: "source" | "target",
  kind: ContentKind,
  id: string,
) {
  if (kind === "quest") {
    throw new Error("Quests sind in diesem Spike nicht angelegt.");
  }
  if (side === "source") {
    return {
      sourceArticleId: kind === "article" ? id : null,
      sourceCharacterId: kind === "character" ? id : null,
      sourcePinId: kind === "pin" ? id : null,
      sourceUniverseId: kind === "universe" ? id : null,
    };
  }
  return {
    targetArticleId: kind === "article" ? id : null,
    targetCharacterId: kind === "character" ? id : null,
    targetPinId: kind === "pin" ? id : null,
    targetUniverseId: kind === "universe" ? id : null,
  };
}

async function mapContext(mapId: string) {
  const [row] = await db
    .select({
      map: maps,
      universe: universes,
    })
    .from(maps)
    .innerJoin(universes, eq(maps.universeId, universes.id))
    .where(eq(maps.id, mapId))
    .limit(1);
  return row ?? null;
}

async function pinContext(pinId: string) {
  const [row] = await db
    .select({
      pin: pins,
      map: maps,
      universe: universes,
    })
    .from(pins)
    .innerJoin(maps, eq(pins.mapId, maps.id))
    .innerJoin(universes, eq(maps.universeId, universes.id))
    .where(eq(pins.id, pinId))
    .limit(1);
  return row ?? null;
}

export async function isContentVisibleFor(
  actor: Actor,
  worldId: string,
  kind: ContentKind,
  id: string,
): Promise<boolean> {
  const membership = await getActiveMembership(worldId, actor.id);
  if (!membership) return false;
  if (kind === "article") {
    const [article] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    if (!article || article.worldId !== worldId) return false;
    return canSeePublishedLayer(membership.role, [article.visibility]);
  }
  if (kind === "universe") {
    const [universe] = await db.select().from(universes).where(eq(universes.id, id)).limit(1);
    if (!universe || universe.worldId !== worldId) return false;
    return canSeePublishedLayer(membership.role, [universe.visibility]);
  }
  if (kind === "pin") {
    const ctx = await pinContext(id);
    if (!ctx || ctx.universe.worldId !== worldId) return false;
    return canSeePublishedLayer(membership.role, [
      ctx.universe.visibility,
      ctx.map.visibility,
      ctx.pin.visibility,
    ]);
  }
  if (kind === "character") {
    const [character] = await db.select().from(characters).where(eq(characters.id, id)).limit(1);
    if (!character) return false;
    const [part] = await db
      .select()
      .from(worldParticipations)
      .where(
        and(
          eq(worldParticipations.characterId, id),
          eq(worldParticipations.worldId, worldId),
        ),
      )
      .limit(1);
    return canSeeCharacterInWorld(part ?? null);
  }
  return false;
}

export async function createWorld(
  actor: Actor,
  input: { name: string },
): Promise<AuthzResult<{ world: { id: string; name: string; createdBy: string } }>> {
  const name = input.name.trim();
  if (!name || name.length > 120) return fail(400, "Ungültiger Weltname.");
  const proto = protocol(actor.id);
  try {
    const created = await db.transaction(async (tx) => {
      const [world] = await tx
        .insert(worlds)
        .values({
          name,
          createdBy: actor.id,
          createdAt: proto.createdAt,
          updatedAt: proto.updatedAt,
          updatedBy: actor.id,
        })
        .returning();
      await tx.insert(memberships).values({
        worldId: world.id,
        userId: actor.id,
        role: "game_master",
        joinedAt: proto.createdAt,
        ...proto,
      });
      await tx.insert(universes).values({
        worldId: world.id,
        name: FIRST_UNIVERSE_NAME,
        sortOrder: 0,
        visibility: "published",
        ...proto,
      });
      return world;
    });
    return ok({
      world: { id: created.id, name: created.name, createdBy: created.createdBy },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail(409, "Die Welt konnte nicht angelegt werden (genau ein Game Master).");
    }
    throw error;
  }
}

export async function getWorldForActor(actor: Actor, worldId: string) {
  const loaded = await requireWorldMember(worldId, actor);
  if (loaded.error) return loaded.error;
  return ok({
    world: {
      id: loaded.world!.id,
      name: loaded.world!.name,
      createdBy: loaded.world!.createdBy,
    },
    role: loaded.membership!.role,
  });
}

export async function deleteWorld(actor: Actor, worldId: string) {
  const world = await getWorld(worldId);
  if (!world) return fail(404, "Welt nicht gefunden.");
  const gate = requireGm(await getActiveMembership(worldId, actor.id));
  if (!gate.ok) return gate;
  await db.delete(worlds).where(eq(worlds.id, worldId));
  return ok({ deleted: true });
}

export async function listMembers(actor: Actor, worldId: string) {
  const loaded = await requireWorldMember(worldId, actor);
  if (loaded.error) return loaded.error;
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.worldId, worldId), isNull(memberships.archivedAt)));
  return ok({
    members: rows.map((row) => ({
      userId: row.userId,
      role: row.role,
      joinedAt: row.joinedAt.toISOString(),
    })),
  });
}

export async function changeMemberRole(
  actor: Actor,
  worldId: string,
  targetUserId: string,
  role: MembershipRole,
) {
  const gate = requireGm(await getActiveMembership(worldId, actor.id));
  if (!gate.ok) return gate;
  if (role === "game_master") {
    return fail(403, "Es gibt genau einen Game Master. Die Rolle ist nicht übertragbar.");
  }
  const [target] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.worldId, worldId),
        eq(memberships.userId, targetUserId),
        isNull(memberships.archivedAt),
      ),
    )
    .limit(1);
  if (!target) return fail(404, "Mitglied nicht gefunden.");
  if (target.role === "game_master") {
    return fail(403, "Der Game Master kann nicht zurückgestuft werden.");
  }
  const [updated] = await db
    .update(memberships)
    .set({ role, ...touch(actor.id) })
    .where(eq(memberships.id, target.id))
    .returning();
  return ok({ member: { userId: updated.userId, role: updated.role } });
}

async function archiveMembershipAndParticipations(
  actorId: string,
  worldId: string,
  userId: string,
) {
  const now = new Date();
  await db
    .update(memberships)
    .set({ archivedAt: now, ...touch(actorId) })
    .where(
      and(
        eq(memberships.worldId, worldId),
        eq(memberships.userId, userId),
        isNull(memberships.archivedAt),
      ),
    );
  const owned = await db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.ownerId, userId));
  if (owned.length === 0) return;
  for (const character of owned) {
    await db
      .update(worldParticipations)
      .set({ archivedAt: now, ...touch(actorId) })
      .where(
        and(
          eq(worldParticipations.worldId, worldId),
          eq(worldParticipations.characterId, character.id),
          isNull(worldParticipations.archivedAt),
        ),
      );
  }
}

export async function removeMember(actor: Actor, worldId: string, targetUserId: string) {
  const gate = requireGm(await getActiveMembership(worldId, actor.id));
  if (!gate.ok) return gate;
  const [target] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.worldId, worldId),
        eq(memberships.userId, targetUserId),
        isNull(memberships.archivedAt),
      ),
    )
    .limit(1);
  if (!target) return fail(404, "Mitglied nicht gefunden.");
  if (target.role === "game_master") {
    return fail(403, "Der Game Master kann nicht entfernt werden.");
  }
  await archiveMembershipAndParticipations(actor.id, worldId, targetUserId);
  return ok({ archived: true });
}

export async function leaveWorld(actor: Actor, worldId: string) {
  const membership = await getActiveMembership(worldId, actor.id);
  const denied = denyIfNoMembership(membership);
  if (denied) return denied;
  if (membership!.role === "game_master") {
    return fail(403, "Der Game Master kann nicht austreten.");
  }
  await archiveMembershipAndParticipations(actor.id, worldId, actor.id);
  return ok({ archived: true });
}

export async function createInvite(
  actor: Actor,
  worldId: string,
  validity: InviteValidity = "unlimited",
) {
  const gate = requireGm(await getActiveMembership(worldId, actor.id));
  if (!gate.ok) return gate;
  const world = await getWorld(worldId);
  if (!world) return fail(404, "Welt nicht gefunden.");
  const [row] = await db
    .insert(inviteLinks)
    .values({
      worldId,
      code: randomBytes(16).toString("hex"),
      validity,
      expiresAt: expiresAtFor(validity),
      ...protocol(actor.id),
    })
    .returning();
  return ok({
    invite: {
      id: row.id,
      code: row.code,
      validity: row.validity,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    },
  });
}

export async function revokeInvite(actor: Actor, inviteId: string) {
  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.id, inviteId))
    .limit(1);
  if (!invite) return fail(404, "Einladung nicht gefunden.");
  const gate = requireGm(await getActiveMembership(invite.worldId, actor.id));
  if (!gate.ok) return gate;
  const [row] = await db
    .update(inviteLinks)
    .set({ revokedAt: new Date(), ...touch(actor.id) })
    .where(eq(inviteLinks.id, inviteId))
    .returning();
  return ok({
    invite: {
      id: row.id,
      code: row.code,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    },
  });
}

export async function joinByInvite(actor: Actor, code: string) {
  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.code, code))
    .limit(1);
  if (!invite || !inviteActive(invite)) {
    return fail(403, "Einladung ungültig oder widerrufen.");
  }
  const [existing] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.worldId, invite.worldId), eq(memberships.userId, actor.id)))
    .limit(1);
  if (existing && !existing.archivedAt) {
    return ok({
      membership: { worldId: existing.worldId, userId: existing.userId, role: existing.role },
      joined: false,
    });
  }
  const proto = protocol(actor.id);
  if (existing) {
    const [row] = await db
      .update(memberships)
      .set({
        archivedAt: null,
        role: "player",
        joinedAt: proto.createdAt,
        joinedViaInviteId: invite.id,
        ...touch(actor.id),
      })
      .where(eq(memberships.id, existing.id))
      .returning();
    await db
      .update(inviteLinks)
      .set({ useCount: invite.useCount + 1, ...touch(actor.id) })
      .where(eq(inviteLinks.id, invite.id));
    return ok({
      membership: { worldId: row.worldId, userId: row.userId, role: row.role },
      joined: true,
    });
  }
  const [row] = await db
    .insert(memberships)
    .values({
      worldId: invite.worldId,
      userId: actor.id,
      role: "player",
      joinedViaInviteId: invite.id,
      ...proto,
    })
    .returning();
  await db
    .update(inviteLinks)
    .set({ useCount: invite.useCount + 1, ...touch(actor.id) })
    .where(eq(inviteLinks.id, invite.id));
  return ok({
    membership: { worldId: row.worldId, userId: row.userId, role: row.role },
    joined: true,
  });
}

export async function createCharacter(actor: Actor, input: { name: string }) {
  const name = input.name.trim();
  if (!name || name.length > 120) return fail(400, "Ungültiger Charaktername.");
  const [row] = await db
    .insert(characters)
    .values({
      ownerId: actor.id,
      name,
      ...protocol(actor.id),
    })
    .returning();
  return ok({ character: { id: row.id, name: row.name, ownerId: row.ownerId } });
}

export async function bringCharacter(actor: Actor, worldId: string, characterId: string) {
  const loaded = await requireWorldMember(worldId, actor);
  if (loaded.error) return loaded.error;
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!character) return fail(404, "Charakter nicht gefunden.");
  if (character.ownerId !== actor.id) {
    return fail(403, "Nur der Besitzer kann den Charakter mitbringen.");
  }
  const [existing] = await db
    .select()
    .from(worldParticipations)
    .where(
      and(
        eq(worldParticipations.characterId, characterId),
        eq(worldParticipations.worldId, worldId),
      ),
    )
    .limit(1);
  if (existing && !existing.archivedAt) {
    return ok({
      participation: { id: existing.id, characterId, worldId, archivedAt: null },
    });
  }
  if (existing) {
    const [row] = await db
      .update(worldParticipations)
      .set({ archivedAt: null, broughtAt: new Date(), ...touch(actor.id) })
      .where(eq(worldParticipations.id, existing.id))
      .returning();
    return ok({
      participation: {
        id: row.id,
        characterId: row.characterId,
        worldId: row.worldId,
        archivedAt: null,
      },
    });
  }
  const [row] = await db
    .insert(worldParticipations)
    .values({
      characterId,
      worldId,
      ...protocol(actor.id),
    })
    .returning();
  return ok({
    participation: {
      id: row.id,
      characterId: row.characterId,
      worldId: row.worldId,
      archivedAt: null,
    },
  });
}

export async function listCharacters(actor: Actor, worldId: string) {
  const loaded = await requireWorldMember(worldId, actor);
  if (loaded.error) return loaded.error;
  const rows = await db
    .select({
      character: characters,
      participation: worldParticipations,
    })
    .from(worldParticipations)
    .innerJoin(characters, eq(worldParticipations.characterId, characters.id))
    .where(
      and(
        eq(worldParticipations.worldId, worldId),
        isNull(worldParticipations.archivedAt),
      ),
    );
  return ok({
    characters: rows.map(({ character }) => ({
      id: character.id,
      name: character.name,
      ownerId: character.ownerId,
    })),
  });
}

export async function createJournal(
  actor: Actor,
  worldId: string,
  input: { characterId: string; title?: string; body: string; visibility: JournalVisibility },
) {
  const loaded = await requireWorldMember(worldId, actor);
  if (loaded.error) return loaded.error;
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, input.characterId))
    .limit(1);
  if (!character) return fail(404, "Charakter nicht gefunden.");
  const [part] = await db
    .select()
    .from(worldParticipations)
    .where(
      and(
        eq(worldParticipations.characterId, input.characterId),
        eq(worldParticipations.worldId, worldId),
      ),
    )
    .limit(1);
  const allowed = authorizeJournalWrite({ actorId: actor.id, ownerId: character.ownerId, participation: part ?? null });
  if (!allowed.ok) return allowed;
  const body = input.body.trim();
  if (!body) return fail(400, "Tagebuchtext fehlt.");
  const [row] = await db
    .insert(journalEntries)
    .values({
      characterId: input.characterId,
      worldId,
      title: input.title?.trim() || null,
      bodyJson: emptyDoc(body),
      bodyPlain: body,
      visibility: input.visibility,
      ...protocol(actor.id),
    })
    .returning();
  return ok({
    journal: {
      id: row.id,
      characterId: row.characterId,
      worldId: row.worldId,
      title: row.title,
      bodyPlain: row.bodyPlain,
      visibility: row.visibility,
    },
  });
}

export async function listJournals(actor: Actor, worldId: string) {
  const loaded = await requireWorldMember(worldId, actor);
  if (loaded.error) return loaded.error;
  const rows = await db
    .select({
      journal: journalEntries,
      character: characters,
      participation: worldParticipations,
    })
    .from(journalEntries)
    .innerJoin(characters, eq(journalEntries.characterId, characters.id))
    .innerJoin(
      worldParticipations,
      and(
        eq(worldParticipations.characterId, journalEntries.characterId),
        eq(worldParticipations.worldId, journalEntries.worldId),
      ),
    )
    .where(eq(journalEntries.worldId, worldId));
  const visible = rows.filter(({ journal, character, participation }) =>
    canSeeJournal({
      actorId: actor.id,
      role: loaded.membership!.role,
      ownerId: character.ownerId,
      visibility: journal.visibility,
      participationArchived: Boolean(participation.archivedAt),
    }),
  );
  return ok({
    journals: visible.map(({ journal, character }) => ({
      id: journal.id,
      characterId: journal.characterId,
      ownerId: character.ownerId,
      title: journal.title,
      bodyPlain: journal.bodyPlain,
      visibility: journal.visibility,
    })),
  });
}

export async function createArticle(
  actor: Actor,
  worldId: string,
  input: { title: string; visibility?: VisibilityStatus; body?: string },
) {
  const gate = requireStaff(await getActiveMembership(worldId, actor.id));
  if (!gate.ok) return gate;
  const title = input.title.trim();
  if (!title || title.length > 200) return fail(400, "Ungültiger Artikeltitel.");
  const body = input.body?.trim() ?? "";
  const [row] = await db
    .insert(articles)
    .values({
      worldId,
      title,
      visibility: input.visibility ?? "gm_only",
      bodyJson: body ? emptyDoc(body) : null,
      bodyPlain: body || null,
      ...protocol(actor.id),
    })
    .returning();
  return ok({
    article: {
      id: row.id,
      title: row.title,
      visibility: row.visibility,
    },
  });
}

export async function updateArticle(
  actor: Actor,
  articleId: string,
  input: { title?: string; visibility?: VisibilityStatus; body?: string },
) {
  const [article] = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!article) return fail(404, "Artikel nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(article.worldId, actor.id));
  if (!gate.ok) return gate;
  const patch: Record<string, unknown> = { ...touch(actor.id) };
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title || title.length > 200) return fail(400, "Ungültiger Artikeltitel.");
    patch.title = title;
  }
  if (input.visibility) patch.visibility = input.visibility;
  if (input.body !== undefined) {
    const body = input.body.trim();
    patch.bodyJson = body ? emptyDoc(body) : null;
    patch.bodyPlain = body || null;
  }
  const [row] = await db.update(articles).set(patch).where(eq(articles.id, articleId)).returning();
  return ok({ article: { id: row.id, title: row.title, visibility: row.visibility } });
}

export async function deleteArticle(actor: Actor, articleId: string) {
  const [article] = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!article) return fail(404, "Artikel nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(article.worldId, actor.id));
  if (!gate.ok) return gate;
  await db.delete(articles).where(eq(articles.id, articleId));
  return ok({ deleted: true });
}

export async function listArticles(actor: Actor, worldId: string) {
  const loaded = await requireWorldMember(worldId, actor);
  if (loaded.error) return loaded.error;
  const rows = await db.select().from(articles).where(eq(articles.worldId, worldId));
  return ok({
    articles: rows
      .filter((row) => canSeePublishedLayer(loaded.membership!.role, [row.visibility]))
      .map((row) => ({
        id: row.id,
        title: row.title,
        visibility: row.visibility,
      })),
  });
}

export async function createUniverse(
  actor: Actor,
  worldId: string,
  input: { name: string; visibility?: VisibilityStatus },
) {
  const gate = requireStaff(await getActiveMembership(worldId, actor.id));
  if (!gate.ok) return gate;
  const name = input.name.trim();
  if (!name || name.length > 120) return fail(400, "Ungültiger Universumsname.");
  try {
    const [row] = await db
      .insert(universes)
      .values({
        worldId,
        name,
        sortOrder: Date.now() % 1_000_000,
        visibility: input.visibility ?? "gm_only",
        ...protocol(actor.id),
      })
      .returning();
    return ok({
      universe: { id: row.id, name: row.name, visibility: row.visibility },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail(409, "Universumsname ist in dieser Welt schon vergeben.");
    throw error;
  }
}

export async function updateUniverse(
  actor: Actor,
  universeId: string,
  input: { name?: string; visibility?: VisibilityStatus },
) {
  const [universe] = await db.select().from(universes).where(eq(universes.id, universeId)).limit(1);
  if (!universe) return fail(404, "Universum nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(universe.worldId, actor.id));
  if (!gate.ok) return gate;
  const patch: Record<string, unknown> = { ...touch(actor.id) };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 120) return fail(400, "Ungültiger Universumsname.");
    patch.name = name;
  }
  if (input.visibility) patch.visibility = input.visibility;
  const [row] = await db.update(universes).set(patch).where(eq(universes.id, universeId)).returning();
  return ok({ universe: { id: row.id, name: row.name, visibility: row.visibility } });
}

export async function deleteUniverse(actor: Actor, universeId: string) {
  const [universe] = await db.select().from(universes).where(eq(universes.id, universeId)).limit(1);
  if (!universe) return fail(404, "Universum nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(universe.worldId, actor.id));
  if (!gate.ok) return gate;
  const siblings = await db
    .select({ id: universes.id })
    .from(universes)
    .where(eq(universes.worldId, universe.worldId));
  if (siblings.length <= 1) {
    return fail(403, "Das letzte Universum einer Welt kann nicht gelöscht werden.");
  }
  await db.delete(universes).where(eq(universes.id, universeId));
  return ok({ deleted: true });
}

async function placeholderFile(actorId: string) {
  const [row] = await db
    .insert(files)
    .values({
      storageKey: `spike/rechte/placeholder-${randomBytes(8).toString("hex")}`,
      mime: "image/png",
      byteSize: 1,
      widthPx: 100,
      heightPx: 100,
      createdBy: actorId,
    })
    .returning();
  return row;
}

export async function createMap(
  actor: Actor,
  universeId: string,
  input: { name: string; visibility?: VisibilityStatus },
) {
  const [universe] = await db.select().from(universes).where(eq(universes.id, universeId)).limit(1);
  if (!universe) return fail(404, "Universum nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(universe.worldId, actor.id));
  if (!gate.ok) return gate;
  const existing = await db.select({ id: maps.id }).from(maps).where(eq(maps.universeId, universeId));
  if (existing.length > 0) {
    return fail(400, "Im MVP höchstens eine Karte pro Universum.");
  }
  const name = input.name.trim();
  if (!name || name.length > 120) return fail(400, "Ungültiger Kartenname.");
  const image = await placeholderFile(actor.id);
  const [row] = await db
    .insert(maps)
    .values({
      universeId,
      name,
      imageId: image.id,
      visibility: input.visibility ?? "gm_only",
      ...protocol(actor.id),
    })
    .returning();
  return ok({
    map: {
      id: row.id,
      universeId: row.universeId,
      name: row.name,
      visibility: row.visibility,
    },
  });
}

export async function updateMap(
  actor: Actor,
  mapId: string,
  input: { name?: string; visibility?: VisibilityStatus },
) {
  const ctx = await mapContext(mapId);
  if (!ctx) return fail(404, "Karte nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(ctx.universe.worldId, actor.id));
  if (!gate.ok) return gate;
  const patch: Record<string, unknown> = { ...touch(actor.id) };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 120) return fail(400, "Ungültiger Kartenname.");
    patch.name = name;
  }
  if (input.visibility) patch.visibility = input.visibility;
  const [row] = await db.update(maps).set(patch).where(eq(maps.id, mapId)).returning();
  return ok({
    map: { id: row.id, universeId: row.universeId, name: row.name, visibility: row.visibility },
  });
}

export async function deleteMap(actor: Actor, mapId: string) {
  const ctx = await mapContext(mapId);
  if (!ctx) return fail(404, "Karte nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(ctx.universe.worldId, actor.id));
  if (!gate.ok) return gate;
  await db.delete(maps).where(eq(maps.id, mapId));
  return ok({ deleted: true });
}

export async function createPin(
  actor: Actor,
  mapId: string,
  input: {
    pinType: PinType;
    title: string;
    visibility?: VisibilityStatus;
    posX: number;
    posY: number;
  },
) {
  const ctx = await mapContext(mapId);
  if (!ctx) return fail(404, "Karte nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(ctx.universe.worldId, actor.id));
  if (!gate.ok) return gate;
  const title = input.title.trim();
  if (!title || title.length > 120) return fail(400, "Ungültiger Pin-Titel.");
  if (input.posX < 0 || input.posX > 1 || input.posY < 0 || input.posY > 1) {
    return fail(400, "Position muss zwischen 0 und 1 liegen.");
  }
  const [row] = await db
    .insert(pins)
    .values({
      mapId,
      pinType: input.pinType,
      title,
      posX: input.posX.toFixed(7),
      posY: input.posY.toFixed(7),
      visibility: input.visibility ?? "gm_only",
      ...protocol(actor.id),
    })
    .returning();
  return ok({
    pin: {
      id: row.id,
      mapId: row.mapId,
      title: row.title,
      visibility: row.visibility,
      posX: pos(row.posX),
      posY: pos(row.posY),
    },
  });
}

export async function updatePin(
  actor: Actor,
  pinId: string,
  input: { title?: string; visibility?: VisibilityStatus; posX?: number; posY?: number },
) {
  const ctx = await pinContext(pinId);
  if (!ctx) return fail(404, "Pin nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(ctx.universe.worldId, actor.id));
  if (!gate.ok) return gate;
  const patch: Record<string, unknown> = { ...touch(actor.id) };
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title || title.length > 120) return fail(400, "Ungültiger Pin-Titel.");
    patch.title = title;
  }
  if (input.visibility) patch.visibility = input.visibility;
  if (input.posX !== undefined) patch.posX = input.posX.toFixed(7);
  if (input.posY !== undefined) patch.posY = input.posY.toFixed(7);
  const [row] = await db.update(pins).set(patch).where(eq(pins.id, pinId)).returning();
  return ok({
    pin: {
      id: row.id,
      mapId: row.mapId,
      title: row.title,
      visibility: row.visibility,
      posX: pos(row.posX),
      posY: pos(row.posY),
    },
  });
}

export async function deletePin(actor: Actor, pinId: string) {
  const ctx = await pinContext(pinId);
  if (!ctx) return fail(404, "Pin nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(ctx.universe.worldId, actor.id));
  if (!gate.ok) return gate;
  await db.delete(pins).where(eq(pins.id, pinId));
  return ok({ deleted: true });
}

export async function placeMarker(
  actor: Actor,
  mapId: string,
  input: { characterId: string; posX: number; posY: number },
) {
  const ctx = await mapContext(mapId);
  if (!ctx) return fail(404, "Karte nicht gefunden.");
  const membership = await getActiveMembership(ctx.universe.worldId, actor.id);
  const denied = denyIfNoMembership(membership);
  if (denied) return denied;
  const mapVisible = canSeePublishedLayer(membership!.role, [
    ctx.universe.visibility,
    ctx.map.visibility,
  ]);
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, input.characterId))
    .limit(1);
  if (!character) return fail(404, "Charakter nicht gefunden.");
  const [part] = await db
    .select()
    .from(worldParticipations)
    .where(
      and(
        eq(worldParticipations.characterId, input.characterId),
        eq(worldParticipations.worldId, ctx.universe.worldId),
        isNull(worldParticipations.archivedAt),
      ),
    )
    .limit(1);
  if (!part) return fail(400, "Der Charakter ist in dieser Welt nicht aktiv mitgebracht.");
  if (
    !canEditMarker({
      role: membership!.role,
      actorId: actor.id,
      ownerId: character.ownerId,
      mapVisibleToActor: mapVisible,
    })
  ) {
    return fail(403, "Diesen Marker darfst du nicht platzieren.");
  }
  if (input.posX < 0 || input.posX > 1 || input.posY < 0 || input.posY > 1) {
    return fail(400, "Position muss zwischen 0 und 1 liegen.");
  }
  const [existingMarker] = await db
    .select({ id: characterMarkers.id })
    .from(characterMarkers)
    .where(
      and(
        eq(characterMarkers.characterId, input.characterId),
        eq(characterMarkers.mapId, mapId),
      ),
    )
    .limit(1);
  if (existingMarker) {
    return fail(409, "Höchstens ein Marker pro Charakter und Karte.");
  }
  try {
    const [row] = await db
      .insert(characterMarkers)
      .values({
        characterId: input.characterId,
        mapId,
        posX: input.posX.toFixed(7),
        posY: input.posY.toFixed(7),
        ...protocol(actor.id),
      })
      .returning();
    return ok({
      marker: {
        id: row.id,
        characterId: row.characterId,
        mapId: row.mapId,
        posX: pos(row.posX),
        posY: pos(row.posY),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail(409, "Höchstens ein Marker pro Charakter und Karte.");
    }
    throw error;
  }
}

export async function moveMarker(
  actor: Actor,
  markerId: string,
  input: { posX: number; posY: number },
) {
  const [marker] = await db
    .select()
    .from(characterMarkers)
    .where(eq(characterMarkers.id, markerId))
    .limit(1);
  if (!marker) return fail(404, "Marker nicht gefunden.");
  const ctx = await mapContext(marker.mapId);
  if (!ctx) return fail(404, "Karte nicht gefunden.");
  const membership = await getActiveMembership(ctx.universe.worldId, actor.id);
  const denied = denyIfNoMembership(membership);
  if (denied) return denied;
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, marker.characterId))
    .limit(1);
  if (!character) return fail(404, "Charakter nicht gefunden.");
  const mapVisible = canSeePublishedLayer(membership!.role, [
    ctx.universe.visibility,
    ctx.map.visibility,
  ]);
  if (
    !canEditMarker({
      role: membership!.role,
      actorId: actor.id,
      ownerId: character.ownerId,
      mapVisibleToActor: mapVisible,
    })
  ) {
    return fail(403, "Diesen Marker darfst du nicht verschieben.");
  }
  if (input.posX < 0 || input.posX > 1 || input.posY < 0 || input.posY > 1) {
    return fail(400, "Position muss zwischen 0 und 1 liegen.");
  }
  const [row] = await db
    .update(characterMarkers)
    .set({
      posX: input.posX.toFixed(7),
      posY: input.posY.toFixed(7),
      ...touch(actor.id),
    })
    .where(eq(characterMarkers.id, markerId))
    .returning();
  return ok({
    marker: {
      id: row.id,
      characterId: row.characterId,
      mapId: row.mapId,
      posX: pos(row.posX),
      posY: pos(row.posY),
    },
  });
}

export async function deleteMarker(actor: Actor, markerId: string) {
  const [marker] = await db
    .select()
    .from(characterMarkers)
    .where(eq(characterMarkers.id, markerId))
    .limit(1);
  if (!marker) return fail(404, "Marker nicht gefunden.");
  const ctx = await mapContext(marker.mapId);
  if (!ctx) return fail(404, "Karte nicht gefunden.");
  const membership = await getActiveMembership(ctx.universe.worldId, actor.id);
  const denied = denyIfNoMembership(membership);
  if (denied) return denied;
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, marker.characterId))
    .limit(1);
  if (!character) return fail(404, "Charakter nicht gefunden.");
  const mapVisible = canSeePublishedLayer(membership!.role, [
    ctx.universe.visibility,
    ctx.map.visibility,
  ]);
  if (
    !canEditMarker({
      role: membership!.role,
      actorId: actor.id,
      ownerId: character.ownerId,
      mapVisibleToActor: mapVisible,
    })
  ) {
    return fail(403, "Diesen Marker darfst du nicht entfernen.");
  }
  await db.delete(characterMarkers).where(eq(characterMarkers.id, markerId));
  return ok({ deleted: true });
}

export async function listWorldGeography(actor: Actor, worldId: string) {
  const loaded = await requireWorldMember(worldId, actor);
  if (loaded.error) return loaded.error;
  const role = loaded.membership!.role;
  const universeRows = await db
    .select()
    .from(universes)
    .where(eq(universes.worldId, worldId));
  const universeIds = universeRows.map((row) => row.id);
  const mapRows =
    universeIds.length === 0
      ? []
      : await db.select().from(maps).where(inArray(maps.universeId, universeIds));
  const mapIds = mapRows.map((row) => row.id);
  const pinRows =
    mapIds.length === 0
      ? []
      : await db.select().from(pins).where(inArray(pins.mapId, mapIds));
  const markerRows = await db
    .select({
      marker: characterMarkers,
      character: characters,
      participation: worldParticipations,
    })
    .from(characterMarkers)
    .innerJoin(characters, eq(characterMarkers.characterId, characters.id))
    .innerJoin(
      worldParticipations,
      and(
        eq(worldParticipations.characterId, characterMarkers.characterId),
        eq(worldParticipations.worldId, worldId),
      ),
    );

  const visibleUniverses = universeRows.filter((universe) =>
    canSeePublishedLayer(role, [universe.visibility]),
  );
  return ok({
    universes: visibleUniverses.map((universe) => {
      const universeMaps = mapRows.filter((map) => map.universeId === universe.id);
      return {
        id: universe.id,
        name: universe.name,
        visibility: universe.visibility,
        maps: universeMaps
          .filter((map) => canSeePublishedLayer(role, [universe.visibility, map.visibility]))
          .map((map) => ({
            id: map.id,
            name: map.name,
            visibility: map.visibility,
            pins: pinRows
              .filter((pin) => pin.mapId === map.id)
              .filter((pin) =>
                canSeePublishedLayer(role, [
                  universe.visibility,
                  map.visibility,
                  pin.visibility,
                ]),
              )
              .map((pin) => ({
                id: pin.id,
                title: pin.title,
                visibility: pin.visibility,
                posX: pos(pin.posX),
                posY: pos(pin.posY),
              })),
            markers: markerRows
              .filter(({ marker, participation }) => {
                if (marker.mapId !== map.id) return false;
                if (participation.archivedAt) return false;
                return canSeePublishedLayer(role, [universe.visibility, map.visibility]);
              })
              .map(({ marker, character }) => ({
                id: marker.id,
                characterId: marker.characterId,
                ownerId: character.ownerId,
                posX: pos(marker.posX),
                posY: pos(marker.posY),
              })),
          })),
      };
    }),
  });
}

export async function createManualRelation(
  actor: Actor,
  worldId: string,
  input: {
    sourceKind: ContentKind;
    sourceId: string;
    targetKind: ContentKind;
    targetId: string;
    label: string;
    origin?: RelationOrigin;
  },
) {
  const gate = requireStaff(await getActiveMembership(worldId, actor.id));
  if (!gate.ok) return gate;
  if ((input.origin ?? "manual") !== "manual") {
    return fail(400, "In diesem Spike können nur manuelle Relationen angelegt werden.");
  }
  if (input.sourceKind === "quest" || input.targetKind === "quest") {
    return fail(400, "Quests sind in diesem Spike nicht angelegt.");
  }
  const label = input.label.trim();
  if (!label || label.length > 60) return fail(400, "Bezeichnung fehlt oder ist zu lang.");
  if (input.sourceKind === input.targetKind && input.sourceId === input.targetId) {
    return fail(400, "Quelle und Ziel dürfen nicht identisch sein.");
  }
  const [row] = await db
    .insert(relations)
    .values({
      worldId,
      sourceKind: input.sourceKind,
      targetKind: input.targetKind,
      origin: "manual",
      label,
      ...exclusiveFks("source", input.sourceKind, input.sourceId),
      ...exclusiveFks("target", input.targetKind, input.targetId),
      ...protocol(actor.id),
    })
    .returning();
  const ends = relationEnds(row);
  return ok({
    relation: {
      id: row.id,
      ...ends,
      origin: row.origin,
      label: row.label,
    },
  });
}

export async function deleteRelation(actor: Actor, relationId: string) {
  const [row] = await db.select().from(relations).where(eq(relations.id, relationId)).limit(1);
  if (!row) return fail(404, "Relation nicht gefunden.");
  const gate = requireStaff(await getActiveMembership(row.worldId, actor.id));
  if (!gate.ok) return gate;
  await db.delete(relations).where(eq(relations.id, relationId));
  return ok({ deleted: true });
}

export async function listRelations(actor: Actor, worldId: string) {
  const loaded = await requireWorldMember(worldId, actor);
  if (loaded.error) return loaded.error;
  const rows = await db.select().from(relations).where(eq(relations.worldId, worldId));
  const visible = [];
  for (const row of rows) {
    const ends = relationEnds(row);
    const sourceVisible = await isContentVisibleFor(
      actor,
      worldId,
      ends.sourceKind,
      ends.sourceId,
    );
    const targetVisible = await isContentVisibleFor(
      actor,
      worldId,
      ends.targetKind,
      ends.targetId,
    );
    if (relationVisible({ sourceVisible, targetVisible })) {
      visible.push({
        id: row.id,
        ...ends,
        origin: row.origin,
        label: row.label,
      });
    }
  }
  return ok({ relations: visible });
}

export async function persistenceSnapshot(actor: Actor, worldId: string) {
  if (process.env.ENABLE_TEST_LOGIN !== "true") {
    return fail(404, "Nicht gefunden.");
  }
  const loaded = await requireWorldMember(worldId, actor);
  if (loaded.error) return loaded.error;
  if (!isStaff(loaded.membership!.role)) {
    return fail(403, "Nur die Spielleitung darf den Persistenz-Snapshot sehen.");
  }
  const [memberRows, partRows, journalRows, markerRows, relationRows] = await Promise.all([
    db.select().from(memberships).where(eq(memberships.worldId, worldId)),
    db.select().from(worldParticipations).where(eq(worldParticipations.worldId, worldId)),
    db.select().from(journalEntries).where(eq(journalEntries.worldId, worldId)),
    db
      .select({
        marker: characterMarkers,
        participation: worldParticipations,
      })
      .from(characterMarkers)
      .innerJoin(
        worldParticipations,
        and(
          eq(worldParticipations.characterId, characterMarkers.characterId),
          eq(worldParticipations.worldId, worldId),
        ),
      ),
    db.select().from(relations).where(eq(relations.worldId, worldId)),
  ]);
  return ok({
    memberships: memberRows.map((row) => ({
      userId: row.userId,
      role: row.role,
      archivedAt: row.archivedAt?.toISOString() ?? null,
    })),
    participations: partRows.map((row) => ({
      id: row.id,
      characterId: row.characterId,
      archivedAt: row.archivedAt?.toISOString() ?? null,
    })),
    journals: journalRows.map((row) => ({
      id: row.id,
      characterId: row.characterId,
      visibility: row.visibility,
      // CR-019a: never expose private journal plaintext (Plan 003 T-015)
      bodyFingerprint:
        row.visibility === "private"
          ? row.bodyPlain === null
            ? null
            : `len:${row.bodyPlain.length}`
          : row.bodyPlain === null
            ? null
            : `hash:${row.bodyPlain.length}`,
    })),
    markers: markerRows.map(({ marker }) => ({
      id: marker.id,
      characterId: marker.characterId,
      mapId: marker.mapId,
      posX: pos(marker.posX),
      posY: pos(marker.posY),
    })),
    relations: relationRows.map((row) => ({
      id: row.id,
      ...relationEnds(row),
      label: row.label,
    })),
  });
}
