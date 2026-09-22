CREATE TYPE "public"."spike_pin_type" AS ENUM('danger', 'boss', 'house', 'city', 'treasure', 'landmark', 'fishing', 'plants', 'dungeon', 'quest', 'teleporter', 'shop');--> statement-breakpoint
CREATE TABLE "spike_character_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"name" text NOT NULL,
	"pos_x" numeric(8, 7) NOT NULL,
	"pos_y" numeric(8, 7) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spike_markers_one_per_map" UNIQUE("map_id"),
	CONSTRAINT "spike_markers_pos_x" CHECK ("spike_character_markers"."pos_x" >= 0 AND "spike_character_markers"."pos_x" <= 1),
	CONSTRAINT "spike_markers_pos_y" CHECK ("spike_character_markers"."pos_y" >= 0 AND "spike_character_markers"."pos_y" <= 1)
);
--> statement-breakpoint
CREATE TABLE "spike_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"image_filename" text NOT NULL,
	"image_width" integer NOT NULL,
	"image_height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spike_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"pin_type" "spike_pin_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"pos_x" numeric(8, 7) NOT NULL,
	"pos_y" numeric(8, 7) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spike_pins_pos_x" CHECK ("spike_pins"."pos_x" >= 0 AND "spike_pins"."pos_x" <= 1),
	CONSTRAINT "spike_pins_pos_y" CHECK ("spike_pins"."pos_y" >= 0 AND "spike_pins"."pos_y" <= 1),
	CONSTRAINT "spike_pins_title_length" CHECK (char_length("spike_pins"."title") BETWEEN 1 AND 120)
);
--> statement-breakpoint
ALTER TABLE "spike_character_markers" ADD CONSTRAINT "spike_character_markers_map_id_spike_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."spike_maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spike_pins" ADD CONSTRAINT "spike_pins_map_id_spike_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."spike_maps"("id") ON DELETE cascade ON UPDATE no action;