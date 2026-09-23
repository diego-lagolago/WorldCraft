import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterMarkers,
  journalEntries,
  memberships,
  relations,
  worldParticipations,
} from "@/db/schema";
import { fail, isStaff, ok, type AuthzResult, type MembershipRow } from "@/lib/authz";
import { isTestLoginEnabled } from "@/lib/env";

function bodyFingerprint(visibility: string, bodyPlain: string | null): string | null {
  if (visibility === "private") {
    // CR-019a: never return private journal plaintext, even to staff diagnostics.
    return bodyPlain === null ? null : `len:${bodyPlain.length}`;
  }
  return bodyPlain === null ? null : createHash("sha256").update(bodyPlain).digest("hex").slice(0, 16);
}

/**
 * Diagnostic snapshot for leave/rejoin tests. Only with Test-Login enabled.
 * Private journal bodies are never returned as plaintext (CR-019a).
 */
export async function persistenceSnapshot(input: {
  membership: MembershipRow | null;
  worldId: string;
}): Promise<
  AuthzResult<{
    memberships: { userId: string; role: string; archivedAt: string | null }[];
    participations: { id: string; characterId: string; archivedAt: string | null }[];
    journals: {
      id: string;
      characterId: string;
      visibility: string;
      bodyFingerprint: string | null;
    }[];
    markers: { id: string; characterId: string; mapId: string; posX: string; posY: string }[];
    relations: { id: string; sourceKind: string; sourceId: string | null; targetKind: string; targetId: string | null }[];
  }>
> {
  if (!isTestLoginEnabled()) return fail(404, "Nicht gefunden.");
  if (!input.membership || !isStaff(input.membership.role)) {
    return fail(403, "Nur die Spielleitung darf den Persistenz-Snapshot sehen.");
  }

  const [memberRows, partRows, journalRows, markerRows, relationRows] = await Promise.all([
    db.select().from(memberships).where(eq(memberships.worldId, input.worldId)),
    db.select().from(worldParticipations).where(eq(worldParticipations.worldId, input.worldId)),
    db.select().from(journalEntries).where(eq(journalEntries.worldId, input.worldId)),
    db
      .select({
        id: characterMarkers.id,
        characterId: characterMarkers.characterId,
        mapId: characterMarkers.mapId,
        posX: characterMarkers.posX,
        posY: characterMarkers.posY,
      })
      .from(characterMarkers)
      .innerJoin(
        worldParticipations,
        and(
          eq(worldParticipations.characterId, characterMarkers.characterId),
          eq(worldParticipations.worldId, input.worldId),
        ),
      ),
    db.select().from(relations).where(eq(relations.worldId, input.worldId)),
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
      bodyFingerprint: bodyFingerprint(row.visibility, row.bodyPlain),
    })),
    markers: markerRows.map((row) => ({
      id: row.id,
      characterId: row.characterId,
      mapId: row.mapId,
      posX: String(row.posX),
      posY: String(row.posY),
    })),
    relations: relationRows.map((row) => ({
      id: row.id,
      sourceKind: row.sourceKind,
      sourceId: row.sourceId,
      targetKind: row.targetKind,
      targetId: row.targetId,
    })),
  });
}
