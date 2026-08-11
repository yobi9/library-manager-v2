-- =====================================================
-- Library Manager V2 — External enriched image storage
--
-- ينقل التخزين الافتراضي لصور الإثراء من داخل المشروع
-- (public/assets/images/enriched) إلى مسار خارجي مطلق على
-- القرص (D:\assets\images\enriched أو أي مسار يختاره المسؤول).
--
-- ملاحظات معمارية:
--   - القيمة المخزّنة في القاعدة (enriched_poster/enriched_backdrop/
--     profile_path) تبقى بصيغة web-relative قديمة
--     (/assets/images/enriched/...) — لا تُعاد كتابة الصفوف.
--   - تعيين image_storage_root لقيمة مطلقة يجعل خادم الصور يقرأ من
--     القرص الخارجي (path.isAbsolute) بدل مجلد public، ويربط البادئة
--     الويب القديمة بالجذر الخارجي في image-service.resolveImagePath.
--   - القيمة المطلقة قابلة للتغيير لاحقاً من لوحة التحكم (إعداد
--     storage.image_storage_root) لأي مكان خارج جذر المشروع.
-- الترحيل idempotent: UPDATE ثم INSERT OR IGNORE كضمان لصف موجود/غائب.
-- مصدر الحقيقة للافتراضيات هو السجل في settings-registry.ts.
-- =====================================================

UPDATE settings
SET value = 'D:\assets\images\enriched',
    description = 'المسار الأساسي (مطلق خارج جذر المشروع أو نسبي لجذر الويب) لتخزين صور الإثراء المحلية'
WHERE key = 'image_storage_root';

INSERT OR IGNORE INTO settings (key, value, category, data_type, description, is_secure)
VALUES (
  'image_storage_root',
  'D:\assets\images\enriched',
  'storage',
  'string',
  'المسار الأساسي (مطلق خارج جذر المشروع أو نسبي لجذر الويب) لتخزين صور الإثراء المحلية',
  0
);
