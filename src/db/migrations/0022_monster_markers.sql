-- Plan 006 T-003: monster_markers (beliebig viele pro Monster, K1).

CREATE TABLE IF NOT EXISTS "monster_markers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "monster_id" uuid NOT NULL,
  "map_id" uuid NOT NULL,
  "pos_x" numeric(8, 7) NOT NULL,
  "pos_y" numeric(8, 7) NOT NULL,
  "visibility" "content_visibility" DEFAULT 'owner_only' NOT NULL,
  "owner_id" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" text NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "updated_by" text NOT NULL,
  CONSTRAINT "monster_markers_monster_id_monsters_id_fk"
    FOREIGN KEY ("monster_id") REFERENCES "public"."monsters"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "monster_markers_map_id_maps_id_fk"
    FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "monster_markers_owner_id_users_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "monster_markers_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "monster_markers_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "monster_markers_pos_x" CHECK ("pos_x" >= 0 AND "pos_x" <= 1),
  CONSTRAINT "monster_markers_pos_y" CHECK ("pos_y" >= 0 AND "pos_y" <= 1)
);

CREATE INDEX IF NOT EXISTS "monster_markers_map" ON "monster_markers" ("map_id");
