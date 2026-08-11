-- =====================================================
-- 008: إسقاط trigger تسجيل الدخول الناجح المكرر
-- =====================================================
-- يزيل `log_user_login` الذي كان يُدرج حدث `login_success` في `security_events`
-- عند كل INSERT في `user_sessions` (أي كل تسجيل دخول ناجح).
--
-- السبب: تسجيل الدخول الناجح مُتبَّع أصلًا في `activities` كـ `user_login`
-- (فئة نظام للأدمن / مستخدم لغيره في `AuthService`)، فكان `login_success` في
-- `security_events` تكراراً يملأ صندوق "أحداث الأمان" بضجيج بلا قيمة أمنية.
-- القيمة الأمنية الحقيقية تبقى في `login_failed` (فشل الدخول) و`user_blocked`
-- /`user_unblocked` (الحظر ورفعه) — وهي ما تُسجَّل عبر `SecurityEventRepository`.
--
-- يُحذف أيضاً أي صف `login_success` قديم موجود من قبل (تنظيف التكرار التاريخي).
--
-- Idempotent: التشغيل المتكرر لا يغيّر شيئاً (DROP TRIGGER IF EXISTS + DELETE).

DROP TRIGGER IF EXISTS log_user_login;

DELETE FROM security_events WHERE event_type = 'login_success';
