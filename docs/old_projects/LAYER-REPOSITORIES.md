# LAYER-REPOSITORIES — طبقة الـ Repositories (Data Access Layer)

> **الغرض:** توثيق طبقة الـ Repositories — طبقة الوصول الوحيدة لقاعدة البيانات،
> نمط `BaseRepository`، عقد الـ pagination الموحّد، والمشاكل المؤكدة.
> كل ما هنا مثبّت من قراءة الكود الفعلي.

---

## 1. الوضع الحالي (Current State)

### الموقع والحجم

- المجلد: `src/backend/repositories/` — **24 ملفاً** (23 Repository + `index.ts`).
- القائمة الفعلية: `activity, ads, dashboard, database, enrichment, enrichment-media,
  image, library, media, messages, news, progress, report, search, security, session,
  settings, snapshot, store-products, translation-cache, user, visitor` +
  `base-repository.ts` + `index.ts`.

### القاعدة المعمارية

- **كل الوصول إلى الـ DB يتم عبر Repository فقط.** لا تستورد Services/Controllers
  قاعدة البيانات مباشرة (مبدأ Data Access).
- الاستثناءات الوحيدة هي Repositories متخصصة لا ترث `BaseRepository` ولا تحتاج
  `this.tableName` (مثل `DashboardRepository`، `DatabaseRepository`، `ImageRepository`).

### نمط `BaseRepository` (`base-repository.ts:96`)

- طرق عامة مغلفة للقراءة/الكتابة:
  - `all(sql, params)` (`:304`)، `get(sql, params)` (`:309`)، `execute(sql, params)` (`:312`).
  - مساعدات ترث `this.tableName`: `findAll(limit)` (`:219`)، `findById` (`:224`)،
    `findByField` (`:234`)، `insert` (`:250`)...
  - Pagination: `paginate(col, order, limit, offset)` (`:327`) و
    `paginateWhere(field, ...)` (`:356-360`).
- **حماية حقن SQL عبر sanitize** (مثال موثق): `:296-300` يفرض `ORDER BY` على
  اسم عمود نظيف (`/ORDER BY\s+([\w.]+)/i`) عند بناء SQL ديناميكي — لا يقبل أي سلسلة
  مفتوحة.
- `getDb()` (`:205`) يستدعي `db.ts` ويوفر اتصالاً بقاعدة WAL.

### عقد الـ pagination الموحّد (Single Source of Truth)

- `getMediaByFilter` في `media-repository.ts:497` — المعاملات: `page, limit, year,
  genre, certification, minRating, excludeTypes (:507), ...`؛ بناء `excludeTypes`
  بـ `NOT IN (...)` عبر `?` placeholder (`:534-536`)؛ الاستعلام `ORDER BY ... LIMIT ?
  OFFSET ?` (`:583`) مع حساب `hasMore`:
  ```
  hasMore: offset + items.length < countRow.count   (:592)
  ```
  والعائد: `{ items, total, page, limit, hasMore }` (موثق في `:492-495`).
- هذا العقد هو **العقد الوحيد** الذي تتبنّاه الـ Routes والـ Frontend للقوائم
  (استهلاكه في `media/route.ts:35` و`use-admin-media.ts:95-96`).

### أمثلة عقود مؤكدة أخرى

- `getLatest(type, limit)` — `ORDER BY created_at DESC LIMIT ?` (media-repository.ts:246-252).
- `getTypes()` — `SELECT DISTINCT type WHERE is_available = 1` (media-repository.ts:260).
- `getPinned()` — `WHERE is_pinned = 1 AND is_available = 1 ORDER BY sort_order` (:237).
- `getChildren(parentId)` — `WHERE parent_media_id = ? AND is_available = 1` (:402).
- `getGenres()` — عبر `media_genres` مع count (:198).
- `getPeople(limit)` — `ORDER BY name LIMIT ?` (:429).
- `getPersonWorks` / `getMediaPeople` (:681).
- `list` في كل من `ads-repository.ts:12-18` و`news-repository.ts:16` و
  `messages-repository.ts:14` و`store-products-repository.ts:13` — **كلها تدعم
  `LIMIT ? OFFSET ?`** لكن الـ Routes المقابلة لا تمررها (راجع API-02).
- `EnrichmentMediaRepository` — عقد `{ ids, total, hasMore }` محسوب بمعادل مماثل
  (enrichment-media-repository.ts:54-68) — يطابق نفس فكرة `hasMore`.

---

## 2. المشاكل المؤكدة (Confirmed Issues)

### REP-01 — تطابق عقد pagination مفقود بين Repositories وRoutes (Phase 1)

- الـ Repositories (ads/news/messages/store-products/reports) تدعم `LIMIT/OFFSET`
  فعلياً، لكن الـ Routes لا تمرّر `limit/offset` المستلمة من الـ Query String إليها
  (راجع API-02). **الخلل في الطبقة الوسطى (Routes/Controllers) وليس في الـ Repository.**
- **المرحلة:** Phase 1 — Functional Integrity.

### REP-02 — مسؤولية `excludeTypes` محمولة في Route وليس Service (Phase 5)

- القيمة الافتراضية `"season,episode,series_sports,series_deen"` مكتوبة في
  `media/route.ts:23-24` كـ getQueryParam default. الـ Repository يستقبلها جاهزة.
- **الملاحظة:** الافتراضيات ذات الدلالة يجب أن تعيش في الـ Service/Repository لا في
  الـ Route (تقليل تكررها مستقبلاً).
- **المرحلة:** Phase 5 — توثيقي/تنظيمي.

---

## 3. العقود المقدمة (Contracts Exposed)

- **مدخلات:** كائنات `params` أنواع صريحة (مثال: نوع `getMediaByFilter` في
  media-repository.ts:497-507) + مصفوفات بارامترات مُعلمة `?`.
- **مخرجات:** كائنات عادية (rows/objects) أو عقد pagination الموحّد `{items,total,
  page,limit,hasMore}` (أو `{ids,total,hasMore}` في EnrichmentMediaRepository).
- **الحدود:** لا تستدعي Repositories الـ Services ولا الـ Controllers — أحادي
  الاتجاه دائماً (أسفل).

---

## 4. ما يجب توثيقه قبل أي تعديل (Preconditions)

1. أي استعلام جديد يُمرّر عبر Repository (BaseRepository أو متخصص)، مع بارامترات
   معلمة وليس Concatenation.
2. `ORDER BY` الديناميكي يُبنى عبر آلية sanitize في base-repository.ts:296-300.
3. أي pagination جديدة يجب أن تعيد عقد `{items,total,page,limit,hasMore}` متسقاً —
   وليس `{rows,total}` (يرتبط بإصلاح API-02).
4. حدّث `LAYER-DB.md` عند تغيير أي جدول/عمود يتعامل معه Repository.
