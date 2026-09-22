CREATE TABLE "spike_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"dice_expression" text,
	"dice_values" integer[],
	"dice_sum" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spike_chat_body_length" CHECK (char_length("spike_chat_messages"."body") BETWEEN 1 AND 2000),
	CONSTRAINT "spike_chat_author_name_length" CHECK (char_length("spike_chat_messages"."author_name") BETWEEN 1 AND 100),
	CONSTRAINT "spike_chat_dice_shape" CHECK ((
        ("spike_chat_messages"."dice_expression" IS NULL AND "spike_chat_messages"."dice_values" IS NULL AND "spike_chat_messages"."dice_sum" IS NULL)
        OR
        ("spike_chat_messages"."dice_expression" IS NOT NULL AND "spike_chat_messages"."dice_values" IS NOT NULL AND "spike_chat_messages"."dice_sum" IS NOT NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "spike_chat_messages" ADD CONSTRAINT "spike_chat_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spike_chat_messages_sent_at" ON "spike_chat_messages" USING btree ("sent_at");