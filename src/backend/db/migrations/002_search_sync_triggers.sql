-- =====================================================
-- 2. FTS5 media_search sync triggers (Phase 5 root-cause fix)
--
-- The original schema (001) only defined an INSERT trigger (`media_items_ai`)
-- which stores `phonetic_key = ''` and never syncs on update or delete. As a
-- result:
--   - editing a title kept the OLD title searchable (no UPDATE trigger)
--   - deleting media left orphan rows in `media_search` (no DELETE trigger)
--   - scanner-created items were inserted with an empty phonetic_key and no
--     denormalized genres/cast (not phonetically searchable)
--
-- These triggers keep the FTS text columns in sync and remove rows for items
-- that are no longer searchable (unavailable, soft-deleted, season/episode).
-- The JS-side backfill (`SearchRepository.backfillMissing`) computes
-- `phonetic_key` + denormalized genres/cast for rows that came in through the
-- INSERT trigger path, and runs after each completed scan.
-- =====================================================

-- Sync FTS text columns on media update; drop the row when the item is no
-- longer searchable (unavailable / soft-deleted / season-episode).
CREATE TRIGGER IF NOT EXISTS media_items_au
AFTER UPDATE ON media_items
BEGIN
  UPDATE media_search
  SET title = NEW.title,
      original_title = NEW.original_title,
      overview = NEW.overview,
      created_at = NEW.created_at
  WHERE media_id = OLD.media_id;

  DELETE FROM media_search
  WHERE media_id = OLD.media_id
    AND (NEW.is_available = 0 OR NEW.deleted_at IS NOT NULL OR NEW.type IN ('season', 'episode'));
END;

-- Remove the FTS row when the media row is hard-deleted.
CREATE TRIGGER IF NOT EXISTS media_items_ad
AFTER DELETE ON media_items
BEGIN
  DELETE FROM media_search WHERE media_id = OLD.media_id;
END;
