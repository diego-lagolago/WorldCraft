import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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
 * T-009 spike tables (Karten-Whiteboard). Prefixed so they stay separate from
 * the later MVP `maps` / `pins` / `character_markers` schema.
 * Positions still use datenmodell 2.7: pos_x/pos_y in 0–1, numeric(8,7).
 * Pin-type values match datenmodell `pin_type`.
 */
export const spikePinType = pgEnum("spike_pin_type", [
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

export const spikeMaps = pgTable("spike_maps", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  imageFilename: text("image_filename").notNull(),
  imageWidth: integer("image_width").notNull(),
  imageHeight: integer("image_height").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const spikePins = pgTable(
  "spike_pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mapId: uuid("map_id")
      .notNull()
      .references(() => spikeMaps.id, { onDelete: "cascade" }),
    pinType: spikePinType("pin_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    locked: boolean("locked").default(false).notNull(),
    posX: numeric("pos_x", { precision: 8, scale: 7 }).notNull(),
    posY: numeric("pos_y", { precision: 8, scale: 7 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("spike_pins_pos_x", sql`${t.posX} >= 0 AND ${t.posX} <= 1`),
    check("spike_pins_pos_y", sql`${t.posY} >= 0 AND ${t.posY} <= 1`),
    check("spike_pins_title_length", sql`char_length(${t.title}) BETWEEN 1 AND 120`),
  ],
);

export const spikeCharacterMarkers = pgTable(
  "spike_character_markers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mapId: uuid("map_id")
      .notNull()
      .references(() => spikeMaps.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    posX: numeric("pos_x", { precision: 8, scale: 7 }).notNull(),
    posY: numeric("pos_y", { precision: 8, scale: 7 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("spike_markers_one_per_map").on(t.mapId),
    check("spike_markers_pos_x", sql`${t.posX} >= 0 AND ${t.posX} <= 1`),
    check("spike_markers_pos_y", sql`${t.posY} >= 0 AND ${t.posY} <= 1`),
  ],
);

/**
 * T-010 spike chat. Prefixed so it stays separate from later MVP chat tables.
 * Extends the world-scoped fachmodell: channels + threads (see src/spike/chat/README.md).
 * No worlds table yet → world_key placeholder instead of world_id.
 * Dice columns follow datenmodell CHK-DICE-SHAPE: all set or all empty.
 */
export const spikeChatChannels = pgTable(
  "spike_chat_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldKey: text("world_key").notNull().default("spike"),
    name: text("name").notNull(),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("spike_chat_channels_sort").on(t.worldKey, t.sort),
    check("spike_chat_channels_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 80`),
  ],
);

export const spikeChatThreads = pgTable(
  "spike_chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => spikeChatChannels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdFromMessageId: uuid("created_from_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("spike_chat_threads_channel").on(t.channelId, t.createdAt),
    check("spike_chat_threads_title_length", sql`char_length(${t.title}) BETWEEN 1 AND 80`),
  ],
);

export const spikeChatMessages = pgTable(
  "spike_chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => spikeChatChannels.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").references(() => spikeChatThreads.id, {
      onDelete: "cascade",
    }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    opensThreadId: uuid("opens_thread_id").references(() => spikeChatThreads.id, {
      onDelete: "cascade",
    }),
    diceExpression: text("dice_expression"),
    diceValues: integer("dice_values").array(),
    diceSum: integer("dice_sum"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("spike_chat_messages_stream").on(t.channelId, t.threadId, t.sentAt),
    unique("spike_chat_messages_opens_thread").on(t.opensThreadId),
    check("spike_chat_body_length", sql`char_length(${t.body}) BETWEEN 1 AND 2000`),
    check("spike_chat_author_name_length", sql`char_length(${t.authorName}) BETWEEN 1 AND 100`),
    check(
      "spike_chat_dice_shape",
      sql`(
        (${t.diceExpression} IS NULL AND ${t.diceValues} IS NULL AND ${t.diceSum} IS NULL)
        OR
        (${t.diceExpression} IS NOT NULL AND ${t.diceValues} IS NOT NULL AND ${t.diceSum} IS NOT NULL)
      )`,
    ),
  ],
);

/**
 * T-011 / datenmodell.md tables. Names match the technical model.
 * Spike chat/karte tables above stay prefixed; these are the shared domain tables.
 */

export const visibilityStatus = pgEnum("visibility_status", ["published", "gm_only"]);
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
]);
export const relationOrigin = pgEnum("relation_origin", [
  "mention",
  "template_field",
  "participation",
  "manual",
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
    index("invite_links_world_active").on(t.worldId),
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
    index("memberships_world_active").on(t.worldId),
    index("memberships_user_active").on(t.userId),
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
    sortOrder: integer("sort_order").notNull(),
    visibility: visibilityStatus("visibility").default("gm_only").notNull(),
    ...protocol,
  },
  (t) => [
    unique("uq_universe_name").on(t.worldId, t.name),
    index("universes_world_sort").on(t.worldId, t.sortOrder),
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
    imageId: uuid("image_id")
      .notNull()
      .references(() => files.id),
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
    visibility: visibilityStatus("visibility").default("gm_only").notNull(),
    ...protocol,
  },
  (t) => [
    index("pins_map").on(t.mapId),
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
    skills: jsonb("skills").notNull(),
    personality: text("personality"),
    ideals: text("ideals"),
    bonds: text("bonds"),
    flaws: text("flaws"),
    bioJson: jsonb("bio_json"),
    bioPlain: text("bio_plain"),
    ...protocol,
  },
  (t) => [
    check("characters_name_length", sql`char_length(${t.name}) BETWEEN 1 AND 120`),
    check("characters_skills_object", sql`jsonb_typeof(${t.skills}) = 'object'`),
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
    index("world_participations_world_active").on(t.worldId),
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
    unique("uq_marker").on(t.characterId, t.mapId),
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
    visibility: visibilityStatus("visibility").default("gm_only").notNull(),
    ...protocol,
  },
  (t) => [
    index("articles_world").on(t.worldId),
    check("articles_title_length", sql`char_length(${t.title}) BETWEEN 1 AND 200`),
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
    sourceCharacterId: uuid("source_character_id").references(() => characters.id, {
      onDelete: "cascade",
    }),
    sourcePinId: uuid("source_pin_id").references(() => pins.id, { onDelete: "cascade" }),
    sourceUniverseId: uuid("source_universe_id").references(() => universes.id, {
      onDelete: "cascade",
    }),
    targetKind: contentKind("target_kind").notNull(),
    targetArticleId: uuid("target_article_id").references(() => articles.id, {
      onDelete: "cascade",
    }),
    targetCharacterId: uuid("target_character_id").references(() => characters.id, {
      onDelete: "cascade",
    }),
    targetPinId: uuid("target_pin_id").references(() => pins.id, { onDelete: "cascade" }),
    targetUniverseId: uuid("target_universe_id").references(() => universes.id, {
      onDelete: "cascade",
    }),
    origin: relationOrigin("origin").notNull(),
    templateFieldKey: text("template_field_key"),
    label: text("label"),
    counterLabel: text("counter_label"),
    ...protocol,
  },
  (t) => [
    index("relations_world_source").on(t.worldId, t.sourceKind),
    index("relations_world_target").on(t.worldId, t.targetKind),
    check(
      "chk_rel_source_one",
      sql`(
        (${t.sourceArticleId} IS NOT NULL)::int
        + (${t.sourceCharacterId} IS NOT NULL)::int
        + (${t.sourcePinId} IS NOT NULL)::int
        + (${t.sourceUniverseId} IS NOT NULL)::int
      ) = 1`,
    ),
    check(
      "chk_rel_target_one",
      sql`(
        (${t.targetArticleId} IS NOT NULL)::int
        + (${t.targetCharacterId} IS NOT NULL)::int
        + (${t.targetPinId} IS NOT NULL)::int
        + (${t.targetUniverseId} IS NOT NULL)::int
      ) = 1`,
    ),
    check(
      "chk_rel_manual_label",
      sql`${t.origin} <> 'manual' OR (${t.label} IS NOT NULL AND char_length(${t.label}) BETWEEN 1 AND 60)`,
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
    visibility: journalVisibility("visibility").default("private").notNull(),
    ...protocol,
  },
  (t) => [
    index("journal_entries_world_character").on(t.worldId, t.characterId),
    check(
      "journal_entries_title_length",
      sql`${t.title} IS NULL OR char_length(${t.title}) BETWEEN 1 AND 200`,
    ),
  ],
);
