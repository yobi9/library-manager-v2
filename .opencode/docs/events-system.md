# نظام الأحداث (Events System)

توثيق معمارية تتبع الأحداث في Library Manager V2 — المصادر، الجداول، الكتابة،
القراءة، البث اللحظي والاحتفاظ. هذا الملف هو مرجع المصمم والمطوّر لفهم كيف
يصل أي حدث من نقطة وقوعه إلى واجهة الأدمن.

---

## 1. الجداول الخمسة ودور كلٍّ منها

| الجدول               | المسؤولية                                                                 | المصدر الموثوق للكتابة                     |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| `activities`         | سجل الأحداث الموحّد المعروض في صفحة الأحداث (3 صناديق)                    | `ActivityRepository.logActivity`           |
| `security_events`    | أحداث أمنية (فشل دخول، حظر/رفع حظر) — تُعرض في صندوق "أحداث الأمان"       | `SecurityEventRepository.logSecurityEvent` |
| `visitor_events`     | تتبع زيارات الزوار (`visit`) ورسائل الزوار (`request`)                    | `VisitorRepository`                        |
| `settings_audit_log` | سجل تدقيق تغيير الإعدادات (قناة تدقيق مخصصة للإعدادات)                    | `SettingsRepository.upsertSetting`         |
| `user_sessions`      | جلسات الدخول النشطة (مصدر `user_login` في `activities` عبر `AuthService`) | `UserSessionRepository.createSession`      |

قاعدة التقسيم: **حدث تشغيلي إداري** → `activities` بفئة نظام. **حدث تفاعل
مستخدم** → `activities` بفئة مستخدم/زائر. **حدث أمني** → `security_events`.
**تغيير إعداد** → `settings_audit_log` (لا يتكرر في `activities`).

---

## 2. فئات الكيانات (`entity_type`)

| القيمة    | المعنى                          | أمثلة                                                                                |
| --------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `system`  | حدث تشغيلي للنظام أو إجراء أدمن | `db_backup`, `library_created`, `scan_completed`, `create_user`, `user_login` للأدمن |
| `user`    | تفاعل مستخدم مسجّل              | `view_media`, `register`, `update_avatar`                                            |
| `visitor` | تفاعل زائر                      | `visitor_view`, `new_request`                                                        |

قاعدة الاشتقاق عند الكتابة: `entityType ?? (userId ? "user" : "visitor")`.
قاعدة التصنيف الإداري: تسجيل الدخول/الخروج وإدارة المستخدمين تُكتب بفئة
`system` عندما يكون الفاعل أدمن (`is_admin = 1`) — راجع `auth-service.ts`
و`user-service.ts`.

---

## 3. مسارات الكتابة (من يقوم بتسجيل ماذا)

### أ) المصادقة والمستخدمون

- `auth-service.ts`: `user_login` / `logout` في `activities` (فئة `system` للأدمن، `user` لغيره)؛ `login_failed` في `security_events` (severity `warning`, details: `reason`).
- `user-service.ts`: `create_user`, `delete_user`, `block_user`, `unblock_user`, `grant_admin`, `revoke_admin` → فئة `system`؛ `update_user` حسب `callerIsAdmin`؛ `register`/`update_avatar` → فئة `user`؛ الحظر/رفع الحظر يسجّلا أيضاً `user_blocked`/`user_unblocked` في `security_events`.

### ب) الوسائط والمكتبات

- `media-service.ts`: `media_updated` (موجود مسبقاً) + `media_deleted` و`media_pinned`/`media_unpinned` (إضافة هذه الدورة).
- `library-service.ts`: `library_created` / `library_updated` / `library_deleted` — فئة `system`، عبر `activityRepo` الحقن حديثاً (إضافة هذه الدورة).

### ج) قاعدة البيانات والماسح

- `database-service.ts`: `db_backup` (موجود) + `db_optimize` و`db_restore` (إضافة هذه الدورة).
  - `db_factory_reset` **لا يُسجَّل في `activities`** عمداً: `truncateAll` يمسح الجدول نفسه، فيبقى التنظيف مستحيل التتبع داخل القاعدة — يُطبع سطر `console.warn` للمشغّل.
- الماسح: دورة المسح تُسجَّل عبر ربط في `services/index.ts` — `scan_started`, `scan_completed` (success), `scan_failed` (error), `scan_paused`, `scan_resumed`, `scan_stopped` (فئة `system`, module `scanner`). `scan_error` و`scan_item` تُبث فقط ولا تُخزَّن (ضجيج).

### د) ما يُستثنى عمداً

- `settings_audit_log` هو قناة التدقيق الرسمية للإعدادات — لا يُكرَّر في `activities`.
- الوحدات الثانوية (أخبار/إعلانات/متجر/رسائل/بلاغات/ترخيص/إثراء) تملك جداول
  أعمال خاصة بها ونظام حالاتها — غير مضمّنة في سجل الأحداث حالياً (قرار نطاق).

---

## 4. مسارات القراءة والواجهات

### صفحة الأحداث (`src/features/admin/pages/events-page.tsx`)

- **الصندوقان الأولان** (نظام/مستخدمين): `GET /api/admin/events/history` — ترحيل لانهائي عبر `useInfiniteQuery` (حجم صفحة 50)، `totals` للعدّ.
- **صندوق الأحداث الأمنية** (ثالث): `GET /api/admin/events/security` — هوك مستقل `useAdminSecurityEvents` بنفس نمط الترحيل. الألوان: `login_failed` كهرماني (warning)، `user_blocked` أحمر، `user_unblocked` أخضر.
- **Polling شرطي (2026-08-09):** الهوكان `useAdminEventsHistory` و`useAdminSecurityEvents`
  يقبلان `options.pollingInterval` (الافتراضي **15s**؛ `false` يعطّله). في
  `events-page.tsx:425,432` يُمرَّر `pollingInterval: connected ? false : 15_000` —
  **أثناء اتصال SSE فعّال لا يُستطلع خلفية إطلاقاً** (البيانات تصل لحظياً عبر
  البث)، ويُستأنف الـ polling فقط عند انقطاع الاتصال (حماية من الإغراق).

### أصلح الفلترة (تاريخي — مهم)

`history/route.ts` كانت تُرجع **كل الصفوف** عند تمرير `type=user|visitor` لأن
`userTypes=undefined` كان يُبطل WHERE. التجميع الصحيح اليوم:

| `?type=`  | صندوق النظام | صندوق المستخدمين  |
| --------- | ------------ | ----------------- |
| (بدون)    | `[system]`   | `[user, visitor]` |
| `system`  | `[system]`   | `[]`              |
| `user`    | `[]`         | `[user, visitor]` |
| `visitor` | `[]`         | `[visitor]`       |

---

## 5. البث اللحظي (SSE)

- نقطة النهاية: `GET /api/admin/events` (`requireAdmin`) — تشترك في `EventBus` وتُبث الأحداث المسماة.
- أحداث هذه الدورة المضافة للبث: `media_deleted`, `scan_started`, `scan_completed`, `scan_failed`, `scan_paused`, `scan_resumed`, `scan_stopped`.
- الهوك `use-admin-events-sse.ts` يطبّع كل حدث إلى `AdminEvent` محلي.
- **قاعدة إعادة الجلب**: فقط الأحداث **المُخزَّنة فعلاً** تطلق إعادة جلب بعد debounce 500ms — قائمة `PERSISTED_SSE_EVENTS` في `events-page.tsx`. أحداث التقدم (enrichment/translation) تُبث ولا تُخزَّن فلا تهزّ القائمة.

### نقطة تقدم المسح: `GET /api/scan-events` (تثخين `scan_item`)

- أحداث lifecycle (`scan_started/completed/failed/paused/resumed/stopped/error`)
  تُبث **فوراً** — القائمة `IMMEDIATE_EVENTS` في `route.ts:18`.
- **`scan_item` مُثخَّن (2026-08-09):** يُدمج في بث واحد بحد أدنى كل **500ms**
  (`PROGRESS_THROTTLE_MS`, `route.ts:21, 85-109`) — حالة التقدم لا تتغير لكل عنصر،
  فلا تُغرق عشرات الرسائل العميل أثناء مسح كبير. المؤقّت يُنظَّف عند الـ abort.
- الـ payload هو `ScanProgress` كامل من `getProgress(libraryId)`، أو
  `getActiveProgress()` عند غياب `libraryId` (أحدث مسح نشط — يكتشف تحديثَ الصفحة
  مسحاً ما زال يعمل بعد إعادة التحميل).

---

## 6. الاحتفاظ (Retention)

`RetentionScheduler` (يبدأ بعد 5 دقائق من الإقلاع ثم كل 24 ساعة):

| الجدول/النطاق                               | الأيام | الأسلوب                                     |
| ------------------------------------------- | ------ | ------------------------------------------- |
| `activities` (زائر)                         | 7      | `deleteOldVisitorActivities`                |
| `activities` (مستخدم/نظام)                  | 90     | `deleteOldActivities`                       |
| `security_events`                           | 180    | `deleteOldEvents`                           |
| `visitor_events` (`event_type='visit'` فقط) | 7      | `deleteOldVisitorEvents` (إضافة هذه الدورة) |
| `settings_audit_log`                        | 180    | `deleteOldAuditLog` (إضافة هذه الدورة)      |
| `user_sessions` (منتهية)                    | —      | `deleteExpiredSessions` (موجود مسبقاً)      |

> تُستثنى رسائل الزوار (`visitor_events.event_type='request'`) من التنظيف
> عمداً — فهي اتصال مستخدم يعرضه الأدمن ويردّ عليه، وليست سجل تتبع.

---

## 7. إزالة التكرارات (Migrations)

### `006_admin_actions_as_system_events.sql`

يعيد تصنيف أحداث الأدمن القديمة (`user_login`, `logout`, `create_user`,
`update_user`, `delete_user`, `block_user`, `unblock_user`, `grant_admin`,
`revoke_admin`) من `user` إلى `system` للأدمنين الحاليين. Idempotent.

### `007_drop_user_creation_trigger.sql`

يسقط `log_user_creation` (كان يُدرج `user_created` تلقائياً عند كل INSERT في
`users`). الإنشاء يُسجَّل الآن صراحةً في الكود:

- `create_user` → أحداث نظام (إدارة الأدمن)
- `register` → أحداث مستخدمين (تسجيل ذاتي)

### `008_drop_login_success_trigger.sql`

يسقط `log_user_login` ويحذف صفوف `login_success` التاريخية من
`security_events`. السبب: تسجيل الدخول الناجح مُتبَّع أصلًا في `activities`
كـ `user_login`، فكان `login_success` تكراراً بلا قيمة أمنية. تبقى القيمة
الأمنية الحقيقية في `login_failed` و`user_blocked`/`user_unblocked` (تُسجَّل
عبر `SecurityEventRepository` وليس عبر trigger).

---

## 8. خرائط التسمية العربية (UI)

`ACTION_LABELS` في `events-page.tsx` تغطي: إدارة المستخدمين، عمليات
المكتبة/الوسائط، قاعدة البيانات، الماسح. `SECURITY_LABELS` تغطي
`login_success` / `login_failed` / `user_blocked` / `user_unblocked`. أي
إجراء جديد يجب أن يضيف تسمية هنا (fallback: استبدال `_` بمسافة).

---

## 9. حدود معروفة (Known Gaps)

- أسماء المستخدمين الذين نفّذوا عمليات المكتبة/الوسائط/قاعدة البيانات غير
  مخزّنة (يُسجَّل الحدث بفئة `system` دون `user_id`) لأن طبقة الـ controllers
  لا تمرّر المُنفِّذ بعد — متاح كتحسين مستقبلي عبر threading للسياق.
- إعادة ترتيب `db_restore` تُسجَّل داخل الملف المستعاد نفسه (يظهر بعد إعادة
  التشغيل)، و`db_factory_reset` بلا أثر داخل القاعدة — قيود أصلية للعمليات.
- `settings_audit_log` غير معروض في صفحة الأحداث (قناته الخاصة في إعدادات
  الأدمن).
