/**
 * أنواع المسلسلات المدعومة في النظام.
 * هذه القائمة مشتقة من تعريف الـ Backend `LibraryType` في
 * `src/backend/scanner/scanner-events.ts` و`ALLOWED_TYPES` في
 * `src/backend/services/library-service.ts` — الـ Backend هو مصدر الحقيقة للأنواع.
 */
export const SERIES_TYPES = [
  "series",
  "series_anime",
  "series_sports",
  "series_ramadan",
  "series_tv",
  "series_deen",
  "series_kids",
  "series_doc",
  
  "series_learn",
] as const;

export type SeriesType = (typeof SERIES_TYPES)[number];

/**
 * الأنواع الإنتاجية للمحتوى المعروضة في واجهة التحكم (سلسلة + فيلم + مسرحية).
 * تطابق المجموعة الإنتاجية في الـ Backend: أنواع `SERIES_TYPES` بالإضافة إلى
 * `movie` و`theater` (بدون أنواع المكتبات مثل `main`/`music`).
 */
export const CONTENT_TYPES = [...SERIES_TYPES, "movie", "theater"] as const;

/** نوع محتوى معروض في واجهة التحكم (سلسلة/فيلم/مسرحية). */
export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * يتحقق مما إذا كان النوع المعطى نوع سلسلة (series_*).
 *
 * @param type - قيمة نوع الوسائط المراد فحصها.
 * @returns `true` إذا كان النوع ضمن `SERIES_TYPES`، وإلا `false`.
 */
export function isSeriesType(type: string): type is SeriesType {
  return (SERIES_TYPES as readonly string[]).includes(type);
}
