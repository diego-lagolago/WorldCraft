CREATE TABLE "spike_chat_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_key" text DEFAULT 'spike' NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spike_chat_channels_name_length" CHECK (char_length("spike_chat_channels"."name") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "spike_chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_from_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spike_chat_threads_title_length" CHECK (char_length("spike_chat_threads"."title") BETWEEN 1 AND 80)
);
--> statement-breakpoint
DROP INDEX "spike_chat_messages_sent_at";--> statement-breakpoint
ALTER TABLE "spike_chat_messages" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
ALTER TABLE "spike_chat_messages" ADD COLUMN "thread_id" uuid;--> statement-breakpoint
INSERT INTO "spike_chat_channels" ("world_key", "name", "sort")
SELECT 'spike', 'Allgemein', 0
WHERE NOT EXISTS (
  SELECT 1 FROM "spike_chat_channels" WHERE "world_key" = 'spike'
);--> statement-breakpoint
UPDATE "spike_chat_messages"
SET "channel_id" = (
  SELECT "id" FROM "spike_chat_channels"
  WHERE "world_key" = 'spike'
  ORDER BY "sort", "created_at"
  LIMIT 1
)
WHERE "channel_id" IS NULL;--> statement-breakpoint
ALTER TABLE "spike_chat_messages" ALTER COLUMN "channel_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "spike_chat_threads" ADD CONSTRAINT "spike_chat_threads_channel_id_spike_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."spike_chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spike_chat_channels_sort" ON "spike_chat_channels" USING btree ("world_key","sort");--> statement-breakpoint
CREATE INDEX "spike_chat_threads_channel" ON "spike_chat_threads" USING btree ("channel_id","created_at");--> statement-breakpoint
ALTER TABLE "spike_chat_messages" ADD CONSTRAINT "spike_chat_messages_channel_id_spike_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."spike_chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spike_chat_messages" ADD CONSTRAINT "spike_chat_messages_thread_id_spike_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."spike_chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spike_chat_messages_stream" ON "spike_chat_messages" USING btree ("channel_id","thread_id","sent_at");