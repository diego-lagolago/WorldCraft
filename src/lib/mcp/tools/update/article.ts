import { updateArticle } from "@/lib/domain/articles";
import { templateFieldsHaveValue } from "@/lib/templates/fields";
import { isTemplateType, templateOf, type TemplateType } from "@/lib/templates/registry";
import { MCP_TEMPLATE_TYPE } from "../../enums";
import { prepareTemplateFields, visibleArticle } from "../../write-shared";
import { assertStand, standOf, throwAuthz, visibilityLabel } from "../../write-rich";
import { renderTemplateFields } from "../renderers";
import { updateFieldSchemas } from "../write-schemas";
import {
  defineUpdateHandler,
  executeRich,
  isEmptyRichText,
  previewRich,
  pushChange,
  pushRenamed,
  type PreviewContext,
} from "./common";

type ArticleRow = Awaited<ReturnType<typeof visibleArticle>>;

function currentTemplateType(row: ArticleRow): TemplateType {
  return isTemplateType(row.templateType) ? row.templateType : "none";
}

async function previewTemplate(
  row: ArticleRow,
  felder: { vorlagentyp?: keyof typeof MCP_TEMPLATE_TYPE; vorlagenfelder?: Record<string, unknown> },
  context: PreviewContext,
) {
  const nextType = felder.vorlagentyp ? MCP_TEMPLATE_TYPE[felder.vorlagentyp] : currentTemplateType(row);
  if (felder.vorlagentyp !== undefined) {
    const oldLabel = isTemplateType(row.templateType) ? templateOf(row.templateType).label : row.templateType;
    pushChange(context, "vorlagentyp", oldLabel, templateOf(nextType).label);
  }
  if (felder.vorlagenfelder === undefined) return;
  const prepared = await prepareTemplateFields({ templateType: nextType, raw: felder.vorlagenfelder, world: context.world });
  context.stubs.add(prepared.stubTitles);
  const render = (type: string, fields: Record<string, unknown>) => (
    renderTemplateFields(type, fields, context.world, context.world.userId)
  );
  pushChange(
    context,
    "vorlagenfelder",
    await render(row.templateType, row.templateFields),
    await render(nextType, prepared.fields),
  );
}

export const articleUpdate = defineUpdateHandler({
  schema: updateFieldSchemas.artikel,
  load: async (world, id, stand) => {
    const row = await visibleArticle(world, id);
    assertStand(row.updatedAt, stand);
    return row;
  },
  preview: async (row, felder, context) => {
    pushRenamed(context, "titel", row.title, felder.titel);
    await previewTemplate(row, felder, context);
    await previewRich(context, { label: "text", oldJson: row.bodyJson, markdown: felder.text });
    return {
      title: felder.titel ?? row.title,
      skipConfirmation: isEmptyRichText(row.bodyJson) && !templateFieldsHaveValue(row.templateFields),
    };
  },
  execute: async (row, felder, context) => {
    const templateType = felder.vorlagentyp ? MCP_TEMPLATE_TYPE[felder.vorlagentyp] : undefined;
    const prepared = felder.vorlagenfelder === undefined
      ? undefined
      : await prepareTemplateFields({
        templateType: templateType ?? currentTemplateType(row),
        raw: felder.vorlagenfelder,
        world: context.world,
      });
    const result = await updateArticle({
      membership: context.membership,
      actorId: context.ctx.userId,
      worldId: context.world.id,
      articleId: row.id,
      title: felder.titel,
      templateType,
      templateFields: prepared ? context.stubs.fillRefs(prepared.fields) : undefined,
      body: await executeRich(context, row.bodyJson, felder.text),
      expectedUpdatedAt: context.expectedUpdatedAt,
    });
    if (!result.ok) throwAuthz(result);
    const updated = await visibleArticle(context.world, row.id);
    return {
      id: updated.id,
      title: updated.title,
      stand: standOf(updated.updatedAt),
      visibility: visibilityLabel(updated.visibility),
    };
  },
});
