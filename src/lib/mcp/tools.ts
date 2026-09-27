import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CONTENT_VISIBILITY_LABEL } from "@/lib/authz";
import { getArticle, listArticles } from "@/lib/domain/articles";
import { getWorldCharacter, listWorldCharacters } from "@/lib/domain/characters";
import { listMembers } from "@/lib/domain/members";
import { getMonster, listMonsters } from "@/lib/domain/monsters";
import { getQuest, listQuests } from "@/lib/domain/quests";
import { getQuestNote } from "@/lib/domain/quest-notes";
import { listLinked } from "@/lib/domain/relations";
import { searchWorld } from "@/lib/domain/search";
import { getUniverse } from "@/lib/domain/universes";
import { getWorldDetails } from "@/lib/domain/worlds";
import { getMcpPin, listMcpUniverseMaps, readMcpImage } from "@/lib/domain/mcp-read";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import { attributeModifier, skillBonus, SKILL_LEVEL_LABEL } from "@/lib/characters/sheet";
import { MONSTER_DANGER_LABEL, MONSTER_KIND_LABEL, MONSTER_RARITY_LABEL, MONSTER_SIZE_LABEL } from "@/lib/monsters/labels";
import { pinTypeMeta } from "@/lib/map/pin-types";
import { templateOf } from "@/lib/templates/registry";
import { writeMcpAuditLog } from "./audit";
import { listMcpWorldMemberships, McpToolError, resolveMcpWorld } from "./context";
import {
  MCP_CONTENT_KIND,
  MCP_CONTENT_KIND_FROM_INTERNAL,
  MCP_CONTENT_KIND_LABEL,
  MCP_MONSTER_KIND_LABELS,
  MCP_QUEST_STATUS,
  MCP_QUEST_STATUS_LABEL,
  MCP_TEMPLATE_TYPE,
} from "./enums";

type ToolContext = { userId: string; clientId: string };
const worldSchema = z.string().trim().min(1).max(120).optional().describe("ID oder Name der Welt. Bei mehreren Welten bitte zuerst welten_auflisten nutzen.");
const contentKind = z.enum(["artikel", "quest", "charakter", "pin", "monster", "universum"]);
const templateTypes = z.enum(["person", "ort", "organisation", "gegenstand", "rasse", "ohne"]);
const status = z.enum(["offen", "aktiv", "abgeschlossen", "gescheitert"]);
const monsterKindLabel = z.enum(MCP_MONSTER_KIND_LABELS);


function text(value: string, isError = false) {
  return { isError, content: [{ type: "text" as const, text: value.length > 20_000 ? `${value.slice(0, 19_950)}\n\n_(gekürzt)_` : value }] };
}

export function asError(error: unknown) {
  return text(error instanceof McpToolError ? error.message : "Die Anfrage konnte nicht verarbeitet werden.", true);
}

export async function withAudit(ctx: ToolContext, toolName: string, action: () => Promise<{ value: string; worldId?: string | null; image?: { data: string; mimeType: "image/jpeg" | "image/webp" } }>) {
  const start = performance.now();
  let worldId: string | null = null;
  let result = "ok";
  try {
    const response = await action();
    worldId = response.worldId ?? null;
    return response.image
      ? { content: [{ type: "text" as const, text: response.value }, { type: "image" as const, data: response.image.data, mimeType: response.image.mimeType }] }
      : text(response.value);
  } catch (error) {
    result = error instanceof McpToolError ? "tool_error" : "error";
    if (!(error instanceof McpToolError)) {
      console.error(JSON.stringify({ event: "mcp_tool_error", tool: toolName, error: error instanceof Error ? error.name : "unknown" }));
    }
    return asError(error);
  } finally {
    await writeMcpAuditLog({ userId: ctx.userId, clientId: ctx.clientId, toolName, worldId, durationMs: performance.now() - start, result })
      .catch((auditError: unknown) => console.error(JSON.stringify({ event: "mcp_audit_error", tool: toolName, error: auditError instanceof Error ? auditError.name : "unknown" })));
  }
}

async function renderTemplateFields(
  templateType: string,
  fields: Record<string, unknown>,
  world: { id: string; role: Parameters<typeof getArticle>[2] },
  viewerId: string,
) {
  const definition = templateOf(templateType);
  const lines = [`Vorlagentyp: ${definition.label}`];
  for (const field of definition.fields) {
    const raw = fields[field.key];
    if (raw === undefined) continue;
    if (field.type === "boolean") lines.push(`${field.label}: ${raw === true ? "Ja" : "Nein"}`);
    else if (field.type === "select") lines.push(`${field.label}: ${field.options.find((option) => option.value === raw)?.label ?? String(raw)}`);
    else if (field.type === "ref" && raw && typeof raw === "object") {
      const ref = raw as { kind?: string; id?: string };
      if (ref.kind === "article" && ref.id) {
        const article = await getArticle(world.id, ref.id, world.role, viewerId);
        if (article) lines.push(`${field.label}: @[${article.title}](artikel:${article.id})`);
      } else if (ref.kind === "character" && ref.id) {
        const character = await getWorldCharacter(world.id, ref.id);
        if (character) lines.push(`${field.label}: @[${character.name}](charakter:${character.id})`);
      }
    }
    else lines.push(`${field.label}: ${String(raw)}`);
  }
  if (definition.type === "item") lines.push(`Quest-Gegenstand: ${fields.quest === true ? "Ja" : "Nein"}`);
  return lines.join("\n");
}

function renderSheet(subject: { class: string | null; attributes: { str: number | null; dex: number | null; con: number | null; int: number | null; wis: number | null; cha: number | null }; proficiencyBonus: number; skills: { name: string; attr: "str" | "dex" | "con" | "int" | "wis" | "cha"; level: "untalented" | "untrained" | "trained" | "expertise" }[]; abilities: { text: string; attr: "str" | "dex" | "con" | "int" | "wis" | "cha" }[]; personality: string | null; ideals: string | null; bonds: string | null; flaws: string | null; bioJson: unknown }) {
  const attributes = Object.entries(subject.attributes).map(([name, value]) => `${name.toUpperCase()}: ${value ?? "–"}`).join(", ");
  const skills = subject.skills.map((skill) => { const total = skillBonus(skill, subject.attributes, subject.proficiencyBonus); return `${skill.name} (${skill.attr.toUpperCase()}, ${SKILL_LEVEL_LABEL[skill.level]}): ${total >= 0 ? "+" : ""}${total}`; }).join("\n");
  const abilities = subject.abilities.map((ability) => { const modifier = attributeModifier(subject.attributes[ability.attr]); return `${ability.text} (${ability.attr.toUpperCase()}): ${modifier >= 0 ? "+" : ""}${modifier}`; }).join("\n");
  return [
    `Klasse: ${subject.class ?? "–"}`,
    `Attribute: ${attributes}`,
    `Übungsbonus: +${subject.proficiencyBonus}`,
    skills ? `Fertigkeiten:\n${skills}` : "",
    abilities ? `Fähigkeiten:\n${abilities}` : "",
    subject.personality ? `Persönlichkeitsmerkmale: ${subject.personality}` : "",
    subject.ideals ? `Ideale: ${subject.ideals}` : "",
    subject.bonds ? `Bindungen: ${subject.bonds}` : "",
    subject.flaws ? `Makel: ${subject.flaws}` : "",
    tiptapJsonToMcpMarkdown(subject.bioJson),
  ].filter(Boolean).join("\n\n");
}

export function registerMcpReadTools(server: McpServer, ctx: ToolContext) {
  server.registerTool("welten_auflisten", { title: "Welten auflisten", description: "Liste die Welten des angemeldeten Benutzers. Vor einer Anfrage ohne bekannte Welt zuerst dieses Werkzeug nutzen." }, async () => withAudit(ctx, "welten_auflisten", async () => {
    const worlds = await listMcpWorldMemberships(ctx.userId);
    const lines = await Promise.all(worlds.map(async (world) => {
      if (!world.mcpEnabled) return `## ${world.name}\nID: ${world.id}\nEigene Rolle: ${world.role}\nMCP für diese Welt nicht freigegeben.`;
      const [details, members, characters] = await Promise.all([getWorldDetails(world.id), listMembers(world.id), listWorldCharacters(world.id)]);
      const mine = characters.filter((character) => character.ownerId === ctx.userId);
      return [`## ${world.name}`, `ID: ${world.id}`, details?.descriptionJson ? tiptapJsonToMcpMarkdown(details.descriptionJson) : "", `Eigene Rolle: ${world.role}`, mine.length ? `Eigene Charaktere: ${mine.map((character) => `${character.name} (${character.id})`).join(", ")}` : "", `Mitglieder: ${members.filter((member) => member.userId !== ctx.userId).map((member) => `${member.name} (${member.role})`).join(", ") || "keine weiteren"}`].filter(Boolean).join("\n");
    }));
    return { value: lines.join("\n\n") || "Keine Welten vorhanden." };
  }));

  server.registerTool("suchen", { title: "Inhalte suchen", description: "Suche sichtbare Inhalte in genau einer freigegebenen Welt. Wenn keine Welt bekannt ist, zuerst welten_auflisten nutzen; nie weltübergreifend suchen.", inputSchema: z.object({ welt: worldSchema, suchbegriff: z.string().trim().min(2).max(200), art: contentKind.optional(), limit: z.number().int().min(1).max(50).optional() }) }, async ({ welt, suchbegriff, art, limit }) => withAudit(ctx, "suchen", async () => {
    const world = await resolveMcpWorld(ctx.userId, welt);
    const hits = await searchWorld({ worldId: world.id, role: world.role, viewerId: ctx.userId, query: suchbegriff, limit: limit ?? 20, kind: art ? MCP_CONTENT_KIND[art] : "all" });
    return { worldId: world.id, value: hits.length ? hits.map((hit) => `- ${hit.title} (${MCP_CONTENT_KIND_LABEL[MCP_CONTENT_KIND_FROM_INTERNAL[hit.kind]]}, ${hit.id})${hit.templateType ? ` – ${templateOf(hit.templateType).label}` : ""}${hit.snippet ? `\n  ${hit.snippet}` : ""}`).join("\n") : "Keine Treffer." };
  }));

  server.registerTool("inhalte_auflisten", { title: "Artikel oder Monster auflisten", description: "Liste sichtbare Artikel oder Monster einer freigegebenen Welt, wenn kein Suchbegriff nötig ist.", inputSchema: z.object({ welt: worldSchema, art: z.enum(["artikel", "monster"]), vorlagentyp: templateTypes.optional(), monster_art: monsterKindLabel.optional(), quest_gegenstand: z.boolean().optional(), limit: z.number().int().min(1).max(200).optional() }) }, async ({ welt, art, vorlagentyp, monster_art, quest_gegenstand, limit }) => withAudit(ctx, "inhalte_auflisten", async () => {
    if (art === "artikel" && monster_art) throw new McpToolError("monster_art ist nur bei art: monster erlaubt.");
    if (art === "monster" && (vorlagentyp || quest_gegenstand !== undefined)) throw new McpToolError("vorlagentyp und quest_gegenstand sind nur bei art: artikel erlaubt.");
    if (quest_gegenstand !== undefined && vorlagentyp !== "gegenstand") throw new McpToolError("quest_gegenstand ist nur bei vorlagentyp: gegenstand erlaubt.");
    const world = await resolveMcpWorld(ctx.userId, welt);
    if (art === "artikel") {
      const rows = await listArticles(world.id, world.role, ctx.userId, vorlagentyp ? MCP_TEMPLATE_TYPE[vorlagentyp] : "all");
      const filtered = rows.filter((row) => quest_gegenstand === undefined || row.isQuestItem === quest_gegenstand).slice(0, limit ?? 50);
      return { worldId: world.id, value: filtered.length ? filtered.map((row) => {
        const rarityField = templateOf(row.templateType).fields.find((field) => field.type === "select" && field.display === "rarity");
        const rarity = rarityField?.type === "select" ? rarityField.options.find((option) => option.value === row.rarity)?.label : undefined;
        return `- ${row.title} (${templateOf(row.templateType).label}, ${row.id})${rarity ? ` – ${rarity}` : ""}${row.isQuestItem ? " – Quest-Gegenstand" : ""}`;
      }).join("\n") : "Keine Inhalte." };
    }
    const rows = await listMonsters(world.id, world.role, ctx.userId, "all");
    const filtered = rows.filter((row) => !monster_art || MONSTER_KIND_LABEL[row.kind] === monster_art).slice(0, limit ?? 50);
    return { worldId: world.id, value: filtered.length ? filtered.map((row) => `- ${row.name} (${MONSTER_KIND_LABEL[row.kind]}, ${row.id}) – ${MONSTER_RARITY_LABEL[row.rarity]}${row.isBoss ? ", Boss" : ""}`).join("\n") : "Keine Monster." };
  }));

  server.registerTool("inhalt_lesen", { title: "Inhalt lesen", description: "Lies einen sichtbaren Inhalt einer freigegebenen Welt vollständig. Bilder werden nie hier, sondern nur mit bild_lesen geliefert.", inputSchema: z.object({ welt: worldSchema, art: contentKind, id: z.string().uuid() }) }, async ({ welt, art, id }) => withAudit(ctx, "inhalt_lesen", async () => {
    const world = await resolveMcpWorld(ctx.userId, welt);
    const role = world.role;
    let value = "";
    if (art === "artikel") {
      const row = await getArticle(world.id, id, role, ctx.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      value = [`# ${row.title}`, `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`, `Stand: ${row.updatedAt.toISOString()}`, await renderTemplateFields(row.templateType, row.templateFields, world, ctx.userId), row.titleImageId ? "Bilder: 1 (über bild_lesen)" : "Bilder: keine", tiptapJsonToMcpMarkdown(row.bodyJson)].filter(Boolean).join("\n\n");
    } else if (art === "quest") {
      const row = await getQuest(world.id, id, role, ctx.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      const note = await getQuestNote({ worldId: world.id, questId: row.id, role, viewerId: ctx.userId });
      value = [`# ${row.title}`, `Status: ${MCP_QUEST_STATUS_LABEL[row.status]}`, `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`, `Stand: ${row.updatedAt.toISOString()}`, row.participants.length ? `Beteiligte Charaktere: ${row.participants.map((entry) => entry.characterName).join(", ")}` : "", tiptapJsonToMcpMarkdown(row.descriptionJson), ...row.chapters.map((chapter) => `## ${chapter.title}\nStatus: ${MCP_QUEST_STATUS_LABEL[chapter.status]}\n${tiptapJsonToMcpMarkdown(chapter.bodyJson)}`), note.ok ? `## Notizblock\nStand: ${note.data.version}\n${tiptapJsonToMcpMarkdown(note.data.bodyJson)}` : ""].filter(Boolean).join("\n\n");
    } else if (art === "charakter") {
      const row = await getWorldCharacter(world.id, id);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      value = [`# ${row.name}`, `Stand: ${row.updatedAt.toISOString()}`, row.portraitId || row.images.length ? `Bilder: ${(row.portraitId ? 1 : 0) + row.images.length} (über bild_lesen)` : "Bilder: keine", renderSheet(row)].join("\n\n");
    } else if (art === "monster") {
      const row = await getMonster(world.id, id, role, ctx.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      const habitat = row.habitatArticleId ? await getArticle(world.id, row.habitatArticleId, role, ctx.userId) : null;
      value = [`# ${row.name}`, `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`, `Stand: ${row.updatedAt.toISOString()}`, `Art: ${MONSTER_KIND_LABEL[row.kind]}`, `Seltenheit: ${MONSTER_RARITY_LABEL[row.rarity]}`, `Boss: ${row.isBoss ? "Ja" : "Nein"}`, `Gefahrenstufe: ${MONSTER_DANGER_LABEL[row.danger]}`, `Größe: ${MONSTER_SIZE_LABEL[row.size]}`, habitat ? `Lebensraum: ${habitat.title} (${habitat.id})` : "", row.portraitId ? "Bilder: 1 (über bild_lesen)" : "Bilder: keine", renderSheet(row)].filter(Boolean).join("\n\n");
    } else if (art === "universum") {
      const row = await getUniverse(world.id, id, role, ctx.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      const maps = await listMcpUniverseMaps(world.id, { role, userId: ctx.userId }, row.id);
      const visible = maps.find((entry) => entry.id === row.id);
      value = [`# ${row.name}`, `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`, `Stand: ${row.updatedAt.toISOString()}`, visible?.maps.length ? `Karten: ${visible.maps.map((map) => `${map.name} (${map.id})`).join(", ")}` : "Karten: keine", tiptapJsonToMcpMarkdown(row.descriptionJson)].filter(Boolean).join("\n\n");
    } else if (art === "pin") {
      const row = await getMcpPin(world.id, id, { role, userId: ctx.userId });
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      value = [`# ${row.title}`, `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`, `Stand: ${row.updatedAt.toISOString()}`, `Pin-Typ: ${pinTypeMeta(row.pinType as Parameters<typeof pinTypeMeta>[0]).label}`, `Karte: ${row.mapName}`, `Universum: ${row.universeName} (${row.universeId})`, tiptapJsonToMcpMarkdown(row.descriptionJson)].filter(Boolean).join("\n\n");
    } else {
      throw new McpToolError("Diese Inhaltsart wird noch nicht unterstützt.");
    }
    return { worldId: world.id, value };
  }));

  server.registerTool("relationen_abrufen", { title: "Relationen abrufen", description: "Lies sichtbare Verknüpfungen eines Inhalts. Unsichtbare Inhalte und Pfade werden nie ausgegeben.", inputSchema: z.object({ welt: worldSchema, art: contentKind, id: z.string().uuid(), tiefe: z.union([z.literal(1), z.literal(2)]).optional() }) }, async ({ welt, art, id, tiefe }) => withAudit(ctx, "relationen_abrufen", async () => {
    const world = await resolveMcpWorld(ctx.userId, welt);
    const first = await listLinked({ worldId: world.id, role: world.role, viewerId: ctx.userId, kind: MCP_CONTENT_KIND[art], id });
    const lines = first.map((row) => `- ${row.title} (${MCP_CONTENT_KIND_LABEL[MCP_CONTENT_KIND_FROM_INTERNAL[row.kind]]}, ${row.id}) – Herkunft: ${row.originLabels.join(", ")}${row.manualLabel ? ` – ${row.manualLabel}` : ""}`);
    if (tiefe === 2) for (const row of first) {
      const next = await listLinked({ worldId: world.id, role: world.role, viewerId: ctx.userId, kind: row.kind, id: row.id });
      for (const child of next.filter((entry) => !(entry.kind === MCP_CONTENT_KIND[art] && entry.id === id))) lines.push(`  - ${row.title} → ${child.title} (${MCP_CONTENT_KIND_LABEL[MCP_CONTENT_KIND_FROM_INTERNAL[child.kind]]}, ${child.id}) – Herkunft: ${child.originLabels.join(", ")}${child.manualLabel ? ` – ${child.manualLabel}` : ""}`);
    }
    return { worldId: world.id, value: lines.length ? lines.join("\n") : "Keine sichtbaren Relationen." };
  }));

  server.registerTool("quests_auflisten", { title: "Quests auflisten", description: "Liste sichtbare Quests einer freigegebenen Welt, optional gefiltert nach Status.", inputSchema: z.object({ welt: worldSchema, status: status.optional() }) }, async ({ welt, status: requestedStatus }) => withAudit(ctx, "quests_auflisten", async () => {
    const world = await resolveMcpWorld(ctx.userId, welt);
    const rows = (await listQuests(world.id, world.role, ctx.userId)).filter((row) => !requestedStatus || row.status === MCP_QUEST_STATUS[requestedStatus]);
    return { worldId: world.id, value: rows.length ? rows.map((row) => `- ${row.title} (${row.id}) – ${MCP_QUEST_STATUS_LABEL[row.status]}${row.participants.length ? ` – Beteiligte: ${row.participants.map((entry) => entry.characterName).join(", ")}` : ""}`).join("\n") : "Keine Quests." };
  }));

  server.registerTool("universen_auflisten", { title: "Universen auflisten", description: "Liste sichtbare Universen einer freigegebenen Welt und ihre Karten. Pins, Marker, Kartenbilder und Koordinaten werden nicht geliefert.", inputSchema: z.object({ welt: worldSchema }) }, async ({ welt }) => withAudit(ctx, "universen_auflisten", async () => {
    const world = await resolveMcpWorld(ctx.userId, welt);
    const rows = await listMcpUniverseMaps(world.id, { role: world.role, userId: ctx.userId });
    return { worldId: world.id, value: rows.length ? rows.map((row) => [`## ${row.name}`, `ID: ${row.id}`, tiptapJsonToMcpMarkdown(row.descriptionJson), row.maps.length ? `Karten: ${row.maps.map((map) => `${map.name} (${map.id})`).join(", ")}` : "Karten: keine"].filter(Boolean).join("\n")).join("\n\n") : "Keine Universen." };
  }));

  server.registerTool("bild_lesen", { title: "Bild lesen", description: "Liefert ein sichtbares Inhaltsbild als Bilddaten. Kartenbilder sind ausgeschlossen; niemals URLs oder Datei-IDs ausgeben.", inputSchema: z.object({ welt: worldSchema, art: z.enum(["welt", "artikel", "charakter", "monster"]), id: z.string().uuid().optional(), bild_nr: z.number().int().min(1).max(10).optional() }) }, async ({ welt, art, id, bild_nr }) => withAudit(ctx, "bild_lesen", async () => {
    const world = await resolveMcpWorld(ctx.userId, welt);
    let fileId: string | null = null;
    let description = "";
    if (art === "welt") {
      if (id) throw new McpToolError("Für ein Weltbild ist keine id erlaubt.");
      fileId = (await getWorldDetails(world.id))?.titleImageId ?? null;
      description = `Bild der Welt ${world.name}.`;
    } else if (art === "artikel") {
      if (!id) throw new McpToolError("id fehlt.");
      const article = await getArticle(world.id, id, world.role, ctx.userId);
      fileId = article?.titleImageId ?? null;
      description = article ? `Titelbild des Artikels ${article.title}.` : "";
    } else if (art === "monster") {
      if (!id) throw new McpToolError("id fehlt.");
      const monster = await getMonster(world.id, id, world.role, ctx.userId);
      fileId = monster?.portraitId ?? null;
      description = monster ? `Profilbild des Monsters ${monster.name}.` : "";
    } else {
      if (!id) throw new McpToolError("id fehlt.");
      const character = await getWorldCharacter(world.id, id);
      fileId = bild_nr ? character?.images[bild_nr - 1]?.fileId ?? null : character?.portraitId ?? null;
      description = character ? `${bild_nr ? `Bild ${bild_nr}` : "Profilbild"} des Charakters ${character.name}.` : "";
    }
    if (!fileId) throw new McpToolError("Bild nicht gefunden.");
    const image = await readMcpImage(ctx.userId, fileId);
    if (!image) throw new McpToolError("Bild nicht gefunden.");
    return { worldId: world.id, value: description, image };
  }));
}
