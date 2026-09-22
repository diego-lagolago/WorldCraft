import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
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
