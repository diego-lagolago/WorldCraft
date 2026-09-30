import { z } from "zod";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LONG, ATTRIBUTE_SHORT, SKILL_LEVEL_LABEL } from "@/lib/characters/sheet";
import { McpToolError } from "../context";
import { TEMPLATE_TYPES, templateOf } from "@/lib/templates/registry";
import { MCP_TEMPLATE_TYPE } from "../enums";
import { fieldsFor, templateFieldsFor, type FieldArt, type FieldDefinition } from "../field-catalog";
import { MCP_SHEET_FIELDS, SHEET_KEY_MAP } from "../write-fields";
import { germanError, issuesMessage, mcpEnum, unionError } from "../validation";

export type CreateArt = Exclude<FieldArt, "notizblock" | "welt">;
export type UpdateArt = FieldArt;

/** Every catalog field carries a German error function with its path (Review 012 CR-003). */
const text = (path: string, max?: number) => {
  const error = germanError(path);
  const schema = z.string({ error }).trim().min(1, { error });
  return max ? schema.max(max, { error }) : schema;
};
const uuid = (path: string) => z.string({ error: germanError(path) }).uuid({ error: germanError(path) });
/** Mention syntax or an already resolved reference; `null` clears the reference. */
const reference = (path: string) => z.union(
  [z.string(), z.object({ kind: z.string(), id: z.string().uuid() }).strict()],
  { error: germanError(path) },
).nullable();

const MCP_TEMPLATE_TYPE_LABEL = Object.fromEntries(
  Object.entries(MCP_TEMPLATE_TYPE).map(([label, value]) => [value, label]),
) as Record<string, string>;

/** inhalt_lesen shows Ja/Nein; written back unchanged it maps onto true/false (002 D18, 012 T-009). */
const yesNo = (path: string) => z.preprocess(
  (value) => (value === "Ja" ? true : value === "Nein" ? false : value),
  z.boolean({ error: germanError(path) }),
);

/** Fixed MCP enums without an English alternative stay enums in the schema (E5). */
const FIXED_ENUM_KEYS = new Set(["vorlagentyp", "status"]);

function describe(schema: z.ZodType, field: FieldDefinition) {
  const values = field.allowedValues?.map((value) => value.label).join(", ");
  const targets = field.referenceTargets?.map((target) => ({
    "artikel:ort": "Ort-Artikel", "artikel:place": "Ort-Artikel",
    "artikel:person": "Person-Artikel",
    "artikel:organisation": "Organisations-Artikel", "artikel:organization": "Organisations-Artikel",
    "artikel:rasse": "Rassen-Artikel", "artikel:race": "Rassen-Artikel",
    charakter: "Charakter", quest: "Quest",
  })[target] ?? target).join(", ");
  return schema.describe(`${field.description}${values ? ` Erlaubte Werte: ${values}.` : ""}${targets ? ` Verweis in Erwähnungssyntax, z. B. @[Titel](artikel:id); erlaubte Ziele: ${targets}; null oder „–“ leert den Verweis.` : ""}`);
}

/** The field catalog is the single source for the public write-schema. */
function schemaFor(art: FieldArt, field: FieldDefinition): z.ZodType {
  const path = `felder.${field.key}`;
  const error = germanError(path);
  switch (field.type) {
  case "text":
    if (field.key === "titel") return text(path, 200);
    if (field.key === "name") return text(path, art === "universum" ? 200 : 120);
    return z.string({ error });
  case "markdown": return z.string({ error });
  case "boolean": return yesNo(path);
  case "number": return field.key === "position" ? z.number({ error }).int({ error }).min(1, { error }) : z.number({ error });
  case "select": {
    const labels = field.allowedValues?.map((value) => value.label);
    return FIXED_ENUM_KEYS.has(field.key) && labels?.length
      ? mcpEnum(labels as [string, ...string[]], path)
      : z.string({ error });
  }
  case "reference": return field.key === "quest_id" ? uuid(path) : reference(path);
  case "list": return z.array(z.string({ error }).trim().min(1, { error }), { error });
  case "object": return field.key === "vorlagenfelder" ? templateFieldsSchema() : monsterSheetSchema();
  }
}

/** Template values are checked by `normalizeTemplateFieldsInput`; `null` clears a field. */
function templateValueSchema(field: FieldDefinition): z.ZodType {
  const path = `felder.vorlagenfelder.${field.key}`;
  if (field.type === "boolean") return yesNo(path).nullable();
  if (field.type === "reference") return reference(path);
  return z.string({ error: germanError(path) }).nullable();
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
  const attributeAliases: Record<string, string> = { STR: "STÄ", DEX: "GES", CON: "KON", INT: "INT", WIS: "WEI", CHA: "CHA" };
  const attributeShape = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [
    ATTRIBUTE_SHORT[key], z.number({ error: germanError(`felder.charakterblatt.attribute.${ATTRIBUTE_SHORT[key]}`) }).optional(),
  ]));
  const attributes = withAliases(z.object(attributeShape).strict(), (key) => {
    const upper = key.toUpperCase();
    const long = ATTRIBUTE_KEYS.find((entry) => ATTRIBUTE_LONG[entry].localeCompare(key, "de", { sensitivity: "accent" }) === 0);
    return attributeAliases[upper] ?? (long ? ATTRIBUTE_SHORT[long] : undefined)
      ?? (ATTRIBUTE_KEYS.find((entry) => ATTRIBUTE_SHORT[entry] === upper) ? upper : undefined);
  });
  const skill = withAliases(z.object({
    name: z.string({ error: germanError("felder.charakterblatt.fertigkeiten") }),
    stufe: z.string({ error: germanError("felder.charakterblatt.fertigkeiten.stufe") }),
    attribut: z.string({ error: germanError("felder.charakterblatt.fertigkeiten.attribut") }),
  }).strict(), (key) => key === "level" ? "stufe" : key === "attr" ? "attribut" : key === "titel" ? "name" : undefined);
  const ability = withAliases(z.object({
    text: z.string({ error: germanError("felder.charakterblatt.faehigkeiten") }),
    attribut: z.string({ error: germanError("felder.charakterblatt.faehigkeiten.attribut") }),
  }).strict(), (key) => key === "attr" ? "attribut" : undefined);
  const descriptions = {
    klasse: "Anzeige: Klasse.", attribute: `Anzeige: Attribute. Erlaubte Schlüssel: ${ATTRIBUTE_KEYS.map((key) => ATTRIBUTE_SHORT[key]).join(", ")}.`,
    uebungsbonus: "Anzeige: Übungsbonus.", fertigkeiten: `Anzeige: Fertigkeiten. Einträge mit name, stufe und attribut; Stufen: ${Object.values(SKILL_LEVEL_LABEL).join(", ")}.`,
    faehigkeiten: "Anzeige: Fähigkeiten. Einträge mit text und attribut.",
  } as const;
  const shape = Object.fromEntries(MCP_SHEET_FIELDS.map((field) => {
    const schema = field.key === "attribute" ? attributes : field.key === "fertigkeiten" ? z.array(skill) : field.key === "faehigkeiten" ? z.array(ability) : field.key === "uebungsbonus" ? z.number({ error: germanError("felder.charakterblatt.uebungsbonus") }) : z.string({ error: germanError(`felder.charakterblatt.${field.key}`) });
    return [field.key, schema.describe(descriptions[field.key as keyof typeof descriptions] ?? `Anzeige: ${field.label}.`).optional()];
  }));
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

/** Compile-time check: the list names exactly the keys of T. */
type ExactKeys<T, K extends readonly PropertyKey[]> = [Exclude<keyof T, K[number]>] extends [never] ? K : never;
const keysOf = <T>() => <const K extends readonly (keyof T)[]>(keys: ExactKeys<T, K>) => keys;

/**
 * Keys of the hand-written field types above; a unit test keeps them equal to the field catalog,
 * so schema (from the catalog) and types cannot drift apart (Review 012 CR-005).
 */
export const FIELD_TYPE_KEYS = {
  artikel: keysOf<ArticleFields>()(["titel", "vorlagentyp", "vorlagenfelder", "text", "sichtbarkeit"]),
  quest: keysOf<QuestFields>()(["titel", "status", "beschreibung", "beteiligte", "sichtbarkeit"]),
  kapitel: keysOf<ChapterCreateFields>()(["quest_id", "titel", "status", "text", "position", "sichtbarkeit"]),
  notizblock: keysOf<NoteFields>()(["text"]),
  monster: keysOf<MonsterFields>()([
    "name", "monster_art", "seltenheit", "boss", "gefahr", "groesse", "lebensraum", "charakterblatt", "bio", "sichtbarkeit",
  ]),
  universum: keysOf<UniverseFields>()(["name", "beschreibung", "sichtbarkeit"]),
  welt: keysOf<WorldFields>()(["name", "beschreibung"]),
} satisfies Record<FieldArt, readonly string[]>;

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
