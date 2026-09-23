ALTER TABLE "characters" DROP CONSTRAINT "characters_skills_object";--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "skills" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
-- The old object held only the fixed D&D list with "untrained"; own skills start empty (datenmodell 3.8.1).
UPDATE "characters" SET "skills" = '[]'::jsonb WHERE jsonb_typeof("skills") <> 'array';--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "proficiency_bonus" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "abilities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_skills_array" CHECK (jsonb_typeof("characters"."skills") = 'array');--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_abilities_array" CHECK (jsonb_typeof("characters"."abilities") = 'array');--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_proficiency_bonus" CHECK ("characters"."proficiency_bonus" BETWEEN 0 AND 10);