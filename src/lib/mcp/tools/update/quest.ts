import { getWorldCharacter } from "@/lib/domain/characters";
import { updateQuest } from "@/lib/domain/quests";
import { MCP_QUEST_STATUS, MCP_QUEST_STATUS_LABEL } from "../../enums";
import type { McpWorldContext } from "../../context";
import { visibleQuest } from "../../write-shared";
import { assertStand, standOf, throwAuthz, visibilityLabel } from "../../write-rich";
import { updateFieldSchemas } from "../write-schemas";
import { defineUpdateHandler, executeRich, previewRich, pushChange, pushRenamed } from "./common";

async function participantLabels(world: McpWorldContext, ids: string[]): Promise<string> {
  const labels = await Promise.all(ids.map(async (id) => {
    const character = await getWorldCharacter(world.id, id);
    return `${character?.name ?? "Unbekannter Charakter"} (${id})`;
  }));
  return labels.join(", ") || "(keine)";
}

export const questUpdate = defineUpdateHandler({
  schema: updateFieldSchemas.quest,
  load: async (world, id, stand) => {
    const row = await visibleQuest(world, id);
    assertStand(row.updatedAt, stand);
    return row;
  },
  preview: async (row, felder, context) => {
    pushRenamed(context, "titel", row.title, felder.titel);
    if (felder.status !== undefined) pushChange(context, "status", MCP_QUEST_STATUS_LABEL[row.status], felder.status);
    if (felder.beteiligte !== undefined) {
      const current = row.participants.map((entry) => `${entry.characterName} (${entry.characterId})`).join(", ");
      pushChange(context, "beteiligte", current || "(keine)", await participantLabels(context.world, felder.beteiligte));
    }
    await previewRich(context, { label: "beschreibung", oldJson: row.descriptionJson, markdown: felder.beschreibung });
    return { title: felder.titel ?? row.title };
  },
  execute: async (row, felder, context) => {
    const result = await updateQuest({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      questId: row.id,
      title: felder.titel,
      status: felder.status ? MCP_QUEST_STATUS[felder.status] : undefined,
      description: await executeRich(context, row.descriptionJson, felder.beschreibung),
      participantIds: felder.beteiligte,
      expectedUpdatedAt: context.expectedUpdatedAt,
    });
    if (!result.ok) throwAuthz(result);
    const updated = await visibleQuest(context.world, row.id);
    return {
      id: updated.id,
      title: updated.title,
      stand: standOf(updated.updatedAt),
      visibility: visibilityLabel(updated.visibility),
    };
  },
});
