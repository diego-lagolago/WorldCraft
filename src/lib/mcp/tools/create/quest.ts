import { createChapter } from "@/lib/domain/quest-chapters";
import { createQuest, getQuest } from "@/lib/domain/quests";
import { McpToolError } from "../../context";
import { MCP_QUEST_STATUS } from "../../enums";
import { standOf, throwAuthz, visibilityLabel } from "../../write-rich";
import { resolveParticipantIds } from "../../write-shared";
import { createFieldSchemas } from "../write-schemas";
import { collectRich, createRich, defineCreateHandler } from "./common";

export const questCreate = defineCreateHandler({
  schema: createFieldSchemas.quest,
  titleOf: (felder) => felder.titel,
  check: async (felder, world) => {
    const participants = await resolveParticipantIds(world, felder.beteiligte);
    if (participants?.snapshotIds.length) {
      throw new McpToolError("Feld „felder.beteiligte“: Teilnahme-Erwähnungen sind beim Anlegen nicht erlaubt.");
    }
  },
  collect: (felder, context) => collectRich(context, felder.beschreibung),
  execute: async (felder, context) => {
    const participants = await resolveParticipantIds(context.world, felder.beteiligte);
    const result = await createQuest({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      title: felder.titel,
      description: await createRich(context, felder.beschreibung),
      status: felder.status ? MCP_QUEST_STATUS[felder.status] : undefined,
      participantIds: participants?.characterIds,
      visibility: "owner_only",
    });
    if (!result.ok) throwAuthz(result);
    return {
      id: result.data.id,
      title: result.data.title,
      stand: standOf(result.data.updatedAt),
      visibility: visibilityLabel(result.data.visibility),
    };
  },
});

/** Status and position are set atomically by `createChapter`; its `updatedAt` is final. */
export const chapterCreate = defineCreateHandler({
  schema: createFieldSchemas.kapitel,
  titleOf: (felder) => felder.titel,
  check: async (felder, world) => {
    const quest = await getQuest(world.id, felder.quest_id, world.role, world.userId);
    if (!quest) throw new McpToolError("Quest nicht gefunden.");
  },
  collect: (felder, context) => collectRich(context, felder.text),
  execute: async (felder, context) => {
    const result = await createChapter({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      questId: felder.quest_id,
      title: felder.titel,
      body: await createRich(context, felder.text),
      status: felder.status ? MCP_QUEST_STATUS[felder.status] : undefined,
      position: felder.position,
      visibility: "owner_only",
    });
    if (!result.ok) throwAuthz(result);
    return {
      id: result.data.id,
      title: result.data.title,
      stand: standOf(result.data.updatedAt),
      visibility: visibilityLabel(result.data.visibility),
    };
  },
});
