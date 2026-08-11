-- فهرس تغطية لمخططات المسح (updateLibraryStats + cleanupOrphanedItems).
-- يحوّل COUNT(*) في `updateLibraryStats` والاستعلامات المفتاحية في
-- `cleanupOrphanedItems` إلى مسح فهرس خالص بدل الفهرس الحالي
-- `idx_media_items_library_id (library_id, is_available)` الذي يفتقر
-- إلى `parent_media_id` فيُضطر لقراءة الصفوف نفسها.
CREATE INDEX IF NOT EXISTS idx_media_items_lib_parent_avail
  ON media_items(library_id, parent_media_id, is_available);
