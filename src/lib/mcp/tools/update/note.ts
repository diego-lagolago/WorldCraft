import { getQuestNote, saveQuestNote } from "@/lib/domain/quest-notes";
import { McpToolError } from "../../context";
import { visibleQuest } from "../../write-shared";
import { throwAuthz } from "../../write-rich";
import { updateFieldSchemas } from "../write-schemas";
import { defineUpdateHandler, executeRich, previewRich, staleError } from "./common";

const TEXT_REQUIRED = "Notizblock braucht das Feld „text“.";

/** The note's stand is its version; `id` is the quest ID. Mentions never create stubs here. */
export const noteUpdate = defineUpdateHandler({
  schema: updateFieldSchemas.notizblock,
  allowStubs: false,
  load: async (world, id, stand) => {
    const quest = await visibleQuest(world, id);
    const note = await getQuestNote({ worldId: world.id, questId: quest.id, role: world.role, viewerId: world.userId });
    if (!note.ok) throwAuthz(note);
    if (String(note.data.version) !== stand) throw staleError();
    return { quest, note: note.data };
  },
  preview: async ({ quest, note }, felder, context) => {
    if (felder.text === undefined) throw new McpToolError(TEXT_REQUIRED);
    await previewRich(context, { label: "text", oldJson: note.bodyJson, markdown: felder.text, allowStubs: false });
    return { title: quest.title };
  },
  execute: async ({ quest, note }, felder, context) => {
    const body = await executeRich(context, note.bodyJson, felder.text);
    if (body === undefined) throw new McpToolError(TEXT_REQUIRED);
    const saved = await saveQuestNote({
      actorId: context.ctx.userId,
      worldId: context.world.id,
      questId: quest.id,
      role: context.world.role,
      bodyJson: body,
      version: Number(context.stand),
    });
    if (!saved.ok) {
      if ("version" in saved) throw staleError();
      throwAuthz(saved);
    }
    return { id: quest.id, stand: String(saved.data.version) };
  },
});
