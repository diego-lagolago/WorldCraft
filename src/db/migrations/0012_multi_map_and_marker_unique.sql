-- Multiple maps per universe (already allowed) + empty maps (nullable image).
-- Character markers: at most one map globally per character (Owner 2026-09-23).
ALTER TABLE "maps" ALTER COLUMN "image_id" DROP NOT NULL;--> statement-breakpoint

-- Keep newest marker when a character already has several (one-per-map legacy).
DELETE FROM "character_markers" AS older
USING "character_markers" AS newer
WHERE older.character_id = newer.character_id
  AND older.id <> newer.id
  AND older.updated_at < newer.updated_at;--> statement-breakpoint

-- Tie-break identical updated_at by id.
DELETE FROM "character_markers" AS older
USING "character_markers" AS newer
WHERE older.character_id = newer.character_id
  AND older.id < newer.id;--> statement-breakpoint

ALTER TABLE "character_markers" DROP CONSTRAINT "uq_marker";--> statement-breakpoint
ALTER TABLE "character_markers" ADD CONSTRAINT "uq_marker_character" UNIQUE("character_id");
