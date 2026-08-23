-- حذف الفهارس المكررة/المغطاة — مُ验证 في التحقق من خط الأساس
-- (08-baseline-validation.md, Section E, IDX-1/2/3/5/6)
--
-- كل فهرس محذوف مُغطّى بالكامل من فهرس آخر متماثل أو فرعي أو يحتوائي.
-- لا يُغيّر الحذف أي خط استعلام نشط.

-- IDX-1: متماثل — كلاهما (user_id, is_active)
-- نحتفظ بـ idx_user_sessions_user_id
DROP INDEX IF EXISTS idx_user_sessions_user_active;

-- IDX-2: متماثل — كلاهما (user_id, created_at DESC)
-- نحتفظ بـ idx_activities_user_created
DROP INDEX IF EXISTS idx_activities_user_date;

-- IDX-3: فرعي — idx_security_events_user (user_id, resolved, created_at DESC)
-- يحتوي idx_security_events_user_resolved (user_id, resolved) عبر البادئة اليسرى
DROP INDEX IF EXISTS idx_security_events_user_resolved;

-- IDX-5: متماثل UNIQUE — كلاهما (user_id, media_id) فريد
-- نحتفظ بـ idx_user_progress_user_media
DROP INDEX IF EXISTS idx_user_progress_unique;

-- IDX-6: بادئة — idx_media_people_media_id (media_id, role)
-- يحتوي idx_media_people_media (media_id) عبر البادئة اليسرى
DROP INDEX IF EXISTS idx_media_people_media;
