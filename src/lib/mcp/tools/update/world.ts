import { getWorldDetails, updateWorld } from "@/lib/domain/worlds";
import { McpToolError } from "../../context";
import { worldStand } from "../../write-shared";
import { throwAuthz } from "../../write-rich";
import { updateFieldSchemas } from "../write-schemas";
import { defineUpdateHandler, executeRich, previewRich, pushRenamed, staleError } from "./common";

/** The world description has neither mentions nor stubs. */
export const worldUpdate = defineUpdateHandler({
  schema: updateFieldSchemas.welt,
  allowStubs: false,
  load: async (world, id, stand) => {
    const details = await getWorldDetails(world.id);
    if (!details || details.id !== id) throw new McpToolError("Inhalt nicht gefunden.");
    if (await worldStand(world.userId, world.id) !== stand) throw staleError();
    return details;
  },
  preview: async (row, felder, context) => {
    pushRenamed(context, "name", row.name, felder.name);
    await previewRich(context, {
      label: "beschreibung",
      oldJson: row.descriptionJson,
      markdown: felder.beschreibung,
      mentions: false,
      allowStubs: false,
    });
    return { title: felder.name ?? row.name };
  },
  execute: async (row, felder, context) => {
    const result = await updateWorld({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      name: felder.name,
      description: await executeRich(context, row.descriptionJson, felder.beschreibung, false),
      expectedUpdatedAt: context.expectedUpdatedAt,
    });
    if (!result.ok) throwAuthz(result);
    const updated = await getWorldDetails(context.world.id);
    if (!updated) throw new McpToolError("Inhalt nicht gefunden.");
    return {
      id: updated.id,
      title: updated.name,
      stand: await worldStand(context.world.userId, context.world.id),
      visibility: "—",
    };
  },
});
