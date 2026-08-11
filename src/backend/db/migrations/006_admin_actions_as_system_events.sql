-- =====================================================
-- 006: تصنيف الأحداث الإدارية القديمة كأحداث نظام
-- =====================================================
-- ينقل الأحداث الإدارية المُسجّلة قبل تفعيل `entityType` عند الكتابة
-- من `entity_type = 'user'` إلى `'system'` حتى تظهر في صندوق "أحداث النظام":
--   - تسجيل الدخول/الخروج للمستخدمين الحاليين المسجّلين كأدمن (is_admin = 1)
--   - عمليات إدارة المستخدمين (إنشاء/تعديل/حذف/حظر/تغيير الصلاحيات)
-- يبقى النشاط العادي (غير الأدمن) و `update_avatar` و `register` كأحداث مستخدمين.
--
-- Idempotent: التشغيل المتكرر لا يغيّر شيئاً لأن الصفوف المنقولة فعلت.

UPDATE activities
SET entity_type = 'system'
WHERE entity_type = 'user'
  AND action IN (
    'user_login',
    'logout',
    'create_user',
    'update_user',
    'delete_user',
    'block_user',
    'unblock_user',
    'grant_admin',
    'revoke_admin'
  )
  AND user_id IS NOT NULL
  AND user_id IN (SELECT user_id FROM users WHERE is_admin = 1);
