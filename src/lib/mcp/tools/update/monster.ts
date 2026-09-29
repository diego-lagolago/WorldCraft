import { getArticle } from "@/lib/domain/articles";
import { updateMonster } from "@/lib/domain/monsters";
import {
  MONSTER_DANGER_LABEL,
  MONSTER_KIND_LABEL,
  MONSTER_RARITY_LABEL,
  MONSTER_SIZE_LABEL,
} from "@/lib/monsters/labels";
import { McpToolError, type McpWorldContext } from "../../context";
import {
  mapMonsterDanger,
  mapMonsterKind,
  mapMonsterRarity,
  mapMonsterSize,
  normalizeMonsterSheet,
  type NormalizedMonsterSheet,
} from "../../write-fields";
import { resolveHabitat, visibleMonster, type ResolvedHabitat } from "../../write-shared";
import { assertStand, standOf, throwAuthz, visibilityLabel } from "../../write-rich";
import { renderSheet } from "../renderers";
import { updateFieldSchemas, type UpdateFields } from "../write-schemas";
import {
  defineUpdateHandler,
  executeRich,
  previewRich,
  pushChange,
  pushRenamed,
  type PreviewContext,
} from "./common";

type MonsterRow = Awaited<ReturnType<typeof visibleMonster>>;
type MonsterFields = UpdateFields<"monster">;

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined) throw new McpToolError(`„${field}“ fehlt oder ist ungültig.`);
  return value;
}

function previewEnums(row: MonsterRow, felder: MonsterFields, context: PreviewContext) {
  if (felder.monster_art !== undefined) {
    const kind = required(mapMonsterKind(felder.monster_art), "monster_art");
    pushChange(context, "monster_art", MONSTER_KIND_LABEL[row.kind], MONSTER_KIND_LABEL[kind]);
  }
  if (felder.seltenheit !== undefined) {
    const rarity = required(mapMonsterRarity(felder.seltenheit), "seltenheit");
    pushChange(context, "seltenheit", MONSTER_RARITY_LABEL[row.rarity], MONSTER_RARITY_LABEL[rarity]);
  }
  if (felder.boss !== undefined) {
    pushChange(context, "boss", row.isBoss ? "Ja" : "Nein", felder.boss ? "Ja" : "Nein");
  }
  if (felder.gefahr !== undefined) {
    const danger = required(mapMonsterDanger(felder.gefahr), "gefahr");
    pushChange(context, "gefahr", MONSTER_DANGER_LABEL[row.danger], MONSTER_DANGER_LABEL[danger]);
  }
  if (felder.groesse !== undefined) {
    const size = required(mapMonsterSize(felder.groesse), "groesse");
    pushChange(context, "groesse", MONSTER_SIZE_LABEL[row.size], MONSTER_SIZE_LABEL[size]);
  }
}

async function currentHabitatLabel(row: MonsterRow, world: McpWorldContext): Promise<string> {
  if (!row.habitatArticleId) return "(keiner)";
  const article = await getArticle(world.id, row.habitatArticleId, world.role, world.userId);
  return article ? `${article.title} (${article.id})` : "(nicht sichtbar)";
}

function nextHabitatLabel(habitat: ResolvedHabitat): string {
  if (habitat.stubTitle) return `${habitat.stubTitle} (neuer Stub)`;
  if (!habitat.habitatArticleId) return "(keiner)";
  return `${habitat.title ?? "Ort"} (${habitat.habitatArticleId})`;
}

/** Renders the sheet without bio; the domain merges attributes per key and replaces other given keys. */
function sheetText(row: MonsterRow, sheet: NormalizedMonsterSheet = {}): string {
  return renderSheet({
    ...row,
    ...sheet,
    attributes: { ...row.attributes, ...sheet.attributes },
    bioJson: null,
  });
}

async function previewDetails(row: MonsterRow, felder: MonsterFields, context: PreviewContext) {
  if (felder.lebensraum !== undefined) {
    const habitat = await resolveHabitat(felder.lebensraum, context.world);
    if (habitat.stubTitle) context.stubs.add([habitat.stubTitle]);
    pushChange(context, "lebensraum", await currentHabitatLabel(row, context.world), nextHabitatLabel(habitat));
  }
  if (felder.charakterblatt !== undefined) {
    const sheet = normalizeMonsterSheet(felder.charakterblatt);
    pushChange(context, "charakterblatt", sheetText(row), sheetText(row, sheet));
  }
}

export const monsterUpdate = defineUpdateHandler({
  schema: updateFieldSchemas.monster,
  load: async (world, id, stand) => {
    const row = await visibleMonster(world, id);
    assertStand(row.updatedAt, stand);
    return row;
  },
  preview: async (row, felder, context) => {
    pushRenamed(context, "name", row.name, felder.name);
    previewEnums(row, felder, context);
    await previewDetails(row, felder, context);
    await previewRich(context, { label: "bio", oldJson: row.bioJson, markdown: felder.bio });
    return { title: felder.name ?? row.name };
  },
  execute: async (row, felder, context) => {
    const habitat = await resolveHabitat(felder.lebensraum, context.world);
    const result = await updateMonster({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      monsterId: row.id,
      name: felder.name,
      kind: mapMonsterKind(felder.monster_art),
      rarity: mapMonsterRarity(felder.seltenheit),
      isBoss: felder.boss,
      danger: mapMonsterDanger(felder.gefahr),
      size: mapMonsterSize(felder.groesse),
      habitatArticleId: habitat.stubTitle ? context.stubs.idFor(habitat.stubTitle) : habitat.habitatArticleId,
      bio: await executeRich(context, row.bioJson, felder.bio),
      ...normalizeMonsterSheet(felder.charakterblatt),
      expectedUpdatedAt: context.expectedUpdatedAt,
    });
    if (!result.ok) throwAuthz(result);
    const updated = await visibleMonster(context.world, row.id);
    return {
      id: updated.id,
      title: updated.name,
      stand: standOf(updated.updatedAt),
      visibility: visibilityLabel(updated.visibility),
    };
  },
});
