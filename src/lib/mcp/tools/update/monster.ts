import { getArticle } from "@/lib/domain/articles";
import { updateMonster } from "@/lib/domain/monsters";
import {
  MONSTER_DANGER_LABEL,
  MONSTER_KIND_LABEL,
  MONSTER_RARITY_LABEL,
  MONSTER_SIZE_LABEL,
} from "@/lib/monsters/labels";
import type { McpWorldContext } from "../../context";
import { MCP_NOT_SET } from "../../enums";
import {
  mapMonsterDanger,
  mapMonsterKind,
  mapMonsterRarity,
  mapMonsterSize,
  normalizeMonsterSheet,
  requiredMonsterEnum,
  type NormalizedMonsterSheet,
} from "../../write-fields";
import { resolveHabitat, visibleMonster, type ResolvedHabitat } from "../../write-shared";
import { assertStand, throwAuthz, visibilityLabel } from "../../write-rich";
import { sheetEntries } from "../renderers";
import { updateFieldSchemas, type UpdateFields } from "../write-schemas";
import {
  defineUpdateHandler,
  executeRich,
  previewRich,
  pushChange,
  pushEntryChanges,
  pushRenamed,
  type PreviewContext,
} from "./common";

type MonsterRow = Awaited<ReturnType<typeof visibleMonster>>;
type MonsterFields = UpdateFields<"monster">;

function previewEnums(row: MonsterRow, felder: MonsterFields, context: PreviewContext) {
  if (felder.monster_art !== undefined) {
    const kind = requiredMonsterEnum.monster_art(felder.monster_art);
    pushChange(context, "monster_art", MONSTER_KIND_LABEL[row.kind], MONSTER_KIND_LABEL[kind]);
  }
  if (felder.seltenheit !== undefined) {
    const rarity = requiredMonsterEnum.seltenheit(felder.seltenheit);
    pushChange(context, "seltenheit", MONSTER_RARITY_LABEL[row.rarity], MONSTER_RARITY_LABEL[rarity]);
  }
  if (felder.boss !== undefined) {
    pushChange(context, "boss", row.isBoss ? "Ja" : "Nein", felder.boss ? "Ja" : "Nein");
  }
  if (felder.gefahr !== undefined) {
    const danger = requiredMonsterEnum.gefahr(felder.gefahr);
    pushChange(context, "gefahr", MONSTER_DANGER_LABEL[row.danger], MONSTER_DANGER_LABEL[danger]);
  }
  if (felder.groesse !== undefined) {
    const size = requiredMonsterEnum.groesse(felder.groesse);
    pushChange(context, "groesse", MONSTER_SIZE_LABEL[row.size], MONSTER_SIZE_LABEL[size]);
  }
}

async function currentHabitatLabel(row: MonsterRow, world: McpWorldContext): Promise<string> {
  if (!row.habitatArticleId) return MCP_NOT_SET;
  const article = await getArticle(world.id, row.habitatArticleId, world.role, world.userId);
  return article ? `${article.title} (${article.id})` : "(nicht sichtbar)";
}

function nextHabitatLabel(habitat: ResolvedHabitat): string {
  if (habitat.stubTitle) return `${habitat.stubTitle} (neuer Stub)`;
  if (!habitat.habitatArticleId) return MCP_NOT_SET;
  return `${habitat.title ?? "Ort"} (${habitat.habitatArticleId})`;
}

/** Renders the sheet without bio; the domain merges attributes per key and replaces other given keys. */
function sheetEntriesFor(row: MonsterRow, sheet: NormalizedMonsterSheet = {}) {
  return sheetEntries({
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
    pushEntryChanges(context, {
    prefix: "Charakterblatt – ",
      before: sheetEntriesFor(row),
      after: sheetEntriesFor(row, sheet),
    });
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
    return { title: felder.name ?? row.name, visibility: visibilityLabel(row.visibility) };
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
    return { id: row.id };
  },
});
