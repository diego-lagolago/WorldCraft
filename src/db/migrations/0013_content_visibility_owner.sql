-- Plan 004 T-003: content_visibility + owner_id on articles, quests, pins.
-- Universes and maps stay on visibility_status (Karten-Ausnahme).

CREATE TYPE "public"."content_visibility" AS ENUM('owner_only', 'gm_only', 'published');--> statement-breakpoint

ALTER TABLE "articles" ADD COLUMN "owner_id" text;--> statement-breakpoint
UPDATE "articles" SET "owner_id" = "created_by" WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "visibility" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "visibility" TYPE "content_visibility" USING ("visibility"::text::"content_visibility");--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "visibility" SET DEFAULT 'owner_only'::"content_visibility";--> statement-breakpoint
CREATE INDEX "articles_world_owner" ON "articles" USING btree ("world_id","owner_id");--> statement-breakpoint

ALTER TABLE "quests" ADD COLUMN "owner_id" text;--> statement-breakpoint
UPDATE "quests" SET "owner_id" = "created_by" WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "quests" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ALTER COLUMN "visibility" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "quests" ALTER COLUMN "visibility" TYPE "content_visibility" USING ("visibility"::text::"content_visibility");--> statement-breakpoint
ALTER TABLE "quests" ALTER COLUMN "visibility" SET DEFAULT 'owner_only'::"content_visibility";--> statement-breakpoint
CREATE INDEX "quests_world_owner" ON "quests" USING btree ("world_id","owner_id");--> statement-breakpoint

ALTER TABLE "pins" ADD COLUMN "owner_id" text;--> statement-breakpoint
UPDATE "pins" SET "owner_id" = "created_by" WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "pins" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ALTER COLUMN "visibility" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pins" ALTER COLUMN "visibility" TYPE "content_visibility" USING ("visibility"::text::"content_visibility");--> statement-breakpoint
ALTER TABLE "pins" ALTER COLUMN "visibility" SET DEFAULT 'owner_only'::"content_visibility";
