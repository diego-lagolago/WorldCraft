CREATE TYPE "public"."content_kind" AS ENUM('article', 'quest', 'character', 'pin', 'universe');--> statement-breakpoint
CREATE TYPE "public"."invite_validity" AS ENUM('one_day', 'seven_days', 'unlimited');--> statement-breakpoint
CREATE TYPE "public"."journal_visibility" AS ENUM('private', 'shared_with_gm');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('game_master', 'master', 'player');--> statement-breakpoint
CREATE TYPE "public"."pin_type" AS ENUM('danger', 'boss', 'house', 'city', 'treasure', 'landmark', 'fishing', 'plants', 'dungeon', 'quest', 'teleporter', 'shop');--> statement-breakpoint
CREATE TYPE "public"."relation_origin" AS ENUM('mention', 'template_field', 'participation', 'manual');--> statement-breakpoint
CREATE TYPE "public"."visibility_status" AS ENUM('published', 'gm_only');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"title" text NOT NULL,
	"template_type" text DEFAULT 'none' NOT NULL,
	"template_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"title_image_id" uuid,
	"body_json" jsonb,
	"body_plain" text,
	"visibility" "visibility_status" DEFAULT 'gm_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "articles_title_length" CHECK (char_length("articles"."title") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "character_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"map_id" uuid NOT NULL,
	"pos_x" numeric(8, 7) NOT NULL,
	"pos_y" numeric(8, 7) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "uq_marker" UNIQUE("character_id","map_id"),
	CONSTRAINT "character_markers_pos_x" CHECK ("character_markers"."pos_x" >= 0 AND "character_markers"."pos_x" <= 1),
	CONSTRAINT "character_markers_pos_y" CHECK ("character_markers"."pos_y" >= 0 AND "character_markers"."pos_y" <= 1)
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"portrait_id" uuid,
	"class" text,
	"skills" jsonb NOT NULL,
	"personality" text,
	"ideals" text,
	"bonds" text,
	"flaws" text,
	"bio_json" jsonb,
	"bio_plain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "characters_name_length" CHECK (char_length("characters"."name") BETWEEN 1 AND 120),
	CONSTRAINT "characters_skills_object" CHECK (jsonb_typeof("characters"."skills") = 'object')
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width_px" integer,
	"height_px" integer,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "files_byte_size" CHECK ("files"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "invite_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"code" text NOT NULL,
	"validity" "invite_validity" NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "invite_links_code_unique" UNIQUE("code"),
	CONSTRAINT "invite_links_use_count" CHECK ("invite_links"."use_count" >= 0),
	CONSTRAINT "invite_links_code_length" CHECK (char_length("invite_links"."code") BETWEEN 16 AND 64)
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"world_id" uuid NOT NULL,
	"title" text,
	"body_json" jsonb NOT NULL,
	"body_plain" text NOT NULL,
	"visibility" "journal_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "journal_entries_title_length" CHECK ("journal_entries"."title" IS NULL OR char_length("journal_entries"."title") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"universe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"image_id" uuid NOT NULL,
	"visibility" "visibility_status" DEFAULT 'gm_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "maps_name_length" CHECK (char_length("maps"."name") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "membership_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_via_invite_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "uq_membership" UNIQUE("world_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"pin_type" "pin_type" NOT NULL,
	"title" text NOT NULL,
	"description_json" jsonb,
	"description_plain" text,
	"pos_x" numeric(8, 7) NOT NULL,
	"pos_y" numeric(8, 7) NOT NULL,
	"visibility" "visibility_status" DEFAULT 'gm_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "pins_title_length" CHECK (char_length("pins"."title") BETWEEN 1 AND 120),
	CONSTRAINT "pins_pos_x" CHECK ("pins"."pos_x" >= 0 AND "pins"."pos_x" <= 1),
	CONSTRAINT "pins_pos_y" CHECK ("pins"."pos_y" >= 0 AND "pins"."pos_y" <= 1)
);
--> statement-breakpoint
CREATE TABLE "relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"source_kind" "content_kind" NOT NULL,
	"source_article_id" uuid,
	"source_character_id" uuid,
	"source_pin_id" uuid,
	"source_universe_id" uuid,
	"target_kind" "content_kind" NOT NULL,
	"target_article_id" uuid,
	"target_character_id" uuid,
	"target_pin_id" uuid,
	"target_universe_id" uuid,
	"origin" "relation_origin" NOT NULL,
	"template_field_key" text,
	"label" text,
	"counter_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "chk_rel_source_one" CHECK ((
        ("relations"."source_article_id" IS NOT NULL)::int
        + ("relations"."source_character_id" IS NOT NULL)::int
        + ("relations"."source_pin_id" IS NOT NULL)::int
        + ("relations"."source_universe_id" IS NOT NULL)::int
      ) = 1),
	CONSTRAINT "chk_rel_target_one" CHECK ((
        ("relations"."target_article_id" IS NOT NULL)::int
        + ("relations"."target_character_id" IS NOT NULL)::int
        + ("relations"."target_pin_id" IS NOT NULL)::int
        + ("relations"."target_universe_id" IS NOT NULL)::int
      ) = 1),
	CONSTRAINT "chk_rel_manual_label" CHECK ("relations"."origin" <> 'manual' OR ("relations"."label" IS NOT NULL AND char_length("relations"."label") BETWEEN 1 AND 60))
);
--> statement-breakpoint
CREATE TABLE "universes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description_json" jsonb,
	"description_plain" text,
	"sort_order" integer NOT NULL,
	"visibility" "visibility_status" DEFAULT 'gm_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "uq_universe_name" UNIQUE("world_id","name"),
	CONSTRAINT "universes_name_length" CHECK (char_length("universes"."name") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE TABLE "world_participations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"world_id" uuid NOT NULL,
	"brought_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "uq_participation" UNIQUE("character_id","world_id")
);
--> statement-breakpoint
CREATE TABLE "worlds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description_json" jsonb,
	"description_plain" text,
	"title_image_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "worlds_name_length" CHECK (char_length("worlds"."name") BETWEEN 1 AND 120)
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_title_image_id_files_id_fk" FOREIGN KEY ("title_image_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_markers" ADD CONSTRAINT "character_markers_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_markers" ADD CONSTRAINT "character_markers_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_markers" ADD CONSTRAINT "character_markers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_markers" ADD CONSTRAINT "character_markers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_portrait_id_files_id_fk" FOREIGN KEY ("portrait_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_universe_id_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."universes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_image_id_files_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_joined_via_invite_id_invite_links_id_fk" FOREIGN KEY ("joined_via_invite_id") REFERENCES "public"."invite_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_article_id_articles_id_fk" FOREIGN KEY ("source_article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_character_id_characters_id_fk" FOREIGN KEY ("source_character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_pin_id_pins_id_fk" FOREIGN KEY ("source_pin_id") REFERENCES "public"."pins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_universe_id_universes_id_fk" FOREIGN KEY ("source_universe_id") REFERENCES "public"."universes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_article_id_articles_id_fk" FOREIGN KEY ("target_article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_character_id_characters_id_fk" FOREIGN KEY ("target_character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_pin_id_pins_id_fk" FOREIGN KEY ("target_pin_id") REFERENCES "public"."pins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_universe_id_universes_id_fk" FOREIGN KEY ("target_universe_id") REFERENCES "public"."universes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universes" ADD CONSTRAINT "universes_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universes" ADD CONSTRAINT "universes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universes" ADD CONSTRAINT "universes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_participations" ADD CONSTRAINT "world_participations_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_participations" ADD CONSTRAINT "world_participations_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_participations" ADD CONSTRAINT "world_participations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_participations" ADD CONSTRAINT "world_participations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_title_image_id_files_id_fk" FOREIGN KEY ("title_image_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_world" ON "articles" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "character_markers_map" ON "character_markers" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "invite_links_world_active" ON "invite_links" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "journal_entries_world_character" ON "journal_entries" USING btree ("world_id","character_id");--> statement-breakpoint
CREATE INDEX "maps_universe" ON "maps" USING btree ("universe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_one_gm" ON "memberships" USING btree ("world_id") WHERE "memberships"."role" = 'game_master' AND "memberships"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "memberships_world_active" ON "memberships" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "memberships_user_active" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pins_map" ON "pins" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "relations_world_source" ON "relations" USING btree ("world_id","source_kind");--> statement-breakpoint
CREATE INDEX "relations_world_target" ON "relations" USING btree ("world_id","target_kind");--> statement-breakpoint
CREATE INDEX "universes_world_sort" ON "universes" USING btree ("world_id","sort_order");--> statement-breakpoint
CREATE INDEX "world_participations_world_active" ON "world_participations" USING btree ("world_id");