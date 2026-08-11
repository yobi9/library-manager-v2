-- Adds the target-section reference for "linked" (shortcut) libraries.
-- A linked library has no paths of its own; it points to an existing
-- content section and the viewer opens the target section directly.
--
-- NOTE: SQLite does NOT support ADD COLUMN IF NOT EXISTS. The migration was
-- already applied to the live database (registered in _migrations), so this
-- statement only runs on fresh databases created from the initial schema.
ALTER TABLE libraries ADD COLUMN linked_library_id INTEGER;
