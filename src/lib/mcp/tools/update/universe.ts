import { updateUniverse } from "@/lib/domain/universes";
import { visibleUniverse } from "../../write-shared";
import { assertStand, standOf, throwAuthz, visibilityLabel } from "../../write-rich";
import { updateFieldSchemas } from "../write-schemas";
import { defineUpdateHandler, executeRich, previewRich, pushRenamed } from "./common";

export const universeUpdate = defineUpdateHandler({
  schema: updateFieldSchemas.universum,
  load: async (world, id, stand) => {
    const row = await visibleUniverse(world, id);
    assertStand(row.updatedAt, stand);
    return row;
  },
  preview: async (row, felder, context) => {
    pushRenamed(context, "name", row.name, felder.name);
    await previewRich(context, { label: "beschreibung", oldJson: row.descriptionJson, markdown: felder.beschreibung });
    return { title: felder.name ?? row.name };
  },
  execute: async (row, felder, context) => {
    const result = await updateUniverse({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      universeId: row.id,
      name: felder.name,
      description: await executeRich(context, row.descriptionJson, felder.beschreibung),
      expectedUpdatedAt: context.expectedUpdatedAt,
    });
    if (!result.ok) throwAuthz(result);
    const updated = await visibleUniverse(context.world, row.id);
    return {
      id: updated.id,
      title: updated.name,
      stand: standOf(updated.updatedAt),
      visibility: visibilityLabel(updated.visibility),
    };
  },
});
