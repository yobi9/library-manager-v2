-- =====================================================
-- 007: إسقاط trigger تكرار إنشاء المستخدم
-- =====================================================
-- يزيل `log_user_creation` الذي كان يُدرج صف `user_created` تلقائياً عند كل
-- INSERT في `users`، لأن إنشاء المستخدم يُسجَّل الآن صراحةً في الكود:
--   - `create_user`  → أحداث نظام (إدارة الأدمن) في `UserService.createUser`
--   - `register`     → أحداث مستخدمين (تسجيل ذاتي) في `UserService.register`
-- النتيجة: لا يوجد صف مكرر لكل عملية إنشاء مستخدم.
--
-- Idempotent: التشغيل المتكرر لا يغيّر شيئاً (DROP TRIGGER IF EXISTS).

DROP TRIGGER IF EXISTS log_user_creation;
