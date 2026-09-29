import { z } from "zod";
import { McpToolError } from "../context";
import { TEMPLATE_TYPES, templateOf } from "@/lib/templates/registry";
import { MCP_TEMPLATE_TYPE } from "../enums";
import { fieldsFor, templateFieldsFor, type FieldArt, type FieldDefinition } from "../field-catalog";
import { MCP_SHEET_FIELDS, SHEET_KEY_MAP } from "../write-fields";
import { issuesMessage, mcpEnum, unionError } from "../validation";

export type CreateArt = Exclude<FieldArt, "notizblock" | "welt">;
export type UpdateArt = FieldArt;

const title = z.string().trim().min(1).max(200);
const shortName = z.string().trim().min(1).max(120);
const uuid = z.string().uuid();
/** Mention syntax or an already resolved reference; `null` clears the reference. */
const reference = z.union([z.string(), z.object({ kind: z.string(), id: uuid }).strict()]).nullable();

const MCP_TEMPLATE_TYPE_LABEL = Object.fromEntries(
  Object.entries(MCP_TEMPLATE_TYPE).map(([label, value]) => [value, label]),
) as Record<string, string>;

/** Fixed MCP enums without an English alternative stay enums in the schema (E5). */
const FIXED_ENUM_KEYS = new Set(["vorlagentyp", "status"]);

function describe(schema: z.ZodType, field: FieldDefinition) {
  const values = field.allowedValues?.map((value) => value.label).join(", ");
  return schema.describe(`${field.description}${values ? ` Erlaubte Werte: ${values}.` : ""}`);
}

/** The field catalog is the single source for the public write-schema. */
function schemaFor(art: FieldArt, field: FieldDefinition): z.ZodType {
  switch (field.type) {
  case "text":
    if (field.key === "titel") return title;
    return field.key === "name" && art !== "universum" ? shortName : field.key === "name" ? title : z.string();
  case "markdown": return z.string();
  case "boolean": return z.boolean();
  case "number": return field.key === "position" ? z.number().int().min(1) : z.number();
  case "select": {
    const labels = field.allowedValues?.map((value) => value.label);
    return FIXED_ENUM_KEYS.has(field.key) && labels?.length
      ? mcpEnum(labels as [string, ...string[]], `felder.${field.key}`)
      : z.string();
  }
  case "reference": return field.key === "quest_id" ? uuid : reference;
  case "list": return z.array(z.string().trim().min(1));
  case "object": return field.key === "vorlagenfelder" ? templateFieldsSchema() : monsterSheetSchema();
  }
}

/** Template values are checked by `normalizeTemplateFieldsInput`; `null` clears a field. */
function templateValueSchema(field: FieldDefinition): z.ZodType {
  if (field.type === "boolean") return z.boolean().nullable();
  if (field.type === "reference") return reference;
  return z.string().nullable();
}

/**
 * Maps accepted aliases (registry keys, other casing) onto the advertised key before the strict
 * object runs, so the published schema only lists German keys (E5) while old writes keep working.
 */
function withAliases(schema: z.ZodType, keyFor: (key: string) => string | undefined) {
  return z.preprocess((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [keyFor(key) ?? key, entry]));
  }, schema);
}

const QUEST_ITEM_KEYS = new Set(["quest", "Quest", "Quest-Gegenstand"]);
const sameKey = (left: string, right: string) => left.localeCompare(right, "de", { sensitivity: "accent" }) === 0;

function templateFieldsSchema() {
  const schemas = TEMPLATE_TYPES.map((templateType) => {
    const definition = templateOf(templateType);
    const shape = Object.fromEntries(templateFieldsFor(templateType).map((field) => [
      field.key,
      describe(templateValueSchema(field), field).optional(),
    ]));
    const object = z.object(shape).strict().describe(`Vorlagenfelder für vorlagentyp = ${MCP_TEMPLATE_TYPE_LABEL[templateType]}.`);
    return withAliases(object, (key) => {
      if (templateType === "item" && QUEST_ITEM_KEYS.has(key)) return "Quest-Gegenstand";
      return definition.fields.find((field) => field.key === key || sameKey(field.label, key))?.label;
    });
  });
  const keysPerType = TEMPLATE_TYPES
    .map((templateType) => `${MCP_TEMPLATE_TYPE_LABEL[templateType]}: ${templateFieldsFor(templateType).map((field) => field.key).join(", ") || "–"}`)
    .join("; ");
  return z.union(schemas as [typeof schemas[number], typeof schemas[number], ...typeof schemas[number][]], {
    error: unionError("felder.vorlagenfelder", [], `Gültige Schlüssel je Vorlagentyp – ${keysPerType}.`),
  });
}

function monsterSheetSchema() {
  const shape = Object.fromEntries(MCP_SHEET_FIELDS.map((field) => [field.key, z.unknown().describe(`Anzeige: ${field.label}.`)]));
  const object = z.object(shape).strict();
  return withAliases(object, (key) => {
    const internal = SHEET_KEY_MAP[key.toLocaleLowerCase("de")];
    return MCP_SHEET_FIELDS.find((field) => SHEET_KEY_MAP[field.key] === internal)?.key;
  }).nullable();
}

function fieldObject(operation: "anlegen" | "aendern", art: FieldArt) {
  const shape = Object.fromEntries(fieldsFor(operation, art).map((field) => {
    const schema = describe(schemaFor(art, field), field);
    return [field.key, operation === "anlegen" && field.requiredOnCreate ? schema : schema.optional()];
  }));
  return z.object(shape).strict().describe(`Felder für art = ${art}.`);
}

type TemplateTypeInput = "person" | "ort" | "organisation" | "gegenstand" | "rasse" | "ohne";
type QuestStatusInput = "offen" | "aktiv" | "abgeschlossen" | "gescheitert";
type ArticleFields = { titel: string; vorlagentyp?: TemplateTypeInput; vorlagenfelder?: Record<string, unknown>; text?: string; sichtbarkeit?: string };
type QuestFields = { titel: string; status?: QuestStatusInput; beschreibung?: string; beteiligte?: string[]; sichtbarkeit?: string };
type ChapterCreateFields = { quest_id: string; titel: string; status?: QuestStatusInput; text?: string; position?: number; sichtbarkeit?: string };
type ChapterUpdateFields = Omit<Partial<ChapterCreateFields>, "quest_id">;
type MonsterFields = {
  name: string;
  monster_art?: string;
  seltenheit?: string;
  boss?: boolean;
  gefahr?: string;
  groesse?: string;
  lebensraum?: unknown;
  charakterblatt?: unknown;
  bio?: string;
  sichtbarkeit?: string;
};
type UniverseFields = { name: string; beschreibung?: string; sichtbarkeit?: string };
type NoteFields = { text?: string };
type WorldFields = { name?: string; beschreibung?: string };

const createFieldSchemaDefinitions = {
  artikel: fieldObject("anlegen", "artikel"),
  quest: fieldObject("anlegen", "quest"),
  kapitel: fieldObject("anlegen", "kapitel"),
  monster: fieldObject("anlegen", "monster"),
  universum: fieldObject("anlegen", "universum"),
} as const;

export const createFieldSchemas = createFieldSchemaDefinitions as unknown as {
  artikel: z.ZodType<ArticleFields>;
  quest: z.ZodType<QuestFields>;
  kapitel: z.ZodType<ChapterCreateFields>;
  monster: z.ZodType<MonsterFields>;
  universum: z.ZodType<UniverseFields>;
};

const updateFieldSchemaDefinitions = {
  artikel: fieldObject("aendern", "artikel"),
  quest: fieldObject("aendern", "quest"),
  kapitel: fieldObject("aendern", "kapitel"),
  notizblock: fieldObject("aendern", "notizblock"),
  monster: fieldObject("aendern", "monster"),
  universum: fieldObject("aendern", "universum"),
  welt: fieldObject("aendern", "welt"),
} as const;

export const updateFieldSchemas = updateFieldSchemaDefinitions as unknown as {
  artikel: z.ZodType<Partial<ArticleFields>>;
  quest: z.ZodType<Partial<QuestFields>>;
  kapitel: z.ZodType<ChapterUpdateFields>;
  notizblock: z.ZodType<NoteFields>;
  monster: z.ZodType<Partial<MonsterFields>>;
  universum: z.ZodType<Partial<UniverseFields>>;
  welt: z.ZodType<WorldFields>;
};

function validKeys(operation: "anlegen" | "aendern", art: FieldArt) {
  return fieldsFor(operation, art).map((field) => field.key).join(", ");
}

/** The SDK validates `felder` before the handler knows `art`, so the fallback lists the keys of every art. */
function keysPerArt(operation: "anlegen" | "aendern", arts: readonly FieldArt[]) {
  return `Gültige Schlüssel je art – ${arts.map((art) => `${art}: ${validKeys(operation, art)}`).join("; ")}.`;
}

const CREATE_ARTS = ["artikel", "quest", "kapitel", "monster", "universum"] as const;
const UPDATE_ARTS = ["artikel", "quest", "kapitel", "notizblock", "monster", "universum", "welt"] as const;

/** JSON Schema exposes this as anyOf: one strict object per supported content art. */
export const createFieldsInput = z.union(CREATE_ARTS.map((art) => createFieldSchemas[art]), {
  error: unionError("felder", CREATE_ARTS, keysPerArt("anlegen", CREATE_ARTS)),
});

export const updateFieldsInput = z.union(UPDATE_ARTS.map((art) => updateFieldSchemas[art]), {
  error: unionError("felder", UPDATE_ARTS, keysPerArt("aendern", UPDATE_ARTS)),
});

export type CreateFields<A extends CreateArt> = z.infer<(typeof createFieldSchemas)[A]>;
export type UpdateFields<A extends UpdateArt> = z.infer<(typeof updateFieldSchemas)[A]>;

/** Parses `felder` and reports every invalid or unknown field with path and valid keys (T-005). */
export function parseFelder<T>(
  schema: { safeParse: (value: unknown) => z.ZodSafeParseResult<T> },
  felder: unknown,
  art: FieldArt,
): T {
  const parsed = schema.safeParse(felder);
  if (parsed.success) return parsed.data;
  const validKeys = schema instanceof z.ZodObject ? Object.keys(schema.shape) : [];
  throw new McpToolError(issuesMessage(parsed.error.issues, { base: "felder", arts: [art], validKeys }));
}

export const createArt = mcpEnum(CREATE_ARTS, "art");
export const updateArt = mcpEnum(UPDATE_ARTS, "art");
