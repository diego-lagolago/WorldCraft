-- Plan 004 T-006: quest_chapters (Schema, Domäne, API).

CREATE TABLE "quest_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quest_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_json" jsonb,
	"body_plain" text,
	"body_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('german', coalesce(body_plain, ''))) STORED,
	"position" integer NOT NULL,
	"visibility" "content_visibility" DEFAULT 'owner_only' NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "quest_chapters_title_length" CHECK (char_length("quest_chapters"."title") BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "quest_chapters" ADD CONSTRAINT "quest_chapters_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_chapters" ADD CONSTRAINT "quest_chapters_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_chapters" ADD CONSTRAINT "quest_chapters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_chapters" ADD CONSTRAINT "quest_chapters_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quest_chapters_quest_position" ON "quest_chapters" USING btree ("quest_id","position");--> statement-breakpoint
CREATE INDEX "quest_chapters_body_tsv" ON "quest_chapters" USING gin ("body_tsv");
