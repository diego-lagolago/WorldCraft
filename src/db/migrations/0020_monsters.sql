-- Plan 005 T-004: monsters table, relation FKs, TRIG-REL-SAME-WORLD for monster.

CREATE TYPE "public"."monster_kind" AS ENUM(
  'beast', 'undead', 'demon', 'dragon', 'humanoid',
  'construct', 'aberration', 'plant', 'magical', 'other'
);--> statement-breakpoint

CREATE TYPE "public"."monster_rarity" AS ENUM(
  'common', 'uncommon', 'rare', 'epic', 'legendary'
);--> statement-breakpoint

CREATE TYPE "public"."monster_danger" AS ENUM(
  'harmless', 'dangerous', 'deadly', 'devastating', 'divine', 'apocalyptic'
);--> statement-breakpoint

CREATE TYPE "public"."monster_size" AS ENUM(
  'tiny', 'small', 'medium', 'large', 'gigantic'
);--> statement-breakpoint

CREATE TABLE "monsters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "world_id" uuid NOT NULL,
  "name" text NOT NULL,
  "portrait_id" uuid,
  "class" text,
  "attr_str" smallint,
  "attr_dex" smallint,
  "attr_con" smallint,
  "attr_int" smallint,
  "attr_wis" smallint,
  "attr_cha" smallint,
  "skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "proficiency_bonus" smallint DEFAULT 2 NOT NULL,
  "abilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "personality" text,
  "ideals" text,
  "bonds" text,
  "flaws" text,
  "bio_json" jsonb,
  "bio_plain" text,
  "bio_tsv" "tsvector" GENERATED ALWAYS AS (
    to_tsvector('german', coalesce(name, '') || ' ' || coalesce(bio_plain, ''))
  ) STORED,
  "kind" "monster_kind" DEFAULT 'other' NOT NULL,
  "rarity" "monster_rarity" DEFAULT 'common' NOT NULL,
  "is_legendary" boolean DEFAULT false NOT NULL,
  "danger" "monster_danger" DEFAULT 'harmless' NOT NULL,
  "size" "monster_size" DEFAULT 'medium' NOT NULL,
  "habitat_article_id" uuid,
  "visibility" "content_visibility" DEFAULT 'owner_only' NOT NULL,
  "owner_id" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" text NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "updated_by" text NOT NULL,
  CONSTRAINT "monsters_name_length" CHECK (char_length("name") BETWEEN 1 AND 120),
  CONSTRAINT "monsters_skills_array" CHECK (jsonb_typeof("skills") = 'array'),
  CONSTRAINT "monsters_abilities_array" CHECK (jsonb_typeof("abilities") = 'array'),
  CONSTRAINT "monsters_proficiency_bonus" CHECK ("proficiency_bonus" BETWEEN 0 AND 10),
  CONSTRAINT "monsters_attr_str" CHECK ("attr_str" IS NULL OR "attr_str" BETWEEN 1 AND 30),
  CONSTRAINT "monsters_attr_dex" CHECK ("attr_dex" IS NULL OR "attr_dex" BETWEEN 1 AND 30),
  CONSTRAINT "monsters_attr_con" CHECK ("attr_con" IS NULL OR "attr_con" BETWEEN 1 AND 30),
  CONSTRAINT "monsters_attr_int" CHECK ("attr_int" IS NULL OR "attr_int" BETWEEN 1 AND 30),
  CONSTRAINT "monsters_attr_wis" CHECK ("attr_wis" IS NULL OR "attr_wis" BETWEEN 1 AND 30),
  CONSTRAINT "monsters_attr_cha" CHECK ("attr_cha" IS NULL OR "attr_cha" BETWEEN 1 AND 30)
);--> statement-breakpoint

ALTER TABLE "monsters" ADD CONSTRAINT "monsters_world_id_worlds_id_fk"
  FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_portrait_id_files_id_fk"
  FOREIGN KEY ("portrait_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_habitat_article_id_articles_id_fk"
  FOREIGN KEY ("habitat_article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_owner_id_users_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_updated_by_users_id_fk"
  FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "monsters_world" ON "monsters" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "monsters_world_owner" ON "monsters" USING btree ("world_id","owner_id");--> statement-breakpoint
CREATE INDEX "monsters_name_trgm" ON "monsters" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "monsters_bio_tsv" ON "monsters" USING gin ("bio_tsv");--> statement-breakpoint

-- Relations: drop dependent indexes/constraints, replace generated columns (PR1).
DROP INDEX IF EXISTS "uq_rel";--> statement-breakpoint
DROP INDEX IF EXISTS "relations_world_source";--> statement-breakpoint
DROP INDEX IF EXISTS "relations_world_target";--> statement-breakpoint
ALTER TABLE "relations" DROP CONSTRAINT IF EXISTS "chk_rel_shape";--> statement-breakpoint

ALTER TABLE "relations" DROP COLUMN "source_id";--> statement-breakpoint
ALTER TABLE "relations" DROP COLUMN "target_id";--> statement-breakpoint

ALTER TABLE "relations" ADD COLUMN "source_monster_id" uuid;--> statement-breakpoint
ALTER TABLE "relations" ADD COLUMN "target_monster_id" uuid;--> statement-breakpoint

ALTER TABLE "relations" ADD CONSTRAINT "relations_source_monster_id_monsters_id_fk"
  FOREIGN KEY ("source_monster_id") REFERENCES "public"."monsters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_monster_id_monsters_id_fk"
  FOREIGN KEY ("target_monster_id") REFERENCES "public"."monsters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "relations" ADD COLUMN "source_id" uuid GENERATED ALWAYS AS (
  coalesce(source_article_id, source_quest_id, source_character_id, source_pin_id, source_universe_id, source_monster_id)
) STORED;--> statement-breakpoint
ALTER TABLE "relations" ADD COLUMN "target_id" uuid GENERATED ALWAYS AS (
  coalesce(target_article_id, target_quest_id, target_character_id, target_pin_id, target_universe_id, target_monster_id)
) STORED;--> statement-breakpoint

ALTER TABLE "relations" ADD CONSTRAINT "chk_rel_shape" CHECK ((
  (case when "source_article_id" is not null then 1 else 0 end)
  + (case when "source_quest_id" is not null then 1 else 0 end)
  + (case when "source_character_id" is not null then 1 else 0 end)
  + (case when "source_pin_id" is not null then 1 else 0 end)
  + (case when "source_universe_id" is not null then 1 else 0 end)
  + (case when "source_monster_id" is not null then 1 else 0 end)
) = 1
and (
  ("source_kind" = 'article' and "source_article_id" is not null)
  or ("source_kind" = 'quest' and "source_quest_id" is not null)
  or ("source_kind" = 'character' and "source_character_id" is not null)
  or ("source_kind" = 'pin' and "source_pin_id" is not null)
  or ("source_kind" = 'universe' and "source_universe_id" is not null)
  or ("source_kind" = 'monster' and "source_monster_id" is not null)
)
and (
  (case when "target_article_id" is not null then 1 else 0 end)
  + (case when "target_quest_id" is not null then 1 else 0 end)
  + (case when "target_character_id" is not null then 1 else 0 end)
  + (case when "target_pin_id" is not null then 1 else 0 end)
  + (case when "target_universe_id" is not null then 1 else 0 end)
  + (case when "target_monster_id" is not null then 1 else 0 end)
) = 1
and (
  ("target_kind" = 'article' and "target_article_id" is not null)
  or ("target_kind" = 'quest' and "target_quest_id" is not null)
  or ("target_kind" = 'character' and "target_character_id" is not null)
  or ("target_kind" = 'pin' and "target_pin_id" is not null)
  or ("target_kind" = 'universe' and "target_universe_id" is not null)
  or ("target_kind" = 'monster' and "target_monster_id" is not null)
)
and not ("source_kind" = "target_kind" and "source_id" = "target_id")
and (
  ("origin" in ('mention', 'participation') and "template_field_key" is null and "label" is null)
  or ("origin" = 'template_field' and "template_field_key" is not null and "label" is null)
  or ("origin" = 'manual' and "label" is not null and char_length("label") between 1 and 60 and "template_field_key" is null)
));--> statement-breakpoint

CREATE UNIQUE INDEX "uq_rel" ON "relations" USING btree (
  "world_id","source_kind","source_id","target_kind","target_id","origin",
  coalesce("template_field_key", ''), coalesce("label", '')
);--> statement-breakpoint
CREATE INDEX "relations_world_source" ON "relations" USING btree ("world_id","source_kind","source_id");--> statement-breakpoint
CREATE INDEX "relations_world_target" ON "relations" USING btree ("world_id","target_kind","target_id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION wc_content_in_world(kind content_kind, content_id uuid, world uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF kind = 'article' THEN
    RETURN EXISTS (SELECT 1 FROM articles WHERE id = content_id AND world_id = world);
  ELSIF kind = 'quest' THEN
    RETURN EXISTS (SELECT 1 FROM quests WHERE id = content_id AND world_id = world);
  ELSIF kind = 'universe' THEN
    RETURN EXISTS (SELECT 1 FROM universes WHERE id = content_id AND world_id = world);
  ELSIF kind = 'pin' THEN
    RETURN EXISTS (
      SELECT 1
      FROM pins p
      JOIN maps m ON m.id = p.map_id
      JOIN universes u ON u.id = m.universe_id
      WHERE p.id = content_id AND u.world_id = world
    );
  ELSIF kind = 'character' THEN
    RETURN EXISTS (
      SELECT 1 FROM world_participations
      WHERE character_id = content_id AND world_id = world
    );
  ELSIF kind = 'monster' THEN
    RETURN EXISTS (SELECT 1 FROM monsters WHERE id = content_id AND world_id = world);
  END IF;
  RETURN false;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION trig_rel_same_world()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_id uuid;
  target_id uuid;
BEGIN
  source_id := coalesce(
    NEW.source_article_id,
    NEW.source_quest_id,
    NEW.source_character_id,
    NEW.source_pin_id,
    NEW.source_universe_id,
    NEW.source_monster_id
  );
  target_id := coalesce(
    NEW.target_article_id,
    NEW.target_quest_id,
    NEW.target_character_id,
    NEW.target_pin_id,
    NEW.target_universe_id,
    NEW.target_monster_id
  );
  IF NOT wc_content_in_world(NEW.source_kind, source_id, NEW.world_id)
     OR NOT wc_content_in_world(NEW.target_kind, target_id, NEW.world_id) THEN
    RAISE EXCEPTION 'TRIG-REL-SAME-WORLD' USING ERRCODE = 'WC003';
  END IF;
  RETURN NEW;
END;
$$;
