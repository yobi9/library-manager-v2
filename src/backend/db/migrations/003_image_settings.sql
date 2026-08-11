-- =====================================================
-- Library Manager V2 — Image storage settings
--
-- بذر إعدادات مسارات الصور المُسجَّلة في Settings Registry:
--   - image_storage_root      → المسار الأساسي (نسبي لجذر الويب) لحفظ صور
--                               الإثراء المحلية؛ مساراته هي ما يُخزَّن في
--                               enriched_poster / enriched_backdrop.
--   - image_placeholder_dir   → المسار الأساسي لصور placeholders (SVG).
-- الترحيل idempotent (INSERT OR IGNORE): لا يلمس صفوفاً موجودة مسبقاً.
-- مصدر الحقيقة للافتراضيات هو السجل في settings-registry.ts.
-- =====================================================

INSERT OR IGNORE INTO settings (key, value, category, data_type, description, is_secure)
VALUES
  ('image_storage_root', '/assets/images/enriched', 'storage', 'string', 'Base path for enriched images (web-relative)', 0),
  ('image_placeholder_dir', '/assets/images/placeholders', 'storage', 'string', 'Base path for placeholder SVGs (web-relative)', 0);
