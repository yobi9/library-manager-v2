/**
 * عنصر حصري (Hero) يُعرض في شريط المحتوى الحصري أعلى الصفحة الرئيسية.
 *
 * الغرض: إبراز عناصر مختارة من المكتبة في سلايدر ضخم. العنصر هو مرجع رفيع
 * لعنصر موجود في قاعدة البيانات عبر `media_id`، والحقول النصية التالية
 * (title/desc/image/...) هي نسخة احتياطية (fallback) تُستخدم في حال غياب
 * تفاصيل الـ API أو غياب الاتصال.
 *
 * مصدر الحقيقة: حقول `exclusive_items` في `PublicSettings` (src/lib/frontend/api-media.ts)
 * و `SettingsService.getPublicSettings()` (src/backend/services/settings-service.ts).
 *
 * النطاق: لا يشمل التفاصيل الكاملة للطاقم/الممثلين — الـ Viewer يجلبها حياً
 * عبر `GET /api/media/:id` عند الحاجة.
 *
 * القيود: `sort_order` هو فهرس العرض (0..n) ويُعاد حسابه عند كل إعادة ترتيب.
 */
export interface ExclusiveItem {
  /** معرّف فريد محلي للعنصر الحصري (ليس معرّف الوسيط). */
  id: string;
  /** معرّف الوسيط في المكتبة — المرجع الأساسي عند عرض التفاصيل الحية. */
  media_id?: number;
  /** عنوان العرض في الـ Hero. */
  title: string;
  /** وصف قصير يُعرض أسفل العنوان (fallback للـ overview). */
  desc?: string;
  /** رابط صورة بديلة (تُستخدم إن تعذّر توليد صورة من `media_id`). */
  image?: string;
  /** رابط تشغيل الفيديو (اختياري). */
  video_url?: string;
  /** رابط مخصص للتنقل عند النقر على "شاهد الآن" — الافتراضي `/itemView/<type>/<id>`. */
  href?: string;
  /** ترتيب العرض داخل الشريط — يعكس فهرس العنصر في القائمة. */
  sort_order: number;
  /** تقييم يدوي (1–5 نجوم) يُعرض في لوحة الإدارة. */
  rating?: number;
  /** وسوم تُعرض كـ Badges (تُملأ تلقائياً من genres عند اختيار وسيط). */
  tags?: string[];
  /** نوع الوسيط (movie/series/...) — يُستخدم لبناء رابط التنقل الافتراضي. */
  type?: string;
  /** سنة الإنتاج (fallback). */
  year?: number;
}

/**
 * بيانات نموذج إضافة/تعديل عنصر حصري كما تُجمع من `ExclusiveFormModal`.
 *
 * الغرض: عزل المدخلات القابلة للتحرير يدوياً عن الحقول المشتقة التي يملؤها
 * منتقي المكتبة تلقائياً (`media_id`, `type`, `year`).
 */
export interface ExclusiveItemFormData {
  title: string;
  desc: string;
  href: string;
  rating: number | null;
  tags: string[];
  video_url: string;
  image: string;
  media_id?: number;
  type?: string;
  year?: number;
}
