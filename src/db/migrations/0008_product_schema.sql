CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."quest_status" AS ENUM('open', 'active', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "character_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"caption" text,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "uq_character_image_order" UNIQUE("character_id","sort_order"),
	CONSTRAINT "character_images_caption_length" CHECK ("character_images"."caption" IS NULL OR char_length("character_images"."caption") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "chat_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "chat_channels_name_length" CHECK (char_length("chat_channels"."name") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"thread_id" uuid,
	"opens_thread_id" uuid,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"dice_expression" text,
	"dice_terms" jsonb,
	"dice_sum" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_msg_opens_thread" UNIQUE("opens_thread_id"),
	CONSTRAINT "chat_messages_body_length" CHECK (char_length("chat_messages"."body") BETWEEN 1 AND 2000),
	CONSTRAINT "chk_dice_shape" CHECK ((
        "chat_messages"."dice_expression" IS NULL
        AND "chat_messages"."dice_terms" IS NULL
        AND "chat_messages"."dice_sum" IS NULL
      ) OR (
        "chat_messages"."dice_expression" IS NOT NULL
        AND "chat_messages"."dice_terms" IS NOT NULL
        AND "chat_messages"."dice_sum" IS NOT NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_from_message_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "chat_threads_title_length" CHECK (char_length("chat_threads"."title") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "quest_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quest_id" uuid NOT NULL,
	"character_id" uuid,
	"character_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "quest_participants_name_length" CHECK (char_length("quest_participants"."character_name") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description_json" jsonb,
	"description_plain" text,
	"description_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('german', coalesce(description_plain, ''))) STORED,
	"status" "quest_status" DEFAULT 'open' NOT NULL,
	"visibility" "visibility_status" DEFAULT 'gm_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "quests_title_length" CHECK (char_length("quests"."title") BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "relations" DROP CONSTRAINT "chk_rel_source_one";--> statement-breakpoint
ALTER TABLE "relations" DROP CONSTRAINT "chk_rel_target_one";--> statement-breakpoint
ALTER TABLE "relations" DROP CONSTRAINT "chk_rel_manual_label";--> statement-breakpoint
DROP INDEX "invite_links_world_active";--> statement-breakpoint
DROP INDEX "memberships_world_active";--> statement-breakpoint
DROP INDEX "memberships_user_active";--> statement-breakpoint
DROP INDEX "relations_world_source";--> statement-breakpoint
DROP INDEX "relations_world_target";--> statement-breakpoint
DROP INDEX "world_participations_world_active";--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "body_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('german', coalesce(body_plain, ''))) STORED;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "first_edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "attr_str" smallint;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "attr_dex" smallint;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "attr_con" smallint;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "attr_int" smallint;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "attr_wis" smallint;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "attr_cha" smallint;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "bio_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('german', coalesce(bio_plain, ''))) STORED;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "body_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('german', coalesce(body_plain, ''))) STORED;--> statement-breakpoint
ALTER TABLE "pins" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pins" ADD COLUMN "description_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('german', coalesce(description_plain, ''))) STORED;--> statement-breakpoint
ALTER TABLE "relations" ADD COLUMN "source_quest_id" uuid;--> statement-breakpoint
ALTER TABLE "relations" ADD COLUMN "source_id" uuid GENERATED ALWAYS AS (coalesce(source_article_id, source_quest_id, source_character_id, source_pin_id, source_universe_id)) STORED;--> statement-breakpoint
ALTER TABLE "relations" ADD COLUMN "target_quest_id" uuid;--> statement-breakpoint
ALTER TABLE "relations" ADD COLUMN "target_id" uuid GENERATED ALWAYS AS (coalesce(target_article_id, target_quest_id, target_character_id, target_pin_id, target_universe_id)) STORED;--> statement-breakpoint
ALTER TABLE "universes" ADD COLUMN "description_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('german', coalesce(description_plain, ''))) STORED;--> statement-breakpoint
ALTER TABLE "character_images" ADD CONSTRAINT "character_images_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_images" ADD CONSTRAINT "character_images_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_images" ADD CONSTRAINT "character_images_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_images" ADD CONSTRAINT "character_images_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_opens_thread_id_chat_threads_id_fk" FOREIGN KEY ("opens_thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_created_from_message_id_chat_messages_id_fk" FOREIGN KEY ("created_from_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_participants" ADD CONSTRAINT "quest_participants_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_participants" ADD CONSTRAINT "quest_participants_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_participants" ADD CONSTRAINT "quest_participants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_participants" ADD CONSTRAINT "quest_participants_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_channel_name" ON "chat_channels" USING btree ("world_id","name") WHERE "chat_channels"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "chat_messages_channel_stream" ON "chat_messages" USING btree ("channel_id","sent_at" desc) WHERE "chat_messages"."thread_id" IS NULL;--> statement-breakpoint
CREATE INDEX "chat_messages_thread_stream" ON "chat_messages" USING btree ("thread_id","sent_at" desc) WHERE "chat_messages"."thread_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quest_participant" ON "quest_participants" USING btree ("quest_id","character_id") WHERE "quest_participants"."character_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "quests_world" ON "quests" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "quests_title_trgm" ON "quests" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "quests_description_tsv" ON "quests" USING gin ("description_tsv");--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_quest_id_quests_id_fk" FOREIGN KEY ("source_quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_quest_id_quests_id_fk" FOREIGN KEY ("target_quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_title_trgm" ON "articles" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "articles_body_tsv" ON "articles" USING gin ("body_tsv");--> statement-breakpoint
CREATE INDEX "characters_name_trgm" ON "characters" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "characters_bio_tsv" ON "characters" USING gin ("bio_tsv");--> statement-breakpoint
CREATE INDEX "journal_entries_body_tsv" ON "journal_entries" USING gin ("body_tsv");--> statement-breakpoint
CREATE INDEX "pins_title_trgm" ON "pins" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "pins_description_tsv" ON "pins" USING gin ("description_tsv");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rel" ON "relations" USING btree ("world_id","source_kind","source_id","target_kind","target_id","origin",coalesce("template_field_key", ''),coalesce("label", ''));--> statement-breakpoint
CREATE INDEX "universes_name_trgm" ON "universes" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "universes_description_tsv" ON "universes" USING gin ("description_tsv");--> statement-breakpoint
CREATE INDEX "invite_links_world_active" ON "invite_links" USING btree ("world_id") WHERE "invite_links"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "memberships_world_active" ON "memberships" USING btree ("world_id") WHERE "memberships"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "memberships_user_active" ON "memberships" USING btree ("user_id") WHERE "memberships"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "relations_world_source" ON "relations" USING btree ("world_id","source_kind","source_id");--> statement-breakpoint
CREATE INDEX "relations_world_target" ON "relations" USING btree ("world_id","target_kind","target_id");--> statement-breakpoint
CREATE INDEX "world_participations_world_active" ON "world_participations" USING btree ("world_id") WHERE "world_participations"."archived_at" IS NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_attr_str" CHECK ("characters"."attr_str" IS NULL OR "characters"."attr_str" BETWEEN 1 AND 30);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_attr_dex" CHECK ("characters"."attr_dex" IS NULL OR "characters"."attr_dex" BETWEEN 1 AND 30);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_attr_con" CHECK ("characters"."attr_con" IS NULL OR "characters"."attr_con" BETWEEN 1 AND 30);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_attr_int" CHECK ("characters"."attr_int" IS NULL OR "characters"."attr_int" BETWEEN 1 AND 30);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_attr_wis" CHECK ("characters"."attr_wis" IS NULL OR "characters"."attr_wis" BETWEEN 1 AND 30);--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_attr_cha" CHECK ("characters"."attr_cha" IS NULL OR "characters"."attr_cha" BETWEEN 1 AND 30);--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "chk_rel_shape" CHECK ((
        (case when "relations"."source_article_id" is not null then 1 else 0 end)
        + (case when "relations"."source_quest_id" is not null then 1 else 0 end)
        + (case when "relations"."source_character_id" is not null then 1 else 0 end)
        + (case when "relations"."source_pin_id" is not null then 1 else 0 end)
        + (case when "relations"."source_universe_id" is not null then 1 else 0 end)
      ) = 1
      and (
        ("relations"."source_kind" = 'article' and "relations"."source_article_id" is not null)
        or ("relations"."source_kind" = 'quest' and "relations"."source_quest_id" is not null)
        or ("relations"."source_kind" = 'character' and "relations"."source_character_id" is not null)
        or ("relations"."source_kind" = 'pin' and "relations"."source_pin_id" is not null)
        or ("relations"."source_kind" = 'universe' and "relations"."source_universe_id" is not null)
      )
      and (
        (case when "relations"."target_article_id" is not null then 1 else 0 end)
        + (case when "relations"."target_quest_id" is not null then 1 else 0 end)
        + (case when "relations"."target_character_id" is not null then 1 else 0 end)
        + (case when "relations"."target_pin_id" is not null then 1 else 0 end)
        + (case when "relations"."target_universe_id" is not null then 1 else 0 end)
      ) = 1
      and (
        ("relations"."target_kind" = 'article' and "relations"."target_article_id" is not null)
        or ("relations"."target_kind" = 'quest' and "relations"."target_quest_id" is not null)
        or ("relations"."target_kind" = 'character' and "relations"."target_character_id" is not null)
        or ("relations"."target_kind" = 'pin' and "relations"."target_pin_id" is not null)
        or ("relations"."target_kind" = 'universe' and "relations"."target_universe_id" is not null)
      )
      and not ("relations"."source_kind" = "relations"."target_kind" and "relations"."source_id" = "relations"."target_id")
      and (
        ("relations"."origin" in ('mention', 'participation') and "relations"."template_field_key" is null and "relations"."label" is null)
        or ("relations"."origin" = 'template_field' and "relations"."template_field_key" is not null and "relations"."label" is null)
        or ("relations"."origin" = 'manual' and "relations"."label" is not null and char_length("relations"."label") between 1 and 60 and "relations"."template_field_key" is null)
      ));