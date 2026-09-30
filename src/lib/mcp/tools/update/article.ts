import { updateArticle } from "@/lib/domain/articles";
import { templateFieldsHaveValue } from "@/lib/templates/fields";
import { isTemplateType, templateOf, type TemplateType } from "@/lib/templates/registry";
import type { McpWorldContext } from "../../context";
import { MCP_TEMPLATE_TYPE } from "../../enums";
import { clearedTemplateFieldKeys } from "../../write-fields";
import { prepareTemplateFields, visibleArticle } from "../../write-shared";
import { assertStand, throwAuthz, visibilityLabel } from "../../write-rich";
import { templateFieldEntries } from "../renderers";
import { updateFieldSchemas } from "../write-schemas";
import {
  defineUpdateHandler,
  executeRich,
  isEmptyRichText,
  previewRich,
  pushChange,
  pushEntryChanges,
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
  const prepared = await mergedTemplateFields(row, nextType, felder.vorlagenfelder, context.world);
  context.stubs.add(prepared.stubTitles);
  pushEntryChanges(context, {
    prefix: "",
    before: await templateFieldEntries(row.templateType, row.templateFields, context.world, context.world.userId),
    after: await templateFieldEntries(nextType, prepared.fields, context.world, context.world.userId),
  });
}

/**
 * Changes only the named template fields and keeps the others (012 T-007); null, "", „–“
 * or false clears one. With a new template type the given fields replace the old ones.
 */
async function mergedTemplateFields(row: ArticleRow, templateType: TemplateType, raw: unknown, world: McpWorldContext) {
  const prepared = await prepareTemplateFields({ templateType, raw, world });
  if (templateType !== currentTemplateType(row)) return prepared;
  const cleared = clearedTemplateFieldKeys(templateType, raw);
  const kept = Object.fromEntries(Object.entries(row.templateFields).filter(([key]) => !cleared.has(key)));
  return { ...prepared, fields: { ...kept, ...prepared.fields } };
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
      visibility: visibilityLabel(row.visibility),
      skipConfirmation: isEmptyRichText(row.bodyJson) && !templateFieldsHaveValue(row.templateFields),
    };
  },
  execute: async (row, felder, context) => {
    const templateType = felder.vorlagentyp ? MCP_TEMPLATE_TYPE[felder.vorlagentyp] : undefined;
    const prepared = felder.vorlagenfelder === undefined
      ? undefined
      : await mergedTemplateFields(row, templateType ?? currentTemplateType(row), felder.vorlagenfelder, context.world);
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
    return { id: row.id };
  },
});
