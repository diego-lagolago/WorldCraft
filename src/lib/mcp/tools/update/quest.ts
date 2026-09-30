import { getWorldCharacter } from "@/lib/domain/characters";
import { updateQuest } from "@/lib/domain/quests";
import { MCP_QUEST_STATUS, MCP_QUEST_STATUS_LABEL } from "../../enums";
import { McpToolError, type McpWorldContext } from "../../context";
import { resolveParticipantIds, visibleQuest } from "../../write-shared";
import { assertStand, throwAuthz, visibilityLabel } from "../../write-rich";
import { updateFieldSchemas } from "../write-schemas";
import { defineUpdateHandler, executeRich, previewRich, pushChange, pushRenamed } from "./common";

async function participantLabels(
  world: McpWorldContext,
  ids: string[],
  current: readonly { id: string; characterName: string }[],
): Promise<string> {
  const labels = await Promise.all(ids.map(async (id) => {
    const name = (await getWorldCharacter(world.id, id))?.name ?? current.find((entry) => entry.id === id)?.characterName;
    return `${name ?? "Unbekannter Charakter"} (${id})`;
  }));
  return labels.join(", ") || "(keine)";
}

function validateSnapshots(
  snapshotIds: readonly string[],
  participants: readonly { id: string; characterId: string | null; href: boolean }[],
) {
  if (snapshotIds.some((id) => !participants.some((entry) => entry.id === id && (!entry.characterId || !entry.href)))) {
    throw new McpToolError("Feld „felder.beteiligte“ enthält eine unbekannte Teilnahme-ID.");
  }
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
    const participants = await resolveParticipantIds(context.world, felder.beteiligte);
    if (participants !== undefined) {
      validateSnapshots(participants.snapshotIds, row.participants);
      const activeIds = row.participants.filter((entry) => entry.characterId && entry.href).map((entry) => entry.characterId!);
      const nextIds = participants.characterIds;
      const unchanged = activeIds.length === nextIds.length && activeIds.every((id) => nextIds.includes(id));
      if (!unchanged) {
        const ordered = [...activeIds.filter((id) => nextIds.includes(id)), ...nextIds.filter((id) => !activeIds.includes(id))];
        const current = await participantLabels(context.world, activeIds, row.participants);
        pushChange(context, "beteiligte", current, await participantLabels(context.world, ordered, row.participants));
      }
    }
    await previewRich(context, { label: "beschreibung", oldJson: row.descriptionJson, markdown: felder.beschreibung });
    return { title: felder.titel ?? row.title, visibility: visibilityLabel(row.visibility) };
  },
  execute: async (row, felder, context) => {
    const participants = await resolveParticipantIds(context.world, felder.beteiligte);
    if (participants) validateSnapshots(participants.snapshotIds, row.participants);
    const result = await updateQuest({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      questId: row.id,
      title: felder.titel,
      status: felder.status ? MCP_QUEST_STATUS[felder.status] : undefined,
      description: await executeRich(context, row.descriptionJson, felder.beschreibung),
      participantIds: participants?.characterIds,
      expectedUpdatedAt: context.expectedUpdatedAt,
    });
    if (!result.ok) throwAuthz(result);
    return { id: row.id };
  },
});
