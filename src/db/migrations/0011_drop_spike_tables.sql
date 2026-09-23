-- T-016: drop spike tables and enum (Plan 003 cutover).
DROP TABLE IF EXISTS "spike_chat_messages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "spike_chat_threads" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "spike_chat_channels" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "spike_character_markers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "spike_pins" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "spike_maps" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."spike_pin_type";
