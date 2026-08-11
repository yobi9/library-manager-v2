# LAYER-DB — طبقة قاعدة البيانات (Database Layer)

> **الغرض:** توثيق قاعدة البيانات — ملف الإعداد، الـ Schema (23 جدولاً)، الـ Migrations،
> العقود الصريحة للأعمدة/المفاتيح، والمشاكل المؤكدة في سلامة البيانات.
> كل ما هنا مثبّت من قراءة الكود الفعلي (`db.ts`, `schema.ts`, `migrations/001_initial_schema.sql`).

---

## 1. الوضع الحالي (Current State)

### الموقع والملفات

- `src/backend/db/db.ts` — إدارة الاتصال.
- `src/backend/db/schema.ts` — تعريفات TypeScript للجداول (23 Interface).
- `src/backend/db/migrations/001_initial_schema.sql` — الـ DDL الفعلي (630 سطراً).
- متغير البيئة: `DATABASE_URL=./data/media_library.db` (SQLite محلي).

### إعداد الاتصال (`db.ts`)

- WAL mode: `PRAGMA journal_mode = WAL;` (`:255`).
- مهلة الانشغال: `PRAGMA busy_timeout = 3000;` (`:257`) — **3 ثوانٍ** (خفّضت من 15s
  في 2026-08-09: أي طلب محظور كان ينتظر حتى 15s في قائمة الاتصال الواحد؛ مع فصل
  اتصال الكتابة (أدناه) توقف القراءات عن الاصطفاف خلف الماسح أصلاً).
- **Auto-Retry على SQLITE_BUSY** حتى 3 مرات مع تأخير تصاعدي (100→200→400ms، `:64-66`).
- أي مهندس يضيف استعلاماً متزامناً يجب أن يتوقع وجود إعادة المحاولة تلقائياً.

### اتصال الكتابة المنفصل للماسح (Writer Connection)

> أُضيف 2026-08-09 (P2 — فصل اتصال الماسح). الهدف: ألا ينتظر الماسح (الكاتب
> الأثقل) والقراءات العادية على **اتصال واحد**، فيزاح كل الضغط إلى اتصال مستقل.

- `initializeWriterDatabase()` (`:303`) / `getWriterDatabase()` (`:322`) — اتصال
  SQLite **ثانٍ لنفس الملف** (WAL: كاتب واحد + قرّاء متزامنون دون انتظار).
- `runInWriterContext(fn)` (`:341`) — عبر `AsyncLocalStorage` (`writerContext`, `:20`):
  أي استدعاء `getDatabase()` داخل سياقه يعيد **اتصال الكتابة** تلقائياً دون تعديل
  أي repository. **مسار متزامن** عندما يكون الاتصال مفتوحاً أصلاً (لا إرجاء
  مايكروتاسك — يحفظ «عقد البداية المتزامنة» لاختبارات الـ walker).
- `getDatabase()` (`:347`) يفحص سياق الكتابة أولاً ثم يقع على الاتصال الرئيسي.
- `closeDatabase()` (`:363`) يغلق **الاتصالين** معاً (مسار backup-restore).
- `openDatabase()` (`:228`) مساعد موحّد يشغّل الهجرات عند الطلب — **إلزامي**
  لاتصال الكتابة: في وضع `:memory:` كل اتصال قاعدة مستقلة، فيجب أن يملك كلاهما
  المخطط كاملاً.
- **الذاكرة المشتركة في الاختبارات:** في `:memory:` تُفتح الاتصالات عبر URI مشترك
  (`file:library_manager_shared?mode=memory&cache=shared`, `SHARED_MEMORY_URI` `:234`)
  مع `OPEN_URI` — اتصالا الرئيسي والكاتب يتشاركان قاعدة واحدة تماماً كملف الإنتاج
  (بدون ذلك كان اتصال الكاتب «فارغاً» ولا يرى صفوف الاختبار المحقونة).
- **قفل الاستبعاد** `withExclusiveTransaction` (`:110`) — يضمن معاملة SAVEPOINT
  واحدة على الاتصال (تفاصيله في LAYER-SCANNER).

### هيكل الجداول (23 جدولاً — مصدر الحقيقة: `001_initial_schema.sql`)

| #   | الجدول                                                      | السطر | ملاحظات                           |
| --- | ----------------------------------------------------------- | ----- | --------------------------------- |
| 1   | `users`                                                     | 12    |                                   |
| 2   | `user_sessions`                                             | 47    |                                   |
| 3   | `libraries`                                                 | 69    |                                   |
| 4   | `media_items`                                               | 103   | أضيفت أعمدة في migrations 016/019 |
| 5   | `media_files`                                               | 188   | `ON DELETE CASCADE` على media_id  |
| 6   | `media_genres`                                              | 217   |                                   |
| 7   | `media_people`                                              | 230   |                                   |
| 8   | `library_snapshots`                                         | 270   |                                   |
| 9   | `settings`                                                  | 292   |                                   |
| 10  | `settings_audit_log`                                        | 312   |                                   |
| 11  | `translation_cache`                                         | 327   |                                   |
| 12  | `activities`                                                | 340   |                                   |
| 13  | `security_events`                                           | 372   |                                   |
| 14  | `pending_enrichment_approvals`                              | 398   |                                   |
| 15  | `user_progress`                                             | 415   |                                   |
| 16  | `media_genres` (مكرر؟) — الحقيقة: 16 هو `media_reports` 441 |       |                                   |
| 17  | `media_reports`                                             | 441   | CHECK على report_type/status      |
| 18  | `visitors`                                                  | 465   | rebuilt في 017                    |
| 19  | `visitor_events`                                            | 485   |                                   |
| 20  | `news`                                                      | 552   |                                   |
| 21  | `messages`                                                  | 571   |                                   |
| 22  | `ads`                                                       | 591   |                                   |
| 23  | `store_products`                                            | 613   |                                   |

> عدد الفهارس الرئيسية على `media_items` (001:171-183): library، type، year، tmdb_id،
> parent، directory_path، enriched، is_available، metadata_status،
> (parent_media_id, is_available)، dedup (library_id, type, normalized_title,
> parent_media_id)، (library_id, is_available)، (library_id, created_at DESC).

### أعمدة `media_items` الحرجة (مؤكدة)

- `enriched` (`schema.ts:92`، `001:124`) — `INTEGER DEFAULT 0` + فهرس `idx_media_items_enriched`.
- `is_leaf` (`schema.ts:104`، `001:136`) — `INTEGER DEFAULT 0`.
- `unavailable_since` / `unavailable_reason` / `last_seen_path` (`schema.ts:107-109`،
  `001:139-141`) — أساس نظام الـ availability.
- `media_files`/`library_snapshots` تحمل أيضاً `unavailable_since/unavailable_reason/
last_seen_path` (`schema.ts:150-152`، `001:200-202`).
- **لا يوجد جدول `channels`** في الـ Schema إطلاقاً — وحدة Live TV مستقبلية فقط.

### Constraints فريدة ملاحظة

- `media_reports.report_type` — `CHECK (report_type IN ('broken','abuse'))` (`001:443`).
- `media_reports.status` — `CHECK (status IN ('pending','resolved','dismissed'))` (`001:456`).
- الأعمدة الفعلية في `media_reports` (001:441-460): `report_id, report_type, media_id,
media_title, media_type, library_id, library_name, library_type, stream_url,
violation_type, description, device_id, ip_address, user_agent, status, resolved_at,
created_at` (و`report_id` المفتاح + FK على media_id).
- `schema.ts` يؤكد: `DbMediaReport` بامتداد `description` و`device_id` و
  `report_type: "broken" | "abuse"` و`status: "pending"|"resolved"|"dismissed"`
  (schema.ts:290-308).

---

## 2. المشاكل المؤكدة (Confirmed Issues)

### DB-01 — INSERT في `media_reports` لا يطابق الـ Schema (Phase 3 — Data Integrity)

- **المشكلة:** `report-repository.ts:16-17` ينفّذ:
  ```sql
  INSERT INTO media_reports (media_id, report_type, message, reporter_device_id, status, created_at)
  VALUES (?, ?, ?, ?, 'pending', datetime('now'))
  ```
  بينما الـ Schema الفعلي (001:441-460) يحتوي **`description`** و**`device_id`** — لا
  عمود باسم `message` ولا `reporter_device_id`.
- **الأثر المزدوج:**
  1. العمودان `message` و`reporter_device_id` غير موجودين → فشل INSERT عند إرسال تقرير
     (`SQLITE_ERROR: no such column`) — **ميزة البلاغات معطلة فعلياً**.
  2. القيمة الافتراضية `data.reportType ?? "general"` (report-repository.ts:20) تخالف
     `CHECK (report_type IN ('broken','abuse'))` → رفض إضافي حتى بعد إصلاح الأعمدة.
- **المرحلة:** **Phase 3 — Data Integrity (أولوية عالية).**
- **الاتجاه المقترح:** مطابقة INSERT مع الأعمدة الفعلية: `media_id, report_type,
description, device_id, status, created_at`، وتقييد `report_type` بالقيم الصالحة
  (broken/abuse) أو توسيع CHECK — مع تحديث `schema.ts` والـ Route/الـ hook معاً.

### DB-02 — تطابق بين `schema.ts` و`001` قد يزاح في migrations لاحقة (Phase 3)

- تمت إعادة بناء `media_items` في migration 016 وتعديلها في 019؛ `visitors` أُعيد
  بناؤها في 017 — أي كود يعتمد على `schema.ts` وحدها قد يفقد تعديلات الـ migrations
  اللاحقة.
- **المرحلة:** Phase 3 — تحقق دوري (Migration drift check).

### DB-03 — عمود واحد `normalized_title` يُستخدم في `idx_media_dedup` (Phase 5)

- `idx_media_dedup ON media_items(library_id, type, normalized_title, parent_media_id)`
  (001:181) — بافتراض عدم تطبيع متسق للعناوين العربية (تشكيل/ألف مقصورة) قد يسمح
  بتكرار عناوين متشابهة بصرياً.
- **المرحلة:** Phase 5 — Secondary Improvements (بحاجة قرار تطبيع).

---

## 3. العقود المقدمة (Contracts Exposed)

- **قاعدة:** لا تستورد الـ Repositories/الخدمات اتصالاً مباشراً خارج `db.ts` —
  مروراً عبر `BaseRepository.getDb()` (`base-repository.ts:205`).
- **الاتصال:** WAL + busy_timeout **3s** + auto-retry SQLITE_BUSY (db.ts:257, 64-66)؛
  اتصال كتابة منفصل للماسح عبر `runInWriterContext` (db.ts:341).
- **الفهارس:** متوفرة على كافة مفاتيح الاستعلامات المعروفة (راجع القائمة في §1).

---

## 4. ما يجب توثيقه قبل أي تعديل (Preconditions)

1. أي تغيير Schema جديد يُضاف كـ migration جديدة (رقم تالي) وليس تعديلاً على 001
   (الـ 001 غير قابل لإعادة الكتابة للبيئات المنشورة).
2. حدّث `schema.ts` بالتوازي مع الـ migration، وأعد التحقق من تطابق الأعمدة
   (درس DB-01).
3. أي CHECK constraint جديد يُراجع مع عقود الـ Repositories (report_type/broken-abuse).
4. أدرج أي جدول جديد في الجدول 23-فهرس هذا الملف مع رقم السطر في 001.
