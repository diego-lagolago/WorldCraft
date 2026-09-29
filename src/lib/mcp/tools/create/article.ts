import { createArticle } from "@/lib/domain/articles";
import { MCP_TEMPLATE_TYPE } from "../../enums";
import { prepareTemplateFields } from "../../write-shared";
import { standOf, throwAuthz, visibilityLabel } from "../../write-rich";
import { createFieldSchemas } from "../write-schemas";
import { collectRich, createRich, defineCreateHandler } from "./common";

export const articleCreate = defineCreateHandler({
  schema: createFieldSchemas.artikel,
  titleOf: (felder) => felder.titel,
  collect: async (felder, context) => {
    const templateType = MCP_TEMPLATE_TYPE[felder.vorlagentyp ?? "ohne"];
    const prepared = await prepareTemplateFields({ templateType, raw: felder.vorlagenfelder, world: context.world });
    context.stubs.add(prepared.stubTitles);
    await collectRich(context, felder.text);
  },
  execute: async (felder, context) => {
    const templateType = MCP_TEMPLATE_TYPE[felder.vorlagentyp ?? "ohne"];
    const prepared = await prepareTemplateFields({ templateType, raw: felder.vorlagenfelder, world: context.world });
    const result = await createArticle({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      title: felder.titel,
      templateType,
      templateFields: context.stubs.fillRefs(prepared.fields),
      body: await createRich(context, felder.text),
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
