import { z } from "zod";
import { McpToolError } from "../context";
import { questStatus, templateTypes } from "./shared";

/** Accepted on create only to answer with a hint; new content always starts private. */
const ignoredVisibility = { sichtbarkeit: z.string().optional() };

const title = z.string().trim().min(1).max(200);
const richText = z.string().optional();

const articleBase = z.object({
  titel: title,
  vorlagentyp: templateTypes.optional(),
  vorlagenfelder: z.record(z.string(), z.unknown()).optional(),
  text: richText,
}).strict();

const questBase = z.object({
  titel: title,
  status: questStatus.optional(),
  beschreibung: richText,
  beteiligte: z.array(z.string().uuid()).optional(),
}).strict();

const chapterBase = z.object({
  titel: title,
  status: questStatus.optional(),
  text: richText,
  position: z.number().int().min(1).optional(),
}).strict();

const monsterBase = z.object({
  name: z.string().trim().min(1).max(120),
  monster_art: z.string().optional(),
  seltenheit: z.string().optional(),
  boss: z.boolean().optional(),
  gefahr: z.string().optional(),
  groesse: z.string().optional(),
  lebensraum: z.unknown().optional(),
  charakterblatt: z.unknown().optional(),
  bio: richText,
}).strict();

const universeBase = z.object({
  name: title,
  beschreibung: richText,
}).strict();

export const createFieldSchemas = {
  artikel: articleBase.extend(ignoredVisibility),
  quest: questBase.extend(ignoredVisibility),
  kapitel: chapterBase.extend({ quest_id: z.string().uuid(), ...ignoredVisibility }),
  monster: monsterBase.extend(ignoredVisibility),
  universum: universeBase.extend(ignoredVisibility),
} as const;

export const updateFieldSchemas = {
  artikel: articleBase.partial(),
  quest: questBase.partial(),
  kapitel: chapterBase.partial(),
  notizblock: z.object({ text: richText }).strict(),
  monster: monsterBase.partial(),
  universum: universeBase.partial(),
  welt: z.object({ name: z.string().trim().min(1).max(120), beschreibung: richText }).strict().partial(),
} as const;

export type CreateArt = keyof typeof createFieldSchemas;
export type UpdateArt = keyof typeof updateFieldSchemas;
export type CreateFields<A extends CreateArt> = z.infer<(typeof createFieldSchemas)[A]>;
export type UpdateFields<A extends UpdateArt> = z.infer<(typeof updateFieldSchemas)[A]>;

/** Parses `felder` and reports every invalid or unknown field by name as a tool error. */
export function parseFelder<T>(schema: { safeParse: (value: unknown) => z.ZodSafeParseResult<T> }, felder: unknown): T {
  const parsed = schema.safeParse(felder);
  if (parsed.success) return parsed.data;
  const messages = parsed.error.issues.map((issue) => (
    issue.code === "unrecognized_keys"
      ? issue.keys.map((key) => `Unbekanntes Feld „${key}“.`).join(" ")
      : `Feld „${issue.path.join(".") || "felder"}“ ist ungültig.`
  ));
  throw new McpToolError(messages.join(" "));
}

export const createArt =z.enum(["artikel", "quest", "kapitel", "monster", "universum"]);
export const updateArt = z.enum(["artikel", "quest", "kapitel", "notizblock", "monster", "universum", "welt"]);
