-- Plan 004 T-009: quest_notes (Schema, Domäne, API).

CREATE TABLE "quest_notes" (
	"quest_id" uuid PRIMARY KEY NOT NULL,
	"body_json" jsonb,
	"body_plain" text,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quest_notes" ADD CONSTRAINT "quest_notes_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_notes" ADD CONSTRAINT "quest_notes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
