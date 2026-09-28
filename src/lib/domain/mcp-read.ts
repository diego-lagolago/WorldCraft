import { readFile } from "node:fs/promises";
import { and, asc, eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db/client";
import { files, maps, pins, universes } from "@/db/schema";
import { canSeeContent, canSeePublishedLayer, type MembershipRole } from "@/lib/authz";
import { authorizeFileRead } from "@/lib/files/authorize-file-read";
import { storedFilePath } from "@/lib/files/store";
import { IMAGE_MAX_PIXELS } from "@/lib/files/inspect";
import { McpToolError } from "@/lib/mcp/context";

type Viewer = { role: MembershipRole; userId: string };

export type McpPin = { id: string; title: string; pinType: string; descriptionJson: unknown; visibility: "owner_only" | "gm_only" | "published"; updatedAt: Date; mapName: string; universeId: string; universeName: string };

export async function getMcpPin(worldId: string, pinId: string, viewer: Viewer): Promise<McpPin | null> {
  const [row] = await db.select({
    id: pins.id, title: pins.title, pinType: pins.pinType, descriptionJson: pins.descriptionJson, visibility: pins.visibility, ownerId: pins.ownerId, updatedAt: pins.updatedAt,
    mapName: maps.name, mapVisibility: maps.visibility, universeId: universes.id, universeName: universes.name, universeVisibility: universes.visibility,
  }).from(pins).innerJoin(maps, eq(maps.id, pins.mapId)).innerJoin(universes, eq(universes.id, maps.universeId)).where(and(eq(pins.id, pinId), eq(universes.worldId, worldId))).limit(1);
  if (!row || !canSeePublishedLayer(viewer, [{ visibility: row.universeVisibility }, { visibility: row.mapVisibility }, { visibility: row.visibility, ownerId: row.ownerId }])) return null;
  return { id: row.id, title: row.title, pinType: row.pinType, descriptionJson: row.descriptionJson, visibility: row.visibility as "owner_only" | "gm_only" | "published", updatedAt: row.updatedAt, mapName: row.mapName, universeId: row.universeId, universeName: row.universeName };
}

export async function listMcpUniverseMaps(worldId: string, viewer: Viewer, universeId?: string) {
  const rows = await db.select({ universeId: universes.id, universeName: universes.name, universeDescriptionJson: universes.descriptionJson, universeVisibility: universes.visibility, mapId: maps.id, mapName: maps.name, mapVisibility: maps.visibility })
    .from(universes).leftJoin(maps, eq(maps.universeId, universes.id)).where(and(eq(universes.worldId, worldId), ...(universeId ? [eq(universes.id, universeId)] : []))).orderBy(asc(universes.sortOrder), asc(maps.name));
  const output = new Map<string, { id: string; name: string; descriptionJson: unknown; maps: { id: string; name: string }[] }>();
  for (const row of rows) {
    if (!canSeeContent(viewer, { visibility: row.universeVisibility })) continue;
    const entry = output.get(row.universeId) ?? { id: row.universeId, name: row.universeName, descriptionJson: row.universeDescriptionJson, maps: [] };
    if (row.mapId && row.mapName && row.mapVisibility && canSeeContent(viewer, { visibility: row.mapVisibility })) entry.maps.push({ id: row.mapId, name: row.mapName });
    output.set(row.universeId, entry);
  }
  return [...output.values()];
}

/** Produces bounded image data only after the same authorization path as /api/files. */
export async function readMcpImage(userId: string, fileId: string): Promise<{ data: string; mimeType: "image/webp" } | null> {
  if (!(await authorizeFileRead(userId, fileId))) return null;
  const [file] = await db.select({ storageKey: files.storageKey }).from(files).where(eq(files.id, fileId)).limit(1);
  if (!file) return null;
  const input = await readFile(storedFilePath(file.storageKey));
  return encodeMcpImage(input);
}

/** Re-encodes one already-authorized image into the bounded MCP response format. */
export async function encodeMcpImage(input: Buffer): Promise<{ data: string; mimeType: "image/webp" }> {
  try {
    for (const quality of [82, 70, 58, 46]) {
      const output = await sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS }).rotate().resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
      if (output.byteLength <= 1024 * 1024) return { data: output.toString("base64"), mimeType: "image/webp" };
    }
    const fallback = await sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS }).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).webp({ quality: 46 }).toBuffer();
    if (fallback.byteLength <= 1024 * 1024) return { data: fallback.toString("base64"), mimeType: "image/webp" };
  } catch {
    throw new McpToolError("Bild zu groß für die Ausgabe.");
  }
  throw new McpToolError("Bild zu groß für die Ausgabe.");
}
