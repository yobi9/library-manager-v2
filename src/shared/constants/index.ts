/**
 * [Domain] هوية المنتج الرسمية (Official Product Name).
 *
 * - الغرض: الاسم التجاري/التقني الموحّد للمنتج "Youbi" — immutable product
 *   identity يُستخدم كـ fallback في كل الأسطح (metadata، الترويسة، التذييل،
 *   تسجيل الدخول، الشروط).
 * - مصدر الحقيقة: هذا الملف فقط؛ أي اسم آخر مكرر في الكود يُعدّ خرقاً للقاعدة.
 * - النطاق: العرض النصي العام والإداري؛ لا يشمل أسماء الخدمات أو الحزم التقنية
 *   (package.json / خدمة Windows) التي تُدار من سكربتات الإصدار والمثبّت.
 * - الحدود: هذا ليس Customer Branding — اسم الموقع الخاص بالعميل يأتي من
 *   إعداد `site_title` ويبقى منفصلاً تماماً عن هنا.
 */
export const APP_NAME = "Youbi";
export const APP_DESCRIPTION = "منصة بث الوسائط";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
    NEW: "/new", // <-- إضافة هذا السطر
  ITEMS: "/items",
  ITEM_VIEW: (type: string, id: string) => `/itemView/${type}/${id}`,
  PLAYER: (id: string) => `/player/${id}`,
  ALBUM_PLAYER: (id: string) => `/itemView/singer/${id}`,

  SECTIONS: "/sections",
  GENRE: "/genre",

  GENRE_ITEMS: (slug: string) => `/genre/${slug}`,
  PERSON: "/person",
  PERSON_ITEMS: (id: string) => `/person/${id}`,
  YEAR: "/year",
  YEAR_ITEMS: (year: string) => `/year/${year}`,
  CERTIFICATION: "/certification",
  CERTIFICATION_ITEMS: (cert: string) => `/certification/${encodeURIComponent(cert)}`,
  RATING: "/rating",
  RATING_ITEMS: (value: number) => `/rating/${value}`,
  LIVE_STREAM: "/liveStream",
  WATCH_LATER: "/watch-later",

  // المسارات الإدارية
  ADMIN: "/admin",
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_EVENTS: "/admin/events",
  ADMIN_PROCESSES: "/admin/processes",
  ADMIN_SETTINGS: "/admin/settings",
  ADMIN_LIVE_STREAM: "/admin/live-stream",
  ADMIN_LIBRARIES: "/admin/libraries",
  ADMIN_MEDIA: "/admin/items-control",
  ADMIN_EXCLUSIVE: "/admin/exclusive",
  ADMIN_PARENTAL: "/admin/parental",
  ADMIN_NEWS: "/admin/news",
  ADMIN_MESSAGES: "/admin/messages",
  ADMIN_USERS: "/admin/users",
  ADMIN_REQUESTS: "/admin/requests",
  ADMIN_REPORTS: "/admin/reports",
  ADMIN_UPLOAD: "/admin/upload",
  ADMIN_DATABASE: "/admin/database",
  ADMIN_LICENSE: "/admin/license",
  ADMIN_TERMS: "/admin/terms",
  ADMIN_HELP: "/admin/help",
  ADMIN_SUBSCRIPTION: "/admin/subscription",
} as const;

/**
 * [Domain] المسارات الاحتياطية الافتراضية لصور الوسائط (Placeholders).
 *
 * - الغرض: بديل عرض مرن في واجهة العميل حين تتعذر الصورة الأصلية (مسار قديم،
 *   ملف مفقود، أو غياب صورة مخصّبة) بدل عرض صورة مكسورة.
 * - مصدر الحقيقة: تطابق ملفات SVG داخل `public/assets/images/placeholders`،
 *   وهي نفس القاعدة المستخدمة في طبقة الخادم (`image-service.ts`) عبر إعداد
 *   `image_placeholder_dir` — عقد مسار موحّد بين العميل والخادم.
 * - النطاق: الاستخدامات الاحتياطية في العميل فقط (library-card، section-card،
 *   search-modal). مسار صور العناصر التفصيلي يعتمد على `/api/images/{id}`
 *   مع بديل من الخادم ولا يمرّ من هنا.
 * - الاكتمال: القائمة كاملة (5 أنواع) ومطابقة لخطة إعادة هيكلة الصور
 *   `docs/plans/image-system-refactor-plan.md`.
 */
export const DEFAULT_IMAGES = {
  POSTER: "/assets/images/placeholders/poster.svg",
  BACKDROP: "/assets/images/placeholders/backdrop.svg",
  LIBRARY: "/assets/images/placeholders/library.svg",
  PERSON: "/assets/images/placeholders/person.svg",
  STILL: "/assets/images/placeholders/still.svg",
} as const;
