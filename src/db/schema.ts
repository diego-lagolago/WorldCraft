import { desc, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

function plainTsv(column: string) {
  return sql.raw(`to_tsvector('german', coalesce(${column}, ''))`);
}

/** Full-text over name + bio (monsters; PR4). */
function nameAndPlainTsv(nameColumn: string, plainColumn: string) {
  return sql.raw(
    `to_tsvector('german', coalesce(${nameColumn}, '') || ' ' || coalesce(${plainColumn}, ''))`,
  );
}

/**
 * Small key-value table so the homepage can prove a live DB read (T-007).
 * Domain tables from `.ai/architecture/datenmodell.md` follow in later tasks.
 */
export const appInfo = pgTable("app_info", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Better Auth `users` plus WorldCraft fields (`discord_id`, `last_login_at`).
 * Discord login and test-login are wired in T-008.
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    discordId: text("discord_id").notNull().unique(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dicePostToChat: boolean("dice_post_to_chat").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [check("users_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 100`)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Product domain tables from `.ai/architecture/datenmodell.md`.
 */

export const visibilityStatus = pgEnum("visibility_status", ["published", "gm_only"]);
/** Dreistufige Sichtbarkeit für Artikel, Quests, Pins, Kapitel (Plan 004). */
export const contentVisibility = pgEnum("content_visibility", [
  "owner_only",
  "gm_only",
  "published",
]);
export const membershipRole = pgEnum("membership_role", [
  "game_master",
  "master",
  "player",
]);
export const inviteValidity = pgEnum("invite_validity", [
  "one_day",
  "seven_days",
  "unlimited",
]);
export const pinType = pgEnum("pin_type", [
  "danger",
  "boss",
  "house",
  "city",
  "treasure",
  "landmark",
  "fishing",
  "plants",
  "dungeon",
  "quest",
  "teleporter",
  "shop",
]);
export const journalVisibility = pgEnum("journal_visibility", [
  "private",
  "shared_with_gm",
]);
export const contentKind = pgEnum("content_kind", [
  "article",
  "quest",
  "character",
  "pin",
  "universe",
  "monster",
]);
export const relationOrigin = pgEnum("relation_origin", [
  "mention",
  "template_field",
  "participation",
  "manual",
]);
export const questStatus = pgEnum("quest_status", [
  "open",
  "active",
  "completed",
  "failed",
]);
export const monsterKind = pgEnum("monster_kind", [
  "beast",
  "undead",
  "demon",
  "dragon",
  "humanoid",
  "construct",
  "aberration",
  "plant",
  "magical",
  "other",
]);
export const monsterRarity = pgEnum("monster_rarity", [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
]);
export const monsterDanger = pgEnum("monster_danger", [
  "harmless",
  "dangerous",
  "deadly",
  "devastating",
  "divine",
  "apocalyptic",
]);
export const monsterSize = pgEnum("monster_size", [
  "tiny",
  "small",
  "medium",
  "large",
  "gigantic",
]);

const protocol = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => users.id),
};

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storageKey: text("storage_key").notNull().unique(),
    mime: text("mime").notNull(),
    byteSize: integer("byte_size").notNull(),
    widthPx: integer("width_px"),
    heightPx: integer("height_px"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [check("files_byte_size", sql`${t.byteSize} > 0`)],
);

export const worlds = pgTable(
  "worlds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    descriptionJson: jsonb("description_json"),
    descriptionPlain: text("description_plain"),
    titleImageId: uuid("title_image_id").references(() => files.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => users.id),
  },
  (t) => [check("worlds_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 120`)],
);

export const inviteLinks = pgTable(
  "invite_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    validity: inviteValidity("validity").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    useCount: integer("use_count").default(0).notNull(),
    ...protocol,
  },
  (t) => [
    index("invite_links_world_active")
      .on(t.worldId)
      .where(sql`${t.revokedAt} IS NULL`),
    check("invite_links_use_count", sql`${t.useCount} >= 0`),
    check("invite_links_code_length", sql`char_length(${t.code}) BETWEEN 16 AND 64`),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: membershipRole("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    joinedViaInviteId: uuid("joined_via_invite_id").references(() => inviteLinks.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...protocol,
  },
  (t) => [
    unique("uq_membership").on(t.worldId, t.userId),
    uniqueIndex("uq_one_gm")
      .on(t.worldId)
      .where(sql`${t.role} = 'game_master' AND ${t.archivedAt} IS NULL`),
    index("memberships_world_active")
      .on(t.worldId)
      .where(sql`${t.archivedAt} IS NULL`),
    index("memberships_user_active")
      .on(t.userId)
      .where(sql`${t.archivedAt} IS NULL`),
  ],
);

export const universes = pgTable(
  "universes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    descriptionJson: jsonb("description_json"),
    descriptionPlain: text("description_plain"),
    descriptionTsv: tsvector("description_tsv").generatedAlwaysAs(plainTsv("description_plain")),
    sortOrder: integer("sort_order").notNull(),
    visibility: visibilityStatus("visibility").default("gm_only").notNull(),
    ...protocol,
  },
  (t) => [
    unique("uq_universe_name").on(t.worldId, t.name),
    index("universes_world_sort").on(t.worldId, t.sortOrder),
    index("universes_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
    index("universes_description_tsv").using("gin", t.descriptionTsv),
    check("universes_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 120`),
  ],
);

export const maps = pgTable(
  "maps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    universeId: uuid("universe_id")
      .notNull()
      .references(() => universes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Null = empty map (no image yet); upload on the map view. */
    imageId: uuid("image_id").references(() => files.id),
    visibility: visibilityStatus("visibility").default("gm_only").notNull(),
    ...protocol,
  },
  (t) => [
    index("maps_universe").on(t.universeId),
    check("maps_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 120`),
  ],
);

export const pins = pgTable(
  "pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    pinType: pinType("pin_type").notNull(),
    title: text("title").notNull(),
    descriptionJson: jsonb("description_json"),
    descriptionPlain: text("description_plain"),
    posX: numeric("pos_x", { precision: 8, scale: 7 }).notNull(),
    posY: numeric("pos_y", { precision: 8, scale: 7 }).notNull(),
    visibility: contentVisibility("visibility").default("owner_only").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    locked: boolean("locked").default(false).notNull(),
    descriptionTsv: tsvector("description_tsv").generatedAlwaysAs(plainTsv("description_plain")),
    ...protocol,
  },
  (t) => [
    index("pins_map").on(t.mapId),
    index("pins_title_trgm").using("gin", sql`${t.title} gin_trgm_ops`),
    index("pins_description_tsv").using("gin", t.descriptionTsv),
    check("pins_title_length", sql`char_length(${t.title}) BETWEEN 1 AND 120`),
    check("pins_pos_x", sql`${t.posX} >= 0 AND ${t.posX} <= 1`),
    check("pins_pos_y", sql`${t.posY} >= 0 AND ${t.posY} <= 1`),
  ],
);

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    portraitId: uuid("portrait_id").references(() => files.id, { onDelete: "set null" }),
    class: text("class"),
    attrStr: smallint("attr_str"),
    attrDex: smallint("attr_dex"),
    attrCon: smallint("attr_con"),
    attrInt: smallint("attr_int"),
    attrWis: smallint("attr_wis"),
    attrCha: smallint("attr_cha"),
    skills: jsonb("skills").default(sql`'[]'::jsonb`).notNull(),
    proficiencyBonus: smallint("proficiency_bonus").default(2).notNull(),
    abilities: jsonb("abilities").default(sql`'[]'::jsonb`).notNull(),
    bioTsv: tsvector("bio_tsv").generatedAlwaysAs(plainTsv("bio_plain")),
    personality: text("personality"),
    ideals: text("ideals"),
    bonds: text("bonds"),
    flaws: text("flaws"),
    bioJson: jsonb("bio_json"),
    bioPlain: text("bio_plain"),
    ...protocol,
  },
  (t) => [
    index("characters_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
    index("characters_bio_tsv").using("gin", t.bioTsv),
    check("characters_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 120`),
    check("characters_skills_array", sql`jsonb_typeof(${t.skills}) = 'array'`),
    check("characters_abilities_array", sql`jsonb_typeof(${t.abilities}) = 'array'`),
    check("characters_proficiency_bonus", sql`${t.proficiencyBonus} BETWEEN 0 AND 10`),
    check("characters_attr_str", sql`${t.attrStr} IS NULL OR ${t.attrStr} BETWEEN 1 AND 30`),
    check("characters_attr_dex", sql`${t.attrDex} IS NULL OR ${t.attrDex} BETWEEN 1 AND 30`),
    check("characters_attr_con", sql`${t.attrCon} IS NULL OR ${t.attrCon} BETWEEN 1 AND 30`),
    check("characters_attr_int", sql`${t.attrInt} IS NULL OR ${t.attrInt} BETWEEN 1 AND 30`),
    check("characters_attr_wis", sql`${t.attrWis} IS NULL OR ${t.attrWis} BETWEEN 1 AND 30`),
    check("characters_attr_cha", sql`${t.attrCha} IS NULL OR ${t.attrCha} BETWEEN 1 AND 30`),
  ],
);

export const worldParticipations = pgTable(
  "world_participations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    broughtAt: timestamp("brought_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...protocol,
  },
  (t) => [
    unique("uq_participation").on(t.characterId, t.worldId),
    index("world_participations_world_active")
      .on(t.worldId)
      .where(sql`${t.archivedAt} IS NULL`),
  ],
);

export const characterMarkers = pgTable(
  "character_markers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    posX: numeric("pos_x", { precision: 8, scale: 7 }).notNull(),
    posY: numeric("pos_y", { precision: 8, scale: 7 }).notNull(),
    ...protocol,
  },
  (t) => [
    /** One marker per character across all maps (Owner 2026-09-23). */
    unique("uq_marker_character").on(t.characterId),
    index("character_markers_map").on(t.mapId),
    check("character_markers_pos_x", sql`${t.posX} >= 0 AND ${t.posX} <= 1`),
    check("character_markers_pos_y", sql`${t.posY} >= 0 AND ${t.posY} <= 1`),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    templateType: text("template_type").default("none").notNull(),
    templateFields: jsonb("template_fields").default(sql`'{}'::jsonb`).notNull(),
    titleImageId: uuid("title_image_id").references(() => files.id, {
      onDelete: "set null",
    }),
    bodyJson: jsonb("body_json"),
    bodyPlain: text("body_plain"),
    bodyTsv: tsvector("body_tsv").generatedAlwaysAs(plainTsv("body_plain")),
    visibility: contentVisibility("visibility").default("owner_only").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    firstEditedAt: timestamp("first_edited_at", { withTimezone: true }),
    ...protocol,
  },
  (t) => [
    index("articles_world").on(t.worldId),
    index("articles_world_owner").on(t.worldId, t.ownerId),
    index("articles_title_trgm").using("gin", sql`${t.title} gin_trgm_ops`),
    index("articles_body_tsv").using("gin", t.bodyTsv),
    check("articles_title_length", sql`char_length(${t.title}) BETWEEN 1 AND 200`),
  ],
);

export const monsters = pgTable(
  "monsters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    portraitId: uuid("portrait_id").references(() => files.id, { onDelete: "set null" }),
    class: text("class"),
    attrStr: smallint("attr_str"),
    attrDex: smallint("attr_dex"),
    attrCon: smallint("attr_con"),
    attrInt: smallint("attr_int"),
    attrWis: smallint("attr_wis"),
    attrCha: smallint("attr_cha"),
    skills: jsonb("skills").default(sql`'[]'::jsonb`).notNull(),
    proficiencyBonus: smallint("proficiency_bonus").default(2).notNull(),
    abilities: jsonb("abilities").default(sql`'[]'::jsonb`).notNull(),
    personality: text("personality"),
    ideals: text("ideals"),
    bonds: text("bonds"),
    flaws: text("flaws"),
    bioJson: jsonb("bio_json"),
    bioPlain: text("bio_plain"),
    bioTsv: tsvector("bio_tsv").generatedAlwaysAs(nameAndPlainTsv("name", "bio_plain")),
    kind: monsterKind("kind").default("other").notNull(),
    rarity: monsterRarity("rarity").default("common").notNull(),
    isLegendary: boolean("is_legendary").default(false).notNull(),
    danger: monsterDanger("danger").default("harmless").notNull(),
    size: monsterSize("size").default("medium").notNull(),
    habitatArticleId: uuid("habitat_article_id").references(() => articles.id, {
      onDelete: "set null",
    }),
    visibility: contentVisibility("visibility").default("owner_only").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    ...protocol,
  },
  (t) => [
    index("monsters_world").on(t.worldId),
    index("monsters_world_owner").on(t.worldId, t.ownerId),
    index("monsters_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
    index("monsters_bio_tsv").using("gin", t.bioTsv),
    check("monsters_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 120`),
    check("monsters_skills_array", sql`jsonb_typeof(${t.skills}) = 'array'`),
    check("monsters_abilities_array", sql`jsonb_typeof(${t.abilities}) = 'array'`),
    check("monsters_proficiency_bonus", sql`${t.proficiencyBonus} BETWEEN 0 AND 10`),
    check("monsters_attr_str", sql`${t.attrStr} IS NULL OR ${t.attrStr} BETWEEN 1 AND 30`),
    check("monsters_attr_dex", sql`${t.attrDex} IS NULL OR ${t.attrDex} BETWEEN 1 AND 30`),
    check("monsters_attr_con", sql`${t.attrCon} IS NULL OR ${t.attrCon} BETWEEN 1 AND 30`),
    check("monsters_attr_int", sql`${t.attrInt} IS NULL OR ${t.attrInt} BETWEEN 1 AND 30`),
    check("monsters_attr_wis", sql`${t.attrWis} IS NULL OR ${t.attrWis} BETWEEN 1 AND 30`),
    check("monsters_attr_cha", sql`${t.attrCha} IS NULL OR ${t.attrCha} BETWEEN 1 AND 30`),
  ],
);

export const quests = pgTable(
  "quests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    descriptionJson: jsonb("description_json"),
    descriptionPlain: text("description_plain"),
    descriptionTsv: tsvector("description_tsv").generatedAlwaysAs(
      plainTsv("description_plain"),
    ),
    status: questStatus("status").default("open").notNull(),
    visibility: contentVisibility("visibility").default("owner_only").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    ...protocol,
  },
  (t) => [
    index("quests_world").on(t.worldId),
    index("quests_world_owner").on(t.worldId, t.ownerId),
    index("quests_title_trgm").using("gin", sql`${t.title} gin_trgm_ops`),
    index("quests_description_tsv").using("gin", t.descriptionTsv),
    check("quests_title_length", sql`char_length(${t.title}) BETWEEN 1 AND 200`),
  ],
);

export const questChapters = pgTable(
  "quest_chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    bodyJson: jsonb("body_json"),
    bodyPlain: text("body_plain"),
    bodyTsv: tsvector("body_tsv").generatedAlwaysAs(plainTsv("body_plain")),
    position: integer("position").notNull(),
    visibility: contentVisibility("visibility").default("owner_only").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    ...protocol,
  },
  (t) => [
    index("quest_chapters_quest_position").on(t.questId, t.position),
    index("quest_chapters_body_tsv").using("gin", t.bodyTsv),
    check("quest_chapters_title_length", sql`char_length(${t.title}) BETWEEN 1 AND 200`),
  ],
);

/** One shared note pad per quest; row created on first save (APP-NOTE-VERSION / APP-NOTE-NO-REL). */
export const questNotes = pgTable("quest_notes", {
  questId: uuid("quest_id")
    .primaryKey()
    .references(() => quests.id, { onDelete: "cascade" }),
  bodyJson: jsonb("body_json"),
  bodyPlain: text("body_plain"),
  version: integer("version").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => users.id),
});

export const questParticipants = pgTable(
  "quest_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "cascade" }),
    characterId: uuid("character_id").references(() => characters.id, {
      onDelete: "set null",
    }),
    characterName: text("character_name").notNull(),
    ...protocol,
  },
  (t) => [
    uniqueIndex("uq_quest_participant")
      .on(t.questId, t.characterId)
      .where(sql`${t.characterId} IS NOT NULL`),
    check(
      "quest_participants_name_length",
      sql`char_length(${t.characterName}) BETWEEN 1 AND 120`,
    ),
  ],
);

export const characterImages = pgTable(
  "character_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull(),
    ...protocol,
  },
  (t) => [
    unique("uq_character_image_order").on(t.characterId, t.sortOrder),
    check(
      "character_images_caption_length",
      sql`${t.caption} IS NULL OR char_length(${t.caption}) BETWEEN 1 AND 200`,
    ),
  ],
);

export const relations = pgTable(
  "relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    sourceKind: contentKind("source_kind").notNull(),
    sourceArticleId: uuid("source_article_id").references(() => articles.id, {
      onDelete: "cascade",
    }),
    sourceQuestId: uuid("source_quest_id").references(() => quests.id, {
      onDelete: "cascade",
    }),
    sourceCharacterId: uuid("source_character_id").references(() => characters.id, {
      onDelete: "cascade",
    }),
    sourcePinId: uuid("source_pin_id").references(() => pins.id, { onDelete: "cascade" }),
    sourceUniverseId: uuid("source_universe_id").references(() => universes.id, {
      onDelete: "cascade",
    }),
    sourceMonsterId: uuid("source_monster_id").references(() => monsters.id, {
      onDelete: "cascade",
    }),
    sourceId: uuid("source_id").generatedAlwaysAs(
      sql`coalesce(source_article_id, source_quest_id, source_character_id, source_pin_id, source_universe_id, source_monster_id)`,
    ),
    targetKind: contentKind("target_kind").notNull(),
    targetArticleId: uuid("target_article_id").references(() => articles.id, {
      onDelete: "cascade",
    }),
    targetQuestId: uuid("target_quest_id").references(() => quests.id, {
      onDelete: "cascade",
    }),
    targetCharacterId: uuid("target_character_id").references(() => characters.id, {
      onDelete: "cascade",
    }),
    targetPinId: uuid("target_pin_id").references(() => pins.id, { onDelete: "cascade" }),
    targetUniverseId: uuid("target_universe_id").references(() => universes.id, {
      onDelete: "cascade",
    }),
    targetMonsterId: uuid("target_monster_id").references(() => monsters.id, {
      onDelete: "cascade",
    }),
    targetId: uuid("target_id").generatedAlwaysAs(
      sql`coalesce(target_article_id, target_quest_id, target_character_id, target_pin_id, target_universe_id, target_monster_id)`,
    ),
    origin: relationOrigin("origin").notNull(),
    templateFieldKey: text("template_field_key"),
    label: text("label"),
    counterLabel: text("counter_label"),
    ...protocol,
  },
  (t) => [
    index("relations_world_source").on(t.worldId, t.sourceKind, t.sourceId),
    index("relations_world_target").on(t.worldId, t.targetKind, t.targetId),
    uniqueIndex("uq_rel").on(
      t.worldId,
      t.sourceKind,
      t.sourceId,
      t.targetKind,
      t.targetId,
      t.origin,
      sql`coalesce(${t.templateFieldKey}, '')`,
      sql`coalesce(${t.label}, '')`,
    ),
    check(
      "chk_rel_shape",
      sql`(
        (case when ${t.sourceArticleId} is not null then 1 else 0 end)
        + (case when ${t.sourceQuestId} is not null then 1 else 0 end)
        + (case when ${t.sourceCharacterId} is not null then 1 else 0 end)
        + (case when ${t.sourcePinId} is not null then 1 else 0 end)
        + (case when ${t.sourceUniverseId} is not null then 1 else 0 end)
        + (case when ${t.sourceMonsterId} is not null then 1 else 0 end)
      ) = 1
      and (
        (${t.sourceKind} = 'article' and ${t.sourceArticleId} is not null)
        or (${t.sourceKind} = 'quest' and ${t.sourceQuestId} is not null)
        or (${t.sourceKind} = 'character' and ${t.sourceCharacterId} is not null)
        or (${t.sourceKind} = 'pin' and ${t.sourcePinId} is not null)
        or (${t.sourceKind} = 'universe' and ${t.sourceUniverseId} is not null)
        or (${t.sourceKind} = 'monster' and ${t.sourceMonsterId} is not null)
      )
      and (
        (case when ${t.targetArticleId} is not null then 1 else 0 end)
        + (case when ${t.targetQuestId} is not null then 1 else 0 end)
        + (case when ${t.targetCharacterId} is not null then 1 else 0 end)
        + (case when ${t.targetPinId} is not null then 1 else 0 end)
        + (case when ${t.targetUniverseId} is not null then 1 else 0 end)
        + (case when ${t.targetMonsterId} is not null then 1 else 0 end)
      ) = 1
      and (
        (${t.targetKind} = 'article' and ${t.targetArticleId} is not null)
        or (${t.targetKind} = 'quest' and ${t.targetQuestId} is not null)
        or (${t.targetKind} = 'character' and ${t.targetCharacterId} is not null)
        or (${t.targetKind} = 'pin' and ${t.targetPinId} is not null)
        or (${t.targetKind} = 'universe' and ${t.targetUniverseId} is not null)
        or (${t.targetKind} = 'monster' and ${t.targetMonsterId} is not null)
      )
      and not (${t.sourceKind} = ${t.targetKind} and ${t.sourceId} = ${t.targetId})
      and (
        (${t.origin} in ('mention', 'participation') and ${t.templateFieldKey} is null and ${t.label} is null)
        or (${t.origin} = 'template_field' and ${t.templateFieldKey} is not null and ${t.label} is null)
        or (${t.origin} = 'manual' and ${t.label} is not null and char_length(${t.label}) between 1 and 60 and ${t.templateFieldKey} is null)
      )`,
    ),
  ],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    title: text("title"),
    bodyJson: jsonb("body_json").notNull(),
    bodyPlain: text("body_plain").notNull(),
    bodyTsv: tsvector("body_tsv").generatedAlwaysAs(plainTsv("body_plain")),
    visibility: journalVisibility("visibility").default("private").notNull(),
    ...protocol,
  },
  (t) => [
    index("journal_entries_world_character").on(t.worldId, t.characterId),
    index("journal_entries_body_tsv").using("gin", t.bodyTsv),
    check(
      "journal_entries_title_length",
      sql`${t.title} IS NULL OR char_length(${t.title}) BETWEEN 1 AND 200`,
    ),
  ],
);

export const chatChannels = pgTable(
  "chat_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...protocol,
  },
  (t) => [
    uniqueIndex("uq_channel_name")
      .on(t.worldId, t.name)
      .where(sql`${t.archivedAt} IS NULL`),
    check("chat_channels_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 80`),
  ],
);

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdFromMessageId: uuid("created_from_message_id")
      .notNull()
      .references((): AnyPgColumn => chatMessages.id, { onDelete: "cascade" }),
    ...protocol,
  },
  (t) => [check("chat_threads_title_length", sql`char_length(${t.title}) BETWEEN 1 AND 80`)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").references((): AnyPgColumn => chatThreads.id, {
      onDelete: "cascade",
    }),
    opensThreadId: uuid("opens_thread_id").references((): AnyPgColumn => chatThreads.id, {
      onDelete: "set null",
    }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body"),
    diceExpression: text("dice_expression"),
    diceTerms: jsonb("dice_terms"),
    diceSum: integer("dice_sum"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [
    unique("uq_msg_opens_thread").on(t.opensThreadId),
    index("chat_messages_channel_stream")
      .on(t.channelId, desc(t.sentAt))
      .where(sql`${t.threadId} IS NULL`),
    index("chat_messages_thread_stream")
      .on(t.threadId, desc(t.sentAt))
      .where(sql`${t.threadId} IS NOT NULL`),
    check(
      "chk_opener_body",
      sql`(
        ${t.opensThreadId} IS NOT NULL
        AND ${t.body} IS NULL
      ) OR (
        ${t.opensThreadId} IS NULL
        AND ${t.body} IS NOT NULL
        AND char_length(${t.body}) BETWEEN 1 AND 2000
      )`,
    ),
    check(
      "chk_dice_shape",
      sql`(
        ${t.diceExpression} IS NULL
        AND ${t.diceTerms} IS NULL
        AND ${t.diceSum} IS NULL
      ) OR (
        ${t.diceExpression} IS NOT NULL
        AND ${t.diceTerms} IS NOT NULL
        AND ${t.diceSum} IS NOT NULL
      )`,
    ),
  ],
);

/**
 * Columns that reference `files.id`. APP-FILE-GC must check every entry here
 * before deleting a file (see `src/lib/files/gc.ts`).
 */
export const FILE_REFERENCE_COLUMNS = [
  worlds.titleImageId,
  articles.titleImageId,
  maps.imageId,
  characters.portraitId,
  characterImages.fileId,
  monsters.portraitId,
] as const;
