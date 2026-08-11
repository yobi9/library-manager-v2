-- =====================================================
-- Library Manager V2 — Normalize boolean setting storage
--
-- توحيد تخزين الإعدادات المنطقية المسجلة في Settings Registry:
--   - data_type = 'boolean' لكل المفاتيح المنطقية.
--   - تطبيع القيمة إلى 'true' / 'false' فقط (بما يتطابق مع
--     دلالة التحقق في validateSetting: 'true' | '1' تعني true).
-- الترحيل idempotent: لا يلمس صفوفاً مخزنة بالفعل بشكل سليم.
-- المفاتيح خارج السجل (ميتة) لا تُلمس.
-- =====================================================

UPDATE settings
SET value = CASE
      WHEN lower(trim(value)) IN ('true', '1') THEN 'true'
      ELSE 'false'
    END,
    data_type = 'boolean',
    updated_at = CURRENT_TIMESTAMP
WHERE key IN (
  'enable_registration',
  'maintenance_mode',
  'show_movie',
  'show_series',
  'show_series_anime',
  'show_series_kids',
  'show_series_sports',
  'show_series_tv',
  'show_series_ramadan',
  'show_series_deen',
  'show_series_doc',
  'show_series_learn',
  'download_images',
  'download_cast_images',
  'deep_scan_enabled',
  'auto_backup_enabled',
  'auto_restart_on_port_change'
)
AND (data_type != 'boolean' OR value NOT IN ('true', 'false'));
