CREATE OR REPLACE FUNCTION wc_content_in_world(kind content_kind, content_id uuid, world uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF kind = 'article' THEN
    RETURN EXISTS (SELECT 1 FROM articles WHERE id = content_id AND world_id = world);
  ELSIF kind = 'quest' THEN
    RETURN EXISTS (SELECT 1 FROM quests WHERE id = content_id AND world_id = world);
  ELSIF kind = 'universe' THEN
    RETURN EXISTS (SELECT 1 FROM universes WHERE id = content_id AND world_id = world);
  ELSIF kind = 'pin' THEN
    RETURN EXISTS (
      SELECT 1
      FROM pins p
      JOIN maps m ON m.id = p.map_id
      JOIN universes u ON u.id = m.universe_id
      WHERE p.id = content_id AND u.world_id = world
    );
  ELSIF kind = 'character' THEN
    RETURN EXISTS (
      SELECT 1 FROM world_participations
      WHERE character_id = content_id AND world_id = world
    );
  END IF;
  RETURN false;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION trig_gm_is_creator()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  creator text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'game_master' AND pg_trigger_depth() = 1 THEN
      RAISE EXCEPTION 'TRIG-GM-IS-CREATOR' USING ERRCODE = 'WC001';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'game_master' THEN
    IF NEW.role <> 'game_master' OR NEW.archived_at IS NOT NULL OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'TRIG-GM-IS-CREATOR' USING ERRCODE = 'WC001';
    END IF;
  END IF;

  IF NEW.role = 'game_master' THEN
    SELECT created_by INTO creator FROM worlds WHERE id = NEW.world_id;
    IF creator IS DISTINCT FROM NEW.user_id OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'TRIG-GM-IS-CREATOR' USING ERRCODE = 'WC001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trig_gm_is_creator
BEFORE INSERT OR UPDATE OR DELETE ON memberships
FOR EACH ROW EXECUTE FUNCTION trig_gm_is_creator();--> statement-breakpoint

CREATE OR REPLACE FUNCTION trig_world_creator_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'TRIG-WORLD-CREATOR-IMMUTABLE' USING ERRCODE = 'WC002';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trig_world_creator_immutable
BEFORE UPDATE ON worlds
FOR EACH ROW EXECUTE FUNCTION trig_world_creator_immutable();--> statement-breakpoint

CREATE OR REPLACE FUNCTION trig_rel_same_world()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_id uuid;
  target_id uuid;
BEGIN
  source_id := coalesce(
    NEW.source_article_id,
    NEW.source_quest_id,
    NEW.source_character_id,
    NEW.source_pin_id,
    NEW.source_universe_id
  );
  target_id := coalesce(
    NEW.target_article_id,
    NEW.target_quest_id,
    NEW.target_character_id,
    NEW.target_pin_id,
    NEW.target_universe_id
  );
  IF NOT wc_content_in_world(NEW.source_kind, source_id, NEW.world_id)
     OR NOT wc_content_in_world(NEW.target_kind, target_id, NEW.world_id) THEN
    RAISE EXCEPTION 'TRIG-REL-SAME-WORLD' USING ERRCODE = 'WC003';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trig_rel_same_world
BEFORE INSERT OR UPDATE ON relations
FOR EACH ROW EXECUTE FUNCTION trig_rel_same_world();--> statement-breakpoint

CREATE OR REPLACE FUNCTION trig_universe_last()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_trigger_depth() = 1
     AND (SELECT count(*) FROM universes WHERE world_id = OLD.world_id) <= 1 THEN
    RAISE EXCEPTION 'TRIG-UNIVERSE-LAST' USING ERRCODE = 'WC004';
  END IF;
  RETURN OLD;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trig_universe_last
BEFORE DELETE ON universes
FOR EACH ROW EXECUTE FUNCTION trig_universe_last();--> statement-breakpoint

CREATE OR REPLACE FUNCTION trig_journal_part()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM world_participations
    WHERE character_id = NEW.character_id AND world_id = NEW.world_id
  ) THEN
    RAISE EXCEPTION 'TRIG-JOURNAL-PART' USING ERRCODE = 'WC005';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trig_journal_part
BEFORE INSERT OR UPDATE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION trig_journal_part();--> statement-breakpoint

CREATE OR REPLACE FUNCTION trig_part_owner_member()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.archived_at IS NULL AND NOT EXISTS (
    SELECT 1
    FROM characters c
    JOIN memberships m
      ON m.user_id = c.owner_id
     AND m.world_id = NEW.world_id
     AND m.archived_at IS NULL
    WHERE c.id = NEW.character_id
  ) THEN
    RAISE EXCEPTION 'TRIG-PART-OWNER-MEMBER' USING ERRCODE = 'WC006';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trig_part_owner_member
BEFORE INSERT OR UPDATE ON world_participations
FOR EACH ROW EXECUTE FUNCTION trig_part_owner_member();--> statement-breakpoint

CREATE OR REPLACE FUNCTION trig_char_owner_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'TRIG-CHAR-OWNER-IMMUTABLE' USING ERRCODE = 'WC007';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trig_char_owner_immutable
BEFORE UPDATE ON characters
FOR EACH ROW EXECUTE FUNCTION trig_char_owner_immutable();--> statement-breakpoint

CREATE OR REPLACE FUNCTION trig_char_images_max()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM character_images WHERE character_id = NEW.character_id) >= 10 THEN
    RAISE EXCEPTION 'TRIG-CHAR-IMAGES-MAX' USING ERRCODE = 'WC008';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trig_char_images_max
BEFORE INSERT ON character_images
FOR EACH ROW EXECUTE FUNCTION trig_char_images_max();
