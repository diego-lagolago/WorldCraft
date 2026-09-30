import { getArticle } from "@/lib/domain/articles";
import { getQuestNote } from "@/lib/domain/quest-notes";
import { getWorldDetails } from "@/lib/domain/worlds";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import { templateOf } from "@/lib/templates/registry";
import { McpToolError, type McpWorldContext } from "./context";
import { MCP_NOT_SET, MCP_QUEST_STATUS_LABEL } from "./enums";
import { fieldFor, labelFor, type FieldArt } from "./field-catalog";
import { sheetEntries, templateFieldEntries } from "./tools/renderers";
import {
  findVisibleChapter,
  visibleArticle,
  visibleMonster,
  visibleQuest,
  visibleUniverse,
  worldStand,
} from "./write-shared";
import { RICH_EXCERPT, tailExcerpt } from "./change-format";
import { formatDelta, RECEIPT_INSTRUCTION, standOf, visibilityLabel, type FieldChange } from "./write-rich";

export { RECEIPT_INSTRUCTION };

/** Stored state of one content item as display label → value, read back after a write (012 T-008). */
export type Snapshot = {
  title: string;
  stand: string;
  visibility?: string;
  entries: Map<string, string>;
  /** Labels holding rich text; their delta shows the appended or new text. */
  richLabels: Set<string>;
};

function label(art: FieldArt, key: string) {
  return fieldFor(art, key)?.label ?? key;
}

function markdown(json: unknown) {
  return tiptapJsonToMcpMarkdown(json).trim() || MCP_NOT_SET;
}

function addEntries(entries: Map<string, string>, rows: readonly (readonly [string, string])[], prefix = "") {
  for (const [label, value] of rows) entries.set(`${prefix}${label}`, value);
}

function snapshot(input: Omit<Snapshot, "entries" | "richLabels">, rows: [string, string][], rich: string[]): Snapshot {
  return { ...input, entries: new Map(rows), richLabels: new Set(rich) };
}

async function articleSnapshot(world: McpWorldContext, id: string, source?: unknown) {
  const row = source as Awaited<ReturnType<typeof visibleArticle>> ?? await visibleArticle(world, id);
  const result = snapshot(
    { title: row.title, stand: standOf(row.updatedAt), visibility: visibilityLabel(row.visibility) },
    [[label("artikel", "titel"), row.title], [label("artikel", "vorlagentyp"), templateOf(row.templateType).label]],
    [label("artikel", "text")],
  );
  addEntries(result.entries, await templateFieldEntries(row.templateType, row.templateFields, world, world.userId));
  result.entries.set(label("artikel", "text"), markdown(row.bodyJson));
  return result;
}

async function questSnapshot(world: McpWorldContext, id: string, source?: unknown) {
  const row = source as Awaited<ReturnType<typeof visibleQuest>> ?? await visibleQuest(world, id);
  const participants = row.participants.map((entry) => entry.characterName).join(", ") || MCP_NOT_SET;
  return snapshot(
    { title: row.title, stand: standOf(row.updatedAt), visibility: visibilityLabel(row.visibility) },
    [
      [label("quest", "titel"), row.title],
      [label("quest", "status"), MCP_QUEST_STATUS_LABEL[row.status]],
      [label("quest", "beteiligte"), participants],
      [label("quest", "beschreibung"), markdown(row.descriptionJson)],
    ],
    [label("quest", "beschreibung")],
  );
}

async function chapterSnapshot(world: McpWorldContext, id: string, source?: unknown) {
  const { chapter } = source as Awaited<ReturnType<typeof findVisibleChapter>> ?? await findVisibleChapter(world, id);
  return snapshot(
    { title: chapter.title, stand: standOf(chapter.updatedAt), visibility: visibilityLabel(chapter.visibility) },
    [
      [label("kapitel", "titel"), chapter.title],
      [label("kapitel", "status"), MCP_QUEST_STATUS_LABEL[chapter.status]],
      [label("kapitel", "position"), String(chapter.position + 1)],
      [label("kapitel", "text"), markdown(chapter.bodyJson)],
    ],
    [label("kapitel", "text")],
  );
}

async function noteSnapshot(world: McpWorldContext, questId: string, source?: unknown) {
  type LoadedNote = {
    quest: Awaited<ReturnType<typeof visibleQuest>>;
    note: Awaited<ReturnType<typeof getQuestNote>> extends { ok: true; data: infer T } ? T : never;
  };
  const loaded = source as LoadedNote | undefined;
  const quest = loaded?.quest ?? await visibleQuest(world, questId);
  const note = loaded
    ? { ok: true as const, data: loaded.note }
    : await getQuestNote({ worldId: world.id, questId: quest.id, role: world.role, viewerId: world.userId });
  if (!note.ok) throw new McpToolError("Notizblock nicht gefunden.");
  return snapshot(
    { title: quest.title, stand: String(note.data.version) },
    [[label("notizblock", "text"), markdown(note.data.bodyJson)]],
    [label("notizblock", "text")],
  );
}

async function monsterSnapshot(world: McpWorldContext, id: string, source?: unknown) {
  const row = source as Awaited<ReturnType<typeof visibleMonster>> ?? await visibleMonster(world, id);
  const habitat = row.habitatArticleId
    ? await getArticle(world.id, row.habitatArticleId, world.role, world.userId)
    : null;
  const select = (key: string, value: string) => labelFor(fieldFor("monster", key)!, value);
  const result = snapshot(
    { title: row.name, stand: standOf(row.updatedAt), visibility: visibilityLabel(row.visibility) },
    [
      [label("monster", "name"), row.name],
      [label("monster", "monster_art"), select("monster_art", row.kind)],
      [label("monster", "seltenheit"), select("seltenheit", row.rarity)],
      [label("monster", "boss"), row.isBoss ? "Ja" : "Nein"],
      [label("monster", "gefahr"), select("gefahr", row.danger)],
      [label("monster", "groesse"), select("groesse", row.size)],
      [label("monster", "lebensraum"), habitat ? `${habitat.title} (${habitat.id})` : MCP_NOT_SET],
    ],
    [label("monster", "bio")],
  );
  addEntries(result.entries, sheetEntries({ ...row, bioJson: null }), "Charakterblatt – ");
  result.entries.set(label("monster", "bio"), markdown(row.bioJson));
  return result;
}

async function universeSnapshot(world: McpWorldContext, id: string, source?: unknown) {
  const row = source as Awaited<ReturnType<typeof visibleUniverse>> ?? await visibleUniverse(world, id);
  return snapshot(
    { title: row.name, stand: standOf(row.updatedAt), visibility: visibilityLabel(row.visibility) },
    [[label("universum", "name"), row.name], [label("universum", "beschreibung"), markdown(row.descriptionJson)]],
    [label("universum", "beschreibung")],
  );
}

async function worldSnapshot(world: McpWorldContext, source?: unknown) {
  const row = source as Awaited<ReturnType<typeof getWorldDetails>> ?? await getWorldDetails(world.id);
  if (!row) throw new McpToolError("Inhalt nicht gefunden.");
  return snapshot(
    { title: row.name, stand: await worldStand(world.userId, world.id) },
    [[label("welt", "name"), row.name], [label("welt", "beschreibung"), markdown(row.descriptionJson)]],
    [label("welt", "beschreibung")],
  );
}

/** Title of a visible item without rendering its fields (relation receipts, Review 012 CR-007). */
export async function contentTitle(world: McpWorldContext, art: "artikel" | "quest" | "monster" | "universum", id: string) {
  if (art === "artikel") return (await visibleArticle(world, id)).title;
  if (art === "quest") return (await visibleQuest(world, id)).title;
  if (art === "monster") return (await visibleMonster(world, id)).name;
  return (await visibleUniverse(world, id)).name;
}

/** Reads the stored state through the same visibility-aware loaders as the write tools. */
export async function snapshotContent(world: McpWorldContext, art: FieldArt, id: string, source?: unknown): Promise<Snapshot> {
  switch (art) {
  case "artikel": return articleSnapshot(world, id, source);
  case "quest": return questSnapshot(world, id, source);
  case "kapitel": return chapterSnapshot(world, id, source);
  case "notizblock": return noteSnapshot(world, id, source);
  case "monster": return monsterSnapshot(world, id, source);
  case "universum": return universeSnapshot(world, id, source);
  case "welt": return worldSnapshot(world, source);
  }
}

function richDelta(entry: string, before: string, after: string): FieldChange {
  const old = before === MCP_NOT_SET ? "" : before;
  const cut = old.length > RICH_EXCERPT;
  const oldValue = old ? tailExcerpt(old) : MCP_NOT_SET;
  const oldCaption = cut ? "vorher (letzte 500 Zeichen)" : "vorher";
  if (old && after.startsWith(old)) {
    return { label: entry, oldValue, oldCaption, newValue: after.slice(old.length).trim(), newCaption: "angehängt" };
  }
  return { label: entry, oldValue, oldCaption, newValue: after, newCaption: "jetzt" };
}

/** Delta between two stored states; `before` is empty when the content was just created. */
export function snapshotDelta(before: Snapshot | null, after: Snapshot): FieldChange[] {
  const changes: FieldChange[] = [];
  const previous = new Map(before?.entries ?? []);
  if (before?.visibility) previous.set("Sichtbarkeit", before.visibility);
  const rows = new Set([...previous.keys(), ...after.entries.keys()]);
  if (after.visibility) rows.add("Sichtbarkeit");
  for (const entry of rows) {
    const value = entry === "Sichtbarkeit" ? after.visibility ?? MCP_NOT_SET : after.entries.get(entry) ?? MCP_NOT_SET;
    const old = previous.get(entry) ?? MCP_NOT_SET;
    if (old === value || (!before && value === MCP_NOT_SET)) continue;
    changes.push(after.richLabels.has(entry) && before
      ? richDelta(entry, old, value)
      : { label: entry, oldValue: old, newValue: value });
  }
  return changes;
}

const RECEIPT_UNAVAILABLE = "Die Änderungsübersicht konnte nach dem Speichern nicht geladen werden; die Änderung ist gespeichert.";

/**
 * Receipt after a successful write. Runs outside the stub compensation: a failed re-read must
 * never report the saved write as failed or remove referenced stubs (Review 012 CR-001).
 */
export async function receiptAfterWrite(input: {
  world: McpWorldContext;
  art: FieldArt;
  id: string;
  before: Snapshot | null;
  /** The handler returns only the ID (and the note version when applicable). */
  result: { id: string; stand?: string };
  stubs?: readonly { id: string; title: string }[];
  notes?: readonly string[];
}): Promise<string> {
  const base = { art: input.art, id: input.id, stubs: input.stubs, notes: input.notes };
  try {
    const after = await snapshotContent(input.world, input.art, input.id);
    return formatReceipt({ ...base, after: { ...after, stand: input.result.stand ?? after.stand }, changes: snapshotDelta(input.before, after) });
  } catch (error) {
    console.error(JSON.stringify({ event: "mcp_receipt_error", art: input.art, error: error instanceof Error ? error.name : "unknown" }));
    return formatReceipt({
      ...base,
      after: {
        title: input.before?.title ?? "Unbekannter Inhalt",
        stand: MCP_NOT_SET,
        visibility: input.before?.visibility,
      },
      changes: null,
      notes: [...(input.notes ?? []), "Bitte vor der nächsten Änderung neu lesen."],
    });
  }
}

/** Receipt after an executed write (Begriffe „Quittung“, E2). */
export function formatReceipt(input: {
  art: string;
  id: string;
  after: Pick<Snapshot, "title" | "visibility"> & { stand?: string };
  /** `null` when the stored state could not be read back after the write. */
  changes: readonly FieldChange[] | null;
  stubs?: readonly { id: string; title: string }[];
  extraLines?: readonly string[];
  notes?: readonly string[];
}): string {
  return [
    RECEIPT_INSTRUCTION,
    "Gespeichert.",
    `Art: ${input.art}`,
    `ID: ${input.id}`,
    `Titel: ${input.after.title}`,
    ...(input.after.stand ? [`Stand: ${input.after.stand}`] : []),
    ...(input.after.visibility ? [`Sichtbarkeit: ${input.after.visibility}`] : []),
    ...(input.extraLines ?? []),
    ...(input.changes === null
      ? [RECEIPT_UNAVAILABLE]
      : input.changes.length
        ? formatDelta(input.changes, "Gespeicherte Änderungen (vorher → nachher):")
        : ["Keine Feldänderung gespeichert."]),
    ...(input.stubs?.length ? ["Neu angelegte Stub-Artikel:", ...input.stubs.map((stub) => `- ${stub.title} (${stub.id})`)] : []),
    ...(input.notes ?? []),
  ].join("\n");
}
