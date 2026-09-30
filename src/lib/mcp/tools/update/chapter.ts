import { updateChapter } from "@/lib/domain/quest-chapters";
import { MCP_QUEST_STATUS, MCP_QUEST_STATUS_LABEL } from "../../enums";
import { findVisibleChapter } from "../../write-shared";
import { assertStand, throwAuthz, visibilityLabel } from "../../write-rich";
import { updateFieldSchemas } from "../write-schemas";
import { defineUpdateHandler, executeRich, previewRich, pushChange, pushRenamed } from "./common";

export const chapterUpdate = defineUpdateHandler({
  schema: updateFieldSchemas.kapitel,
  load: async (world, id, stand) => {
    const found = await findVisibleChapter(world, id);
    assertStand(found.chapter.updatedAt, stand);
    return found;
  },
  preview: async ({ chapter }, felder, context) => {
    pushRenamed(context, "titel", chapter.title, felder.titel);
    if (felder.status !== undefined) pushChange(context, "status", MCP_QUEST_STATUS_LABEL[chapter.status], felder.status);
    if (felder.position !== undefined) pushChange(context, "position", String(chapter.position + 1), String(felder.position));
    await previewRich(context, { label: "text", oldJson: chapter.bodyJson, markdown: felder.text });
    return { title: felder.titel ?? chapter.title, visibility: visibilityLabel(chapter.visibility) };
  },
  execute: async ({ chapter, questId }, felder, context) => {
    const result = await updateChapter({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      questId,
      chapterId: chapter.id,
      title: felder.titel,
      status: felder.status ? MCP_QUEST_STATUS[felder.status] : undefined,
      body: await executeRich(context, chapter.bodyJson, felder.text),
      position: felder.position,
      expectedUpdatedAt: context.expectedUpdatedAt,
    });
    if (!result.ok) throwAuthz(result);
    return { id: chapter.id };
  },
});
