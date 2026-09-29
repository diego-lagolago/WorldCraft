import { CONTENT_VISIBILITY_LABEL } from "@/lib/authz";
import { createMonster } from "@/lib/domain/monsters";
import { createUniverse } from "@/lib/domain/universes";
import {
  mapMonsterDanger,
  mapMonsterKind,
  mapMonsterRarity,
  mapMonsterSize,
  normalizeMonsterSheet,
} from "../../write-fields";
import { resolveHabitat } from "../../write-shared";
import { standOf, throwAuthz, visibilityLabel } from "../../write-rich";
import { createFieldSchemas } from "../write-schemas";
import { collectRich, createRich, defineCreateHandler } from "./common";

export const monsterCreate = defineCreateHandler({
  schema: createFieldSchemas.monster,
  titleOf: (felder) => felder.name,
  check: async (felder) => {
    normalizeMonsterSheet(felder.charakterblatt);
    mapMonsterKind(felder.monster_art);
    mapMonsterRarity(felder.seltenheit);
    mapMonsterDanger(felder.gefahr);
    mapMonsterSize(felder.groesse);
  },
  collect: async (felder, context) => {
    const habitat = await resolveHabitat(felder.lebensraum, context.world);
    if (habitat.stubTitle) context.stubs.add([habitat.stubTitle]);
    await collectRich(context, felder.bio);
  },
  execute: async (felder, context) => {
    const habitat = await resolveHabitat(felder.lebensraum, context.world);
    const result = await createMonster({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      name: felder.name,
      kind: mapMonsterKind(felder.monster_art),
      rarity: mapMonsterRarity(felder.seltenheit),
      isBoss: felder.boss,
      danger: mapMonsterDanger(felder.gefahr),
      size: mapMonsterSize(felder.groesse),
      habitatArticleId: (habitat.stubTitle ? context.stubs.idFor(habitat.stubTitle) : habitat.habitatArticleId) ?? null,
      bio: await createRich(context, felder.bio),
      ...normalizeMonsterSheet(felder.charakterblatt),
      visibility: "owner_only",
    });
    if (!result.ok) throwAuthz(result);
    const { monster } = result.data;
    return {
      id: monster.id,
      title: monster.name,
      stand: standOf(monster.updatedAt),
      visibility: visibilityLabel(monster.visibility),
    };
  },
});

/** Universes start as „nur Spielleitung“; they have no owner-only level. */
export const universeCreate = defineCreateHandler({
  schema: createFieldSchemas.universum,
  titleOf: (felder) => felder.name,
  collect: (felder, context) => collectRich(context, felder.beschreibung),
  execute: async (felder, context) => {
    const result = await createUniverse({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      name: felder.name,
      description: await createRich(context, felder.beschreibung),
      visibility: "gm_only",
    });
    if (!result.ok) throwAuthz(result);
    return {
      id: result.data.id,
      title: result.data.name,
      stand: standOf(result.data.updatedAt),
      visibility: CONTENT_VISIBILITY_LABEL.gm_only,
    };
  },
});
